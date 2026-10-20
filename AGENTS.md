# AGENTS.md — cómo se trabaja en lo-mio

Este archivo es la fuente de verdad para cualquier agente (y humano). Contexto de producto: [docs/vision.md](docs/vision.md) · términos: [docs/glosario.md](docs/glosario.md).

## Flujo: spec primero (OpenSpec)

1. **No hay código de comportamiento sin un change aprobado** en `openspec/changes/`. Se propone con `/opsx:propose`, se implementa con `/opsx:apply` y se archiva con `/opsx:archive`.
2. Las specs vigentes (`openspec/specs/`) describen lo que el sistema **hace hoy**. Si el código y la spec no coinciden, es un bug de uno de los dos: se reporta, no se elige en silencio.
3. Tooling, refactors y docs no necesitan specs (`skip_specs: true` en el change), pero sí un change si tocan más de un paquete.
4. Un change = una rama = un PR. Un change que no se puede revisar en una sesión es demasiado grande: se parte en cortes verticales (ver el roadmap en el README). Al terminar, `pnpm verify` pasa y las tareas de `tasks.md` quedan marcadas.

## Arquitectura

Monolito modular organizado en **contextos de negocio (DDD)** que se comunican por **eventos asíncronos**. Está diseñado para que cualquier contexto pueda separarse como servicio cambiando el transporte, no el código. Decisiones y su porqué: [docs/arquitectura.md](docs/arquitectura.md). Cada change agrega en su `design.md` solo las decisiones de su feature.

```
packages/
  kernel/        Shared kernel: Money, splitAmount, Id, Result, EventEnvelope, puerto EventBus. Puro (solo zod).
  client/        Cliente de API tipado + hooks; lo usan todos los fronts.
contexts/<ctx>/  Un paquete por contexto (venues, staff, tables, claims, pos, settlement):
  domain/        Agregados, eventos de dominio, reglas. Puro: sin IO ni librerías.
  contracts/     openapi.yaml + asyncapi.yaml (fuente de verdad) y generated/ (zod, tipos; no se edita).
  server/        Casos de uso, repositorios, rutas Fastify, handlers de eventos.
apps/
  api/           Composition root: monta los server/, el bus y los workers. Sin reglas de negocio.
  mobile/        Expo (iOS/Android), superficies por rol. src/features/<ctx>/
  guest-web/     Web liviana del comensal por QR. src/features/<ctx>/
```

Límites (los verifica `tests/architecture.test.ts` en cada commit):
- `kernel` y los `domain/` son puros: solo importan su propio código (y `kernel`). `kernel` además puede usar zod.
- **Entre contextos solo se importa `@lo-mio/<ctx>/contracts`.** Nunca el domain ni el server de otro.
- Solo `apps/api` importa capas `server/`. Los fronts usan `domain/` y `contracts/`, nunca librerías de servidor.
- Las apps no se importan entre sí: lo compartido va a `packages/`.
- Sin ciclos de imports (Biome).

Comunicación entre contextos:
- **Escritura:** un contexto nunca escribe en las tablas de otro. Reacciona a sus eventos.
- **Eventos:** se publican con `EventBus.publish(evento, { tx })` **dentro de la misma transacción** del cambio. Tópico: `<ctx>.<agregado>.<hecho-en-pasado>.v<n>`. El schema vive en el `contracts/` del emisor. Los cambios incompatibles van a una versión nueva.
- **Handlers idempotentes** por `event.id`, siempre.
- **Consistencia:** un comando modifica un agregado, de forma síncrona y con control optimista. Entre contextos es eventual: si una regla cruza contextos, va con versión esperada o una saga (ver `docs/arquitectura.md`, sección 5).

Integraciones (POS, pagos, OCR) **siempre detrás de un contrato** definido en el `domain/` del contexto dueño, con un adaptador por proveedor. El dominio nunca sabe que existe Fudo.

## Reglas de código

1. **Antes de escribir, buscar.** `grep` en `packages/` y `contexts/` por el concepto (en inglés, ver glosario). Reimplementar algo que ya existe es el error más común de un agente.
2. **Lo más simple que funcione.** Nada de abstracciones "para después", interfaces con una sola implementación ni config para valores que no cambian. Si recortas algo a propósito, déjalo marcado con `// ponytail: <límite> — <cuándo mejorarlo>`.
3. **Dinero = enteros en unidad mínima + código de moneda.** Nunca `float`. Repartir siempre con `splitAmount` de `@lo-mio/kernel`.
4. **Validar en los bordes** (HTTP, POS, archivos) con un schema; dentro del sistema, confiar en los tipos.
5. **Errores**: nunca tragarse una excepción. Las fallas esperadas se modelan como resultado y las inesperadas se propagan y se loguean.
6. **Toda mutación de asignaciones o pagos es un evento auditable** (quién, cuándo, desde qué dispositivo, por qué).
7. Sin `any`, sin `!` (non-null assertion), sin `console` (se usa el logger), sin export default (salvo donde el framework lo exige: rutas de Expo Router y archivos `*.config.ts`).
8. Funciones ≤ 60 líneas y complejidad cognitiva ≤ 12 (lo verifica Biome; en `*.test.ts` el límite de líneas no aplica, porque un `describe` agrupa casos). Si no cabe, el diseño está mal.
9. Nombres en inglés en el código, según el glosario. Textos de UI, specs y docs en español.

