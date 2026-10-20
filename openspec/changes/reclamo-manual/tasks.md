# Tasks

Cada tarea de `server` empieza por su contrato (`openapi.yaml` / `asyncapi.yaml`), regenera el código y recién después implementa (ver `docs/arquitectura.md`, sección 12).

## 1. Contexto `venues` y `staff`

- [x] 1.1 Dominio de país (CL: CLP, 0 decimales, boleta SII) y alta de local, mesas con QR revocable y catálogo; verificar con unit tests y tests de integración, incluido el país no soportado
- [x] 1.2 Personal, roles y sesión (cookie web y token app, 12 h) con aislamiento por `venueId`; verificar con tests de integración, incluido el acceso cruzado entre locales y la sesión expirada

## 2. Contexto `pos`

- [x] 2.1 Contrato `PosAdapter` con capacidades, suite de contrato reutilizable y adaptador manual que publica `pos.item.received.v1`; verificar que el adaptador manual pasa la suite y con un test de integración del evento

## 3. Contexto `tables`

- [x] 3.1 Dominio: apertura única (por el mesero o por el primer ítem), unión, alias generado; verificar con unit tests de cada escenario
- [x] 3.2 Server: unirse por QR con cookie de comensal, QR revocado o inexistente; verificar con un test de integración de apertura concurrente (una sola sesión)

## 4. Contexto `claims`

- [x] 4.1 Dominio: eventos de asignación y su fold (reclamo, compartido igual/porciones, unirse); verificar con unit tests y una propiedad: la suma de las partes siempre es igual al precio
- [x] 4.2 Server: consumir `pos.item.received.v1`, comandos de reclamo con control optimista e idempotencia; verificar con un test de integración del reclamo simultáneo
- [x] 4.3 Historial de auditoría por ítem; verificar con un test que reconstruye el estado desde los eventos

## 5. Contexto `settlement`

- [x] 5.1 Proyección de saldo desde los eventos de `claims`; verificar con unit tests y un test de integración con eventos de entrada

## 6. Tiempo real y cliente

- [ ] 6.1 Gateway WebSocket (suscripción por sesión, reanudación por último `event.id`) y su conexión en `packages/client` (el cliente HTTP y los hooks se generan del contrato); verificar con un test de integración con 2 instancias de la API
- [ ] 6.2 Flujos API en `tests/flows/` (unirse, reclamar, compartir, ver saldo) agrupados por contexto y flujo; verificar en el reporte Allure

## 7. `apps/guest-web`

- [ ] 7.1 React + Vite con `src/features/<ctx>/`, imagen (estático sobre servidor sin root) y componente `guestWeb` en el chart con su HTTPRoute; Playwright con trace y video hacia Allure (Chromium y Pixel en PR, matriz completa nightly) y presupuesto < 150 KB gzip; verificar con un e2e de smoke en kind y agregar el job a los checks requeridos
- [ ] 7.2 Unirse, feed en vivo, lo mío / compartir / yo también, ver saldo; verificar con un e2e de 3 comensales concurrentes y axe sin violaciones serias

## 8. `apps/mobile` (personal)

- [ ] 8.1 Expo Router con development build, login y `src/features/<ctx>/`; Maestro en CI (Android en PR) con video de cada flujo hacia Allure; verificar con un flujo de smoke
- [ ] 8.2 Mesas abiertas, abrir mesa y carga manual de ítems; verificar con un flujo Maestro coordinado con el e2e de 7.2 (el mesero carga y los comensales reclaman)
