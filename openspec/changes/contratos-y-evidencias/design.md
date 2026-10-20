# Design

## Context

Hoy `apps/api` define rutas a mano y `contracts/` está vacío. Los tests son Vitest (unit e integración) con salida de consola. Ver `docs/arquitectura.md`, secciones 2, 10 y 12.

## Goals / Non-Goals

**Goals:**
- Una sola fuente de verdad por contrato. Si algo no está en el contrato, no existe en el código, ni en los mocks, ni en los tests.
- Que una persona sin contexto técnico pueda abrir el reporte y entender qué flujo de negocio se probó, qué pasó en cada paso y ver la evidencia.

**Non-Goals:**
- Versionado público de la API (no hay consumidores externos todavía).

## Decisions

### Contratos

- **Ubicación:** `contexts/<ctx>/contracts/openapi.yaml` (rutas del contexto bajo `/v1/<ctx>/…`) y `contexts/<ctx>/contracts/asyncapi.yaml` (eventos que emite). Plataforma (`/health`) en `apps/api/openapi/platform.yaml`. **Redocly CLI** une todo en `apps/api/openapi.yaml` y aplica reglas de lint (operationId obligatorio, errores como `application/problem+json` RFC 9457, ejemplos en cada respuesta, porque Microcks los usa para mockear).
- **Por qué YAML como fuente y no zod → OpenAPI:** el contrato lo revisa una persona (o un consumidor externo) sin leer TypeScript. También lo consumen herramientas que no son TypeScript (Schemathesis, Microcks), y obliga a decidir la interfaz antes de implementarla.
- **Contratos externos** en `contracts/external/<sistema>/` (ej. `fudo/openapi.yaml`), versionados tal como los entrega el proveedor.

### Generación

- **@hey-api/openapi-ts** genera, por contexto, en `contracts/generated/`: tipos, schemas zod y (en `packages/client`) el cliente con hooks de TanStack Query. Lo generado **se commitea**, porque así es visible para agentes y revisores. El job `contracts` lo regenera y falla si hay diferencias.
- **AsyncAPI → zod:** los payloads de AsyncAPI son JSON Schema. Se convierten a zod con la misma pipeline. La herramienta exacta (Modelina o JSON Schema → zod) se elige en la tarea 2.2 con una prueba sobre un evento real del kernel.
- **Regla:** nunca escribir a mano un schema que exista en un contrato. Lo verifica el test de arquitectura: `contracts/` solo exporta desde `generated/`.

### La API implementa solo su contrato

- **fastify-openapi-glue** crea las rutas desde `openapi.yaml`. Cada contexto entrega un objeto de handlers por `operationId`: si el contrato declara una operación sin handler, la API no arranca; si un handler no tiene operación, no se monta.
- Requests validados con el schema del contrato (ajv de Fastify). Respuestas serializadas con su schema, así que un campo no declarado no sale.
- Errores en formato `application/problem+json`.

### Eventos

- `PgBossEventBus.publish` valida el evento contra el schema generado desde AsyncAPI. Un evento no declarado, o con un payload que no cumple el contrato, se rechaza antes de entrar a la transacción.

### Mocks: Microcks

- En kind se instala en modo liviano (*uber*), con `values-local.yaml`, y carga los contratos propios y los externos al arrancar.
- En los tests de integración se usa `@microcks/microcks-testcontainers` para mockear un contexto o sistema externo dentro de un solo test.
- Los mocks responden **los ejemplos del contrato**, así que un ejemplo inválido rompe el lint, no el test.

### Conformidad: Schemathesis

- Corre contra la API desplegada en kind (CI: job `api-flows`). Genera casos desde el OpenAPI (incluidos bordes y datos inválidos) y verifica respuestas, códigos y headers contra el contrato. Exporta JUnit para Allure.

### Flujos funcionales: Playwright

- `tests/flows/<contexto>/<flujo>.flow.ts`, contra el Gateway (HTTPS, igual que producción).
- Convención: `test.describe("<Contexto>")` → `test.describe("<Flujo de usuario>")` → `test("<escenario>")` con `test.step("<paso funcional>")`. Los nombres son en español y en lenguaje de negocio; ejemplo: Reclamos → Compartir un ítem → "tres comensales reparten una tabla" → paso "Ana reclama la tabla".
- El cliente HTTP de los flujos es `packages/client` (generado), así que un flujo no puede llamar algo que no esté en el contrato.
- Se adjuntan request/response de cada paso; en los fronts, trace y video (`trace: "on"`, `video: "on"`).

### Evidencias: Allure 3

- Todos los frameworks escriben `allure-results`: allure-playwright (flujos API y e2e web), allure-vitest (unit e integración), JUnit de Schemathesis y de Maestro.
- **Jerarquía única**: `epic` = contexto, `feature` = flujo de usuario, `story` = escenario. Se deriva de los `describe` (convención anterior) con un helper compartido, para que nadie la escriba a mano en cada test.
- Mobile: cada flujo de Maestro graba video (`startRecording`) y se adjunta al resultado.
- CI: cada job sube sus `allure-results` y un job final `report` genera **un solo HTML** como artifact del run, con el resumen en el PR. No se publica en GitHub Pages: el repo es público y los reportes pueden traer datos de prueba y trazas.

## Risks / Trade-offs

- **[Más herramientas]** → Cada una cubre algo que las demás no: conformidad (Schemathesis), flujos (Playwright), mocks (Microcks) y lectura humana (Allure). Bruno queda solo como opción de exploración manual (importa el OpenAPI) y no se mantienen colecciones.
- **[Código generado commiteado]** → Diffs más grandes. Se marca `linguist-generated` en `.gitattributes` para que GitHub los colapse.
- **[fastify-openapi-glue con un solo mantenedor principal]** → Lo cubre la conformidad de Schemathesis: si la librería se abandona, se reemplaza por registro manual de rutas desde el mismo contrato sin cambiar los tests.
