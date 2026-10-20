# Proposal

## Why

Reclamar sin poder cobrar no ahorra los ~20 minutos. Este change cierra el ciclo: cada comensal paga su saldo con un comprobante verificable, y la mesa se cierra solo cuando cada ítem tiene dueño y cada saldo está saldado o reconocido.

## What Changes

- El mesero registra el pago de cada comensal con monto, medio y comprobante: timbre de la boleta (PDF417), voucher de tarjeta (foto + código de autorización) o foto del efectivo si el local la exige.
- Detección de folios duplicados y boletas de otro emisor.
- Salida de comensales (saldo cero, o deuda abierta marcada por el mesero).
- Alerta de ítems sin dueño al primer pago y al intentar cerrar.
- Cierre de mesa coordinado entre contextos.
- Configuración de modos de operación por local, con override por mesa.
- Retención de fotos de comprobantes.

## Capabilities

### New Capabilities

Ninguna: todas las capabilities ya las introduce `reclamo-manual`.

### Modified Capabilities

Se agregan requirements (sin modificar los existentes):
- `venue-config`: herencia local → mesa y modos de operación.
- `table-session`: salida de comensales y cierre de sesión.
- `item-claims`: ítems sin dueño y reparto con comensales retirados.
- `settlement`: registro de pago, comprobantes (boleta, voucher, efectivo) y retención.

## Fuera de alcance

- Pago desde el celular del comensal y lectura de pagos desde Fudo.
- Validación de la firma electrónica del SII en el timbre.
- Registro de pagos sin conexión: `mesero-offline`.

## Impact

- Crecen `venues`, `tables`, `claims`, `settlement`.
- Cámara en `apps/mobile` (QR, PDF417, foto de voucher).
- Almacenamiento de objetos compatible con S3 (MinIO en tests).
- Depende de: `reclamo-manual`.
