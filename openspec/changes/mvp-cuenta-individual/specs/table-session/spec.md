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

### Requirement: Salida de comensales
Un comensal SHALL poder retirarse de la sesión solo con saldo cero. El mesero MAY marcar a un comensal como retirado con saldo pendiente, lo que MUST registrarse como deuda abierta.

#### Scenario: Salida con saldo cero
- **WHEN** un comensal sin saldo pendiente se retira
- **THEN** deja de aparecer como activo y su historial queda en la sesión

#### Scenario: Comensal que se fue sin pagar
- **WHEN** el mesero marca como retirado a un comensal con saldo de 8.500 CLP
- **THEN** el comensal queda como retirado con deuda abierta de 8.500 CLP, visible para el mesero y el encargado

### Requirement: Cierre de sesión
La sesión SHALL cerrarse solo cuando no quedan ítems sin dueño y todos los saldos son cero o deudas abiertas reconocidas por un encargado.

#### Scenario: Cierre bloqueado por ítems sin dueño
- **WHEN** el mesero intenta cerrar una sesión con 2 ítems sin dueño
- **THEN** el cierre se rechaza y se listan los 2 ítems

#### Scenario: Cierre con deuda reconocida
- **WHEN** queda una deuda abierta y un encargado la reconoce con su PIN
- **THEN** la sesión se cierra y la deuda queda en el reporte del local
