#!/usr/bin/env bash
# E2E de la web del comensal contra el ambiente desplegado. Uso: apps/guest-web/e2e/run.sh [url]
set -euo pipefail
# Siempre el clúster local, nunca el contexto activo de kubectl (podría ser uno real).
kube() { kubectl --context "${KUBE_CONTEXT:-kind-lo-mio}" "$@"; }
cd "$(dirname "$0")/.."
mkdir -p ../../reports/guest-web
ca="../../reports/guest-web/ca.crt"
kube get secret lo-mio-local-ca -n cert-manager -o jsonpath='{.data.ca\.crt}' | base64 -d >"$ca"
WEB_URL="${1:-https://mesa.lo-mio.localhost}" NODE_EXTRA_CA_CERTS="$PWD/$ca" pnpm exec playwright test
