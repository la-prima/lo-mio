# Proposal

## Why

En el local hay excepciones que el flujo de reclamo no resuelve solo: alguien reclamó mal, alguien no tiene celular o se quedó sin batería. Sin herramientas para el personal, esas excepciones vuelven a convertirse en los 20 minutos de reconstrucción.

## What Changes

- Tarjetas y posavasos NFC (con QR impreso) que el mesero vincula a un comensal.
- Transferencia de la cuenta de un comensal a otro identificador (ej. de celular a tarjeta).
- Reasignaciones propuestas por el mesero, que el comensal confirma en su dispositivo o el mesero confirma escaneando la tarjeta.
- Override sin respuesta: PIN de encargado, aprobación remota o transferencia a tarjeta.
- Tiempo de espera de confirmación configurable.

## Capabilities

### New Capabilities

Ninguna.

### Modified Capabilities

Se agregan requirements:
- `venue-config`: tiempo de espera de confirmación.
- `staff-access`: PIN de encargado.
- `guest-identity`: identificador físico y transferencia de cuenta.
- `item-claims`: reasignación con confirmación y override.

## Fuera de alcance

- Compra y logística de tarjetas y posavasos (decisión del piloto).
- Pulseras: mismo protocolo, sin código extra.

## Impact

- Crecen `venues`, `staff`, `tables`, `claims`.
- NFC en `apps/mobile` (`react-native-nfc-manager`).
- Depende de: `cobro-con-comprobante` (el override y las disputas afectan saldos y cierre).
