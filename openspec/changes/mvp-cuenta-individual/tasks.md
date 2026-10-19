# Tasks

## 1. Base técnica

- [ ] 1.1 `packages/kernel`: Money, Id (UUIDv7), Result y `EventEnvelope` con su schema zod; verificar con unit tests (incluido el round-trip de serialización del sobre)
- [ ] 1.2 Puerto `EventBus` en kernel y un adaptador en memoria **solo para unit tests** de handlers; verificar con un test de publicación y suscripción
- [ ] 1.3 `apps/api` con Fastify (helmet, cors, rate-limit, logger pino), `GET /health` y validación de variables de entorno al arranque (`.env.example`); verificar con tests de integración, incluido el arranque fallido si falta una variable
- [ ] 1.4 `compose.yaml` (Postgres), migraciones SQL versionadas y harness de Testcontainers; verificar con un test que migra una base vacía
- [ ] 1.5 Adaptador `EventBus` con pg-boss: `publish` dentro de la transacción del caller, suscripción por tópico y worker transaccional; verificar con tests de integración: rollback ⇒ sin evento, 2 suscriptores ⇒ ambos reciben, fallo del handler ⇒ reintento sin efecto duplicado
- [ ] 1.6 Job `integration` en CI; verificar que corre en un PR
- [ ] 1.7 Plantilla de contexto: crear `contexts/venues` con `domain/`, `contracts/` y `server/` y sus subpath exports; verificar que `tests/architecture.test.ts` la valida y que `pnpm verify` pasa

## 2. Contexto `venues` (spec `venue-config`)

- [ ] 2.1 Dominio: país (CL), Venue, Table con QR revocable, configuración y herencia local → mesa; verificar con unit tests de herencia y del cambio con sesión abierta
- [ ] 2.2 Contratos y server: CRUD de local, mesas, catálogo manual y configuración; eventos `venues.table.config-changed.v1`; verificar con tests de integración, incluido el rechazo de modos no disponibles

## 3. Contexto `staff` (spec `staff-access`)

- [ ] 3.1 Dominio y server: personal, roles, sesión (cookie web y token app, 12 h) y aislamiento por `venueId`; verificar con tests de integración, incluido el acceso cruzado entre locales
- [ ] 3.2 PIN de encargado con bloqueo a los 5 intentos y rate limit; verificar con un test de integración del bloqueo y su vencimiento

## 4. Contexto `tables` (specs `table-session`, `guest-identity`)

- [ ] 4.1 Dominio: TableSession (apertura única, unión, salida, deuda abierta) y Credential (vincular, liberar, transferir); verificar con unit tests de cada escenario de las specs
- [ ] 4.2 Server: unirse por QR (web y app), alias generado, identificadores físicos; verificar con un test de integración de apertura concurrente (una sola sesión)
- [ ] 4.3 Saga de cierre (espera `claims…all-items-owned` y `settlement…balances-cleared`, cancela si algo cambia); verificar con un test de integración que publica los eventos de entrada en distinto orden

## 5. Contexto `claims` (spec `item-claims`)

- [ ] 5.1 Dominio: eventos de asignación y su fold (reclamo, compartido igual/porciones, unirse, reasignación, confirmación, rechazo, override); verificar con unit tests y una propiedad: la suma de las partes siempre es igual al precio
- [ ] 5.2 Server: consumir `pos.item.received.v1` como ítem sin dueño; comandos de reclamo con control optimista e idempotencia; verificar con un test de integración del reclamo simultáneo
- [ ] 5.3 Server: reasignación con confirmación (dispositivo o escaneo), tiempo de espera, override con PIN y aprobación remota; verificar con tests de integración de cada camino
- [ ] 5.4 Historial de auditoría por ítem; verificar con un test que reconstruye el estado desde los eventos

## 6. Contexto `pos` (spec `pos-integration`)

- [ ] 6.1 Contrato `PosAdapter` con capacidades y suite de contrato reutilizable; adaptador manual que la pasa; verificar con la suite
- [ ] 6.2 Sincronización con deduplicación por `posItemId`, anulaciones, cambios de precio y backoff, publicando `pos.item.received|voided|repriced.v1`; verificar con tests de integración usando un adaptador fake
- [ ] 6.3 **Bloqueante externo:** obtener acceso y documentación de la API de Fudo; registrar en `design.md` las capacidades reales
- [ ] 6.4 Adaptador Fudo contra un fake de Fudo; verificar que pasa la suite de contrato
- [ ] 6.5 Modo `order-via-lo-mio` con envío idempotente (solo si Fudo lo soporta según 6.3); verificar con un test de reintento tras corte de red

