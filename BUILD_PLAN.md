# Gradient Ascent — Build Plan

> A personal, Duolingo-style daily practice site for learning machine learning and the Python and math it needs.
> Runs locally on my computer. Built to make me _understand_ ML, not just use it.

This is the living source of truth for what we're building and why. Update it whenever a decision changes —
add a line to the **Decision log** at the bottom when you do.

Companion doc: [DESIGN.md](DESIGN.md) (how it looks and feels).

---

## 1. Goal

**Who it's for:** me (Caio). Took AP CSP + AP CSA, most of it didn't stick, now vibecodes web apps, Python
scripts, mobile apps and backends without fully understanding the code. Calc AB/BC went well (rusty ~1.5 years).
AP Stats, plus a college stats class in progress.

**What success looks like (6 months in):**

- I can write small programs in Python from scratch, without AI, and debug them.
- I understand how a neural network learns well enough to build one from scratch (micrograd → MLP → tiny GPT).
- Two weeks after learning something, I can still do it unaided (softmax and NLL on a blank page, say).
- I've practiced on most days, and kept going when I felt like it.

There's no fixed deadline, but sooner is better. **Main reason for learning ML:** deep understanding.

**How I learn best:** visualizing and building. Not walls of text, not rote memorization. Doing > reading.

**Non-goals:** not a product for other people, no accounts, no social features, no leaderboards,
no mobile app (it's a local website), no AI writing my answers.

---

## 2. Learning principles (the research we're building on)

Every feature should trace back to one of these. If a feature doesn't serve one, question it.

| #   | Principle                                           | Evidence                                                                             | How the app applies it                                                                                       |
| --- | --------------------------------------------------- | ------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------ |
| P1  | **Retrieval practice** — recalling beats re-reading | Strong (cognitive science, broad)                                                    | Every session starts with recall items, not re-reading                                                       |
| P2  | **Spaced repetition**                               | Strong. An intro-Python tool showed ~+1% final exam per hour of use                  | Review items scheduled with **FSRS** (open-source, used by Anki, beat SM-2 for 99.6% of users in benchmarks) |
| P3  | **Interleaving** — mix topics                       | Effect sizes ~0.42 immediate / ~0.79 delayed vs blocked practice                     | Reviews mix Python, NumPy, math and ML items                                                                 |
| P4  | **Read → trace → explain → write ladder**           | Tracing + explaining predicted ~46% of code-writing performance (Lister et al. 2009) | Each concept climbs: predict output → Parsons → fill blank → fix bug → write → explain                       |
| P5  | **Worked examples + fading + subgoal labels**       | Strong for worked examples; subgoal labels ~+8% in programming studies               | New concepts open with one labeled example; following exercises remove more of it                            |
| P6  | **PRIMM** — Predict, Run, Investigate, Modify, Make | Promising, limited studies                                                           | Structure of every "new concept" card sequence                                                               |
| P7  | **Program visualization** (Python Tutor style)      | Several small positive studies; can become a crutch                                  | Step-through visualizer — but you **predict before it reveals**                                              |
| P8  | **Mastery learning**                                | Strong (Bloom)                                                                       | A skill node unlocks the next only when passed on ≥ 2 separate days                                          |
| P9  | **Hint-first AI tutoring**                          | CS50 Duck experience; guardrails leak if prompt-only                                 | Graduated hint ladder, enforced in code; full solution only via "I give up"                                  |
| P10 | **Gamify the habit, not the grind**                 | Streaks drive habit; XP-for-easy-repeats causes grinding                             | Streak + freezes; XP weighted to new/hard/first-try; no leaderboards                                         |

Sources are listed in [§12](#12-sources).

---

## 3. Curriculum

The curriculum lives in [CURRICULUM.md](CURRICULUM.md): one ML path of 11 units, the lesson plans, the target
mistakes for each lesson, projects and checkpoints. The research behind the change from three tracks to one path is in
`reports/` (kept local, not committed).

---

## 4. The daily session

Two separate loops.

### Daily 5 (~5 min) → counts the day for the streak

Up to 5 problems from everything already learned, chosen by FSRS (most overdue first). The set is fixed for the day, so
leaving and coming back resumes it. Each problem shows up as a tile: right first try, right with help, or missed. When
it's done, that's it until tomorrow.

### Lessons (~12 min each, as many as you want)

One visual, subgoal-labeled worked example → predict → run → practice ladder → explain. Then a checkpoint at the end of
each unit, then the project. On a day with nothing to review, finishing a lesson counts the day.

### Keep going (optional)

Next lesson, extra reviews (due soonest first), or practice on any passed lesson.

### Long blocks (from about Unit 5, weekends)

90–180 minutes outside the app for Karpathy's videos, real PyTorch and messy data. See
[CURRICULUM.md](CURRICULUM.md#5-what-stays-outside-the-app).

## 5. Exercise types

| Type                                              | Ladder rung        | Graded by                 | Notes                     |
| ------------------------------------------------- | ------------------ | ------------------------- | ------------------------- |
| Multiple choice / predict output                  | Read/trace         | Exact match               | Fast warm-up items        |
| Step-through question ("value of `x` at step 7?") | Trace              | Exact match               | Uses visualizer           |
| Parsons (order the lines)                         | Trace → write      | Order / tests             | Distractor lines optional |
| Fill in the blank (faded)                         | Write (scaffolded) | Tests                     | Fewer givens each time    |
| Find & fix the bug                                | Debug              | Tests                     | Real-world bug patterns   |
| Write a function                                  | Write              | Hidden + visible tests    | Core skill                |
| Explain in plain English                          | Explain            | AI rubric (or self-grade) | Ends each concept         |
| Code autopsy                                      | Read my code       | AI-generated Qs           | Phase 5                   |
| Project milestone                                 | Make               | Tests                     | Multi-day                 |

---

## 6. System design

### 6.1 Tech stack

| Layer              | Choice                                                                     | Why                                                                     |
| ------------------ | -------------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| Build / dev server | **Vite**                                                                   | Fast, simple, standard                                                  |
| UI                 | **React 19 + TypeScript**                                                  | What I vibecode with                                                    |
| Styling            | **Tailwind CSS v4** with tokens from DESIGN.md (`src/styles/tokens.css`)   | Tokens in one place, utility classes everywhere                         |
| Routing            | **React Router**                                                           | Few pages; simple                                                       |
| Code editor        | **Monaco** (VS Code's editor) — Phase 2                                    | Familiar, good TS/Python highlighting                                   |
| Python runtime     | **Pyodide** in a Web Worker — Phase 2                                      | Real Python + NumPy in the browser, no server needed, UI doesn't freeze |
| Storage            | **IndexedDB via Dexie** — Phase 2                                          | All progress local; export/import JSON for backup                       |
| Scheduling         | **ts-fsrs** — Phase 2                                                      | Open-source FSRS implementation                                         |
| AI                 | **Gemini API** via a tiny local Node server — later                        | Keeps the key out of the browser; caches responses                      |
| ML runtime         | NumPy in Pyodide (self-hosted wheels); PyTorch in Colab/Kaggle long blocks | Official Pyodide has no PyTorch                                         |
| Tests              | **Vitest** (+ Testing Library)                                             | Same config as Vite                                                     |
| Lint / format      | **oxlint** + Prettier                                                      | Came with the Vite template; very fast                                  |

### 6.2 Folder structure (target)

```
gradient-ascent/
├── BUILD_PLAN.md          ← this file
├── DESIGN.md              ← design system
├── content/               ← curriculum as data (YAML), NOT code
│   ├── tracks/            ← the path and its units
│   ├── lessons/           ← worked examples, concept cards
│   ├── exercises/         ← exercise items (by skill id)
│   └── projects/          ← multi-day projects + milestones
├── server/                ← (later) tiny local server: Gemini proxy, cache
├── src/
│   ├── app/               ← routes, layout, providers
│   ├── features/
│   │   ├── session/       ← daily session builder + runner
│   │   ├── exercises/     ← one component per exercise type
│   │   ├── review/        ← FSRS scheduling
│   │   ├── progress/      ← streak, XP, mastery, skill tree
│   │   ├── runner/        ← code execution (Pyodide / JS workers)
│   │   ├── visualizer/    ← step-through execution diagrams
│   │   └── tutor/         ← AI hint ladder + explain grading
│   │   └── lesson-demo/   ← sample lesson used by the style guide (prototype for exercises/)
│   ├── components/        ← Adam, CodeBlock
│   ├── components/ui/     ← design-system primitives (Button, Card, ProgressBar, Chip)
│   ├── lib/               ← db, utils, types
│   ├── styles/            ← tokens.css (values), components.css (ga-* classes), global.css
│   └── assets/            ← mascot, icons
└── public/
```

### 6.3 Core data model (draft — will change)

```ts
Skill      { id, title, prereqs: SkillId[], position }            // node on the path
Lesson     { id, skillId, cards: Card[] }                          // worked example → PRIMM steps
Exercise   { id, skillId, type, prompt, starterCode?, tests?, answer?, difficulty, rung }
ReviewCard { exerciseId | conceptId, fsrsState, due, lastReview }  // spaced-repetition state
Attempt    { exerciseId, at, correct, firstTry, hintsUsed, gaveUp, durationMs, code? }
Mastery    { skillId, status: locked|learning|passed|mastered, passedOnDays: date[] }
DayLog     { date, coreDone, xp, minutes, freezeUsed }
Daily      { day, itemIds, results: { itemId: clean|assisted|missed }, completedAt? }  // one fixed set per day
```

### 6.4 Key rules (enforced in code, not just UI)

- **Daily 5:** due reviews first, most overdue first; topped up from items due soon if fewer than 5 are due; nothing already seen today; max 2 fix/write, placed last. Frozen for the day once started. Cards with variants show a different one per review.
- **Lessons:** always the lowest unlocked lesson on the path. Independent of the Daily 5.
- **Mastery:** skill = `passed` after its ladder is completed; `mastered` after a correct spaced review on a _different day_. Next skill unlocks at `passed`; tree node turns gold at `mastered`.
- **XP:** new concept > hard exercise > first-try correct > review. Repeating an already-mastered easy item ≈ 0 XP. Hints and give-ups reduce XP.
- **Streak:** Daily 5 finished = day counts. If nothing can be reviewed today, finishing a lesson counts instead. 2 freezes/week auto-applied. No guilt notifications.
- **AI never returns a full solution** unless the user pressed "I give up"; responses are checked for code blocks longer than N lines before display. Give-up → must retype + explain → item re-queued for tomorrow.
- **Works offline / without AI.** AI features degrade to self-grading and static hints.

### 6.5 Gemini notes

- Free-tier limits change often (sources ranged ~20–1,500 requests/day per model). Check real limits in AI Studio.
- Free-tier prompts may be used by Google to improve products → don't send private code I care about.
- Cache every AI response by hash(prompt) on the local server; budget requests per day.
- Key lives in `.env.local` (`GEMINI_API_KEY`), read only by the local server. Never committed.

---

## 7. Phases & milestones

Each phase ends with something I can actually use. Check boxes as we go.

### Phase 1 — Foundation

Plan, design, and an empty-but-solid project. **No curriculum, no features.**

- [x] Research learning science + existing apps
- [x] `BUILD_PLAN.md` (this file)
- [x] `DESIGN.md` (design system, tokens, components, mascot direction)
- [x] Project scaffold: Vite + React + TS + Tailwind v4 + React Router + Vitest + oxlint/Prettier
- [x] Design tokens implemented in `src/styles/tokens.css` (dark only, Summit)
- [x] Fonts self-hosted (works offline)
- [x] Placeholder home + `/styleguide` page that renders the tokens and base primitives
- [x] `.env.example`, `.gitignore`, README with how to run
- [x] Pick the mascot → **Adam the mountain goat** (`src/components/Adam.tsx`)
- [x] Pick a visual direction → **Summit**; tokens, primitives and shell rebuilt from it
- [x] Animate Adam (idle breathing/blink/ear flick; hop, flinch, tilt reactions)

**Done when:** `npm run dev` shows the shell and the style guide; `npm run build`, `npm run lint`, `npm test` pass (all green on 2026-11-04).

### Phase 2 — Core loop MVP (Python only) ← **current**

- [x] Dexie DB + data model + export/import backup (`src/lib/db.ts`, Settings page)
- [x] Content format (YAML + zod schema) + loader + validation script (`npm run content:check` runs every answer in real Python)
- [x] Pyodide runner in a Web Worker (timeouts by restarting the worker, stdout capture, test harness)
- [x] Monaco editor component (lazy-loaded, Summit theme, no autocomplete)
- [x] Exercise components: worked example, predict-output/MC, Parsons, fill-blank, fix-bug, write-function, explain (self-graded for now)
- [x] Session builder + session runner (one card at a time, feedback, hints, try again / show answer, misses retried at the end)
- [x] FSRS reviews (ts-fsrs, FSRS-7; anything seen today comes back tomorrow at the earliest)
- [x] Streak (2 automatic freezes/week), XP, "done for today", "keep going" (next lesson, extra reviews, practice)
- [x] Content: Unit 1, 10 lessons / 89 cards
- [x] Daily 5: its own session, fixed daily set, tiles, streak rule
- [x] Card variants, project lessons, self-hosted NumPy
- [x] Content: Unit 1 project, Unit 2 (9 lessons, checkpoint, project)
- [ ] Use it daily for 2 weeks and fix what feels off

**Done when:** I can do a full daily session of Python for 2 weeks and reviews come back on schedule.

### Phase 3 — NumPy, math and first models

- [ ] matplotlib output and shape viewer
- [ ] Modify cards, per-choice feedback
- [ ] Content: Units 3–5
- [ ] Watch-with-prediction and long-block lesson types; long blocks count for the streak

### Phase 4 — From micrograd to MLP

- [ ] Computation-graph visualizer, live loss-curve chart, recorded training logs to diagnose
- [ ] Content: Units 6–7
- [ ] Review the path at the Unit 7 decision point

### Phase 5 — Language models

- [ ] Worker-based training with checkpoints, streamed loss and a stop button
- [ ] Sample text-quality run before fixing the capstone size
- [ ] Content: Units 8–11

### Later, if still wanted

- [ ] Local server + Gemini hint ladder + explain-grading + response cache
- [ ] Step-through code visualizer (top visualizations are free to link in the meantime)
- [ ] AI-generated variants of mastered exercises, weekly recap, code autopsy

## 8. Definition of done (every feature)

- Works offline (AI features degrade gracefully)
- Keyboard accessible (⌘/Ctrl+Enter run, Enter continue, number keys for choices)
- Respects `prefers-reduced-motion`
- Has at least a smoke test

## 9. Commands

```bash
npm install        # once
npm run dev        # start at http://localhost:5173
npm run build      # type-check + production build
npm run lint       # oxlint
npm test           # Vitest
npm run content:check  # validate content + run every answer in real Python
npm run setup:python   # download the Python packages (runs after npm install)
```

## 10. Open questions

- Should explanations be typed or optionally spoken (speech-to-text)?
- How to source exercises: hand-written + AI-drafted-then-reviewed. Link to other sites rather than copying (Deep-ML is educational-use only, TorchCode's license is unclear, d2l is CC BY-SA, fastbook is GPL; TorchLeet and micrograd are permissive)

## 11. Decision log

| Date       | Decision                                                                                                             | Why                                                                                                               |
| ---------- | -------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| 2026-11-04 | Name: **Gradient Ascent**                                                                                            | Small steps uphill every day; ML pun                                                                              |
| 2026-11-04 | Python first, then TS; three interleaved tracks                                                                      | Python is the ML language; TS explains my web projects                                                            |
| 2026-11-04 | Local-only web app, Vite + React + TS                                                                                | Simple; the codebase itself is learning material                                                                  |
| 2026-11-04 | Gemini (free tier) via local server, optional                                                                        | Free; key stays out of the browser                                                                                |
| 2026-11-04 | Phase 1 = plan + design + scaffold only                                                                              | Agree on the target before building                                                                               |
| 2026-11-04 | Mascot: **Adam the mountain goat**                                                                                   | Climbs one step at a time; named after the Adam optimizer                                                         |
| 2026-11-04 | First look rejected as too generic; 4 directions (Summit, Trailhead, Contour, Daybreak) built in a style lab         | Choose visually, mix parts, then commit                                                                           |
| 2026-11-04 | Visual direction: **Summit** (layered indigo, flat orange buttons, segmented progress). Other 3 removed              | Professional and calm, still game-like                                                                            |
| 2026-11-04 | Dark only for now                                                                                                    | One theme done well; light can come later                                                                         |
| 2026-11-04 | Adam animates with CSS only, off under reduced motion                                                                | No animation library needed; respects accessibility                                                               |
| 2026-11-04 | Content in YAML (not JSON), validated with zod                                                                       | Code blocks stay readable with block scalars; one schema gives types + validation                                 |
| 2026-11-04 | Unit 1 order: variables → numbers → strings → functions → if → while → for → lists → dicts → patterns                | Functions early so later lessons can use real write-a-function tests                                              |
| 2026-11-04 | Explain cards are self-graded for now                                                                                | Honest offline fallback until a tutor exists                                                                      |
| 2026-11-04 | Misses come back the next day, not the same day                                                                      | Sessions are daily; same-day repeats are handled by the in-session retry                                          |
| 2026-11-04 | Curriculum moved to CURRICULUM.md; every lesson lists its target mistakes                                            | Wrong answers and fix-card bugs come from real novice mistakes                                                    |
| 2026-11-04 | Each unit ends with a checkpoint (80% to pass) and a 3–5 step project                                                | Mixed recall before moving on; projects tie a unit's ideas together                                               |
| 2026-11-04 | Tracks start in stages: Foundations, then + Web after A2, then + ML after A3                                         | Avoids overload; micrograd needs classes and special methods                                                      |
| 2026-11-04 | Classes unit moved before data structures (now Track A Unit 3)                                                       | Track C's micrograd depends on it                                                                                 |
| 2026-11-05 | **One ML path** replaces three tracks. Web paused; data structures and algorithms become an optional interview track | Goal is deep ML understanding; ML had fewer slots than Web, and the six-month target couldn't be met              |
| 2026-11-05 | Unit order: Python → NumPy → calculus → first models → micrograd → MLP → trees → probability → makemore → GPT        | No study settles the order; syllabi and the math each step needs. NumPy, evaluation and probability were the gaps |
| 2026-11-05 | **Daily 5** replaces the warm-up: separate from lessons, capped at 5, fixed per day, counts the streak               | My idea. Keeps review small and finite; a busy day still counts                                                   |
| 2026-11-05 | Problems enter the pool the day after first seen, not at unit end                                                    | Spacing should start right away                                                                                   |
| 2026-11-05 | Cards can have variants; each is checked in real Python                                                              | Repeating identical cards trains memory of the answer                                                             |
| 2026-11-05 | Python packages are downloaded after install and verified by hash, not committed                                     | Stays offline at runtime without binaries in git                                                                  |
| 2026-11-05 | Projects are lessons of write cards, with reference code in each starter                                             | Works today with no carryover engine; projects stay out of review                                                 |

## 12. Sources

- Parsons problems: [Wikipedia](https://en.wikipedia.org/wiki/Parsons_problem), [ACM 2019](https://dl.acm.org/doi/10.1145/3291279.3339419), [Ericson 2022 review](https://juholeinonen.com/assets/pdf/ericson2022parsons.pdf)
- [PRIMM](https://primmportal.com/wp-content/uploads/2020/10/teaching-computer-programming-with-primm-a-sociocultural-perspective.pdf)
- Spaced/interleaved retrieval: [Python tool (ACM)](https://dl.acm.org/doi/10.1145/3291279.3339411), [interleaving](https://pdf.retrievalpractice.org/spacing/InterleavedRetrievalPracticePromotesScienceLearning_SanaYan_2022.pdf), [variable retrieval](https://pmc.ncbi.nlm.nih.gov/articles/PMC11536137/)
- Subgoal labels: [pilot](https://par.nsf.gov/biblio/10171487-design-pilot-testing-subgoal-labeled-worked-examples-five-core-concepts-cs1), [Code.org](https://par.nsf.gov/servlets/purl/10301534)
- Read/trace/write: [Lopez et al. 2008](https://opus.lib.uts.edu.au/handle/10453/10806), [Lister et al. 2009](https://eprints.qut.edu.au/27653)
- Visualization: [Python Tutor study](https://journal.binus.ac.id/index.php/commit/article/view/3704), [multiple views](https://www.themoonlight.io/review/from-code-to-concept-evaluating-multiple-coordinated-views-in-introductory-programming)
- FSRS: [Anki FAQ](https://faqs.ankiweb.net/what-spaced-repetition-algorithm)
- AI tutors: [CS50 AI](https://cs.harvard.edu/malan/publications/fp0627-liu.pdf), [hint levels](https://arxiv.org/pdf/2404.02213)
- Gamification: [streak design](https://yukaichou.com/gamification-study/master-the-art-of-streak-design-for-short-term/), [critique](https://dev.to/yaptech/duolingos-shallow-learning-trap-gamified-streaks-harmful-habits-4134)
- ML path: see [CURRICULUM.md §7](CURRICULUM.md#7-research-behind-these-choices)
- Gemini: [rate limits](https://ai.google.dev/gemini-api/docs/rate-limits)
