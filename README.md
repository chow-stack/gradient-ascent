# Gradient Ascent ⛰️

Small steps uphill, every day. A personal, Duolingo-style daily practice site for coding fundamentals,
the web stack, and machine learning — running locally.

- **What & why, phases, data model:** [BUILD_PLAN.md](BUILD_PLAN.md)
- **How it looks:** [DESIGN.md](DESIGN.md) — live at `/styleguide`

## Run it

```bash
npm install
npm run dev
```

Open http://localhost:5173.

| Command                 | What it does                                         |
| ----------------------- | ---------------------------------------------------- |
| `npm run dev`           | Dev server with hot reload                           |
| `npm run build`         | Type-check + production build                        |
| `npm run lint`          | Lint with oxlint                                     |
| `npm test`              | Run tests once (Vitest)                              |
| `npm run content:check` | Validate lessons and run every answer in real Python |
| `npm run format`        | Format with Prettier                                 |

## Project layout

```
content/          curriculum as YAML (tracks/, lessons/); schema in src/features/content/schema.ts
src/app/          routes + app shell
src/pages/        Today, Path, Session, Settings, Style guide
src/features/     content (schema + loader), runner (Python worker), exercises,
                  session (planner + runner), review (FSRS), progress (streak, XP)
src/components/   Adam, CodeBlock, editor (Monaco), UI primitives
src/lib/          db (IndexedDB via Dexie), dates
src/styles/       tokens.css, components.css, global.css
scripts/          check-content.ts
```

## Secrets

Copy `.env.example` to `.env.local` and add a Gemini key when we get to Phase 3. `.env.local` is git-ignored.
