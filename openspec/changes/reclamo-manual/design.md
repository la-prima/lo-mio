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
- **Flujo de eventos.** `tables` decide a qué sesión pertenece cada ítem; si `claims` consumiera directo el evento del POS, podría recibir un ítem antes de que exista la sesión.

| Tópico | Emisor | Consumidores | Para qué |
|---|---|---|---|
| `pos.item.received.v1` | pos | tables | Ítem nuevo en una mesa (manual hoy, Fudo después) |
| `tables.session.opened.v1` | tables | gateway WS | Se abrió la mesa |
| `tables.item.seated.v1` | tables | claims | El ítem quedó en la sesión abierta (una unidad por evento) |
| `tables.guest.joined.v1` | tables | claims, settlement, gateway WS | Comensal nuevo en la sesión |
| `claims.item.changed.v1` | claims | settlement, gateway WS | Estado completo del ítem (dueños y partes) con su `version` |
| `settlement.balance.changed.v1` | settlement | gateway WS | Saldo nuevo de un comensal |

  - `claims` guarda sus **eventos de dominio** (reclamado, compartido, sumado) en su propia tabla y publica hacia afuera un solo evento de integración con el **estado completo** del ítem. Los consumidores proyectan por `version` sin conocer la lógica de reclamos y descartan versiones viejas.
  - La cantidad se expande en `tables`: 2 cervezas = 2 `tables.item.seated.v1`, cada una con su id (spec `pos-integration`, escenario "Carga manual").
- **Carga manual con nombre y precio del catálogo elegidos en la app.** `pos` no lee el catálogo de `venues`: el mesero autenticado elige el producto y la app envía nombre y precio. Hoy el mesero ya puede escribir cualquier precio en el POS, así que no agrega un riesgo nuevo.
- **Autenticación declarada en el contrato.** Dos esquemas de seguridad en OpenAPI: `staffSession` (cookie `lomio_staff` o `Authorization: Bearer`) y `guestSession` (cookie `lomio_guest`). Cada operación declara cuál acepta y fastify-openapi-glue aplica los `securityHandlers`. Los tokens son **opacos y aleatorios**: en la base se guarda solo su hash SHA-256, así que se pueden revocar y una filtración de la base no los expone. `apps/api` resuelve el actor (`staff` o `guest`, siempre con su `venueId`) usando el `server/` de `staff` y de `tables`; los handlers reciben el actor ya resuelto.
- **Proyecciones locales en vez de consultas entre contextos.** `claims` valida que los comensales de un reparto pertenezcan a la sesión usando su propia proyección de `tables.guest.joined.v1`; `settlement` calcula los saldos con su proyección de `claims.item.changed.v1`.
- **Idempotencia de comandos:** header `Idempotency-Key` en las operaciones que crean o cambian estado; tabla de plataforma `idempotency_keys` (clave, actor, hash del request, respuesta). Reintentar con la misma clave devuelve la misma respuesta; la misma clave con otro request responde 422.
- **Locales y personal iniciales por script** (`apps/api/src/seed.ts`): el MVP no tiene autoservicio para crear locales ni el primer administrador.
- **Tiempo real entre réplicas (cambio respecto al plan):** un suscriptor durable del bus (`realtime`) toma cada evento relevante una vez y hace `pg_notify` en su transacción; cada instancia de la API escucha el canal y reenvía a sus sockets. Un suscriptor del bus por sí solo no alcanza: es consumidor competitivo y cada evento llegaría a una sola réplica.
- **Reanudación por snapshot (cambio respecto al plan):** en vez de guardar un log por sesión y reanudar desde el último `event.id`, al conectarse el servidor envía el feed y los saldos completos; cada ítem trae su `version` y el cliente descarta lo que ya tiene. Cumple "resincronizar sin acciones duplicadas" sin almacenamiento extra.
- **WebSocket fuera de fastify-openapi-glue** (glue solo monta HTTP): la ruta `/v1/sessions/{sessionId}/events` se declara en el `asyncapi.yaml` de la API y la registra `apps/api`, con la misma autenticación.
- **Comensales del snapshot desde `tables`, no desde la proyección de `settlement`:** el aviso en vivo de un comensal puede salir antes de que otro se suscriba; si el snapshot dependiera de una proyección que todavía no lo procesó, ese comensal no aparecería nunca. Los montos sí salen de `settlement` (sus cambios llegan como eventos del mismo contexto).
- **Web del comensal en el mismo origen que la API:** el HTTPRoute de `guestWeb` envía `/v1` a la API y el resto a los estáticos. La cookie `lomio_guest` es de primera parte, no hace falta CORS con credenciales (ni su preflight en redes móviles) y el WebSocket va al mismo host.
- **Alias por defecto sin duplicados:** la unión bloquea la fila de la sesión (`FOR UPDATE`) al numerar "Comensal N"; dos uniones simultáneas se numeran en orden (con alias repetidos, "compartir con" no distingue a quién).

- **Gateway WebSocket** en `apps/api` (`docs/arquitectura.md`, sección 6): reenvía los eventos de la sesión a sus clientes y reanuda desde el último `event.id`.

## Risks / Trade-offs

- **[Los comensales no escanean el QR]** → Es lo que este change permite medir en el local. Plan B: el mesero entrega tarjetas al sentar a la mesa (change `tarjetas-y-reasignacion`).
- **[Saldo desfasado por consistencia eventual]** → El feed muestra "actualizando" mientras el saldo no refleja el último reclamo propio.