## Calidad: qué corre y cuándo

| Momento | Qué | Tiempo |
|---|---|---|
| **pre-commit** | gitleaks (secretos), Biome (formato + lint), test de arquitectura, typecheck, tests relacionados con lo modificado, validar specs | < 10 s |
| **commit-msg** | Conventional Commits: `tipo(scope): descripción` | — |
| **pre-push** | `pnpm verify` completo | < 1 min |
| **CI en cada PR** | verify · integración (Testcontainers) · imagen (Trivy + SBOM) · chart (lint, kubeconform, Trivy) · humo en kind · gitleaks (historial completo) · Semgrep (SAST) · CodeQL (SAST) · osv-scanner (SCA + licencias) · *e2e cuando existan los fronts* | minutos |
| **Nightly / pre-release** | *carga (k6), failover, DAST (ZAP), e2e en matriz completa de navegadores* | — |

En cursiva: se activa con el change que crea la app correspondiente (ver el roadmap en el README).

**Nunca** usar `--no-verify`. Si un hook falla, se arregla la causa.

### Pirámide de pruebas

| Tipo | Dónde | Herramienta | Qué cubre |
|---|---|---|---|
| Unit | junto al código: `*.test.ts` | Vitest | Toda regla de `kernel` y de cada `domain/`. Obligatorio para lógica de dinero. |
| Integración | `**/*.int.test.ts` (`pnpm test:int`, requiere Docker) | Vitest + Testcontainers (Postgres real + pg-boss) | Por contexto: comandos, persistencia y eventos (se publican los de entrada y se verifican los de salida). Nada de mocks de la base de datos. |
| Contrato de la API | `tests/contract/` | Schemathesis | La API implementa exactamente su OpenAPI: códigos, schemas, headers, métodos no permitidos. Casos generados desde el contrato. |
| Contrato de adaptadores | `contexts/pos/server/adapters/` | Vitest | Cada adaptador POS pasa la **misma** suite del contrato `PosAdapter`. |
| Flujos de la API | `tests/flows/` | Playwright (cliente generado) | Flujos funcionales por contexto contra el ambiente desplegado, con request/response en cada paso. |
| E2E web | `apps/guest-web/e2e/` | Playwright: Chromium, Firefox, WebKit, Pixel y iPhone emulados | Flujos del comensal: unirse, reclamar, compartir, confirmar y ver saldo. |
| E2E mobile | `apps/mobile/e2e/` | Maestro en emuladores Android e iOS | Flujos del personal: cobro completo con rotación, offline, override. |
| Carga | `load/` | k6 | Objetivos en `docs/arquitectura.md`, sección 9. |
| Failover | `load/chaos/` | k6 + detener contenedores | Caída de la API o de la DB a mitad del flujo: ni comandos ni eventos se pierden o duplican. |

Una prueba por comportamiento y no por función. Tiene que fallar si el comportamiento se rompe.

### Contract-first

- **Los contratos son la fuente de verdad** (`docs/arquitectura.md`, sección 12): `openapi.yaml` y `asyncapi.yaml` en `contexts/<ctx>/contracts/`; plataforma en `apps/api/openapi/platform.yaml`; terceros en `contracts/external/`.
- **Orden de trabajo:** 1) escribir o cambiar el contrato, 2) `pnpm contracts` (lint + bundle + generación), 3) implementar. Nunca al revés.
- **Nunca escribir a mano** un schema, tipo o cliente que exista en un contrato: `contracts/` solo reexporta `generated/` (lo verifica el test de arquitectura) y CI falla si lo generado difiere.
- **Reglas del contrato** (`redocly.yaml`): `operationId` y `summary` en cada operación; errores como `application/problem+json`; objetos cerrados (`additionalProperties`); cada respuesta con `examples` **con nombre**; endpoints públicos con `security: []` explícito.
- **Mocks deterministas:** una operación con varias respuestas declara `x-microcks-operation` (dispatcher `SCRIPT`) que responde `ok` por defecto o el ejemplo que pida el header `X-Mock-Example`.
- **Eventos:** cada tópico en el `asyncapi.yaml` del emisor; su payload es un `$ref` a `components.schemas` del `openapi.yaml` del mismo contexto. El bus rechaza lo que no esté declarado.
- **Rutas:** los contextos entregan handlers por `operationId`; la API no arranca si falta o sobra uno.

