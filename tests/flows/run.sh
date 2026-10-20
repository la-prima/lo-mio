#!/usr/bin/env bash
# Flujos de la API contra el ambiente desplegado. Uso: tests/flows/run.sh [url]
set -euo pipefail
cd "$(dirname "$0")"
mkdir -p ../../reports/flows
ca="../../reports/flows/ca.crt"
kubectl get secret lo-mio-local-ca -n cert-manager -o jsonpath='{.data.ca\.crt}' | base64 -d >"$ca"
API_URL="${1:-https://api.lo-mio.localhost}" NODE_EXTRA_CA_CERTS="$PWD/$ca" pnpm exec playwright test
