# Arquitectura de lo-mio

Decisiones transversales que aplican a todos los changes. Cada change documenta en su propio `design.md` solo las decisiones de su feature y referencia este archivo. **Para cambiar algo aquí, primero hay que abrir un change de OpenSpec que lo justifique.**

## Restricciones que dan forma al diseño

- Habrá apps móviles nativas (iOS y Android) para el personal, y a futuro para comensales frecuentes.
- El comensal casual entra por QR y **no instala nada**: su superficie es web, liviana, en 4G.
- Los meseros trabajan con wifi irregular y no pueden perder acciones.
- Todo lo que mueve dinero tiene que ser auditable y reconstruible.
- El monolito tiene que poder partirse en servicios más adelante sin reescribir el dominio.
- Producción corre en **Kubernetes administrado** (proveedor a elegir en `despliegue-piloto`).

## Objetivos

- Contextos de negocio (DDD) con límites que se verifican automáticamente, iguales en back y front.
- Comunicación entre contextos solo por eventos asíncronos versionados y contratos públicos, para que separar un contexto en un servicio sea cambiar el transporte y no el código.
- Que el dominio de cada contexto se pueda probar completo sin base de datos ni red, y que se reutilice en el front.
- Que agregar un POS nuevo sea agregar un adaptador que pase la suite del contrato.

**No objetivos (por ahora):** microservicios, broker de mensajes, event sourcing en todas las entidades, multi-región.

## Decisiones

### 1. Contextos acotados (DDD)

| Contexto | Specs | Responsabilidad | Agregados |
|---|---|---|---|
| `venues` | venue-config | Local, mesas, QR, catálogo manual, configuración y herencia | Venue, Table |
| `staff` | staff-access | Personal, roles, sesiones, PIN | StaffMember |
| `tables` | table-session, guest-identity | Sesión de mesa, comensales, identificadores físicos, transferencia de cuenta | TableSession, Credential |
| `claims` | item-claims | Ítems de la mesa y su asignación (reclamos, repartos, reasignaciones, overrides) | TabItem |
| `pos` | pos-integration | Capa anticorrupción: traduce cada POS a eventos propios | PosConnection |
| `settlement` | settlement | Saldos, pagos y comprobantes | GuestAccount, Payment |

`tables` agrupa dos specs porque cambian juntas: un comensal no existe fuera de una sesión. Separarlas forzaría eventos entre dos contextos que siempre se despliegan juntos.

### 2. Estructura del monorepo: un paquete por contexto

```
packages/
  kernel/          Shared kernel: Money, splitAmount, Id (UUIDv7), Result, EventEnvelope, puerto EventBus
  client/          Cliente HTTP tipado + hooks de TanStack Query; lo usan mobile y guest-web
contexts/<ctx>/    Un paquete por contexto, con subpaths:
  domain/          agregados, eventos de dominio, reglas puras (sin IO, sin librerías)
  contracts/       API pública: openapi.yaml + asyncapi.yaml (fuente de verdad) y generated/ (zod y tipos generados)
  server/          casos de uso, repositorios (Kysely), rutas Fastify, handlers de eventos
apps/
  api/             composition root: monta el server/ de cada contexto, el bus y los workers
  mobile/          Expo (iOS + Android): una app, superficies por rol; src/features/<ctx>/
  guest-web/       React DOM + Vite, solo comensal; src/features/<ctx>/
```

Límites que verifica `tests/architecture.test.ts` (corre en pre-commit):
- `domain/` solo importa su propio dominio y `kernel`.
- Un contexto solo importa de otro su `contracts/`.
- Solo `apps/api` importa capas `server/`.
- Los fronts no importan librerías de servidor y las apps no se importan entre sí.

**Por qué 1 paquete por contexto y no 3:** con subpaths se logran los mismos límites con 6 `package.json` en vez de 18. Para extraer un contexto como servicio, se toma el paquete y se le da un `apps/<ctx>-service` propio que monte solo su `server/`.

