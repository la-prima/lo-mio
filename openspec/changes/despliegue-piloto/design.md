# Design

## Context

Producción es Kubernetes administrado con el chart de `plataforma-k8s`, Postgres administrado y almacenamiento S3. Las métricas de éxito están en `docs/vision.md`.

## Goals / Non-Goals

**Goals:**
- Desplegar sin interrumpir la operación del local, con rollback inmediato.
- Medir el antes y el después con los mismos criterios.

**Non-Goals:**
- Alta disponibilidad multi-región.

## Decisions

- **Despliegue en tres etapas:**
  1. **Modo sombra** (1 semana): lo-mio corre en paralelo y el mesero cobra como siempre. Se compara la cuenta de lo-mio con la real.
  2. **Modo activo** en un grupo de mesas, usando el override de configuración por mesa.
  3. **Todo el local.**
- **Rollback:** desactivar lo-mio en el local. En `assign-only` el local sigue operando sin cambios, porque no se reemplaza ni el POS ni el pago.
- **Línea base antes de la etapa 1:** tiempo de cobro por mesa y diferencias de caja, medidos en 5–10 mesas largas sin lo-mio.

## Risks / Trade-offs

- **[El personal no adopta la app]** → Capacitación corta en la etapa 1, con el modo sombra como práctica sin riesgo.

## Open Questions

- Proveedor de Kubernetes administrado. El candidato por latencia es GKE Autopilot en Santiago (`southamerica-west1`).
