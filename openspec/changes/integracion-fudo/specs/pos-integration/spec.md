# Spec Delta

## ADDED Requirements

### Requirement: Sincronización de ítems desde el POS
En modo `assign-only`, el sistema SHALL importar los ítems de cada mesa desde el POS sin duplicarlos. Cada ítem MUST conservar su identificador del POS. Las anulaciones y cambios de precio en el POS MUST reflejarse en lo-mio.

#### Scenario: Ítem repetido en dos lecturas
- **WHEN** dos sincronizaciones consecutivas devuelven el mismo ítem del POS
- **THEN** existe un solo ítem en lo-mio

#### Scenario: Anulación en el POS
- **WHEN** el POS anula un ítem que ya estaba reclamado
- **THEN** el ítem se marca anulado, deja de sumar al saldo de su dueño y el dueño es notificado

#### Scenario: POS no disponible
- **WHEN** el POS no responde
- **THEN** el feed muestra el último estado conocido con la hora de la última sincronización, el mesero ve el aviso y la sincronización se reintenta con backoff

### Requirement: Pedido desde lo-mio
En modo `order-via-lo-mio`, un pedido confirmado en lo-mio SHALL enviarse al POS para que llegue a cocina o barra, y el ítem MUST nacer ya asignado a quien lo pidió. El envío MUST ser idempotente.

#### Scenario: Envío exitoso
- **WHEN** un pedido se confirma en lo-mio
- **THEN** se crea en el POS y el ítem queda vinculado al identificador que devolvió el POS

#### Scenario: Reintento tras corte de red
- **WHEN** el envío falla por red y se reintenta
- **THEN** el POS recibe el pedido una sola vez

#### Scenario: POS rechaza el pedido
- **WHEN** el POS rechaza el pedido (producto agotado, mesa cerrada en el POS)
- **THEN** el pedido queda como rechazado con el motivo y el mesero es notificado; no se asigna ningún monto

### Requirement: Adaptador Fudo
El sistema SHALL incluir un adaptador para Fudo que soporte al menos la lectura de mesas e ítems. La creación de pedidos SHALL declararse soportada solo si la API de Fudo lo permite.

#### Scenario: Credenciales inválidas
- **WHEN** las credenciales de Fudo del local son inválidas o expiran
- **THEN** la integración queda en estado de error visible para el administrador, y el local puede seguir operando con el adaptador manual
