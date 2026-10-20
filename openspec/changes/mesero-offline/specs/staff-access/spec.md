# Spec Delta

## ADDED Requirements

### Requirement: Acciones del personal sin conexión
Toda acción del personal registrada sin conexión SHALL encolarse en su dispositivo y enviarse al recuperar la red, aplicándose exactamente una vez. El dispositivo MUST mostrar cuántas acciones siguen pendientes.

#### Scenario: Registro sin conexión
- **WHEN** el mesero registra un pago sin conexión
- **THEN** el pago queda en cola en su dispositivo, se envía al recuperar conexión y se aplica una sola vez

#### Scenario: Acción rechazada al sincronizar
- **WHEN** una acción encolada se rechaza al enviarse (por ejemplo, el saldo cambió mientras no había red)
- **THEN** el mesero ve la acción rechazada con el motivo y puede rehacerla con los datos actuales
