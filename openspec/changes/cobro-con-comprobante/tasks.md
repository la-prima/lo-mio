# Tasks

## 1. Configuración

- [ ] 1.1 Herencia local → mesa y modos de operación (`assign-only`/`order-via-lo-mio`, `staff-marked`, evidencia de efectivo); verificar con unit tests de herencia, del cambio con sesión abierta y del rechazo de modos no disponibles

## 2. Pagos y comprobantes (`settlement`)

- [ ] 2.1 Parser del timbre `<TED>`; verificar con fixtures de timbres reales anonimizados, incluido otro emisor y un timbre mal formado
- [ ] 2.2 Registro de pago con versión de saldo esperada, tope de saldo, folio duplicado y evidencia exigida; verificar con tests de integración, incluido el pago con saldo desactualizado
- [ ] 2.3 Subida de fotos con URLs prefirmadas, acceso por rol y retención; verificar con un test de integración contra MinIO

## 3. Salida y cierre (`tables`, `claims`)

- [ ] 3.1 Salida con saldo cero, deuda abierta y reparto con retirados; verificar con tests de integración de cada escenario
- [ ] 3.2 Alerta de ítems sin dueño al primer pago y al cerrar; verificar con un test de integración
- [ ] 3.3 Saga de cierre; verificar con un test de integración que publica los eventos de entrada en distinto orden y cancela si llega un ítem nuevo

## 4. Apps

- [ ] 4.1 Mobile: cámara (QR, PDF417, foto de voucher con OCR) y registro de pago; verificar con un test de los parsers de payload y un flujo Maestro de cobro completo con rotación de comensales
- [ ] 4.2 Guest-web: aviso de ítems sin dueño y saldo pagado; verificar con e2e
