# Glosario

Términos usados en specs, código y UI. En código se usa el término en inglés de la columna 2.

| Español | Código | Significado |
|---|---|---|
| Local | `venue` | Restaurante o bar. Unidad de configuración y de datos (tenant). |
| Mesa | `table` | Mesa física, con su QR fijo. |
| Sesión de mesa | `tableSession` | Desde que se abre la mesa hasta que se cierra. Una mesa tiene muchas sesiones en el día. |
| Comensal | `guest` | Persona dentro de una sesión. Anónimo por defecto. |
| Identificador | `credential` | Medio con el que un comensal se identifica: sesión de navegador, tarjeta NFC o posavasos. |
| Ítem | `item` | Línea de consumo que viene del POS (o se carga manualmente). |
| Reclamo | `claim` | Un comensal dice "esto es mío" (completo o en una parte). |
| Reparto | `split` | Cómo se divide un ítem compartido: partes iguales o porciones. |
| Reasignación | `reassignment` | Cambio de dueño propuesto por el mesero. Queda pendiente hasta que se confirme. |
| Override | `override` | Asignación forzada por el encargado (con PIN o aprobación). Siempre queda auditada. |
| Saldo | `balance` | Lo que un comensal debe: sus reclamos menos sus pagos. |
| Liquidación | `settlement` | Registro de un pago de un comensal con su comprobante. |
| Comprobante | `proof` | Timbre de la boleta (PDF417), voucher de tarjeta o foto del efectivo. |
| Adaptador POS | `posAdapter` | Implementación del contrato de integración con un POS (manual, Fudo, …). |

## Arquitectura

| Término | Significado |
|---|---|
| Contexto | Límite de negocio con su propio modelo y datos (`contexts/<ctx>`). Equivale a un futuro servicio. |
| Agregado | Conjunto de datos que cambia junto y de forma consistente en una transacción (ej. `TabItem`). |
| Evento de dominio | Hecho que ya ocurrió dentro de un contexto, en pasado (ej. "ítem reclamado"). |
| Evento de integración | Evento publicado a otros contextos por el bus, con schema versionado en `contracts/`. |
| Tópico | Nombre del evento en el bus: `<ctx>.<agregado>.<hecho>.v<n>`. |
| Saga | Proceso que coordina varios contextos reaccionando a sus eventos (ej. cierre de mesa). |
| Capa anticorrupción | Traducción entre un sistema externo (POS) y nuestro modelo, para que el externo no lo contamine. |
