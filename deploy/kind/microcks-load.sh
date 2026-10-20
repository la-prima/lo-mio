#!/usr/bin/env bash
# Carga en Microcks (kind) los contratos propios y externos. Cada OpenAPI se empaqueta antes
# (resuelve $ref entre archivos, que Microcks no sigue). Idempotente: re-subir reemplaza.
set -euo pipefail
# Siempre el clúster local, nunca el contexto activo de kubectl (podría ser uno real).
kube() { kubectl --context "${KUBE_CONTEXT:-kind-lo-mio}" "$@"; }
cd "$(dirname "$0")/../.."
export REDOCLY_SUPPRESS_UPDATE_NOTICE=true REDOCLY_TELEMETRY=off
url="https://microcks.lo-mio.localhost"
tmp="$(mktemp -d)"
trap 'rm -rf "$tmp"' EXIT
kube get secret lo-mio-local-ca -n cert-manager -o jsonpath='{.data.ca\.crt}' | base64 -d >"$tmp/ca.crt"

until curl -fsS --cacert "$tmp/ca.crt" "$url/api/health" >/dev/null 2>&1; do sleep 2; done

shopt -s nullglob
for contract in apps/api/openapi/platform.yaml contexts/*/contracts/openapi.yaml contracts/external/*/openapi.yaml; do
  # Un contrato sin operaciones no tiene nada que mockear.
  if grep -qE '^paths: \{\}' "$contract"; then echo "sin operaciones: $contract"; continue; fi
  bundled="$tmp/$(echo "$contract" | tr '/' '_')"
  pnpm exec redocly bundle "$contract" -o "$bundled" >/dev/null
  curl -fsS --cacert "$tmp/ca.crt" -F "file=@$bundled" "$url/api/artifact/upload?mainArtifact=true" >/dev/null
  echo "cargado: $contract"
done
