# Spec Delta

## MODIFIED Requirements

### Requirement: Saldo por comensal
El saldo de un comensal SHALL ser la suma de sus partes de los ítems que tiene asignados menos sus pagos registrados, en la moneda de su sesión. Un ítem en disputa sin confirmar MUST NOT sumar al saldo de nadie hasta que se resuelva. Cada cambio de un reparto o de un pago MUST recalcular a todos los comensales afectados. Un cambio más viejo que llega tarde MUST NOT pisar el vigente.

#### Scenario: Saldo con compartido
- **WHEN** un comensal tiene una cerveza de 4.500 CLP y un tercio de una tabla de 12.000 CLP
- **THEN** su saldo es 8.500 CLP

#### Scenario: Comensal sin ítems
- **WHEN** un comensal se une a la mesa y todavía no tiene ítems
- **THEN** aparece en los saldos de la mesa con saldo 0 en la moneda de la sesión

#### Scenario: Cambio de reparto
- **WHEN** un ítem que era de un solo comensal se reparte con otro
- **THEN** baja el saldo del dueño anterior y sube el del nuevo, y la suma de ambos no cambia

#### Scenario: Pago parcial
- **WHEN** un comensal con saldo de 8.500 CLP paga 4.500 CLP
- **THEN** su saldo queda en 4.000 CLP

#### Scenario: Ítem en disputa
- **WHEN** el personal reasigna a otro comensal una cerveza de 4.500 CLP y el nuevo dueño todavía no confirma
- **THEN** la cerveza no suma al saldo de ninguno de los dos hasta que se confirme o se resuelva con un override
