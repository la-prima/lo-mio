# Tasks

## 1. Descubrimiento

- [ ] 1.1 **Bloqueante externo:** obtener acceso y documentación de la API de Fudo; importar su Swagger en `contracts/external/fudo/` y registrar en este `design.md` capacidades, autenticación, límites de rate y si existen webhooks

## 2. Sincronización

- [ ] 2.1 Sincronizador con deduplicación por `posItemId`, anulaciones, cambios de precio y backoff; verificar con tests de integración usando un adaptador fake
- [ ] 2.2 Estado de la conexión visible en administración y uso del adaptador manual como respaldo; verificar con un test de integración de credenciales inválidas

## 3. Adaptador Fudo

- [ ] 3.1 Adaptador Fudo contra el mock de Microcks generado desde su Swagger; verificar que pasa la suite de contrato
- [ ] 3.2 Modo `order-via-lo-mio` con envío idempotente (solo si 1.1 confirma que se pueden crear pedidos); verificar con un test de reintento tras corte de red y de rechazo del POS
