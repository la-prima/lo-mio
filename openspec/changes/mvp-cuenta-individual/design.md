# Design

## Context

Repo nuevo con tooling de calidad (ver `AGENTS.md`) y un paquete, `packages/kernel`, que contiene `splitAmount`. Motivación y alcance: `proposal.md`. Comportamiento: `specs/`.

Restricciones que dan forma al diseño:
- El restaurante piloto usa **Fudo** y todavía no tenemos acceso a su API (está en solicitud).
- Habrá apps móviles nativas (iOS y Android) para el personal, y a futuro para comensales frecuentes.
- El comensal casual entra por QR y **no instala nada**: su superficie es web, liviana, en 4G.
- Los meseros trabajan con wifi irregular y no pueden perder acciones.
- Todo lo que mueve dinero tiene que ser auditable y reconstruible.
- El monolito tiene que poder partirse en servicios más adelante sin reescribir el dominio.

## Goals / Non-Goals

**Goals:**
- Contextos de negocio (DDD) con límites que se verifican automáticamente, iguales en back y front.
- Comunicación entre contextos solo por eventos asíncronos versionados y contratos públicos, para que separar un contexto en un servicio sea cambiar el transporte y no el código.
- Que el dominio de cada contexto se pueda probar completo sin base de datos ni red, y que se reutilice en el front.
- Que agregar un POS nuevo sea agregar un adaptador que pase la suite del contrato.

**Non-Goals:**
- Microservicios ni un broker de mensajes en el MVP.
- Event sourcing en todas las entidades (solo donde la auditoría lo exige, D5).
- Escala multi-región.

## Decisions

### D1. Contextos acotados (DDD)

| Contexto | Specs | Responsabilidad | Agregados |
|---|---|---|---|
| `venues` | venue-config | Local, mesas, QR, catálogo manual, configuración y herencia | Venue, Table |
| `staff` | staff-access | Personal, roles, sesiones, PIN | StaffMember |
| `tables` | table-session, guest-identity | Sesión de mesa, comensales, identificadores físicos, transferencia de cuenta | TableSession, Credential |
| `claims` | item-claims | Ítems de la mesa y su asignación (reclamos, repartos, reasignaciones, overrides) | TabItem |
| `pos` | pos-integration | Capa anticorrupción: traduce cada POS a eventos propios | PosConnection |
| `settlement` | settlement | Saldos, pagos y comprobantes | GuestAccount, Payment |

`tables` agrupa dos specs porque cambian juntas: un comensal no existe fuera de una sesión. Separarlas forzaría eventos entre dos contextos que siempre se despliegan juntos.

### D2. Estructura del monorepo: un paquete por contexto

