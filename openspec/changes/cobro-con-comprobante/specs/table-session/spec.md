# Spec Delta

## ADDED Requirements

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
