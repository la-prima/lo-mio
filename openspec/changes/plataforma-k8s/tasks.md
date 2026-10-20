# Tasks

## 1. Imagen

- [x] 1.1 `apps/api/Dockerfile` multi-stage (`pnpm deploy --prod`, distroless nonroot) y entrypoint `src/migrate.ts`; verificar que la imagen arranca contra Postgres, responde `/health` y que Trivy no reporta vulnerabilidades altas ni críticas
- [x] 1.2 Separar `/health/live` (proceso) de `/health` (readiness con base); verificar con tests de integración

## 2. Helm chart

- [ ] 2.1 Chart `deploy/helm/lo-mio` con la API: Deployment, Service, HTTPRoute, Job de migraciones, NetworkPolicy, PDB, ServiceAccount, securityContext y `values-local.yaml`; verificar con `helm lint`, kubeconform y `trivy config` sin hallazgos altos

## 3. Clúster local

- [ ] 3.1 `deploy/kind/cluster.yaml` (ctlptl: 3 nodos, registro local, puertos 80/443) con Envoy Gateway, cert-manager (CA local) y CloudNativePG (2 instancias); verificar que el clúster se crea desde cero y que el Gateway responde por HTTPS
- [ ] 3.2 `Tiltfile` con build, live update y el chart; eliminar `compose.yaml` y actualizar "Empezar" en el README; verificar que `tilt ci` levanta todo y que `https://api.lo-mio.localhost/health` responde 200

## 4. CI

- [ ] 4.1 Job `image`: build, Trivy de imagen y chart (falla con altas o críticas) y SBOM CycloneDX como artifact; verificar en el PR
- [ ] 4.2 Job `k8s-smoke`: kind en CI + `tilt ci` + `/health` por el Gateway; agregar `image` y `k8s-smoke` a los checks requeridos del ruleset; verificar en el PR

## 5. Documentación

- [ ] 5.1 Comandos y requisitos en `AGENTS.md` (`tilt up`, requisitos de recursos, `kubectl debug`); verificar que un clon limpio levanta el ambiente siguiendo solo el README
