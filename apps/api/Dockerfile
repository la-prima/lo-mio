# syntax=docker/dockerfile:1
# Se construye desde la raíz del repo: docker build -f apps/api/Dockerfile .

# Las dos etapas usan Debian 13 (misma libc).
FROM node:24-trixie-slim AS build
WORKDIR /app
RUN corepack enable
# Primero solo el lockfile: la descarga de dependencias queda en caché mientras no cambie.
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
RUN pnpm fetch --prod
COPY . .
# Solo dependencias de producción de la API y de los paquetes del workspace que usa.
# Los paquetes del workspace quedan como symlinks a su carpeta (fuera de node_modules),
# porque Node no quita tipos de archivos .ts dentro de node_modules.
RUN pnpm install --offline --frozen-lockfile --prod --ignore-scripts --filter "@lo-mio/api..."

# Sin shell ni gestor de paquetes; usuario sin privilegios.
FROM gcr.io/distroless/nodejs24-debian13:nonroot
ENV NODE_ENV=production
WORKDIR /app
COPY --from=build /app/package.json ./
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/packages ./packages
COPY --from=build /app/contexts ./contexts
COPY --from=build /app/apps/api ./apps/api
WORKDIR /app/apps/api
# Explícito aunque la base `:nonroot` ya lo define: si se cambia la base, sigue sin ser root.
USER 65532:65532
EXPOSE 3000
# El entrypoint de la imagen es node. Migraciones: CMD ["src/migrate.ts"].
CMD ["src/main.ts"]
