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

## MODIFIED Requirements

### Requirement: Sesión de dispositivo del personal
El personal SHALL iniciar sesión en su dispositivo una vez por turno. La sesión MUST expirar tras 12 horas o al cerrarla manualmente.

#### Scenario: Sesión expirada
- **WHEN** un mesero con la sesión expirada intenta registrar un pago
- **THEN** se le pide volver a autenticarse y la acción pendiente se conserva para reintentarla

#### Scenario: Cierre de sesión
- **WHEN** un mesero cierra su sesión
- **THEN** su token deja de servir de inmediato y cualquier operación con él se rechaza como no autenticada
