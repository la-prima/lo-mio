# Proposal

## Why

Todos los changes del MVP se apoyan en el kernel, el bus de eventos y la API. El riesgo técnico más alto del proyecto (publicar eventos dentro de la misma transacción del cambio, sin perderlos ni procesarlos dos veces) tiene que validarse antes de construir funcionalidades encima.

## What Changes

- `packages/kernel`: Money, Id (UUIDv7), Result, `EventEnvelope` y el puerto `EventBus`.
- Adaptador `EventBus` con pg-boss (outbox transaccional, pub/sub por tópico, workers transaccionales).
- `apps/api` con Fastify y plugins de seguridad, health check y validación de entorno.
- Postgres en `compose.yaml`, migraciones SQL versionadas y harness de Testcontainers.
- Plantilla de contexto (`contexts/venues` vacío con `domain/`, `contracts/`, `server/`) validada por el test de arquitectura.
- Job de integración en CI.

## Capabilities

### New Capabilities

Ninguna: es infraestructura sin comportamiento observable por usuarios (`skip_specs: true`).

### Modified Capabilities

Ninguna.

## Fuera de alcance

- Cualquier regla de negocio: llega con `reclamo-manual`.
- Hosting y despliegue: `despliegue-piloto`.
- Gateway WebSocket: llega con el primer flujo que lo necesita (`reclamo-manual`).

## Impact

- Nuevo: `apps/api`, `contexts/venues` (esqueleto), `compose.yaml`, `migrations/`.
- Crece `packages/kernel`.
- Dependencias nuevas: fastify y sus plugins oficiales, pg, pg-boss, kysely, zod, testcontainers.
- CI: job `integration` (requiere Docker en el runner).
