# Proposal

## Why

El wifi de los locales es irregular y el mesero no puede perder un pago o una carga porque se cortó la red. Este change hace que toda acción del personal sobreviva a un corte y se aplique exactamente una vez.

## What Changes

- Cola persistente de acciones del personal en el dispositivo, con envío al recuperar la red.
- Indicador de acciones pendientes y manejo de acciones rechazadas al sincronizar.
- Distribución de la app a los dispositivos del piloto (TestFlight, internal testing de Play) y actualizaciones JS con EAS Update.

## Capabilities

### New Capabilities

Ninguna.

### Modified Capabilities

- `staff-access`: se agrega el requirement de acciones del personal sin conexión y se modifica Sesión de dispositivo del personal (con la sesión expirada, la acción pendiente se conserva para reintentarla).

## Fuera de alcance

- Modo offline del comensal (sin red ve el último estado y un aviso).
- Publicación pública en las tiendas.

## Impact

- `apps/mobile`: SQLite (`expo-sqlite`), EAS Build/Update.
- `apps/api`: idempotencia por clave en todos los comandos del personal (la base ya existe desde `reclamo-manual`).
- Depende de: `cobro-con-comprobante`. Requiere cuentas de Apple Developer y Google Play.
