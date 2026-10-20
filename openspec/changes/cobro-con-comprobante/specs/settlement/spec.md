# Spec Delta

## ADDED Requirements

### Requirement: Registro de pago por el personal
En modo `staff-marked`, el mesero SHALL registrar el pago de un comensal indicando monto, medio de pago y comprobante. Un pago MUST NOT superar el saldo del comensal.

#### Scenario: Pago total con tarjeta
- **WHEN** el mesero registra un pago de 8.500 CLP con tarjeta y escanea el voucher
- **THEN** el saldo del comensal queda en 0 y el pago queda con el comprobante adjunto

#### Scenario: Pago mayor al saldo
- **WHEN** el mesero intenta registrar 10.000 CLP para un saldo de 8.500 CLP
- **THEN** el registro se rechaza indicando el saldo actual

### Requirement: Comprobante de boleta electrónica
Cuando el comprobante sea una boleta electrónica chilena, el sistema SHALL leer el timbre electrónico (código PDF417) y extraer RUT emisor, tipo de documento, folio, fecha y monto total. Si el RUT emisor no coincide con el del local, el sistema MUST advertirlo.

#### Scenario: Timbre legible
- **WHEN** el mesero escanea el timbre de una boleta del local
- **THEN** el pago guarda folio, fecha y monto de la boleta para conciliación

#### Scenario: Boleta de otro emisor
- **WHEN** el RUT emisor del timbre no es el del local
- **THEN** se muestra una advertencia y el mesero debe confirmar o escanear otra boleta

#### Scenario: Folio repetido
- **WHEN** se escanea una boleta cuyo folio ya está asociado a otro pago
- **THEN** se rechaza como duplicada salvo confirmación de un encargado

### Requirement: Comprobante de voucher de tarjeta
Cuando el comprobante sea un voucher de tarjeta, el sistema SHALL guardar una foto del voucher e intentar extraer el código de autorización. Si no logra extraerlo, el mesero MUST poder escribirlo.

#### Scenario: Extracción fallida
- **WHEN** no se puede leer el código de autorización de la foto
- **THEN** se pide ingresarlo manualmente y la foto queda adjunta igual

### Requirement: Evidencia de pago en efectivo
Si el local exige evidencia en efectivo, el mesero SHALL adjuntar una foto del monto entregado. Si no la exige, el pago en efectivo se registra solo con el monto.

#### Scenario: Evidencia exigida y faltante
- **WHEN** el local exige evidencia y el mesero intenta registrar efectivo sin foto
- **THEN** el registro se rechaza

### Requirement: Retención de comprobantes
Las imágenes de comprobantes SHALL ser accesibles solo para encargados y administradores del local, y MUST eliminarse tras el plazo de retención configurado por el local (por defecto 90 días), conservando los datos extraídos.

#### Scenario: Vencimiento de retención
- **WHEN** una foto de comprobante supera el plazo de retención
- **THEN** la imagen se elimina y el pago conserva folio, monto y fecha
