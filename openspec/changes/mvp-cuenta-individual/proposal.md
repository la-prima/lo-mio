# Proposal

## Why

En mesas compartidas con rotación de personas, cobrar le cuesta al mesero ~20 min por mesa y genera diferencias de caja, porque nadie sabe con certeza quién consumió qué ni quién pagó (ver `docs/vision.md`). El MVP valida en un restaurante piloto (Chile, POS Fudo) que llevar la cuenta por persona sin cambiar la operación del local baja ese tiempo a menos de 3 minutos.

## What Changes

- Una sesión de mesa a la que los comensales se unen escaneando el QR de la mesa (web, sin app) o con una tarjeta NFC/QR que entrega el mesero.
- Un feed de la mesa con los ítems que vienen del POS, donde cada comensal reclama lo suyo: completo, compartido en partes iguales o por porciones.
- El mesero puede proponer reasignaciones. El comensal las confirma en su dispositivo, o el mesero escanea la tarjeta del comensal. Si no hay respuesta, el encargado fuerza con PIN o aprueba desde la vista de administración. La salida preferida es transferir la cuenta del comensal a una tarjeta.
- Saldo por comensal en tiempo real. Ítems sin dueño alertados antes del cierre.
- El mesero registra el pago de cada comensal con su comprobante: escaneo del timbre de la boleta (PDF417) o del voucher; en efectivo, foto de evidencia si el local lo exige.
- Contrato de integración `PosAdapter` con dos adaptadores: **manual** (el mesero carga ítems en lo-mio) y **Fudo** (lectura de ítems de la mesa).
- Configuración por local con override por mesa: modo de envío de pedidos (solo asignación vs. pedido desde lo-mio al POS), modo de liquidación y exigencia de evidencia.
- Base técnica: monolito modular organizado en contextos de negocio (DDD) que se comunican por eventos asíncronos, API Fastify sobre Postgres, app móvil (React Native/Expo) para personal y comensales frecuentes, web liviana para el comensal que entra por QR, y pruebas de integración, e2e, carga y failover.

## Capabilities

### New Capabilities

- `venue-config`: configuración de local y mesa (país, moneda, modos de operación) con herencia local → mesa.
- `staff-access`: roles mesero, encargado y administrador; autenticación del personal y PIN de encargado.
- `table-session`: apertura, unión de comensales, rotación y cierre de una sesión de mesa.
- `guest-identity`: identificación anónima del comensal por navegador, tarjeta o posavasos, y transferencia de cuenta entre identificadores.
- `item-claims`: reclamo y reparto de ítems, reasignación con confirmación, override auditado e ítems sin dueño.
- `pos-integration`: contrato de adaptador POS, sincronización de ítems y envío opcional de pedidos al POS.
- `settlement`: saldo por comensal, registro de pagos con comprobante y condiciones de cierre de mesa.

### Modified Capabilities

Ninguna (primer change del proyecto).

## Fuera de alcance

- Pago desde el celular del comensal (Webpay / Mercado Pago) y lectura de pagos desde Fudo. El modo de liquidación queda modelado para agregarlos en changes posteriores.
- Posavasos y pulseras: usan el mismo protocolo que la tarjeta, así que no requieren código extra. Su compra y logística se evalúan después del piloto.
- Propinas por persona, alertas de salida, analítica para el local.
- Otros POS distintos de Fudo y otros países distintos de Chile (el modelo los admite, pero no se implementan).
- Broker de mensajes (NATS u otro) y separación en microservicios: el diseño los permite, pero el MVP corre como monolito con eventos sobre Postgres.
- Publicación pública en tiendas: el piloto usa TestFlight y el internal testing de Play.

## Impact

- Nuevo: `contexts/{venues,staff,tables,claims,pos,settlement}` (un paquete por contexto con `domain/`, `contracts/` y `server/`), `packages/client`, `apps/api`, `apps/mobile`, `apps/guest-web`.
- Crece `packages/kernel` (Money, Id, Result, EventEnvelope, puerto EventBus).
- Infraestructura: Postgres (datos + eventos con pg-boss), hosting de contenedores, almacenamiento de imágenes, cuentas de Apple Developer y Google Play.
- CI: jobs de integración, e2e web (Playwright), e2e mobile (Maestro), carga y failover.
- Dependencia externa crítica: acceso a la API de Fudo (en solicitud).
