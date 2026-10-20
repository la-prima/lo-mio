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
- **Un queue por suscriptor**, llamado `<tópico>__<contexto-consumidor>`. Así cada contexto reintenta y hace dead-letter de forma independiente.
- **Bus en memoria solo para unit tests:** vive en `packages/kernel` como implementación de prueba del puerto, nunca se monta en `apps/api`.
- **Migraciones en SQL plano** con un runner mínimo (tabla `schema_migrations`). pg-boss maneja su propio esquema.
- **Variables de entorno validadas con zod** al arranque; si falta una, el proceso no arranca.

## Risks / Trade-offs

- **[Testcontainers en CI]** → Requiere Docker en el runner (disponible en `ubuntu-latest`). Localmente hay que tener Docker corriendo para los tests de integración, pero el pre-commit no los corre.
- **[pg-boss no cumple las garantías]** → Es lo que este change verifica primero (tarea 2.2). Si falla, se evalúa un outbox propio antes de seguir.
