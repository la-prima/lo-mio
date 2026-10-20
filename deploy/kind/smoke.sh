#!/usr/bin/env bash
# La API responde por el Gateway con TLS válido (CA local) y HTTP redirige a HTTPS.
set -euo pipefail
ca="$(mktemp)"
trap 'rm -f "$ca"' EXIT
kubectl get secret lo-mio-local-ca -n cert-manager -o jsonpath='{.data.ca\.crt}' | base64 -d >"$ca"

for _ in $(seq 1 30); do
  if curl -fsS --cacert "$ca" https://api.lo-mio.localhost/health; then
    echo
    test "$(curl -s -o /dev/null -w '%{http_code}' http://api.lo-mio.localhost/health)" = 301
    echo "ok: https://api.lo-mio.localhost/health"
    exit 0
  fi
  sleep 2
done
echo "la API no respondió por el Gateway" >&2
exit 1
