# Spec Delta

## ADDED Requirements

### Requirement: Herencia de configuración local → mesa
Los modos de operación SHALL definirse a nivel de local, y cada mesa MAY sobrescribirlos. El valor efectivo de una mesa MUST ser el de la mesa si existe y, si no, el del local.

#### Scenario: Mesa sin override
- **WHEN** el local tiene modo de pedidos "solo asignación" y la mesa 5 no tiene override
- **THEN** el modo efectivo de la mesa 5 es "solo asignación"

#### Scenario: Mesa con override
- **WHEN** el local tiene "solo asignación" y la mesa 5 tiene override "pedido desde lo-mio"
- **THEN** el modo efectivo de la mesa 5 es "pedido desde lo-mio" y el resto de las mesas sigue en "solo asignación"

#### Scenario: Cambio con sesión abierta
- **WHEN** se cambia el modo de una mesa que tiene una sesión abierta
- **THEN** el cambio aplica a partir de la próxima sesión y la sesión abierta conserva el modo con que se abrió

### Requirement: Modos de operación configurables
La configuración SHALL incluir: modo de pedidos (`assign-only` | `order-via-lo-mio`), modo de liquidación (`staff-marked` en el MVP) y exigencia de foto de evidencia en efectivo (por defecto desactivada).

#### Scenario: Modo de pedidos no soportado por el adaptador
- **WHEN** se configura `order-via-lo-mio` en un local cuyo adaptador POS no puede crear pedidos
- **THEN** la configuración se rechaza indicando que el POS conectado no lo permite

#### Scenario: Modo de liquidación no disponible
- **WHEN** se intenta configurar un modo de liquidación distinto de `staff-marked`
- **THEN** la configuración se rechaza indicando que el modo aún no está disponible
