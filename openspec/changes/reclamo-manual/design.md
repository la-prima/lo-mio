# Design

## Context

Primer change con reglas de negocio. Aplica `docs/arquitectura.md` completo; aquí solo van las decisiones propias del flujo.

## Goals / Non-Goals

**Goals:**
- Un flujo usable en el local: mesero carga ítems en la app, comensales reclaman en la web.
- Ejercitar el primer evento real entre contextos: `pos.item.received.v1` → `claims` → `settlement`.

**Non-Goals:**
- Pulir la UI: lo justo para probar el flujo con personas reales.

## Decisions

- **Identificación del comensal:** cookie httpOnly `SameSite=Lax` ligada a la sesión de mesa. El QR de la mesa lleva un código aleatorio revocable, no el número de mesa.
- **Auth del personal:** usuario y contraseña con `scrypt` (`node:crypto`). La sesión es una cookie httpOnly en la web y un token en `expo-secure-store` en la app. `@fastify/rate-limit` en el login.
- **Carga manual como POS:** el adaptador manual publica el mismo `pos.item.received.v1` que publicará Fudo. `claims` no sabe de dónde viene el ítem.
- **Eventos de este change** (cada uno declarado en el `asyncapi.yaml` de su emisor):

| Tópico | Emisor | Consumidores |
|---|---|---|
| `pos.item.received.v1` | pos | claims |
| `tables.guest.joined.v1` | tables | claims, settlement |
| `claims.item.assigned.v1` | claims | settlement, gateway WS |
| `settlement.balance.changed.v1` | settlement | gateway WS |

- **Gateway WebSocket** en `apps/api` (`docs/arquitectura.md`, sección 6): reenvía los eventos de la sesión a sus clientes y reanuda desde el último `event.id`.

## Risks / Trade-offs

- **[Los comensales no escanean el QR]** → Es lo que este change permite medir en el local. Plan B: el mesero entrega tarjetas al sentar a la mesa (change `tarjetas-y-reasignacion`).
- **[Saldo desfasado por consistencia eventual]** → El feed muestra "actualizando" mientras el saldo no refleja el último reclamo propio.