### Evidencias (reporte Allure)

Todo test escribe en `reports/allure-results`; `pnpm report` genera un único HTML (`reports/allure-report/index.html`) agrupado **contexto → flujo de usuario → escenario → paso**. Para que se entienda sin leer código:

- **Nombres en español y en lenguaje de negocio.** El `describe` de primer nivel nombra un comportamiento ("Reparto de montos"), nunca una función (`splitAmount`).
- **Flujos** (`tests/flows/<contexto>/<flujo>.flow.ts`): `test.describe("<Contexto>")` → `test.describe("<Flujo de usuario>")` → `test("<escenario>")` → `test.step("<paso>")`. El contexto es uno de `DOMAINS` (`tests/allure/labels.ts`); otro nombre hace fallar el flujo. Ej.: Reclamos → Compartir un ítem → "tres comensales reparten una tabla" → "Ana reclama la tabla".
- **Cada `expect` lleva un mensaje de negocio** (`expect(x, "la API responde 200")`): es el título del chequeo en el reporte.
- **Adjuntos automáticos:** request/response de cada llamada (fixture `api`); traces y video en e2e web; video en Maestro.
- La jerarquía se deriva sola (`tests/allure/labels.ts`): no escribir `epic`/`feature`/`story` a mano.

## Seguridad

- **Secretos**: solo por variables de entorno. `.env` está en `.gitignore`; se versiona `.env.example`. gitleaks bloquea el commit.
- **Dependencias**: antes de agregar una, revisar si ya está resuelto con stdlib, plataforma o algo ya instalado. pnpm rechaza versiones con menos de 7 días publicadas (`minimumReleaseAge`) y bloquea scripts de instalación salvo la lista `allowBuilds`.
- **Excepciones de SCA**: en `osv-scanner.toml`, con motivo y `ignoreUntil` de máximo 90 días.
- **Datos personales**: el comensal es anónimo por defecto. Fotos de evidencia y comprobantes son datos sensibles: acceso por rol y retención definida.
- **Multi-tenant**: toda consulta y todo evento llevan `venueId`. Las pruebas de integración incluyen el intento de acceso cruzado entre locales.
- GitHub Actions fijadas por SHA (Dependabot las actualiza).

## Comandos

```bash
pnpm install        # instala y activa los hooks
pnpm verify         # todo lo de pre-push
pnpm fix            # formato + autofix de lint
pnpm test           # unit tests
pnpm test:int       # integración (requiere Docker)
pnpm contracts      # lint + bundle + generación desde los contratos
pnpm test:contract  # Schemathesis contra la API en kind
pnpm test:flows     # flujos de la API (Playwright) contra kind
pnpm report         # reporte Allure único con todo lo anterior
pnpm spec           # valida OpenSpec

# Ambiente local (Docker con ≥ 6 GB de memoria asignada)
ctlptl apply -f deploy/kind/cluster.yaml   # clúster kind (idempotente)
tilt up                                    # infra + app con el chart de producción; UI en http://localhost:10350
tilt ci                                    # lo mismo, sin UI: termina en verde o en rojo (lo usa CI)
ctlptl delete -f deploy/kind/cluster.yaml  # borrar todo
```

### Plataforma

- Todo lo desplegable corre como en producción: imagen distroless sin root, sistema de archivos de solo lectura, mismo Helm chart (`deploy/helm/lo-mio`) y entrada por Gateway API con HTTPS (`https://api.lo-mio.localhost`). Ver `docs/arquitectura.md`, sección 11.
- **No hay live update:** cada cambio reconstruye la imagen (~2 s con caché). No relajar `readOnlyRootFilesystem` para acelerar el ciclo.
- **Un cambio en el chart** se valida con `helm lint`, kubeconform y `trivy config` (los corre el job `image` de CI) y con `tilt ci` desde cero.
- **Depurar un pod distroless** (no tiene shell): `kubectl debug -n lo-mio -it <pod> --image=busybox:1.37 --target=api`.
- **Postgres local** (CloudNativePG): `kubectl cnpg psql lo-mio-db -n lo-mio` con el plugin, o `kubectl port-forward -n lo-mio svc/lo-mio-db-rw 5432`.

## Definición de terminado

- [ ] Change de OpenSpec con todas sus tareas marcadas.
- [ ] Specs actualizadas si cambió el comportamiento.
- [ ] Pruebas del nivel que corresponde (ver pirámide).
- [ ] `pnpm verify` en verde y CI en verde.
- [ ] Sin TODOs sueltos: o se hace, o queda como `ponytail:` con su límite, o pasa a una tarea en un change.