## 7. Contexto `settlement` (spec `settlement`)

- [ ] 7.1 Dominio: proyección de saldo desde los eventos de `claims` (excluye anulados y disputas) y parser del timbre `<TED>`; verificar con unit tests y fixtures de timbres anonimizados (incluido otro emisor y un timbre mal formado)
- [ ] 7.2 Server: registro de pagos con versión de saldo esperada, tope de saldo, folio duplicado y evidencia exigida; verificar con tests de integración, incluido el pago con saldo desactualizado
- [ ] 7.3 Subida de fotos con URLs prefirmadas, acceso por rol y retención; verificar con un test de integración contra MinIO

## 8. Tiempo real y cliente compartido

- [ ] 8.1 Gateway WebSocket en `apps/api` (suscripción por sesión, reanudación por último `event.id`); verificar con un test de integración con 2 instancias de la API
- [ ] 8.2 `packages/client`: cliente tipado desde `contracts/` + hooks TanStack Query + conexión WebSocket; verificar con tests contra la API real (Testcontainers)

## 9. `apps/guest-web` (comensal por QR)

- [ ] 9.1 React DOM + Vite con `src/features/<ctx>/`; presupuesto < 150 KB gzip verificado en CI
- [ ] 9.2 Playwright (Chromium y Pixel en PR; matriz completa cada noche) y job de CI; verificar con un e2e de smoke
- [ ] 9.3 Unirse, feed en vivo, lo mío / compartir / yo también, confirmar o rechazar reasignaciones, ver saldo; verificar con un e2e de 3 comensales concurrentes y axe sin violaciones serias

## 10. `apps/mobile` (Expo: personal y comensal frecuente)

- [ ] 10.1 Expo Router con development build, superficies por rol y `src/features/<ctx>/`; Maestro en CI (Android en PR, iOS nightly); verificar con un flujo de smoke
- [ ] 10.2 Lectura NFC (`react-native-nfc-manager`) y cámara (QR, PDF417); verificar en dispositivo real iOS y Android y con un test de los parsers de payload
- [ ] 10.3 Mesero: mesas, carga manual, escaneo, reasignar, override, registrar pago con comprobante; verificar con un flujo Maestro del cobro completo de una mesa con rotación
- [ ] 10.4 Cola offline en SQLite con idempotencia; verificar con un flujo Maestro que corta la red a mitad del registro de un pago
- [ ] 10.5 Encargado/admin: configuración, personal, aprobaciones, deudas abiertas, historial de ítems; verificar con flujos Maestro
- [ ] 10.6 Comensal en la app (unirse por QR y la misma funcionalidad que la web); verificar con un flujo Maestro
- [ ] 10.7 EAS Build/Update y distribución por TestFlight e internal testing de Play; verificar instalando en dispositivos del piloto

## 11. Carga, failover y DAST

- [ ] 11.1 Entorno efímero en compose (2 API + Postgres + proxy) para nightly
- [ ] 11.2 Escenarios k6 con los objetivos de D12 (HTTP, WebSocket y latencia de eventos); verificar que el workflow nightly falla si no se cumplen
- [ ] 11.3 Caos: matar una API y reiniciar la DB a mitad del flujo; verificar 0 comandos o eventos perdidos o duplicados
- [ ] 11.4 DAST con OWASP ZAP baseline en nightly; verificar que falla ante hallazgos altos

## 12. Preparación del piloto

- [ ] 12.1 Elegir hosting (open question de `design.md`), desplegar en staging y documentar el runbook en `docs/runbook.md`
- [ ] 12.2 Cargar el local piloto (mesas, QR, tarjetas, personal) y verificar el flujo completo en staging con dispositivos reales

## Workflow follow-up

- Revisar el change con el equipo antes de `/opsx:apply`.
- Archivar con `/opsx:archive` al terminar el piloto en modo sombra.
