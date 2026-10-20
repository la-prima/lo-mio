# Design

## Context

Aplica `docs/arquitectura.md`: `pos` es la capa anticorrupción (sección 1) y el envío idempotente reutiliza la cola de comandos (sección 8). Las capacidades reales de la API de Fudo todavía no se conocen.

## Goals / Non-Goals

**Goals:**
- Que `claims` no note diferencia entre un ítem manual y uno de Fudo.

**Non-Goals:**
- Escribir en Fudo nada que no sea un pedido (ni pagos ni cierres).

## Decisions

- **Polling por local cada 10 s**, solo mientras haya mesas abiertas, con backoff exponencial ante error. Si Fudo ofrece webhooks, se reemplaza el polling dentro del adaptador sin tocar el contrato.
- **Deduplicación por `posItemId` en `pos/server`**, compartida por todos los adaptadores; el adaptador solo traduce.
- **Fake de Fudo** (servidor HTTP en los tests) que pasa la misma suite de contrato que el adaptador real; se construye con la documentación oficial.
- **Credenciales cifradas** en la base con una clave del entorno; nunca en logs.
- **Eventos nuevos:** `pos.item.voided.v1`, `pos.item.repriced.v1`, `pos.order.sent|rejected.v1`, `pos.connection.failed.v1`.

## Risks / Trade-offs

- **[Fudo sin API o sin creación de pedidos]** → El piloto sigue con el adaptador manual y `order-via-lo-mio` queda deshabilitado por capacidad. Se sabe en la tarea 1.1.
- **[Límites de rate de la API de Fudo]** → El polling se ajusta a lo que permitan; se documenta en la tarea 1.1.
