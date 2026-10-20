# -*- mode: Python -*-
# Ambiente local que simula producción: `ctlptl apply -f deploy/kind/cluster.yaml && tilt up`.
load("ext://helm_resource", "helm_resource", "helm_repo")

# Nunca desplegar en otro clúster por accidente.
if k8s_context() != "kind-lo-mio":
    fail("Tilt solo corre contra kind-lo-mio. Crear con: ctlptl apply -f deploy/kind/cluster.yaml")

# La primera instalación descarga imágenes; el límite por defecto (30 s) no alcanza.
update_settings(k8s_upsert_timeout_secs=600)

# ---------- infra: lo que en producción provee la plataforma ----------
helm_resource(
    "cert-manager",
    "oci://quay.io/jetstack/charts/cert-manager",
    namespace="cert-manager",
    flags=["--version", "v1.21.2", "--create-namespace", "--set", "crds.enabled=true"],
    labels=["infra"],
)
helm_resource(
    "envoy-gateway",
    "oci://docker.io/envoyproxy/gateway-helm",
    namespace="envoy-gateway-system",
    flags=["--version", "v1.9.2", "--create-namespace"],
    labels=["infra"],
)
helm_repo("cnpg-repo", "https://cloudnative-pg.github.io/charts", labels=["infra"])
helm_resource(
    "cloudnative-pg",
    "cnpg-repo/cloudnative-pg",
    namespace="cnpg-system",
    flags=["--version", "0.29.1", "--create-namespace"],
    resource_deps=["cnpg-repo"],
    labels=["infra"],
)

# Gateway + TLS + Postgres. Espera a que estén listos para que la app no arranque antes.
local_resource(
    "platform",
    cmd=" && ".join([
        "kubectl apply -f deploy/kind/infra/postgres.yaml -f deploy/kind/infra/gateway.yaml -f deploy/kind/infra/tls.yaml",
        "kubectl wait --for=condition=Ready certificate/lo-mio-localhost -n gateway --timeout=180s",
        "kubectl wait --for=condition=Programmed gateway/lo-mio -n gateway --timeout=180s",
        "kubectl wait --for=condition=Ready cluster/lo-mio-db -n lo-mio --timeout=300s",
    ]),
    deps=["deploy/kind/infra"],
    resource_deps=["cert-manager", "envoy-gateway", "cloudnative-pg"],
    labels=["infra"],
)

# Mocks desde los contratos (Microcks), recargados cuando cambia un contrato.
k8s_yaml("deploy/kind/infra/microcks.yaml")
# El namespace y el HTTPRoute van con el workload: si quedaran "uncategorized", Tilt los aplicaría
# antes de que Envoy Gateway instale los CRDs de Gateway API (en un clúster nuevo, falla).
k8s_resource(
    "microcks",
    objects=["mocks:namespace", "microcks:httproute:mocks"],
    resource_deps=["platform"],
    labels=["mocks"],
)
local_resource(
    "microcks-contracts",
    cmd="deploy/kind/microcks-load.sh",
    deps=["apps/api/openapi", "contexts", "contracts/external"],
    ignore=["**/generated/**", "**/*.ts"],
    resource_deps=["microcks"],
    labels=["mocks"],
)

# ---------- app: el mismo chart e imagen que en producción ----------
# Sin live update a propósito: el contenedor tiene el sistema de archivos de solo lectura
# (igual que en producción), así que cada cambio reconstruye la imagen (con caché de capas).
docker_build("lo-mio-api", ".", dockerfile="apps/api/Dockerfile", only=[
    "package.json", "pnpm-lock.yaml", "pnpm-workspace.yaml", "apps/api", "packages", "contexts",
])
docker_build("lo-mio-guest-web", ".", dockerfile="apps/guest-web/Dockerfile", only=[
    "package.json", "pnpm-lock.yaml", "pnpm-workspace.yaml", "tsconfig.base.json", "apps/guest-web",
    "packages",
], ignore=["apps/guest-web/dist", "apps/guest-web/e2e"])
helm_resource(
    "lo-mio",
    "deploy/helm/lo-mio",
    namespace="lo-mio",
    flags=["--values", "deploy/helm/lo-mio/values-local.yaml"],
    image_deps=["lo-mio-api", "lo-mio-guest-web"],
    image_keys=[
        ("api.image.repository", "api.image.tag"),
        ("guestWeb.image.repository", "guestWeb.image.tag"),
    ],
    resource_deps=["platform"],
    labels=["app"],
)

# Prueba de humo: la API responde por el Gateway, por HTTPS, con certificado válido.
local_resource(
    "smoke",
    cmd="deploy/kind/smoke.sh",
    resource_deps=["lo-mio"],
    labels=["app"],
)