**Front estructurado igual:** `src/features/<ctx>/` en cada app front, usando `domain/` (por ejemplo, para calcular saldos de forma optimista sin red) y `contracts/` (validación de formularios con los mismos schemas que el back).

### 3. API: Fastify

Elegido contra Hono y NestJS con estos criterios: completitud, estabilidad, seguridad, cadencia y rendimiento. Datos al 2026-10-19:

| | Fastify | Hono | NestJS |
|---|---|---|---|
| Gobernanza | OpenJS Foundation, 25 contribuyentes con ≥20 commits | 8 contribuyentes con ≥20 commits | 21; empresa detrás |
| Soporte | LTS escrita: cada major ≥6 meses + 6 meses de parches de seguridad tras el siguiente; soporte comercial EOL vía OpenJS/HeroDevs | Sin política LTS publicada; v5 en RC | Sí |
| Advisories (12 meses) | 13 (6 altas) | 46 (6 altas) | 9 (7 altas) |
| Seguridad oficial | Plugins del core: helmet, rate-limit, cors, cookie, csrf-protection, multipart, websocket | Middlewares propios (la mayoría de sus advisories) | Sobre Express/Fastify |
| req/s Node 24 (GET / POST) | 91,5k / 72,7k | 88,8k / 62,9k | overhead de DI |
| Encaje | Total | Total | Usa decoradores legacy, incompatibles con el type stripping de Node y con TS 7 |

Fastify además valida y serializa con JSON Schema compilado (rendimiento y protección contra datos extra en la respuesta). Con `fastify-type-provider-zod`, los schemas de `contracts/` son la validación de la ruta y el tipo del cliente, sin codegen. El benchmark lo mantiene el equipo de Fastify (sesgo posible) y lo validamos con nuestras pruebas k6 (sección 9).

**Fijación de versión:** usar el último major con soporte vigente. Cuando salga Fastify 6 estable, migrar dentro de su ventana de 6 meses.

### 4. Eventos asíncronos sin broker: pg-boss detrás de un puerto

