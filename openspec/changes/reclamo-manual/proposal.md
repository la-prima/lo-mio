# Proposal

## Why

Es el primer flujo de punta a punta y la hipótesis central del producto: que los comensales reclamen lo suyo sin trabajo extra del mesero. Con este change ya se puede probar en el restaurante, con carga manual y sin depender de la API de Fudo.

## What Changes

- El personal inicia sesión; el mesero abre una mesa y carga ítems desde el catálogo del local.
- El comensal escanea el QR de la mesa (web, sin instalar nada), entra anónimo y ve el feed en vivo.
- El comensal reclama ítems completos o compartidos (partes iguales o porciones) y ve su saldo.
- Todo cambio de asignación queda auditado.
- Contrato `PosAdapter` con el adaptador manual.
- Primera versión de `apps/guest-web` y de `apps/mobile` (solo personal: login, mesas, carga manual).

## Capabilities

### New Capabilities

- `venue-config`: país del local (moneda y documento tributario).
- `staff-access`: roles y sesión de dispositivo del personal.
- `table-session`: apertura de la sesión y unión de comensales.
- `guest-identity`: comensal anónimo con identificador de dispositivo.
- `item-claims`: feed, reclamo completo, ítems compartidos y auditoría.
- `pos-integration`: contrato de adaptador y adaptador manual.
- `settlement`: saldo por comensal.

### Modified Capabilities

Ninguna.

## Fuera de alcance

- Pagos, salida y cierre de mesa: `cobro-con-comprobante`.
- Reasignaciones, override, PIN y tarjetas: `tarjetas-y-reasignacion`.
- Modo offline del mesero: `mesero-offline`.
- Comensal en la app móvil: llega cuando haya comensales frecuentes que la pidan.

## Impact

- Nuevo: contextos `staff`, `tables`, `claims`, `pos`, `settlement`; completa `venues`; `packages/client`; `apps/guest-web`; `apps/mobile`.
- Gateway WebSocket en `apps/api`.
- CI: e2e web (Playwright) y e2e mobile (Maestro, Android).
