# Spec Delta

## Purpose

Configuración de cada local y sus mesas: datos de país, moneda y modos de operación, con valores del local que cada mesa puede sobrescribir.

## ADDED Requirements

### Requirement: Configuración de país del local
Cada local SHALL tener un país que determine su moneda, la cantidad de decimales de la unidad mínima y el tipo de documento tributario. Los montos MUST almacenarse como enteros en la unidad mínima de esa moneda.

#### Scenario: Local chileno
- **WHEN** se crea un local con país Chile
- **THEN** su moneda es CLP con 0 decimales y su documento tributario es la boleta electrónica SII

#### Scenario: País no soportado
- **WHEN** se intenta crear un local con un país sin configuración disponible
- **THEN** la operación se rechaza indicando que el país no está soportado

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
La configuración SHALL incluir: modo de pedidos (`assign-only` | `order-via-lo-mio`), modo de liquidación (`staff-marked` en el MVP), exigencia de foto de evidencia en efectivo (por defecto desactivada) y tiempo de espera de confirmación de reasignaciones.

#### Scenario: Modo de pedidos no soportado por el adaptador
- **WHEN** se configura `order-via-lo-mio` en un local cuyo adaptador POS no puede crear pedidos
- **THEN** la configuración se rechaza indicando que el POS conectado no lo permite

#### Scenario: Modo de liquidación no disponible
- **WHEN** se intenta configurar un modo de liquidación distinto de `staff-marked`
- **THEN** la configuración se rechaza indicando que el modo aún no está disponible
