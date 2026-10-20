# Tasks

## 1. Contratos

- [x] 1.1 `apps/api/openapi/platform.yaml` (`/health`, `/health/live`, errores problem+json) y bundling + lint con Redocly; verificar que `pnpm contracts` falla con un contrato sin `operationId` o sin ejemplos
- [x] 1.2 Estructura `contexts/<ctx>/contracts/{openapi,asyncapi}.yaml` en la plantilla `venues` y `contracts/external/`; verificar que el bundle incluye el contrato del contexto

## 2. Generación

- [x] 2.1 @hey-api/openapi-ts: zod y tipos por contexto, y cliente con TanStack Query en `packages/client`; job `contracts` que falla si lo generado difiere; verificar con un cambio de contrato sin regenerar
- [x] 2.2 AsyncAPI → zod (elegir la herramienta con un evento real) y validación en `PgBossEventBus.publish`; verificar con tests: evento no declarado y payload inválido se rechazan
- [x] 2.3 Regla en el test de arquitectura: `contracts/` solo exporta `generated/`; verificar con un schema escrito a mano

## 3. La API implementa solo su contrato

- [x] 3.1 Rutas con fastify-openapi-glue y handlers por `operationId` desde cada contexto; verificar con tests de integración: ruta no declarada → 404, operación sin handler → no arranca, campo extra en la respuesta → no sale

## 4. Mocks

- [x] 4.1 Microcks en el chart local cargando contratos propios y externos, y helper de Testcontainers; verificar que el mock de `/health` responde el ejemplo del contrato en kind y en un test de integración

## 5. Pruebas desde el contrato y evidencias

- [x] 5.1 Schemathesis contra la API en kind (JUnit → Allure); verificar que detecta un desvío introducido a propósito (un campo no declarado ya no puede salir desde 3.1, así que se verificó con un código de estado no declarado: detectado como "Undocumented HTTP status code")
- [x] 5.2 Playwright para flujos API con la convención dominio → flujo → escenario → paso y primer flujo "Plataforma › Salud del sistema"; verificar el reporte HTML con request/response adjuntos
- [ ] 5.3 Allure 3 con allure-playwright, allure-vitest y JUnit, helper de jerarquía y job `report` que publica un solo HTML con resumen en el PR; agregar `contracts` y `api-flows` a los checks requeridos; verificar abriendo el reporte del PR

## 6. Documentación

- [ ] 6.1 `AGENTS.md` (contract-first, convención de nombres de pruebas, evidencias); verificar que el reporte del PR se entiende sin leer el código
