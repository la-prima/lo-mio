# Proposal

## Why

Los objetivos de rendimiento y resiliencia (`docs/arquitectura.md`, sección 9) son hipótesis hasta medirlos. Antes del piloto hay que saber si pg-boss, el gateway WebSocket y la recuperación ante caídas cumplen, y tener esas mediciones corriendo cada noche para detectar regresiones.

## What Changes

- Entorno efímero para pruebas no funcionales (2 instancias de la API, Postgres y proxy).
- Escenarios k6 de carga HTTP, WebSocket y latencia de eventos.
- Pruebas de caos: caída de una instancia de la API y reinicio de la DB a mitad del flujo.
- DAST con OWASP ZAP.
- Workflow nightly que falla si no se cumplen los objetivos.

## Capabilities

### New Capabilities

Ninguna (`skip_specs: true`: no cambia comportamiento).

### Modified Capabilities

Ninguna.

## Fuera de alcance

- Pruebas contra producción.
- Optimizaciones: si un objetivo no se cumple, el arreglo va en su propio change.

## Impact

- Nuevo: `load/`, `load/chaos/`, `compose.load.yaml`, workflow `nightly.yml`.
- Depende de: `cobro-con-comprobante` (flujo completo que medir).