- **Puerto:** `EventBus` en `kernel` (`publish(event, { tx })` y `subscribe(topic, handler)`). Ningún contexto conoce pg-boss.
- **Adaptador MVP:** [pg-boss](https://github.com/timgit/pg-boss) sobre el mismo Postgres.
  - `publish` dentro de la transacción del cambio de negocio: outbox nativo, sin eventos perdidos ni fantasmas.
  - Pub/sub con un queue por suscriptor: fan-out por tópico.
  - Idempotencia con tabla `inbox`: el handler corre en una transacción de Kysely junto con el registro (suscriptor, `event.id`); un evento repetido se descarta. Se eligió en vez de los workers transaccionales de pg-boss porque esos abren su propia transacción (no de Kysely) y porque el inbox sigue valiendo con cualquier broker.
  - LISTEN/NOTIFY para entrega inmediata; los reintentos (programados a futuro) los recoge un sondeo cada 5 s.
  - Reintentos con backoff y dead-letter.
- **Sobre de evento** (`EventEnvelope`, inspirado en CloudEvents): `id` (UUIDv7), `type`, `version`, `venueId`, `aggregateId`, `occurredAt`, `correlationId`, `causationId`, `data`.
- **Tópicos:** `<contexto>.<agregado>.<hecho-en-pasado>.v<n>`, ej. `claims.item.claimed.v1`. El schema de cada evento vive en el `contracts/` del contexto que lo emite. Un cambio incompatible es una versión nueva, y se publican ambas mientras haya consumidores de la anterior.
- **Consumidores idempotentes** por `event.id`, garantizado por el inbox del adaptador.
- **Migración futura:** un adaptador `EventBus` para NATS JetStream (u otro) con los mismos tópicos. pg-boss queda solo como outbox relay.

**Alternativas descartadas:**
- NATS desde ya: otro servidor que operar sin necesidad medida.
- Un EventEmitter en memoria: pierde eventos si el proceso cae y no se parece a un broker real.
- Outbox hecho a mano: es lo que pg-boss ya resuelve y prueba.

### 5. Consistencia: síncrono dentro del agregado, eventual entre contextos

- Un comando modifica **un agregado** en una transacción con control optimista (`version`). Así se resuelven el reclamo simultáneo y la doble apertura de la mesa.
- `claims` guarda sus cambios como **eventos de dominio inmutables** (la auditoría que exige la spec) y una proyección del estado vigente, calculada por una función pura de `claims/domain`.
- Entre contextos, todo es eventual. Casos donde importa:
  - **Pago vs. saldo:** `settlement` mantiene su propia proyección del saldo con los eventos de `claims`. El comando de pago lleva la versión de saldo que vio el mesero; si cambió, se rechaza y se muestra el saldo actualizado. Nunca se cobra sobre un saldo viejo.
  - **Cierre de mesa:** es una *saga* en `tables`. Pide el cierre, espera `claims.session.all-items-owned.v1` y `settlement.session.balances-cleared.v1`, y cierra. Si algo cambia en el medio, se cancela y se avisa.
  - **Ítem del POS:** `pos` publica `pos.item.received.v1` y `claims` lo convierte en un ítem "sin dueño".
- Latencia esperada entre contextos: < 1 s p95 (pg-boss con LISTEN/NOTIFY). La UI muestra el estado "actualizando" cuando aplica.

### 6. Tiempo real hacia los clientes: WebSocket

Un gateway en `apps/api` se suscribe a los eventos relevantes y los reenvía por WebSocket (`@fastify/websocket`) a los clientes de cada sesión de mesa. Los clientes guardan el último `event.id` visto y, al reconectar, piden lo que se perdieron.

**Por qué WebSocket y no SSE:** React Native trae WebSocket nativo, pero no tiene soporte confiable de streaming `fetch` para SSE. Un solo protocolo para la web y la app.

Con varias instancias de la API, cada una recibe los eventos por pg-boss (fan-out), así que no hace falta Redis.

### 7. Frontends

- **`apps/mobile` (Expo, React Native):** una app en las tiendas con superficies por rol. El comensal frecuente entra sin login y el personal (mesero, encargado, admin) inicia sesión. Expo Router, development builds (no Expo Go, por el NFC) y EAS Build/Update.
- **`apps/guest-web` (React DOM + Vite):** solo comensal casual que entra por QR. Presupuesto: < 150 KB gzip en la carga inicial, verificado en CI.
- **Compartido** (en `packages/client` y los `contracts/` y `domain/` de cada contexto): cliente de API, hooks de datos, validaciones, reglas de saldo y reparto. **No se comparte UI**: cada front usa sus primitivas (RN vs DOM). Es el costo aceptado de mantener la web liviana.

### 8. Offline del mesero

Cada acción del personal se encola en SQLite (`expo-sqlite`) con una `idempotencyKey` (UUIDv7) y se envía cuando vuelve la red. La API guarda la clave con restricción `UNIQUE`: un reintento devuelve el resultado original. La misma clave viaja como `causationId` de los eventos que genera. El envío idempotente de pedidos al POS reutiliza el mismo mecanismo. El comensal web no tiene modo offline: sin red ve el último estado y un aviso.

### 9. Objetivos de carga y failover

| Métrica | Objetivo |
|---|---|
| Escenario base | 200 locales × 30 mesas × 6 comensales conectados ≈ 36 000 WebSockets |
| API p95 | < 300 ms con 200 req/s sostenidos |
| Reclamo → feed de los demás | p95 < 2 s (la spec exige < 5 s) |
| Evento entre contextos | p95 < 1 s |
| Failover | Muere una instancia de la API: 0 comandos o eventos perdidos o duplicados; WebSocket reconecta en < 10 s. Reinicio de la DB: los comandos encolados en el dispositivo se aplican al volver. |

Los escenarios k6 y de caos viven en `load/` y corren cada noche contra un clúster kind efímero con el mismo chart (sección 11).

### 10. Pruebas end-to-end

- **`guest-web`:** Playwright con Chromium, Firefox, WebKit, Pixel 7 e iPhone 15. En cada PR, Chromium y Pixel; la matriz completa cada noche.
- **`mobile`:** [Maestro](https://maestro.dev) sobre emuladores Android e iOS (flujos en YAML, más estables que Detox para un equipo de agentes). Android en cada PR (Linux), iOS cada noche (runner macOS).
- **Flujos críticos multiusuario:** mesero en mobile y 3 comensales en guest-web sobre la misma mesa.
- **Eventos:** las pruebas de integración de cada contexto publican los eventos de entrada y verifican los de salida, sin depender de otros contextos.

### 11. Plataforma: contenedores, Helm y kind

- Todo componente desplegable (API y web del comensal) es una **imagen distroless sin root**, con sistema de archivos de solo lectura, desplegada con un **único Helm chart** (`deploy/helm/lo-mio`). Mismo chart en local, CI y producción; solo cambian los values.
- La entrada es **Gateway API** (Envoy Gateway) con TLS (cert-manager), igual que en producción.
- **Ambiente local:** kind (3 nodos, declarado con ctlptl) + Tilt. Postgres con **CloudNativePG** (primario + réplica), que reproduce el modelo de un Postgres administrado y permite probar failover. En producción se usa el Postgres administrado del proveedor.
- Migraciones como **Job de Helm** previo a cada despliegue.
- Los tests de integración siguen con Testcontainers (rápidos y aislados). kind es para probar el sistema desplegado.
- Detalle: change archivado [`plataforma-k8s`](../openspec/changes/archive/2026-10-20-plataforma-k8s/).

### 12. Contract-first

- **Los contratos son la fuente de verdad:** OpenAPI para HTTP y AsyncAPI para eventos, en `contexts/<ctx>/contracts/`. Los contratos de terceros (Fudo) van en `contracts/external/`.
- **Todo lo demás se deriva:**
  - schemas zod, tipos y cliente con hooks (`packages/client`), generados y commiteados, con verificación de drift en CI;
  - las rutas de Fastify (una ruta sin contrato no puede existir);
  - la validación del bus de eventos;
  - los mocks (Microcks, desde los ejemplos del contrato).
- **Pruebas desde el contrato:**
  - Schemathesis verifica la conformidad de la API contra su OpenAPI.
  - Playwright prueba los flujos funcionales usando el cliente generado.
- **Evidencias:** un reporte Allure por run, con jerarquía contexto → flujo de usuario → escenario → paso, y traces, videos y request/response adjuntos.
- Detalle: change archivado [`contratos-y-evidencias`](../openspec/changes/archive/2026-10-20-contratos-y-evidencias/).

## Reutilización (antes de escribir código)

- `splitAmount` (`kernel`) para todo reparto.
- Los schemas generados desde los contratos validan rutas (Fastify), formularios (ambos fronts) y eventos (bus).
- `packages/client` es el único cliente de API de ambos fronts.
- La cola idempotente (sección 8) también envía pedidos al POS.
- La lectura de cámara se usa para QR de mesa, tarjetas, timbre SII y voucher.

## Riesgos transversales

- **[Consistencia eventual confunde al usuario]** → Comandos con versión esperada, estado "actualizando" en la UI y saga de cierre (sección 5). Lo cubren e2e específicos.
- **[pg-boss como cuello de botella]** → Lo miden las pruebas de carga (sección 9). La salida es el adaptador NATS (sección 4), sin tocar los contextos.
- **[Dos fronts sin UI compartida]** → Duplicación acotada a componentes visuales; lógica, datos y validación son compartidos. Si la web crece, se evalúa react-native-web con el presupuesto de bundle como criterio.
- **[Publicación en tiendas]** → La revisión de Apple/Google agrega días. Para el piloto: TestFlight e internal testing de Play, y EAS Update para correcciones JS.
