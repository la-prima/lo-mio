# Spec Delta

## Purpose

Saldo de cada comensal y registro de sus pagos con comprobante verificable, para que cada peso cobrado tenga un respaldo.

## ADDED Requirements

### Requirement: Saldo por comensal
El saldo de un comensal SHALL ser la suma de sus partes de los ítems que tiene asignados, en la moneda de su sesión. Cada cambio de un reparto MUST recalcular a todos los comensales afectados, los dueños anteriores y los nuevos. Un cambio más viejo que llega tarde MUST NOT pisar el vigente.

#### Scenario: Saldo con compartido
- **WHEN** un comensal tiene una cerveza de 4.500 CLP y un tercio de una tabla de 12.000 CLP
- **THEN** su saldo es 8.500 CLP

#### Scenario: Comensal sin ítems
- **WHEN** un comensal se une a la mesa y todavía no tiene ítems
- **THEN** aparece en los saldos de la mesa con saldo 0 en la moneda de la sesión

#### Scenario: Cambio de reparto
- **WHEN** un ítem que era de un solo comensal se reparte con otro
- **THEN** baja el saldo del dueño anterior y sube el del nuevo, y la suma de ambos no cambia
