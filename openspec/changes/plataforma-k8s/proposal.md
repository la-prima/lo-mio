# Proposal

## Why

Producción va a correr en Kubernetes administrado. Para que lo que se prueba localmente y en CI se comporte como producción, la API (y luego la web del comensal) tiene que correr en contenedores, desplegarse con el mismo Helm chart y entrar por un Gateway API, igual que en producción. Hoy el ambiente local es un Postgres en `compose.yaml` y la API corriendo directo en Node.

## What Changes

- Imagen de contenedor de la API: multi-stage, sin root y con sistema de archivos de solo lectura.
- Helm chart `deploy/helm/lo-mio` con la API, sus probes, políticas de red, presupuesto de disrupción y un Job de migraciones.
- Clúster local con kind que simula producción: varios nodos, Gateway API con Envoy Gateway, TLS con cert-manager y Postgres con CloudNativePG (primario + réplica).
- Tilt para el ciclo de desarrollo: build, despliegue con el chart y recarga en vivo.
- Se elimina `compose.yaml`. Los tests de integración siguen con Testcontainers.
- CI: escaneo de imagen y chart (Trivy), SBOM, lint del chart y una prueba de humo en kind.

## Capabilities

### New Capabilities

Ninguna: es plataforma, sin comportamiento observable por usuarios (`skip_specs: true`).

### Modified Capabilities

Ninguna.

## Fuera de alcance

- Imagen y componente del chart para `guest-web`: llegan con `reclamo-manual`, cuando la app exista. El chart queda preparado para sumarla.
- Clúster de producción, registro de imágenes y firma de imágenes: `despliegue-piloto`.
- Observabilidad (métricas y trazas): cuando haya tráfico real.

## Impact

- Nuevo: `apps/api/Dockerfile`, `deploy/helm/lo-mio/`, `deploy/kind/`, `Tiltfile`.
- Se elimina `compose.yaml`; cambia "Empezar" en el README.
- Herramientas locales: Docker, kind, ctlptl, Tilt, Helm, kubectl.
- CI: jobs `image` y `k8s-smoke`, que pasan a ser checks requeridos.
- Depende de: `base-tecnica`.
