# Design

## Context

La API corre hoy con `node src/main.ts` y migra al arrancar. Producción será Kubernetes administrado (proveedor a elegir en `despliegue-piloto`; candidato GKE Autopilot en Santiago). Ver `docs/arquitectura.md`, sección 11.

## Goals / Non-Goals

**Goals:**
- Paridad local ↔ producción: mismo chart, misma entrada (Gateway API con TLS), mismo tipo de Postgres (primario + réplica).
- Que `tilt up` levante todo con un solo comando y que `tilt ci` sirva de prueba de humo en CI.

**Non-Goals:**
- Simular el proveedor de nube (balanceadores administrados, IAM).

## Decisions

- **Imagen:** build multi-stage con `pnpm install --prod --filter @lo-mio/api...` (solo las dependencias de producción de la API y de los paquetes del workspace que usa) sobre `gcr.io/distroless/nodejs24-debian13:nonroot`. **No se usa `pnpm deploy`** (cambio respecto al plan inicial): copia los paquetes del workspace dentro de `node_modules`, y Node no quita tipos de archivos `.ts` ahí, así que la API no arrancaría. Con `install --filter` los paquetes quedan como symlinks a su carpeta real, igual que en desarrollo. Sin shell ni gestor de paquetes, UID no root, `readOnlyRootFilesystem`. Alternativa descartada: `node:24-alpine`, que trae shell y un gestor de paquetes que no necesitamos (más superficie de ataque y más CVEs que gestionar).
- **El Job de migraciones tiene su propia ServiceAccount, también como hook** (peso -1): los hooks `pre-install` se crean antes que los recursos normales del chart, así que el Job no puede usar la ServiceAccount de la API.
- **Migraciones como Job de Helm** (`pre-install`/`pre-upgrade`) con el mismo binario (`node src/migrate.ts`). Si una migración falla, el despliegue se detiene antes de reemplazar pods. La migración al arrancar se mantiene solo para desarrollo sin clúster.
- **Probes:** liveness = el proceso responde (`/health/live`, sin tocar la base); readiness = la base responde (`/health`). Así, si la base cae, no se reinician los pods en cascada: solo salen del balanceo.
- **Chart único `lo-mio`** con un bloque de values por componente (`api`; `guestWeb` cuando exista). Incluye `values-local.yaml`; staging y producción llegan en `despliegue-piloto`.
- **Seguridad del chart:** `securityContext` restrictivo (sin privilegios, capabilities eliminadas, seccomp `RuntimeDefault`), `NetworkPolicy` (la API solo recibe tráfico del Gateway y solo sale a Postgres), `PodDisruptionBudget`, recursos con requests y limits, `ServiceAccount` sin token montado.
- **kind:** 1 control plane + 2 workers (para ejercitar el scheduling y el PDB), con un registro local para que Tilt suba imágenes rápido. Se declara con **ctlptl** (herramienta del equipo de Tilt) para que crear el clúster sea idempotente.
- **Entrada:** Gateway API con **Envoy Gateway** (implementación de referencia, sin la complejidad de un service mesh). El servicio de Envoy se expone por NodePort mapeado a los puertos 80/443 del host (`extraPortMappings`), sin depender de un LoadBalancer. En kind usa `externalTrafficPolicy: Cluster`: con `Local` (el valor de Envoy Gateway, que conserva la IP del cliente) el control plane, por donde entra el host y que no tiene pod de Envoy, descarta el tráfico. En producción queda `Local`. Hostnames `*.lo-mio.localhost` (resuelven a 127.0.0.1 sin tocar `/etc/hosts`).
- **TLS:** cert-manager con una CA local autofirmada. Los clientes de prueba confían en esa CA. Se prueba HTTPS de punta a punta, igual que en producción.
- **Postgres:** **CloudNativePG** con 2 instancias. Es el mismo modelo primario/réplica de un Postgres administrado y permite las pruebas de failover de `carga-y-failover`. En producción se usará el Postgres administrado del proveedor; el chart solo recibe la URL por `Secret`.
- **Tilt:** `docker_build` **sin live update** (cambio respecto al plan inicial): el contenedor tiene el sistema de archivos de solo lectura, igual que en producción, y Tilt no puede sincronizar archivos dentro de él. Relajarlo solo en local rompería la paridad. Reconstruir la imagen tras un cambio tarda ~2 s gracias a la caché de capas. Los charts se instalan con `helm_resource` (un `helm upgrade` real, que respeta los hooks). Los recursos se agrupan en `infra` (cert-manager, Envoy Gateway, CloudNativePG, `platform`) y `app` (chart + prueba de humo).

## Risks / Trade-offs

- **[Consumo de recursos en el notebook]** → kind con 3 nodos + CNPG con 2 instancias + Envoy necesita ~6 GB para Docker. Se documenta el mínimo; `values-local.yaml` usa requests bajos.
- **[CI más lento]** → `k8s-smoke` tarda varios minutos. Corre en paralelo con el resto y cachea las imágenes de infraestructura.
- **[Distroless sin shell dificulta depurar]** → Se usa `kubectl debug` con un contenedor efímero; documentado en el runbook.
