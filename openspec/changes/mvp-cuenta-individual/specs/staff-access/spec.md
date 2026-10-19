# Spec Delta

## Purpose

Acceso del personal del local (meseros, encargados, administradores) y autorización de acciones sensibles como overrides y cierres.

## ADDED Requirements

### Requirement: Roles del personal
El sistema SHALL distinguir los roles `waiter`, `manager` y `admin`, siempre dentro de un local. Toda acción del personal MUST quedar asociada a la persona que la realizó.

#### Scenario: Mesero opera su local
- **WHEN** un mesero autenticado del local A consulta una mesa del local A
- **THEN** la consulta se permite

#### Scenario: Acceso cruzado entre locales
- **WHEN** un usuario del local A intenta leer o modificar datos del local B
- **THEN** la operación se rechaza y el intento queda registrado

### Requirement: PIN de encargado
Cada encargado SHALL tener un PIN personal para autorizar acciones sensibles desde el dispositivo de un mesero. Tras 5 intentos fallidos consecutivos el PIN MUST bloquearse durante 15 minutos.

#### Scenario: Autorización con PIN
- **WHEN** un encargado ingresa su PIN correcto en el dispositivo del mesero para forzar una asignación
- **THEN** la acción se ejecuta y queda registrada a nombre del encargado

#### Scenario: Bloqueo por intentos
- **WHEN** se ingresa un PIN incorrecto 5 veces seguidas
- **THEN** el PIN queda bloqueado 15 minutos y se notifica a los administradores del local

### Requirement: Sesión de dispositivo del personal
El personal SHALL iniciar sesión en su dispositivo una vez por turno. La sesión MUST expirar tras 12 horas o al cerrarla manualmente.

#### Scenario: Sesión expirada
- **WHEN** un mesero con la sesión expirada intenta registrar un pago
- **THEN** se le pide volver a autenticarse y la acción pendiente se conserva para reintentarla
