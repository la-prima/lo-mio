#!/usr/bin/env bash
# La API y la web del comensal responden por el Gateway con TLS válido (CA local),
# la web comparte origen con la API (/v1) y HTTP redirige a HTTPS.
set -euo pipefail
# Siempre el clúster local, nunca el contexto activo de kubectl (podría ser uno real).
kube() { kubectl --context "${KUBE_CONTEXT:-kind-lo-mio}" "$@"; }
ca="$(mktemp)"
trap 'rm -f "$ca"' EXIT
kube get secret lo-mio-local-ca -n cert-manager -o jsonpath='{.data.ca\.crt}' | base64 -d >"$ca"
status() { curl -s --cacert "$ca" -o /dev/null -w '%{http_code}' "$1"; }

ready() {
  [ "$(status https://api.lo-mio.localhost/health)" = 200 ] &&
    [ "$(status https://mesa.lo-mio.localhost/m/smoke)" = 200 ] &&
    [ "$(status https://mesa.lo-mio.localhost/v1/guests/me)" = 401 ]
}
for _ in $(seq 1 30); do
  if ready; then
    test "$(status http://api.lo-mio.localhost/health)" = 301
    echo "ok: https://api.lo-mio.localhost y https://mesa.lo-mio.localhost (web + /v1)"
    exit 0
  fi
  sleep 2
done
echo "la API o la web no respondieron por el Gateway" >&2
exit 1
