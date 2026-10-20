# Tasks

## 1. Identificadores físicos (`tables`)

- [ ] 1.1 Registro de identificadores, vinculación, liberación al pagar y transferencia de cuenta; verificar con tests de integración de cada escenario
- [ ] 1.2 Mobile: lectura NFC y QR impreso; verificar en dispositivos reales iOS y Android y con un test del parser de payload

## 2. PIN y tiempo de espera

- [ ] 2.1 PIN de encargado con bloqueo y rate limit; verificar con un test de integración del bloqueo y su vencimiento
- [ ] 2.2 Configuración del tiempo de espera con override por mesa; verificar con unit tests del valor por defecto y del rango

## 3. Reasignación (`claims`)

- [ ] 3.1 Dominio: propuesta, confirmación (dispositivo o escaneo), rechazo → disputa, y quita sin confirmación; verificar con unit tests
- [ ] 3.2 Server: override con PIN, aprobación remota y bloqueo antes del timeout; verificar con tests de integración de cada camino

## 4. Apps

- [ ] 4.1 Mobile: reasignar, confirmar con tarjeta, override y aprobaciones pendientes del encargado; verificar con flujos Maestro
- [ ] 4.2 Guest-web: aceptar o rechazar una reasignación y ver el historial; verificar con e2e
