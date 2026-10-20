# Spec Delta

## Purpose

Saldo de cada comensal y registro de sus pagos con comprobante verificable, para que cada peso cobrado tenga un respaldo.

## ADDED Requirements

### Requirement: Saldo por comensal
El saldo de un comensal SHALL ser la suma de sus partes de ítems vigentes menos sus pagos registrados. Ítems anulados o en disputa no confirmada MUST NOT sumar al saldo.

#### Scenario: Saldo con compartido
- **WHEN** un comensal tiene una cerveza de 4.500 CLP y un tercio de una tabla de 12.000 CLP
- **THEN** su saldo es 8.500 CLP
