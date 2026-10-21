# lo-mio

**La cuenta de cada persona, dentro de la mesa.**

En bares y restaurantes donde la gente comparte mesa, llega y se va, cobrar se vuelve un problema: nadie recuerda quién pidió qué ni si los que se fueron pagaron. Reconstruir la cuenta le toma al mesero unos 20 minutos por mesa.

lo-mio se ubica entre el sistema del local (POS), los meseros y los clientes, y no cambia cómo se pide a cocina ni cómo se cobra:

1. El mesero carga los pedidos en su POS, como siempre.
2. Los ítems aparecen en un feed de la mesa.
3. Cada comensal se identifica en segundos (QR de la mesa en su celular, o una tarjeta NFC) y **reclama lo suyo**: completo, compartido o por porciones.
4. Cuando alguien se va, paga su saldo y queda registrado con su comprobante.
5. Al cerrar la mesa no hay nada que reconstruir.

La explicación completa está en [docs/vision.md](docs/vision.md).

## Estado

**Etapa de definición.** El MVP está especificado y todavía no está implementado. El piloto será en un restaurante de Chile que usa el POS Fudo.

| Documento | Contenido |
|---|---|
| [docs/vision.md](docs/vision.md) | Problema, idea, medios de identificación, ideas futuras y métricas del piloto |
| [docs/glosario.md](docs/glosario.md) | Términos del dominio y su nombre en el código |
| [AGENTS.md](AGENTS.md) | Cómo se trabaja: flujo, arquitectura, reglas de código, pruebas y seguridad. **Lectura obligatoria antes de contribuir.** |
| [docs/arquitectura.md](docs/arquitectura.md) | Decisiones técnicas transversales con su justificación, riesgos y objetivos de carga |
| [openspec/changes/](openspec/changes/) | Changes del MVP: propuesta, specs, diseño y tareas de cada uno (ver roadmap abajo) |

### Roadmap del MVP

Cada change es una rama y un PR. Se implementan en este orden (✅ = archivado):

| # | Change | Entrega | Depende de |
|---|---|---|---|
| 1 | [base-tecnica](openspec/changes/archive/2026-10-20-base-tecnica/) ✅ | Kernel, bus de eventos (pg-boss), API Fastify, Testcontainers | — |
| 2 | [plataforma-k8s](openspec/changes/archive/2026-10-20-plataforma-k8s/) ✅ | Imágenes, Helm chart, kind con Gateway API, CloudNativePG y Tilt | 1 |
| 3 | [contratos-y-evidencias](openspec/changes/archive/2026-10-20-contratos-y-evidencias/) ✅ | Contract-first (OpenAPI/AsyncAPI), mocks con Microcks, Schemathesis, flujos Playwright y reporte Allure | 2 |
| 4 | [reclamo-manual](openspec/changes/archive/2026-10-21-reclamo-manual/) ✅ | Primer flujo de punta a punta: carga manual → QR → reclamar/compartir → saldo | 3 |
| 5 | [cobro-con-comprobante](openspec/changes/cobro-con-comprobante/) | Pagos con comprobante (timbre SII, voucher, efectivo) y cierre de mesa | 4 |
| 6 | [tarjetas-y-reasignacion](openspec/changes/tarjetas-y-reasignacion/) | Tarjetas NFC, reasignaciones con confirmación, override | 5 |
| 7 | [mesero-offline](openspec/changes/mesero-offline/) | Acciones del mesero sin conexión, distribución de la app al piloto | 5 |
| 8 | [integracion-fudo](openspec/changes/integracion-fudo/) | Sincronización con Fudo y pedido desde lo-mio. **Bloqueado por el acceso a la API** | 4 |
| 9 | [carga-y-failover](openspec/changes/carga-y-failover/) | k6, caos (incluido failover de Postgres) y DAST en nightly | 5 |
| 10 | [despliegue-piloto](openspec/changes/despliegue-piloto/) | Kubernetes administrado, runbook y despliegue gradual en el local | 5, 7, 9 |

## Cómo se trabaja

El proyecto usa **spec-driven development** con [OpenSpec](https://github.com/Fission-AI/OpenSpec): no se escribe código de comportamiento sin un change aprobado en [openspec/changes/](openspec/changes/). Las specs vigentes viven en [openspec/specs/](openspec/specs/). El desarrollo se hace principalmente con agentes de IA, que siguen [AGENTS.md](AGENTS.md).

```
/opsx:propose   proponer un change (propuesta, specs, diseño, tareas)
/opsx:apply     implementarlo
/opsx:archive   archivarlo y actualizar las specs vigentes
```

## Stack y arquitectura

Monolito modular en TypeScript (pnpm workspaces, Node 24), organizado en **contextos de negocio (DDD)** que se comunican por **eventos asíncronos**. Está diseñado para separar cualquier contexto como servicio sin reescribir su dominio.

| Pieza | Tecnología |
|---|---|
| API | Fastify sobre Postgres, rutas generadas desde su contrato OpenAPI |
| Contratos | OpenAPI (HTTP) y AsyncAPI (eventos) como fuente de verdad; código, mocks (Microcks) y tests derivados |
| Plataforma | Contenedores distroless, Helm, Kubernetes con Gateway API; local con kind + Tilt |
| Eventos | pg-boss (outbox transaccional y pub/sub sobre Postgres), detrás de un puerto `EventBus` que permite migrar a NATS u otro broker |
| App móvil (personal y comensal frecuente) | React Native con Expo (iOS y Android, NFC nativo) |
| Web del comensal por QR | React + Vite, liviana, sin instalación |

```
packages/kernel     shared kernel: dinero, ids, eventos
packages/client     cliente de API compartido por los fronts
contexts/<ctx>/     venues · staff · tables · claims · pos · settlement
                    cada uno con domain/ (puro) · contracts/ (API pública) · server/
apps/               api · mobile · guest-web
```

El porqué de cada decisión (incluida la comparación de frameworks) está en [docs/arquitectura.md](docs/arquitectura.md). Los límites entre contextos se verifican en cada commit ([AGENTS.md → Arquitectura](AGENTS.md#arquitectura)).

## Empezar

Requisitos: Node 24 (`.nvmrc`), corepack, Docker (≥ 6 GB de memoria asignada), [kind](https://kind.sigs.k8s.io), [ctlptl](https://github.com/tilt-dev/ctlptl), [Tilt](https://tilt.dev), Helm, kubectl y [gitleaks](https://github.com/gitleaks/gitleaks).

```bash
corepack enable pnpm
brew install gitleaks kind tilt-dev/tap/ctlptl tilt helm kubectl
pnpm install                                  # dependencias y git hooks
pnpm verify                                   # lint, tipos, tests, código muerto y specs
pnpm test:int                                 # integración con Postgres real (Docker)

ctlptl apply -f deploy/kind/cluster.yaml      # clúster local (3 nodos, Gateway API, TLS)
tilt up                                       # infra + API con el mismo chart que producción
```

La API queda en https://api.lo-mio.localhost (certificado de una CA local; ver [deploy/kind/](deploy/kind/)). Para borrar todo: `ctlptl delete -f deploy/kind/cluster.yaml`.

## Calidad y seguridad

Cada commit pasa por la detección de secretos, el lint, el test de arquitectura, el typecheck, los tests y la validación de specs. Cada PR suma SAST (Semgrep, CodeQL) y SCA con control de licencias (osv-scanner). El detalle de qué corre y cuándo está en [AGENTS.md → Calidad](AGENTS.md#calidad-qué-corre-y-cuándo).
