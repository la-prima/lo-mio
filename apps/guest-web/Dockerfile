# syntax=docker/dockerfile:1
# Se construye desde la raíz del repo: docker build -f apps/guest-web/Dockerfile .

FROM node:24-trixie-slim AS build
WORKDIR /app
RUN corepack enable
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
RUN pnpm fetch
COPY . .
RUN pnpm install --offline --frozen-lockfile --ignore-scripts --filter "@lo-mio/guest-web..."
# Falla si la carga inicial supera el presupuesto (budget.ts).
RUN pnpm --filter @lo-mio/guest-web build

# Un binario estático sobre `scratch`: sin shell ni gestor de paquetes; usuario sin privilegios.
FROM ghcr.io/static-web-server/static-web-server:2.44.1
COPY --from=build /app/apps/guest-web/dist /public
COPY apps/guest-web/sws.toml /etc/sws.toml
ENV SERVER_CONFIG_FILE=/etc/sws.toml
USER 65532:65532
EXPOSE 8080
