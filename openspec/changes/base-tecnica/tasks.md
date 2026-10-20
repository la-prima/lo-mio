# Tasks

## 1. Kernel

- [x] 1.1 Money, Id (UUIDv7), Result y `EventEnvelope` con su schema zod en `packages/kernel`; verificar con unit tests (incluido el round-trip de serialización del sobre)
- [x] 1.2 Puerto `EventBus` y bus en memoria para unit tests; verificar con un test de publicación y suscripción

## 2. Infraestructura

- [x] 2.1 `compose.yaml` (Postgres), runner de migraciones SQL y harness de Testcontainers; verificar con un test que migra una base vacía
- [x] 2.2 Adaptador `EventBus` con pg-boss; verificar con tests de integración: rollback ⇒ sin evento, 2 suscriptores ⇒ ambos reciben, fallo del handler ⇒ reintento sin efecto duplicado
- [x] 2.3 `apps/api` con Fastify (helmet, cors, rate-limit, logger pino), `GET /health` y validación de entorno (`.env.example`); verificar con tests de integración, incluido el arranque fallido si falta una variable
- [ ] 2.4 Job `integration` en CI y agregarlo a los checks requeridos del ruleset; verificar que corre en el PR de este change

## 3. Plantilla de contexto

- [x] 3.1 `contexts/venues` con `domain/`, `contracts/`, `server/` y subpath exports, montado en `apps/api`; verificar que `tests/architecture.test.ts` lo valida y que `pnpm verify` pasa
