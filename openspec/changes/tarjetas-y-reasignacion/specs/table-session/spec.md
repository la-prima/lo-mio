# Spec Delta

## MODIFIED Requirements

### Requirement: Unión de comensales
Un comensal SHALL poder unirse a la sesión abierta de una mesa escaneando el QR fijo de la mesa o presentando una tarjeta al mesero. Unirse MUST tomar menos de 10 segundos y MUST NOT pedir datos personales.

#### Scenario: Unión por QR
- **WHEN** un comensal escanea el QR de la mesa 3 con su celular
- **THEN** entra al feed de la sesión abierta de la mesa 3 como comensal anónimo con un alias editable

#### Scenario: QR de mesa sin sesión
- **WHEN** un comensal escanea el QR de una mesa sin sesión abierta
- **THEN** se abre la sesión y el comensal queda unido

#### Scenario: Varios comensales escanean a la vez
- **WHEN** varios comensales escanean el QR de la misma mesa al mismo tiempo
- **THEN** todos quedan en la misma sesión y cada uno recibe un alias distinto

#### Scenario: QR antiguo o de otro local
- **WHEN** se escanea un QR con un código de mesa inexistente o revocado
- **THEN** se muestra un error claro y no se crea ninguna sesión

#### Scenario: Unión con tarjeta
- **WHEN** un comensal sin celular le entrega al mesero una tarjeta libre en la mesa 3
- **THEN** el mesero la vincula y el comensal queda unido a la sesión de la mesa 3
