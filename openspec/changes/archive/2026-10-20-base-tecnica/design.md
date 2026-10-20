# Design

## Context

Decisiones de arquitectura en `docs/arquitectura.md`: estructura (sección 2), Fastify (sección 3), eventos con pg-boss (sección 4) y consistencia (sección 5). Este change las materializa sin reglas de negocio.

## Goals / Non-Goals

**Goals:**
- Probar con tests de integración las tres garantías del bus: rollback ⇒ sin evento; fan-out a todos los suscriptores; fallo del handler ⇒ reintento sin efecto duplicado.
- Dejar una plantilla de contexto que los demás changes copien.

**Non-Goals:**
- Adaptador NATS (solo el puerto lo permite).
- Observabilidad completa: logger estructurado sí; métricas y trazas, cuando haya tráfico real.

## Decisions

- **Transacción como parámetro explícito:** `EventBus.publish(event, { tx })` recibe la transacción de Kysely, envuelta como `Db` de pg-boss. Alternativa descartada: una transacción implícita por contexto async (AsyncLocalStorage), porque oculta qué escrituras son atómicas, que es justo lo que un agente tiene que ver.
- **Idempotencia con inbox, no con workers transaccionales de pg-boss** (cambio respecto al plan inicial): el worker transaccional abre su propia transacción con el cliente de pg-boss, no una de Kysely, así que los handlers no podrían usar los repositorios de los contextos. En su lugar, el handler corre en una transacción de Kysely junto con un `insert` en `inbox (subscriber, event_id)`; si el evento ya estaba, se descarta. Cubre también la entrega doble y sigue valiendo con cualquier broker.
- **Sondeo de respaldo cada 5 s:** con LISTEN/NOTIFY los jobs inmediatos llegan al instante, pero los reintentos (programados a futuro) no generan aviso y por defecto esperaban hasta 30 s.
- **Un queue por suscriptor**, llamado `<tópico>__<contexto-consumidor>`. Así cada contexto reintenta y hace dead-letter de forma independiente.
- **Bus en memoria solo para unit tests:** vive en `packages/kernel` como implementación de prueba del puerto, nunca se monta en `apps/api`.
- **`packages/postgres`** agrupa la infraestructura compartida por la API y los tests de todos los contextos: conexión, migraciones (de plataforma y de cada contexto, en `contexts/<ctx>/server/migrations`), el adaptador del bus y el harness de Testcontainers (`@lo-mio/postgres/testing`).
- **zod permitido en `kernel`:** el sobre de eventos necesita su schema y zod es validación pura que corre en Node, React Native y web. `domain/` sigue sin librerías.
- **Tests de integración como `*.int.test.ts`** en un proyecto de Vitest aparte (`pnpm test:int`): requieren Docker, así que no corren en pre-commit ni pre-push.
- **Migraciones en SQL plano** con un runner mínimo (tabla `schema_migrations`). pg-boss maneja su propio esquema.
- **Variables de entorno validadas con zod** al arranque; si falta una, el proceso no arranca.

## Risks / Trade-offs

- **[Testcontainers en CI]** → Requiere Docker en el runner (disponible en `ubuntu-latest`). Localmente hay que tener Docker corriendo para los tests de integración, pero el pre-commit no los corre.
- **[pg-boss no cumple las garantías]** → Es lo que este change verifica primero (tarea 2.2). Si falla, se evalúa un outbox propio antes de seguir.
