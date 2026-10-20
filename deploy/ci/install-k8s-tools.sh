#!/usr/bin/env bash
# Instala kind, ctlptl y Tilt en el runner de CI con versión y SHA-256 fijos.
# Para actualizar: cambiar versión y hash (de los checksums oficiales del release).
set -euo pipefail
bin="${1:-/usr/local/bin}"
tmp="$(mktemp -d)"
trap 'rm -rf "$tmp"' EXIT

fetch() { # url sha256 destino
  curl -fsSL "$1" -o "$3"
  echo "$2  $3" | sha256sum --check --quiet
}

fetch https://github.com/kubernetes-sigs/kind/releases/download/v0.33.0/kind-linux-amd64 \
  aee6151561422756b764a4ae28e7f44cda5af5a9eead3cc9985112b1de8d8e0d "$tmp/kind"
fetch https://github.com/tilt-dev/ctlptl/releases/download/v0.9.6/ctlptl.0.9.6.linux.x86_64.tar.gz \
  a83ad620d04a526fd4186adfab9e757e8d59b9becf9b1244a9416dfaabec610f "$tmp/ctlptl.tgz"
fetch https://github.com/tilt-dev/tilt/releases/download/v0.37.8/tilt.0.37.8.linux.x86_64.tar.gz \
  e39513f958705d30524d55f68b1d46fbef2b46a0da568efd00e6383dee6be44f "$tmp/tilt.tgz"

tar -xzf "$tmp/ctlptl.tgz" -C "$tmp" ctlptl
tar -xzf "$tmp/tilt.tgz" -C "$tmp" tilt
sudo install -m 0755 "$tmp/kind" "$tmp/ctlptl" "$tmp/tilt" "$bin/"
kind version && ctlptl version && tilt version
