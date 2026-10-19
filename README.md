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
| [Propuesta del MVP](openspec/changes/mvp-cuenta-individual/proposal.md) | Qué incluye el MVP, por qué y qué queda fuera |
| [Specs del MVP](openspec/changes/mvp-cuenta-individual/specs/) | Comportamiento esperado, con escenarios |
| [Diseño del MVP](openspec/changes/mvp-cuenta-individual/design.md) | Decisiones técnicas con su justificación, riesgos y objetivos de carga |
| [Tareas del MVP](openspec/changes/mvp-cuenta-individual/tasks.md) | Plan de implementación |

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
| API | Fastify sobre Postgres |
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

El porqué de cada decisión (incluida la comparación de frameworks) está en el [diseño del MVP](openspec/changes/mvp-cuenta-individual/design.md). Los límites entre contextos se verifican en cada commit ([AGENTS.md → Arquitectura](AGENTS.md#arquitectura)).

## Empezar

Requisitos: Node 24 (`.nvmrc`), corepack y [gitleaks](https://github.com/gitleaks/gitleaks).

```bash
corepack enable pnpm
brew install gitleaks
pnpm install        # instala dependencias y activa los git hooks
pnpm verify         # lint, tipos, tests, código muerto y specs
```

## Calidad y seguridad

Cada commit pasa por la detección de secretos, el lint, el test de arquitectura, el typecheck, los tests y la validación de specs. Cada PR suma SAST (Semgrep, CodeQL) y SCA con control de licencias (osv-scanner). El detalle de qué corre y cuándo está en [AGENTS.md → Calidad](AGENTS.md#calidad-qué-corre-y-cuándo).
