# Proposal

## Why

Con carga manual, el mesero carga los pedidos dos veces (en Fudo y en lo-mio), lo que contradice el principio de no agregarle trabajo. La integración con el POS del piloto elimina esa doble carga.

## What Changes

- Sincronización de ítems de cada mesa desde el POS, sin duplicados, reflejando anulaciones y cambios de precio.
- Adaptador Fudo que implementa el contrato `PosAdapter`.
- Modo `order-via-lo-mio` (pedido desde lo-mio al POS), solo si la API de Fudo permite crear pedidos.

## Capabilities

### New Capabilities

Ninguna.

### Modified Capabilities

- `pos-integration`: se agregan sincronización, pedido desde lo-mio y adaptador Fudo.

## Fuera de alcance

- Otros POS.
- Lectura de pagos desde Fudo (modo de liquidación futuro).

## Impact

- Crece `contexts/pos` (adaptador Fudo, sincronizador).
- Credenciales de Fudo por local, guardadas cifradas.
- **Bloqueado por:** acceso y documentación de la API de Fudo (en solicitud). Depende de `reclamo-manual`; es independiente de los demás changes.
