# Design

## Context

Aplica `docs/arquitectura.md`; las reglas de consistencia entre pago, saldo y cierre son las de la sección 5.

## Goals / Non-Goals

**Goals:**
- Que nunca se registre un pago sobre un saldo desactualizado.
- Que cada peso cobrado tenga un comprobante asociado.

**Non-Goals:**
- Conciliación automática con el SII o con la terminal de pago.

## Decisions

- **Pago con versión de saldo esperada:** el comando de pago lleva la versión de la proyección que vio el mesero; si cambió, se rechaza y se devuelve el saldo actual.
- **Cierre como saga en `tables`:** pide el cierre, espera `claims.session.all-items-owned.v1` y `settlement.session.balances-cleared.v1`; si llega un ítem nuevo o un saldo cambia en el medio, se cancela y se avisa.
- **Timbre SII:** el parser del XML `<TED>` (RUT emisor `RE`, tipo `TD`, folio `F`, fecha `FE`, monto `MNT`) vive en `settlement/domain`, es puro y se prueba con timbres reales anonimizados. No se valida la firma del SII (`ponytail:` riesgo bajo, porque se escanea una boleta física impresa por el propio local; se valida cuando haya pagos fuera del local).
- **Voucher:** foto + extracción del código de autorización con OCR en el dispositivo (ML Kit vía módulo Expo). Si falla, se ingresa a mano.
- **Fotos:** se suben directo al almacenamiento de objetos con URLs prefirmadas; la retención se aplica con una regla de ciclo de vida del bucket; acceso solo para encargados y admin.
- **Eventos nuevos:** `settlement.payment.recorded.v1`, `settlement.session.balances-cleared.v1`, `claims.session.all-items-owned.v1`, `tables.guest.left.v1`, `tables.session.closed.v1`.

## Risks / Trade-offs

- **[Timbres ilegibles en papel térmico gastado]** → Ingreso manual de folio y monto como respaldo; se registra la tasa de fallas.
- **[Fotos de vouchers con datos de tarjeta]** → Los vouchers chilenos imprimen el PAN truncado; acceso restringido y retención limitada.

## Open Questions

- Plazo de retención por defecto (90 días es provisorio). Lo confirma el local con su contador.
