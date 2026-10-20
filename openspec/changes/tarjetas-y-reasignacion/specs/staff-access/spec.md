# Spec Delta

## ADDED Requirements

### Requirement: PIN de encargado
Cada encargado SHALL tener un PIN personal para autorizar acciones sensibles desde el dispositivo de un mesero. Tras 5 intentos fallidos consecutivos el PIN MUST bloquearse durante 15 minutos.

#### Scenario: Autorización con PIN
- **WHEN** un encargado ingresa su PIN correcto en el dispositivo del mesero para forzar una asignación
- **THEN** la acción se ejecuta y queda registrada a nombre del encargado

#### Scenario: Bloqueo por intentos
- **WHEN** se ingresa un PIN incorrecto 5 veces seguidas
- **THEN** el PIN queda bloqueado 15 minutos y se notifica a los administradores del local
