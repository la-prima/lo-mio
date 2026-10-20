# Tasks

## 1. Infraestructura

- [ ] 1.1 Elegir proveedor de Kubernetes administrado (registrar la decisión en este `design.md`), registro de imágenes con firma (cosign) y desplegar staging con el chart y un workflow de despliegue; verificar el flujo completo en staging con dispositivos reales
- [ ] 1.2 Documentar `docs/runbook.md` (despliegue, rollback, incidentes); verificar ejecutando un rollback en staging siguiendo el runbook
- [ ] 1.3 Desplegar producción; verificar health check y alertas básicas

## 2. Piloto

- [ ] 2.1 Medir la línea base (tiempo de cobro y diferencias de caja en 5–10 mesas largas sin lo-mio)
- [ ] 2.2 Cargar el local (mesas, QR impresos, tarjetas, personal) y capacitar al personal
- [ ] 2.3 Etapa 1, modo sombra (1 semana); verificar comparando la cuenta de lo-mio con la real
- [ ] 2.4 Etapas 2 y 3; verificar las métricas de éxito de `docs/vision.md` contra la línea base
