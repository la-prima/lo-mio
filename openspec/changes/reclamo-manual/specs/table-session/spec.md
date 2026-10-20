# Spec Delta

## Purpose

Ciclo de vida de una sesión de mesa: desde que se abre hasta que se cierra, con comensales que llegan y se van en el camino.

## ADDED Requirements

### Requirement: Apertura de sesión
Una mesa SHALL tener como máximo una sesión abierta a la vez. La sesión MUST abrirse cuando el mesero la abre o cuando llega el primer ítem del POS para esa mesa, lo que ocurra primero.

#### Scenario: Apertura por primer pedido
- **WHEN** el POS informa un ítem para la mesa 3 y la mesa 3 no tiene sesión abierta
- **THEN** se abre una sesión para la mesa 3 y el ítem aparece en su feed

#### Scenario: Doble apertura
- **WHEN** dos meseros intentan abrir la mesa 3 al mismo tiempo
- **THEN** existe una sola sesión abierta y ambos ven la misma

### Requirement: Unión de comensales
Un comensal SHALL poder unirse a la sesión abierta de una mesa escaneando el QR fijo de la mesa o presentando una tarjeta al mesero. Unirse MUST tomar menos de 10 segundos y MUST NOT pedir datos personales.

#### Scenario: Unión por QR
- **WHEN** un comensal escanea el QR de la mesa 3 con su celular
- **THEN** entra al feed de la sesión abierta de la mesa 3 como comensal anónimo con un alias editable

#### Scenario: QR de mesa sin sesión
- **WHEN** un comensal escanea el QR de una mesa sin sesión abierta
- **THEN** se abre la sesión y el comensal queda unido

#### Scenario: QR antiguo o de otro local
- **WHEN** se escanea un QR con un código de mesa inexistente o revocado
- **THEN** se muestra un error claro y no se crea ninguna sesión
