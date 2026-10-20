# Design

## Context

Aplica `docs/arquitectura.md`, sección 8 (cola de comandos idempotentes).

## Goals / Non-Goals

**Goals:**
- 0 acciones perdidas o duplicadas ante cortes de red, cierre de la app o reinicio del dispositivo.

**Non-Goals:**
- Resolver conflictos automáticamente: si una acción encolada ya no es válida, se rechaza y el mesero decide.

## Decisions

- **Cola en SQLite**, no en memoria ni en AsyncStorage: sobrevive al cierre de la app y permite consultar pendientes.
- **Envío en orden estricto** por dispositivo: una acción no se envía hasta que la anterior se confirmó o se rechazó. Evita que un pago llegue antes que la carga del ítem que paga.
- **Reintentos con backoff** y reintento inmediato al detectar que volvió la red (`@react-native-community/netinfo`).
- **EAS Update** para correcciones JS en el piloto sin pasar por la revisión de las tiendas; los cambios nativos requieren un build nuevo.

## Risks / Trade-offs

- **[Una acción encolada queda inválida al volver la red]** → Se muestra como rechazada con el motivo; nunca se descarta en silencio.
- **[Orden estricto bloquea la cola si una acción falla de forma permanente]** → Una acción rechazada por el servidor sale de la cola; solo los errores de red la mantienen.
