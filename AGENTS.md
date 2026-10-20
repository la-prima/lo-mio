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
  kernel/        Shared kernel: Money, splitAmount, Id, Result, EventEnvelope, puerto EventBus. Puro.
  client/        Cliente de API tipado + hooks; lo usan todos los fronts.
contexts/<ctx>/  Un paquete por contexto (venues, staff, tables, claims, pos, settlement):
  domain/        Agregados, eventos de dominio, reglas. Puro: sin IO ni librerías.
  contracts/     API pública del contexto: comandos, queries, eventos (zod, versionados).
  server/        Casos de uso, repositorios, rutas Fastify, handlers de eventos.
apps/
  api/           Composition root: monta los server/, el bus y los workers. Sin reglas de negocio.
  mobile/        Expo (iOS/Android), superficies por rol. src/features/<ctx>/
  guest-web/     Web liviana del comensal por QR. src/features/<ctx>/
```

Límites (los verifica `tests/architecture.test.ts` en cada commit):
- `kernel` y los `domain/` son puros: solo importan su propio código (y `kernel`).
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
8. Funciones ≤ 60 líneas y complejidad cognitiva ≤ 12 (lo verifica Biome). Si no cabe, el diseño está mal.
9. Nombres en inglés en el código, según el glosario. Textos de UI, specs y docs en español.

## Calidad: qué corre y cuándo

| Momento | Qué | Tiempo |
|---|---|---|
| **pre-commit** | gitleaks (secretos), Biome (formato + lint), test de arquitectura, typecheck, tests relacionados con lo modificado, validar specs | < 10 s |
| **commit-msg** | Conventional Commits: `tipo(scope): descripción` | — |
| **pre-push** | `pnpm verify` completo | < 1 min |
| **CI en cada PR** | verify · gitleaks (historial completo) · Semgrep (SAST) · CodeQL (SAST) · osv-scanner (SCA + licencias) · *integración y e2e cuando existan las apps* | minutos |
| **Nightly / pre-release** | *carga (k6), failover, DAST (ZAP), e2e en matriz completa de navegadores* | — |

En cursiva: se activa con el change que crea la app correspondiente (ver el roadmap en el README).

**Nunca** usar `--no-verify`. Si un hook falla, se arregla la causa.

### Pirámide de pruebas

| Tipo | Dónde | Herramienta | Qué cubre |
|---|---|---|---|
| Unit | junto al código: `*.test.ts` | Vitest | Toda regla de `kernel` y de cada `domain/`. Obligatorio para lógica de dinero. |
| Integración | `contexts/<ctx>/server/**/*.test.ts` | Vitest + Testcontainers (Postgres real + pg-boss) | Por contexto: comandos, persistencia y eventos (se publican los de entrada y se verifican los de salida). Nada de mocks de la base de datos. |
| Contrato | `contexts/pos/server/adapters/` | Vitest | Cada adaptador POS pasa la **misma** suite del contrato `PosAdapter`. |
| E2E web | `apps/guest-web/e2e/` | Playwright: Chromium, Firefox, WebKit, Pixel y iPhone emulados | Flujos del comensal: unirse, reclamar, compartir, confirmar y ver saldo. |
| E2E mobile | `apps/mobile/e2e/` | Maestro en emuladores Android e iOS | Flujos del personal: cobro completo con rotación, offline, override. |
| Carga | `load/` | k6 | Objetivos en `docs/arquitectura.md`, sección 9. |
| Failover | `load/chaos/` | k6 + detener contenedores | Caída de la API o de la DB a mitad del flujo: ni comandos ni eventos se pierden o duplican. |

Una prueba por comportamiento y no por función. Tiene que fallar si el comportamiento se rompe.

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
pnpm spec           # valida OpenSpec
```

## Definición de terminado

- [ ] Change de OpenSpec con todas sus tareas marcadas.
- [ ] Specs actualizadas si cambió el comportamiento.
- [ ] Pruebas del nivel que corresponde (ver pirámide).
- [ ] `pnpm verify` en verde y CI en verde.
- [ ] Sin TODOs sueltos: o se hace, o queda como `ponytail:` con su límite, o pasa a una tarea en un change.
