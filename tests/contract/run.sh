#!/usr/bin/env bash
# Schemathesis contra la API desplegada (kind local o CI), por el Gateway y con TLS verificado.
# Uso: tests/contract/run.sh [url]   (por defecto https://api.lo-mio.localhost)
set -euo pipefail
# Siempre el clúster local, nunca el contexto activo de kubectl (podría ser uno real).
kube() { kubectl --context "${KUBE_CONTEXT:-kind-lo-mio}" "$@"; }
cd "$(dirname "$0")/../.."
url="${1:-https://api.lo-mio.localhost}"
host="$(echo "$url" | sed -E 's#^https?://([^/:]+).*#\1#')"
out="${REPORT_DIR:-$PWD/reports/contract}"
rm -rf "$out" && mkdir -p "$out"
ca="$out/ca.crt"
kube get secret lo-mio-local-ca -n cert-manager -o jsonpath='{.data.ca\.crt}' | base64 -d >"$ca"

# Sesión del administrador local (seed de values-local.yaml): sin ella todo respondería 401 y no
# se probaría la conformidad real de las operaciones protegidas.
# Reintenta mientras el límite del login responda 429 (lo consume el fuzzing de una corrida anterior).
login() {
  curl -fsS --cacert "$ca" -H 'content-type: application/json' "$url/v1/staff/sessions" \
    -d '{"email":"admin@lo-mio.localhost","password":"admin-local-123"}'
}
for _ in $(seq 1 15); do session="$(login 2>/dev/null)" && break; sleep 5; done
token="$(echo "${session:?no se pudo iniciar sesión}" | sed -E 's/.*"token":"([^"]+)".*/\1/')"

# Un comensal en una mesa nueva: sin él, las operaciones del comensal solo verían 401.
api() { curl -fsS --cacert "$ca" -H 'content-type: application/json' "$@"; }
qr="$(api -H "authorization: Bearer $token" -H "idempotency-key: $(uuidgen)" \
  "$url/v1/venues/current/tables" -d "{\"label\":\"C$(date +%s | tail -c 6)\"}" |
  sed -E 's/.*"qrCode":"([^"]+)".*/\1/')"
# La mesa llega a `tables` por el bus; el join tiene su propio límite (429) si se corrió hace poco.
for _ in $(seq 1 30); do
  guest="$(api -D - -o /dev/null "$url/v1/join/$qr" -d '{"alias":"Schemathesis"}' 2>/dev/null |
    sed -nE 's/^set-cookie: lomio_guest=([^;]+).*/\1/ip')" && [ -n "$guest" ] && break
  sleep 2
done

# Con el usuario actual: en Linux el contenedor no podría escribir el reporte en la carpeta montada.
docker run --rm --user "$(id -u):$(id -g)" -w /out --add-host "$host:host-gateway" \
  -e API_URL="$url" -e CA_BUNDLE=/out/ca.crt -e REPORT_DIR=/out -e API_TOKEN="$token" -e GUEST_TOKEN="${guest:?no se pudo unir un comensal}" \
  -v "$PWD/apps/api/openapi.yaml:/spec/openapi.yaml:ro" \
  -v "$PWD/tests/contract/schemathesis.toml:/spec/schemathesis.toml:ro" \
  -v "$out:/out" \
  schemathesis/schemathesis:v4.30.1 --config-file /spec/schemathesis.toml run /spec/openapi.yaml

# Al reporte unificado, con la jerarquía común.
node tests/contract/labels.ts "$out/allure-results" "$PWD/reports/allure-results"
