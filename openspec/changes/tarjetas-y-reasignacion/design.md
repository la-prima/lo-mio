# Design

## Context

Aplica `docs/arquitectura.md`. La reasignación es un agregado más en `claims` (sección 5): una propuesta con estado pendiente → confirmada | rechazada | forzada.

## Goals / Non-Goals

**Goals:**
- Que ninguna reasignación que suma monto a un comensal se aplique sin su confirmación o sin un responsable identificado.

**Non-Goals:**
- Resolver quién tiene la razón en una disputa: el sistema registra y el personal decide.

## Decisions

- **Identificador físico:** tag NFC NTAG213 con una URL y un código aleatorio de 128 bits, más el mismo código en QR impreso. El código se puede copiar; la seguridad está en que vincular o confirmar con un identificador físico lo hace siempre un mesero autenticado en su dispositivo.
- **Lectura:** `react-native-nfc-manager` (Core NFC en iOS, NFC en Android) y, como respaldo, el QR impreso con la cámara que ya existe.
- **PIN de encargado:** hash `scrypt`, bloqueo a los 5 intentos durante 15 minutos (en la base, no en memoria), `@fastify/rate-limit` en el endpoint.
- **Timeout de confirmación:** no hay un temporizador en el servidor. La propuesta guarda `expiresAt` y el override se habilita al consultarla después de esa hora. Si nadie actúa, no pasa nada.
- **Eventos nuevos:** `claims.reassignment.proposed|confirmed|rejected|forced.v1`, `tables.credential.linked|released.v1`, `tables.guest.transferred.v1`.

## Risks / Trade-offs

- **[Tarjetas perdidas o robadas]** → Un código perdido solo sirve en manos de un mesero autenticado; se puede revocar desde administración.
- **[Abuso del override]** → Queda auditado a nombre del encargado y es visible para el comensal; el reporte de overrides por encargado va en la vista de administración.