```
packages/
  kernel/          Shared kernel: Money, splitAmount, Id (UUIDv7), Result, EventEnvelope, puerto EventBus
  client/          Cliente HTTP tipado + hooks de TanStack Query; lo usan mobile y guest-web
contexts/<ctx>/    Un paquete por contexto, con subpaths:
  domain/          agregados, eventos de dominio, reglas puras (sin IO, sin librerías)
  contracts/       API pública: comandos, queries y eventos de integración (schemas zod, versionados)
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

### D3. API: Fastify

Elegido contra Hono y NestJS con estos criterios: completitud, estabilidad, seguridad, cadencia y rendimiento. Datos al 2026-10-19:

| | Fastify | Hono | NestJS |
|---|---|---|---|
| Gobernanza | OpenJS Foundation, 25 contribuyentes con ≥20 commits | 8 contribuyentes con ≥20 commits | 21; empresa detrás |
| Soporte | LTS escrita: cada major ≥6 meses + 6 meses de parches de seguridad tras el siguiente; soporte comercial EOL vía OpenJS/HeroDevs | Sin política LTS publicada; v5 en RC | Sí |
| Advisories (12 meses) | 13 (6 altas) | 46 (6 altas) | 9 (7 altas) |
| Seguridad oficial | Plugins del core: helmet, rate-limit, cors, cookie, csrf-protection, multipart, websocket | Middlewares propios (la mayoría de sus advisories) | Sobre Express/Fastify |
| req/s Node 24 (GET / POST) | 91,5k / 72,7k | 88,8k / 62,9k | overhead de DI |
| Encaje | Total | Total | Usa decoradores legacy, incompatibles con el type stripping de Node y con TS 7 |

Fastify además valida y serializa con JSON Schema compilado (rendimiento y protección contra datos extra en la respuesta). Con `fastify-type-provider-zod`, los schemas de `contracts/` son la validación de la ruta y el tipo del cliente, sin codegen. El benchmark lo mantiene el equipo de Fastify (sesgo posible) y lo validamos con nuestras pruebas k6 (D12).

**Fijación de versión:** usar el último major con soporte vigente. Cuando salga Fastify 6 estable, migrar dentro de su ventana de 6 meses.

### D4. Eventos asíncronos sin broker: pg-boss detrás de un puerto

- **Puerto:** `EventBus` en `kernel` (`publish(event, { tx })` y `subscribe(topic, handler)`). Ningún contexto conoce pg-boss.
- **Adaptador MVP:** [pg-boss](https://github.com/timgit/pg-boss) sobre el mismo Postgres.
  - `publish` dentro de la transacción del cambio de negocio: outbox nativo, sin eventos perdidos ni fantasmas.
  - Pub/sub con un queue por suscriptor: fan-out por tópico.
  - Workers transaccionales: el efecto del handler y el *ack* se confirman juntos, sin doble procesamiento.
  - Reintentos con backoff y dead-letter.
- **Sobre de evento** (`EventEnvelope`, inspirado en CloudEvents): `id` (UUIDv7), `type`, `version`, `venueId`, `aggregateId`, `occurredAt`, `correlationId`, `causationId`, `data`.
- **Tópicos:** `<contexto>.<agregado>.<hecho-en-pasado>.v<n>`, ej. `claims.item.claimed.v1`. El schema de cada evento vive en el `contracts/` del contexto que lo emite. Un cambio incompatible es una versión nueva, y se publican ambas mientras haya consumidores de la anterior.
- **Consumidores idempotentes** por `event.id`, aunque el worker transaccional ya lo garantiza, para que la regla siga valiendo con NATS.
- **Migración futura:** un adaptador `EventBus` para NATS JetStream (u otro) con los mismos tópicos. pg-boss queda solo como outbox relay.

**Alternativas descartadas:**
- NATS desde ya: otro servidor que operar sin necesidad medida.
- Un EventEmitter en memoria: pierde eventos si el proceso cae y no se parece a un broker real.
- Outbox hecho a mano: es lo que pg-boss ya resuelve y prueba.

### D5. Consistencia: síncrono dentro del agregado, eventual entre contextos

- Un comando modifica **un agregado** en una transacción con control optimista (`version`). Así se resuelven el reclamo simultáneo y la doble apertura de la mesa.
- `claims` guarda sus cambios como **eventos de dominio inmutables** (la auditoría que exige la spec) y una proyección del estado vigente, calculada por una función pura de `claims/domain`.
- Entre contextos, todo es eventual. Casos donde importa:
  - **Pago vs. saldo:** `settlement` mantiene su propia proyección del saldo con los eventos de `claims`. El comando de pago lleva la versión de saldo que vio el mesero; si cambió, se rechaza y se muestra el saldo actualizado. Nunca se cobra sobre un saldo viejo.
  - **Cierre de mesa:** es una *saga* en `tables`. Pide el cierre, espera `claims.session.all-items-owned.v1` y `settlement.session.balances-cleared.v1`, y cierra. Si algo cambia en el medio, se cancela y se avisa.
  - **Ítem del POS:** `pos` publica `pos.item.received.v1` y `claims` lo convierte en un ítem "sin dueño".
- Latencia esperada entre contextos: < 1 s p95 (pg-boss con LISTEN/NOTIFY). La UI muestra el estado "actualizando" cuando aplica.

### D6. Tiempo real hacia los clientes: WebSocket

Un gateway en `apps/api` se suscribe a los eventos relevantes y los reenvía por WebSocket (`@fastify/websocket`) a los clientes de cada sesión de mesa. Los clientes guardan el último `event.id` visto y, al reconectar, piden lo que se perdieron.

**Por qué WebSocket y no SSE:** React Native trae WebSocket nativo, pero no tiene soporte confiable de streaming `fetch` para SSE. Un solo protocolo para la web y la app.

Con varias instancias de la API, cada una recibe los eventos por pg-boss (fan-out), así que no hace falta Redis.

### D7. Frontends

- **`apps/mobile` (Expo, React Native):** una app en las tiendas con superficies por rol. El comensal frecuente entra sin login y el personal (mesero, encargado, admin) inicia sesión. Expo Router, development builds (no Expo Go, por el NFC) y EAS Build/Update.
- **`apps/guest-web` (React DOM + Vite):** solo comensal casual que entra por QR. Presupuesto: < 150 KB gzip en la carga inicial, verificado en CI.
- **Compartido** (en `packages/client` y los `contracts/` y `domain/` de cada contexto): cliente de API, hooks de datos, validaciones, reglas de saldo y reparto. **No se comparte UI**: cada front usa sus primitivas (RN vs DOM). Es el costo aceptado de mantener la web liviana.

### D8. Offline del mesero

Cada acción del personal se encola en SQLite (`expo-sqlite`) con una `idempotencyKey` (UUIDv7) y se envía cuando vuelve la red. La API guarda la clave con restricción `UNIQUE`: un reintento devuelve el resultado original. La misma clave viaja como `causationId` de los eventos que genera. El envío idempotente de pedidos al POS reutiliza el mismo mecanismo. El comensal web no tiene modo offline: sin red ve el último estado y un aviso.

### D9. Identificación y lectura física

- **Comensal web:** cookie httpOnly, `SameSite=Lax`, ligada a la sesión de mesa.
- **Comensal en app:** token en `expo-secure-store`.
- **QR de mesa:** URL con un código aleatorio revocable (no el número de mesa).
- **Tarjeta / posavasos:** tag NFC NTAG213 con una URL y un código aleatorio de 128 bits, más el mismo código en QR impreso. El código se puede copiar. La seguridad está en que vincular o confirmar con un identificador físico lo hace siempre un mesero autenticado en su dispositivo.
- **Lectura en la app:** `react-native-nfc-manager` (Core NFC en iOS y NFC en Android) y la cámara con `expo-camera` para QR y PDF417. **Con app nativa, el NFC funciona también en iPhone.**

### D10. Comprobantes

- **Timbre SII:** el parser del `<TED>` (RUT emisor, tipo, folio, fecha, monto) vive en `settlement/domain`, es puro y se prueba con timbres reales anonimizados. No se valida la firma del SII en el MVP (`ponytail:` riesgo bajo, porque se escanea una boleta física impresa por el propio local).
- **Voucher:** foto y extracción del código de autorización con OCR en el dispositivo (ML Kit vía módulo Expo). Si falla, se ingresa a mano.
- **Fotos:** se suben directo al almacenamiento S3 con URLs prefirmadas, y la retención se aplica con una regla de ciclo de vida del bucket.

### D11. Integración Fudo y auth del personal

- **Fudo:** polling por local cada 10 s, solo con mesas abiertas, con backoff ante error. El adaptador traduce al contrato `PosAdapter` de `pos/domain`, y la deduplicación por `posItemId` vive en `pos/server`, compartida por todos los adaptadores. En pruebas se usa un fake de Fudo que pasa la misma suite de contrato.
- **Auth del personal:** usuario y contraseña con `scrypt` (`node:crypto`). La sesión es una cookie httpOnly en la web y un token en secure-store en la app. El PIN del encargado se guarda con el mismo hash y bloqueo por intentos. `@fastify/rate-limit` en los endpoints de login y PIN.

### D12. Objetivos de carga y failover

| Métrica | Objetivo |
|---|---|
| Escenario base | 200 locales × 30 mesas × 6 comensales conectados ≈ 36 000 WebSockets |
| API p95 | < 300 ms con 200 req/s sostenidos |
| Reclamo → feed de los demás | p95 < 2 s (la spec exige < 5 s) |
| Evento entre contextos | p95 < 1 s |
| Failover | Muere una instancia de la API: 0 comandos o eventos perdidos o duplicados; WebSocket reconecta en < 10 s. Reinicio de la DB: los comandos encolados en el dispositivo se aplican al volver. |

Los escenarios k6 y de caos viven en `load/` y corren cada noche contra un entorno efímero (compose: 2 instancias de la API, Postgres y un proxy).

### D13. Pruebas end-to-end

- **`guest-web`:** Playwright con Chromium, Firefox, WebKit, Pixel 7 e iPhone 15. En cada PR, Chromium y Pixel; la matriz completa cada noche.
- **`mobile`:** [Maestro](https://maestro.dev) sobre emuladores Android e iOS (flujos en YAML, más estables que Detox para un equipo de agentes). Android en cada PR (Linux), iOS cada noche (runner macOS).
- **Flujos críticos multiusuario:** mesero en mobile y 3 comensales en guest-web sobre la misma mesa.
- **Eventos:** las pruebas de integración de cada contexto publican los eventos de entrada y verifican los de salida, sin depender de otros contextos.

## Reutilización (antes de escribir código)

- `splitAmount` (`kernel`) para todo reparto.
- Los schemas de `contracts/` validan rutas (Fastify), formularios (ambos fronts) y eventos (bus).
- `packages/client` es el único cliente de API de ambos fronts.
- La cola idempotente (D8) también envía pedidos al POS.
- La lectura de cámara se usa para QR de mesa, tarjetas, timbre SII y voucher.

## Risks / Trade-offs

- **[Fudo sin API o sin creación de pedidos]** → El piloto usa el adaptador manual en paralelo y `order-via-lo-mio` queda deshabilitado por capacidad. Se sabrá en la tarea 5.3.
- **[Consistencia eventual confunde al usuario]** → Comandos con versión esperada, estado "actualizando" en la UI y saga de cierre (D5). Lo cubren e2e específicos.
- **[pg-boss como cuello de botella]** → Lo miden las pruebas de carga (D12). La salida es el adaptador NATS (D4), sin tocar los contextos.
- **[Dos fronts sin UI compartida]** → Duplicación acotada a componentes visuales; lógica, datos y validación son compartidos. Si la web crece, se evalúa react-native-web con el presupuesto de bundle como criterio.
- **[Publicación en tiendas]** → La revisión de Apple/Google agrega días. Para el piloto: TestFlight e internal testing de Play, y EAS Update para correcciones JS.
- **[Los comensales no escanean el QR]** → Se mide en el piloto. Plan B: el mesero entrega tarjetas al sentar a la mesa.
- **[Timbres ilegibles en papel térmico gastado]** → Ingreso manual de folio y monto como respaldo.
- **[Disputas entre comensales]** → El sistema registra todo y le da al personal las herramientas; no decide quién tiene la razón.
- **[Fotos de vouchers]** → Los vouchers chilenos imprimen el PAN truncado. Acceso solo para encargados y admin, y retención limitada.

## Migration Plan

No aplica (greenfield). Despliegue del piloto:
1. **Modo sombra** (1 semana): lo-mio en paralelo y el mesero cobra como siempre. Se compara la cuenta de lo-mio con la real.
2. **Modo activo** en un grupo de mesas, con el override de configuración por mesa.
3. **Todo el local.**

Rollback: desactivar lo-mio en el local. En `assign-only`, el local sigue operando sin cambios.

## Open Questions

- Proveedor de hosting. Contenedores + Postgres administrado + almacenamiento S3 corren en cualquiera; la región de Santiago (GCP `southamerica-west1`) es la candidata por latencia.
- Plazo de retención por defecto de los comprobantes (90 días es provisorio). Lo confirma el local con su contador.
