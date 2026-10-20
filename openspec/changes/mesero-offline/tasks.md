# Tasks

## 1. Cola offline

- [ ] 1.1 Cola SQLite con orden estricto, idempotency key y reintentos; verificar con unit tests de la cola (red caída, rechazo, reinicio)
- [ ] 1.2 Indicador de pendientes y manejo de rechazos en la UI; verificar con un flujo Maestro que corta la red a mitad del registro de un pago y de una carga de ítems

## 2. Distribución del piloto

- [ ] 2.1 EAS Build y distribución por TestFlight e internal testing de Play; verificar instalando en los dispositivos del piloto
- [ ] 2.2 EAS Update en el canal del piloto; verificar publicando un cambio JS y viéndolo en un dispositivo instalado
