# Proposal

## Why

Hasta ahora los contratos se iban a escribir como schemas zod en el código. Eso no garantiza que la API haga solo lo que dice su definición, ni que los mocks de otros sistemas (Fudo) o de otros contextos sean fieles. Además, las evidencias de las pruebas hoy son salida de consola, difícil de revisar para una persona.

Este change instala **contract-first**: los contratos (OpenAPI para HTTP, AsyncAPI para eventos) son la fuente de verdad. Los tipos, validaciones, rutas y mocks se derivan de ellos. También instala **evidencias legibles**: un reporte HTML agrupado por dominio y flujo de usuario, con traces y videos.

## What Changes

- Cada contexto declara su `openapi.yaml` y su `asyncapi.yaml`; la API publica el contrato unificado.
- Los schemas zod, los tipos y el cliente con hooks de TanStack Query (`packages/client`) se **generan** desde los contratos; CI falla si lo generado no coincide.
- Las rutas de Fastify se crean desde el OpenAPI: no puede existir un endpoint que no esté en el contrato, y las respuestas se validan contra él.
- El bus de eventos solo acepta eventos declarados en AsyncAPI.
- Mocks con Microcks a partir de los contratos (propios y externos, como el Swagger de Fudo), en kind y en Testcontainers.
- Conformidad de la API con su contrato verificada por Schemathesis.
- Flujos funcionales de la API con Playwright, organizados por dominio y flujo.
- Reporte unificado con Allure: dominio → flujo → paso, con traces, videos y logs adjuntos.

## Capabilities

### New Capabilities

Ninguna: cambia cómo se definen y prueban los contratos, no el comportamiento (`skip_specs: true`).

### Modified Capabilities

Ninguna.

## Fuera de alcance

- Contratos de negocio de cada contexto: los escribe cada change (`reclamo-manual` y siguientes) siguiendo este modelo.
- Importar el Swagger de Fudo: depende del acceso (`integracion-fudo`), pero la carpeta y el mecanismo quedan listos.
- Video del front web y mobile: el mecanismo (Playwright y Maestro hacia Allure) queda definido aquí; se aplica cuando existan los fronts.

## Impact

- Nuevo: `contexts/<ctx>/contracts/{openapi,asyncapi}.yaml`, código generado en `contracts/generated/`, `contracts/external/`, `tests/flows/`, configuración de Allure, Microcks en el chart local.
- Cambia: `contracts/` deja de escribirse a mano; `apps/api` monta rutas desde el contrato; `PgBossEventBus` valida contra AsyncAPI.
- Dependencias: Redocly CLI, @hey-api/openapi-ts, fastify-openapi-glue, Playwright, allure-playwright, allure-vitest, Allure 3; Schemathesis y Microcks como contenedores.
- CI: jobs `contracts` (lint + drift de generado) y `api-flows`, y un job final `report` que publica el Allure.
- Depende de: `plataforma-k8s` (los flujos corren contra el ambiente kind).
