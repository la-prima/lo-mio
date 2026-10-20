# Proposal

## Why

El valor del MVP se valida en el local, no en staging. Este change lleva lo construido al restaurante piloto de forma gradual y con vuelta atrás.

## What Changes

- Elección de hosting y despliegue de staging y producción.
- Runbook de operación (despliegue, rollback, incidentes).
- Carga del local piloto: mesas, QR impresos, tarjetas, personal.
- Plan de despliegue en tres etapas: modo sombra, grupo de mesas y todo el local.
- Medición de las métricas de éxito del piloto.

## Capabilities

### New Capabilities

Ninguna (`skip_specs: true`).

### Modified Capabilities

Ninguna.

## Fuera de alcance

- Segundo local.
- Publicación pública en las tiendas.

## Impact

- Infraestructura: contenedores, Postgres administrado, almacenamiento de objetos, dominio y certificados.
- Nuevo: `docs/runbook.md`, workflow de despliegue.
- Depende de: `cobro-con-comprobante`, `mesero-offline` y `carga-y-failover`. `tarjetas-y-reasignacion` es recomendable; `integracion-fudo` es deseable pero no bloquea (hay carga manual).
