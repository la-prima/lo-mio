#!/usr/bin/env bash
# Schemathesis contra la API desplegada (kind local o CI), por el Gateway y con TLS verificado.
# Uso: tests/contract/run.sh [url]   (por defecto https://api.lo-mio.localhost)
set -euo pipefail
cd "$(dirname "$0")/../.."
url="${1:-https://api.lo-mio.localhost}"
host="$(echo "$url" | sed -E 's#^https?://([^/:]+).*#\1#')"
out="${REPORT_DIR:-$PWD/reports/contract}"
rm -rf "$out" && mkdir -p "$out"
ca="$out/ca.crt"
kubectl get secret lo-mio-local-ca -n cert-manager -o jsonpath='{.data.ca\.crt}' | base64 -d >"$ca"

docker run --rm --add-host "$host:host-gateway" \
  -e API_URL="$url" -e CA_BUNDLE=/out/ca.crt -e REPORT_DIR=/out \
  -v "$PWD/apps/api/openapi.yaml:/spec/openapi.yaml:ro" \
  -v "$PWD/tests/contract/schemathesis.toml:/spec/schemathesis.toml:ro" \
  -v "$out:/out" \
  schemathesis/schemathesis:v4.30.1 --config-file /spec/schemathesis.toml run /spec/openapi.yaml

# Al reporte unificado, con la jerarquía común.
node tests/contract/labels.ts "$out/allure-results" "$PWD/reports/allure-results"
