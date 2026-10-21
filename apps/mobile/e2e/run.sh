#!/usr/bin/env bash
# Flujos Maestro de la app contra la API en kind, con la app release ya instalada en el emulador.
# Uso: apps/mobile/e2e/run.sh
set -euo pipefail
# Siempre el clúster local, nunca el contexto activo de kubectl (podría ser uno real).
kube() { kubectl --context "${KUBE_CONTEXT:-kind-lo-mio}" "$@"; }
cd "$(dirname "$0")/../../.."
out=reports/mobile
mkdir -p "$out"

# La app habla con http://localhost:3000 (src/api.ts): port-forward a la API y `adb reverse`.
kube port-forward -n lo-mio svc/lo-mio-api 3000:80 >"$out/port-forward.log" 2>&1 &
forward=$!
trap 'kill $forward' EXIT
for _ in $(seq 1 30); do curl -fsS -o /dev/null http://localhost:3000/health && break; sleep 1; done
adb reverse tcp:3000 tcp:3000

status=0
maestro test apps/mobile/e2e --format junit --output "$out/junit.xml" \
  --debug-output "$out" --flatten-debug-output || status=$?
node tests/allure/maestro.ts apps/mobile/e2e "$out/junit.xml" "$out" reports/allure-results
exit "$status"
