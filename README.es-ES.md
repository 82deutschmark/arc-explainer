# ARC-AGI Explainer

[![Live](https://img.shields.io/badge/live-arc.markbarney.net-4f8ef7?style=flat-square)](https://arc.markbarney.net)
[![ARC Prize](https://img.shields.io/badge/ARC%20Prize-Community%20Recognition%202025-f97316?style=flat-square)](https://arcprize.org/blog/arc-prize-2025-results-analysis)
[![X / Twitter](https://img.shields.io/badge/X-%4082deutschmark-000000?style=flat-square&logo=x)](https://x.com/82deutschmark)
[![Discord](https://img.shields.io/badge/Discord-Weekly%20Event-5865F2?style=flat-square&logo=discord)](https://t.co/byuWsVrqhm)

> Una plataforma de investigación personal para ARC-AGI — creada por un veterano productor de videojuegos que no intenta resolver el benchmark, sino simplemente comprenderlo y facilitárselo a quienes sí lo están haciendo.

---

## Antecedentes

Soy productor de videojuegos, no ingeniero. Trabajo con ingenieros. No voy a resolver ARC-AGI — simplemente me parece fascinante y quería construir algo que pudiera ser útil para las personas que realmente están trabajando en ello. Comenzó en julio de 2025 como un proyecto por curiosidad y creció hasta convertirse en una suite de investigación completa. A finales de 2025, ARC Prize [reconoció el esfuerzo](https://arcprize.org/blog/arc-prize-2025-results-analysis) — lo cual significó mucho. A partir del 22 de febrero de 2026, me encuentro en un pequeño receso del desarrollo activo, pero la plataforma está en línea y se mantiene actualizada.

---

**Producción:** https://arc.markbarney.net
**Staging:** https://arc-explainer-staging.up.railway.app/ (rama `ARC3`)
**Docs:** [CLAUDE.md](./CLAUDE.md) • [Referencia de API](./docs/EXTERNAL_API.md) • [Registro de cambios](./CHANGELOG.md)

---

## Inicio Rápido (Windows/PowerShell)

```powershell
# Clonar e instalar
git clone <repository-url> arc-explainer
cd arc-explainer
git submodule update --init --recursive
npm install

# .env mínimo (raíz)
OPENAI_API_KEY=tu_clave_aquí          # necesaria para OpenAI + Responses API
OPENROUTER_API_KEY=tu_clave_si_la_usas   # opcional; se requiere BYOK en producción
DATABASE_URL=postgresql://...         # opcional para funciones locales respaldadas por DB

# Ejecutar servidor de desarrollo
npm run dev  # Permitir ~10s para calentar, luego abrir localhost:5173

# O construir y ejecutar servidor de desarrollo
npm run build-dev
```

Más detalles: [CLAUDE.md](./CLAUDE.md) y [docs/reference/architecture/DEVELOPER_GUIDE.md](./docs/reference/architecture/DEVELOPER_GUIDE.md).

## Entorno y Claves (BYOK)

- La producción impone el modelo Bring Your Own Key (Trae tu propia clave) para proveedores de pago (OpenAI, xAI, Anthropic, Google, DeepSeek, OpenRouter). Las claves son solo por sesión, nunca se almacenan.
- Dev/staging: pueden existir claves de servidor, pero las pruebas también deberían funcionar con tus propias claves.
- Los flujos de Worm Arena y Poetiq aceptan claves proporcionadas por el usuario a través de la interfaz; el backend las inyecta por sesión (ver [docs/reference/api/EXTERNAL_API.md](./docs/reference/api/EXTERNAL_API.md) y [docs/reference/api/SnakeBench_WormArena_API.md](./docs/reference/api/SnakeBench_WormArena_API.md)).

## Qué Probar Primero

- **Puzzle Analyst:** `/task/:taskId` — cuadrícula de alta densidad de análisis.
- **RE-ARC Bench:** `/re-arc` — generar conjuntos de datos de evaluación únicos y validar envíos de solvers.
- **Worm Arena:** `/worm-arena` (repeticiones), `/worm-arena/live/:sessionId` (en vivo), `/worm-arena/stats` (tabla de clasificación).
- **ARC3 playground:** `/arc3/playground` — observar agentes resolviendo juegos reales de ARC-AGI-3.
  - Sitio externo ARC3: [arc3.sonpham.net](https://arc3.sonpham.net)
  - Repetición destacada: [Locksmith run](https://arc3.sonpham.net/share/77c39fa5-63d2-47bd-be83-0eb1b20e5d71)
- **APIs:** comienza con `/api/health`, luego `/api/puzzle/overview`; consulta EXTERNAL_API.md para ver toda la superficie de la API.

## Trabajando en este Repositorio

- **Arquitectura y patrones:** [Guía del Desarrollador](./docs/reference/architecture/DEVELOPER_GUIDE.md) (SRP, repositorios, servicios, streaming).
- **Referencia de Hooks:** [hooks de frontend](./docs/reference/frontend/HOOKS_REFERENCE.md).
- **SnakeBench/Worm Arena API:** [SnakeBench_WormArena_API.md](./docs/reference/api/SnakeBench_WormArena_API.md).
- **Detalles de BYOK:** [EXTERNAL_API.md](./docs/reference/api/EXTERNAL_API.md).
- **Datos:** Rompecabezas ARC en `data/`; repeticiones de SnakeBench en `external/SnakeBench/backend/completed_games`.
- **Contrato de Streaming:** ver la documentación de Responses API en `docs/reference/api/` (ResponsesAPI.md, OpenAI_Responses_API_Streaming_Implementation.md).

## Notas de Despliegue

- **Staging:** Railway en `arc-explainer-staging.up.railway.app`, rastreando la rama `ARC3`.
- **Producción:** despliegues automáticos desde `main`. Usa PRs hacia `ARC3`; no realices push de cambios disruptivos directamente a `main`.
- **Banderas de entorno:** `ENABLE_SSE_STREAMING` (servidor), `VITE_ENABLE_SSE_STREAMING` (cliente).

## Descripción General de la Arquitectura

### Stack Tecnológico
**Frontend:** React 18 + TypeScript + Vite + TailwindCSS + componentes DaisyUI
**Backend:** Express.js + TypeScript + PostgreSQL (Drizzle ORM) + fallback en memoria
**Integración de IA:** Patrón Unified BaseAIService que soporta más de 6 proveedores
**Tiempo Real:** Streaming de WebSockets para el solver Saturn y progreso por lotes
**Despliegue:** Listo para Railway con soporte de Docker

### Patrones de Diseño Clave
- **Patrón Repositorio** - Separación limpia entre el acceso a datos y la lógica de negocio
- **Abstracción de Proveedor** - Interfaz unificada para OpenAI, Anthropic, xAI, etc.
- **Actualizaciones Optimistas** - Retroalimentación instantánea de la UI con conciliación del servidor
- **Preservación de Respuestas** - Respuestas crudas de la API guardadas antes del análisis para depuración
- **Encadenamiento de Conversaciones** - Gestión de contexto consciente del proveedor con persistencia de 30 días

### Rutas

#### Rutas de Frontend (wouter)

- **Inicio / Rompecabezas**
  - `/`
  - `/browser`
  - `/task/:taskId` (nuevo predeterminado - Puzzle Analyst)
  - `/puzzle/:taskId` (legado - PuzzleExaminer)
  - `/examine/:taskId`
  - `/puzzles/database`
- **Discusión**
  - `/discussion`
  - `/discussion/:taskId`
- **Analítica / Rankings**
  - `/analytics`
  - `/leaderboards`
  - `/elo`
  - `/elo/leaderboard`
  - `/elo/:taskId`
  - `/compare`
  - `/compare/:taskId`
- **Feedback / Debate**
  - `/feedback`
  - `/test-solution`
  - `/test-solution/:taskId`
  - `/debate`
  - `/debate/:taskId`
- **Modelos**
  - `/models`
  - `/model-config`
  - `/model-comparison`
- **Solvers**
  - `/puzzle/saturn/:taskId`
  - `/puzzle/grover/:taskId`
  - `/puzzle/beetree/:taskId?`
  - `/puzzle/poetiq/:taskId`
  - `/poetiq`
- **RE-ARC Bench** (nuevo - pruebas comunitarias)
  - `/re-arc` - generar conjuntos de datos y evaluar envíos
- **ARC3**
  - `/arc3`
  - `/arc3/playground`
  - `/arc3/games`
  - `/arc3/games/:gameId`
- **Worm Arena / SnakeBench**
  - `/snakebench`
  - `/snake-arena` (redirección)
  - `/worm-arena`
  - `/worm-arena/live`
  - `/worm-arena/live/:sessionId`
  - `/worm-arena/matches`
  - `/worm-arena/stats`
  - `/worm-arena/models` (nuevo - historial de partidas del modelo)
  - `/worm-arena/rules` (nuevo - reglas y transparencia de prompts)
- **Administración**
  - `/admin`
  - `/admin/models`
  - `/admin/ingest-hf`
  - `/admin/openrouter`
- **Otros**
  - `/trading-cards`
  - `/hall-of-fame`
  - `/human-cards` (redirección)
  - `/kaggle-readiness`
  - `/scoring`
  - `/about`
  - `/llm-reasoning`
  - `/llm-reasoning/advanced`
  - más un catch-all 404

#### Rutas de API Backend (Express)

- **Salud**
  - `GET /api/health`
- **Modelos**
  - `GET /api/models`
  - `GET /api/models/:modelKey`
  - `GET /api/models/provider/:provider`
- **Gestión de Modelos (GUI)**
  - `GET /api/model-management/list`
  - `GET /api/model-management/stats`
  - `GET /api/model-management/search`
  - `POST /api/model-management/validate`
  - `POST /api/model-management/toggle-active`
  - `POST /api/model-management/create-alias`
  - `POST /api/model-management/add`
  - `PUT /api/model-management/notes`
  - `DELETE /api/model-management/delete`
  - `GET /api/model-management/openrouter-models`
- **Rompecabezas ARC**
  - `GET /api/puzzle/list`
  - `GET /api/puzzle/overview`
  - `GET /api/puzzle/task/:taskId`
  - `POST /api/puzzle/bulk-status`
  - `POST /api/puzzle/analyze/:taskId/:model`
  - `POST /api/puzzle/analyze-list`
  - `GET /api/puzzle/:puzzleId/has-explanation`
  - `POST /api/puzzle/reinitialize`
  - `POST /api/puzzle/validate` (devuelve 501)
  - Estadísticas:
    - `GET /api/puzzle/accuracy-stats`
    - `GET /api/puzzle/general-stats`
    - `GET /api/puzzle/raw-stats`
    - `GET /api/puzzle/performance-stats`
    - `GET /api/puzzle/performance-stats-filtered`
    - `GET /api/puzzle/trustworthiness-stats-filtered`
    - `GET /api/puzzle/confidence-stats`
    - `GET /api/puzzle/worst-performing`
    - `GET /api/puzzles/stats`
- **SSE de análisis genérico**
  - `POST /api/stream/analyze`
  - `GET /api/stream/analyze/:taskId/:modelKey/:sessionId`
  - `DELETE /api/stream/analyze/:sessionId`
  - `POST /api/stream/cancel/:sessionId`
- **Discusión**
  - `GET /api/discussion/eligible`
- **Métricas y costo**
  - `GET /api/metrics/reliability`
  - `GET /api/metrics/comprehensive-dashboard`
  - `GET /api/metrics/compare`
  - `GET /api/metrics/costs/models`
  - `GET /api/metrics/costs/models/map`
  - `GET /api/metrics/costs/models/:modelName`
  - `GET /api/metrics/costs/models/:modelName/trends`
  - `GET /api/metrics/costs/system/stats`
- **Rendimiento de dataset del modelo**
  - `GET /api/model-dataset/performance/:modelName/:datasetName`
  - `GET /api/model-dataset/models`
  - `GET /api/model-dataset/datasets`
  - `GET /api/model-dataset/metrics/:modelName/:datasetName`
- **Prompts**
  - `POST /api/prompt/preview/:provider/:taskId`
  - `GET /api/prompts`
  - `POST /api/prompt-preview`
- **Explicaciones**
  - `GET /api/puzzle/:puzzleId/explanations/summary`
  - `GET /api/puzzle/:puzzleId/explanations`
  - `GET /api/puzzle/:puzzleId/explanation`
  - `GET /api/explanations/:id`
  - `POST /api/puzzle/save-explained/:puzzleId`
  - Cadena de refutación:
    - `GET /api/explanations/:id/chain`
    - `GET /api/explanations/:id/original`
- **Feedback + Soluciones**
  - `POST /api/feedback`
  - `GET /api/feedback`
  - `GET /api/feedback/stats`
  - `GET /api/feedback/accuracy-stats`
  - `GET /api/feedback/accuracy-stats-filtered`
  - `GET /api/feedback/overconfident-models`
  - `GET /api/feedback/debate-accuracy-stats`
  - `GET /api/explanation/:explanationId/feedback`
  - `GET /api/puzzle/:puzzleId/feedback`
  - `GET /api/puzzles/:puzzleId/solutions`
  - `POST /api/puzzles/:puzzleId/solutions`
  - `POST /api/solutions/:solutionId/vote`
  - `GET /api/solutions/:solutionId/votes`
- **ELO**
  - `GET /api/elo/comparison`
  - `GET /api/elo/comparison/:puzzleId`
  - `POST /api/elo/vote`
  - `GET /api/elo/leaderboard`
  - `GET /api/elo/models`
  - `GET /api/elo/stats`
- **Saturn**
  - `POST /api/saturn/analyze/:taskId`
  - `GET /api/stream/saturn/:taskId/:modelKey`
  - `POST /api/saturn/analyze-with-reasoning/:taskId`
  - `GET /api/saturn/status/:sessionId`
- **Grover**
  - `POST /api/puzzle/grover/:taskId/:modelKey`
  - `GET /api/stream/grover/:taskId/:modelKey`
  - `GET /api/grover/status/:sessionId`
- **Poetiq**
  - `POST /api/poetiq/solve/:taskId`
  - `POST /api/poetiq/batch`
  - `GET /api/poetiq/batch/:sessionId`
  - `GET /api/poetiq/status/:sessionId`
  - `GET /api/poetiq/models`
  - `GET /api/poetiq/community-progress`
  - `GET /api/poetiq/stream/:sessionId`
  - `POST /api/poetiq/stream/solve/:taskId`
  - `POST /api/poetiq/stream/start/:sessionId`
- **Beetree**
  - `POST /api/beetree/run`
  - `GET /api/beetree/status/:sessionId`
  - `POST /api/beetree/estimate`
  - `GET /api/beetree/history/:taskId`
  - `GET /api/beetree/cost-breakdown/:explanationId`
  - `POST /api/beetree/cancel/:sessionId`
  - `GET /api/stream/analyze/beetree-:sessionId`
- **SnakeBench**
  - `GET /api/snakebench/models-with-games` (nuevo)
  - `GET /api/snakebench/model-history-full` (nuevo)
  - `GET /api/snakebench/model-insights` (nuevo)
  - `GET /api/snakebench/llm-player/prompt-template` (nuevo)
  - `POST /api/snakebench/run-match`
  - `POST /api/snakebench/run-batch`
  - `GET /api/snakebench/games`
  - `GET /api/snakebench/games/:gameId`
  - `GET /api/snakebench/matches`
  - `GET /api/snakebench/health`
  - `GET /api/snakebench/recent-activity`
  - `GET /api/snakebench/leaderboard`
  - `GET /api/snakebench/stats`
  - `GET /api/snakebench/model-rating`
  - `GET /api/snakebench/model-history`
  - `GET /api/snakebench/greatest-hits`
  - `GET /api/snakebench/trueskill-leaderboard`
- **Worm Arena Live SSE**
  - `POST /api/wormarena/prepare`
  - `GET /api/wormarena/stream/:sessionId`
- **ARC3**
  - `GET /api/arc3/default-prompt`
  - `GET /api/arc3/system-prompts`
  - `GET /api/arc3/system-prompts/:id`
  - `GET /api/arc3/games`
  - `POST /api/arc3/start-game`
  - `POST /api/arc3/manual-action`
  - `POST /api/arc3/real-game/run`
  - `POST /api/arc3/stream/prepare`
  - `GET /api/arc3/stream/:sessionId`
  - `POST /api/arc3/stream/cancel/:sessionId`
  - `POST /api/arc3/stream/:sessionId/continue`
  - `GET /api/arc3/stream/:sessionId/continue-stream`
- **Batch**
  - `POST /api/batch/start`
  - `GET /api/batch/status/:sessionId`
  - `POST /api/batch/pause/:sessionId`
  - `POST /api/batch/resume/:sessionId`
  - `GET /api/batch/results/:sessionId`
  - `GET /api/batch/sessions`
- **Administración**
  - `GET /api/admin/quick-stats`
  - `GET /api/admin/recent-activity`
  - `POST /api/admin/validate-ingestion`
  - `POST /api/admin/start-ingestion`
  - `GET /api/admin/ingestion-history`
  - `GET /api/admin/hf-folders`
  - Administración de OpenRouter:
    - `GET /api/admin/openrouter/catalog`
    - `GET /api/admin/openrouter/discover`
    - `POST /api/admin/openrouter/import`
    - `GET /api/admin/openrouter/sync-config`
  - Ayudantes de recuperación:
    - `GET /api/admin/recovery-stats`
    - `POST /api/admin/recover-multiple-predictions`

---

## Para Investigadores

Esta plataforma permite el estudio sistemático de las capacidades de razonamiento de la IA en patrones visuales abstractos:

### Casos de Uso de Investigación
- **Comparación de modelos** - Evaluar el razonamiento entre GPT-5, serie o, Grok-4, Claude, Gemini, DeepSeek
- **Análisis de costo-rendimiento** - Compensaciones entre el uso de tokens y la precisión para diferentes proveedores
- **Calibración de confianza** - Estudio de patrones de exceso de confianza y puntuación de confiabilidad
- **Profundidad de razonamiento** - Analizar el pensamiento estructurado de modelos con soporte para tokens de razonamiento
- **Dinámica de conversación** - Rastrear cómo el contexto afecta el refinamiento progresivo del razonamiento
- **Evaluación por lotes** - Pruebas sistemáticas a gran escala en más de 1,000 rompecabezas

### Acceso a Datos
- **API sin restricciones** - Acceso programático completo a todos los análisis y métricas
- **Integración con HuggingFace** - Importar predicciones externas para análisis comparativos
- **Almacenamiento de respuestas crudas** - Cargas útiles completas de la API preservadas para análisis personalizados
- **Prompts personalizados** - Diseñar marcos de evaluación especializados

**Documentación de la API:** [docs/EXTERNAL_API.md](./docs/EXTERNAL_API.md)

---

## Sobre los Rompecabezas ARC-AGI

El Abstract Reasoning Corpus for Artificial General Intelligence (ARC-AGI) es un benchmark para probar la inteligencia fluida en sistemas de IA.

### Estructura del Dataset
- **ARC-AGI-1**: 400 rompecabezas de entrenamiento + 400 de evaluación
- **ARC-AGI-2**: 1,000 de entrenamiento + 120 de evaluación (públicos)
- **Conjuntos de prueba privados**: Conjuntos semi-privados (comerciales) y totalmente privados (competencia) calibrados con la misma dificultad

### Formato del Rompecabezas
Cada rompecabezas consiste en:
- **Ejemplos de entrenamiento**: 3 pares de entrada/salida que demuestran el patrón
- **Casos de prueba**: 1-2 cuadrículas de entrada que requieren la predicción de la salida
- **Cuadrículas**: Matrices rectangulares (de 1x1 a 30x30) con enteros del 0 al 9 (visualizados como colores o emojis)

### Criterio de Éxito
- Predecir las dimensiones **exactas** de la cuadrícula de salida y todos los valores de las celdas
- Se permiten 2 intentos por cada entrada de prueba
- Debe funcionar en el **primer encuentro** con el rompecabezas
- Rendimiento humano: ~66% en el conjunto de evaluación

### Ubicación de Datos
```
data/
├── training/      # 1000 tareas para entrenamiento de algoritmos
├── evaluation/    # 120 tareas para pruebas (ARC-AGI-1)
├── evaluation2/   # 120 tareas para pruebas (ARC-AGI-2)
└── training2/     # Tareas de entrenamiento adicionales
```

**Lee el artículo de ARC-AGI-2:** [arxiv.org/pdf/2505.11831](https://www.arxiv.org/pdf/2505.11831)

- Generador de GIF de rompecabezas ARC: `.claude/skills/slack-gif-creator/create_arc_puzzle_gif.py <puzzle_id>` → `arc_puzzle_<id>.gif` (requiere `pillow`, `imageio`, `numpy`).  
- Banderas de funciones y alternadores: ver `shared/utils/featureFlags.ts` y `shared/config/streaming.ts`.

## Contribuir

Las contribuciones son bienvenidas. Comienza con [CLAUDE.md](./CLAUDE.md) para conocer los estándares de codificación, las expectativas de SRP/DRY y los requisitos de streaming. Las notas de lanzamiento están en [CHANGELOG.md](./CHANGELOG.md).

---

**Construido por [Mark Barney](https://x.com/82deutschmark)** — productor de videojuegos, miembro de la comunidad ARC Prize.
Únete a la discusión comunitaria semanal: [evento de Discord](https://t.co/byuWsVrqhm)
