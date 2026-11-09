# Gradient Ascent

**Small steps uphill, every day.** A local-first daily practice app for learning machine learning, from Python to
a tiny GPT. It's built on learning research instead of streak-farming.

Each day has a **Daily 5**: up to five problems from everything you've learned, picked by spaced repetition. Lessons are
separate, and you can do as many as you like. Each one teaches one new idea through worked examples and short
explanations, mixed with exercises: predict the output, order the lines, fill in the blank, fix the bug, write the
code, and explain it in plain English. All code runs as real Python in your browser, and all progress stays on your machine.

> **Status:** Phase 3 of 5. Units 1 to 7 are written for true beginners: Programs and values, Functions and
> repetition, Collections and libraries, Python for ML code, NumPy, shapes and plots, Calculus and gradient descent,
> and First models, judged honestly. A hand-built micrograd comes next. See the [roadmap](#roadmap).

---

## Features

- **Daily 5:** one fixed set a day, tracked as tiles, and what counts for your streak: 3 quick review cards, then 2 new
  coding tasks the AI writes from what you've learned and checks in real Python first. Without an AI key (or
  offline), all five are review cards. Cards can come back with new values, so answers can't just be memorised.
- **Unlimited lessons:** on your own schedule, with a checkpoint and a project ending each unit.
- **Eight exercise types:** worked examples (predict, then run), multiple choice, Parsons problems,
  fill-in-the-blank, fix-the-bug, write-a-function with visible and hidden tests, explain-in-your-own-words (graded by AI
  if you add a key), and projects: a game your own code runs, like Wordle with a solver bot, built milestone by milestone.
- **Checks you can't fool:** code is rerun with other values and checked for the idea the card is about, so printing the
  expected answer doesn't pass.
- **Real Python in the browser:** [Pyodide](https://pyodide.org) runs in a Web Worker, so the UI never freezes.
  Infinite loops are stopped by a timeout, and errors point to the line that caused them. The worker is locked down,
  so code (yours or the AI's) can't reach the network or your saved progress.
- **A real editor:** [Monaco](https://microsoft.github.io/monaco-editor/), the editor from VS Code, with
  autocomplete turned off on purpose so you do the thinking.
- **Spaced repetition:** every exercise you've seen is scheduled with
  [FSRS](https://github.com/open-spaced-repetition/ts-fsrs), the algorithm behind modern Anki.
- **Mastery path:** a lesson is _passed_ when you finish it and _mastered_ after a correct review on a later day.
  Each lesson unlocks the next.
- **Habit-friendly gamification:** streaks with two automatic freezes a week, and XP weighted toward new and hard
  work rather than easy repeats. There are no leaderboards and no guilt.
- **Local-first and private:** progress is stored in IndexedDB, with JSON backup and restore. There are no
  accounts, no tracking and no server. The optional AI features talk to Google directly (see [Privacy](#privacy)).
- **Keyboard-first:** <kbd>1</kbd>–<kbd>4</kbd> picks a choice, <kbd>Enter</kbd> checks and continues, and
  <kbd>⌘</kbd>/<kbd>Ctrl</kbd>+<kbd>Enter</kbd> checks from inside the editor.
- **Adam the mountain goat:** an animated mascot who reacts to your answers. He's named after the Adam optimizer,
  and his motion respects `prefers-reduced-motion`.

## The learning approach

Every feature traces back to a research-backed principle. The full table, with sources, is in
[BUILD_PLAN.md](BUILD_PLAN.md#2-learning-principles-the-research-were-building-on).

| Principle                                       | How it shows up                                                                   |
| ----------------------------------------------- | --------------------------------------------------------------------------------- |
| Retrieval practice                              | Sessions open with recall, not re-reading                                         |
| Spaced repetition                               | FSRS schedules every exercise you've seen                                         |
| Interleaving                                    | Reviews mix lessons, and never show the same lesson twice in a row when avoidable |
| Read → trace → explain → write                  | Lessons move from reading code to writing it                                      |
| Worked examples with subgoal labels             | New ideas open with labelled, runnable code                                       |
| PRIMM (Predict, Run, Investigate, Modify, Make) | You predict before you run                                                        |
| Mastery learning                                | Lessons unlock in order; mastery needs a correct review on another day            |

## Tech stack

| Layer          | Choice                                                            |
| -------------- | ----------------------------------------------------------------- |
| App            | React 19, TypeScript, Vite                                        |
| Styling        | Tailwind CSS v4 with design tokens ([DESIGN.md](DESIGN.md))       |
| Python runtime | Pyodide (WebAssembly) in a Web Worker, served locally and offline |
| Editor         | Monaco, lazy-loaded                                               |
| Storage        | IndexedDB via Dexie                                               |
| Scheduling     | ts-fsrs (FSRS-7)                                                  |
| Content        | YAML, validated with zod                                          |
| Quality        | Vitest + Testing Library, oxlint, Prettier                        |

## Getting started

**Requirements:** Node.js 22.18 or newer (the content checker uses Node's built-in TypeScript support).

```bash
git clone https://github.com/chow-stack/gradient-ascent.git
cd gradient-ascent
npm install
npm run dev
```

`npm install` also downloads NumPy and matplotlib for offline use (`npm run setup:python` retries it).

Open <http://localhost:5173> and press **Start**.

### Scripts

| Command                 | What it does                                              |
| ----------------------- | --------------------------------------------------------- |
| `npm run dev`           | Start the dev server with hot reload                      |
| `npm run build`         | Type-check and build for production (`dist/`)             |
| `npm run preview`       | Serve the production build locally                        |
| `npm test`              | Run the test suite once                                   |
| `npm run content:check` | Validate every lesson and run every answer in real Python |
| `npm run setup:python`  | Download the Python packages lessons use                  |
| `npm run lint`          | Lint with oxlint                                          |
| `npm run format`        | Format with Prettier                                      |

## Writing lessons

Lessons are plain YAML files in [`content/lessons/`](content/lessons). They're validated against one
[schema](src/features/content/schema.ts), and the app picks them up automatically.

```yaml
- type: fix
  id: off-by-one
  prompt: This should print 0, 1 and 2, but prints one number too many. Fix it.
  code: |
    i = 0
    while i <= 3:
        print(i)
        i += 1
  solution: |
    i = 0
    while i < 3:
        print(i)
        i += 1
  expectOutput: |
    0
    1
    2
  why: '`<= 3` lets i = 3 through. Check the last pass of every loop.'
```

`npm run content:check` runs each lesson in Python and fails if any of these is untrue:

- the answer to every "predict the output" question matches what the code really prints
- every reference solution passes its tests
- every buggy snippet actually fails

## Project structure

```
content/            Curriculum as YAML (tracks/, lessons/)
scripts/            check-content.ts: runs every answer in Pyodide on Node
src/
  app/              Routes and the app shell
  pages/            Today, Path, Session, Settings, Style guide
  features/
    content/        Schema and loader
    runner/         Python worker, test harness, client with timeouts
    exercises/      One view per exercise type, plus grading
    session/        Session planner and runner, done screen
    review/         FSRS scheduling
    progress/       Recording, streak, XP
  components/       Adam, CodeBlock, Monaco editor, UI primitives
  lib/              IndexedDB (Dexie), dates, helpers
  styles/           Design tokens and component styles
```

## Roadmap

- [x] **Phase 1:** plan, design system ("Summit"), project setup
- [x] **Phase 2:** lessons, Daily 5, spaced repetition, streaks, self-hosted NumPy
- [ ] **Phase 3:** Python, NumPy, calculus and first models (Units 1–7, all built), plus AI-written Daily 5 tasks
- [ ] **Phase 4:** a hand-built micrograd and MLP, with diagnosing training curves (Units 8–9)
- [ ] **Phase 5:** trees, probability, makemore, attention and a tiny GPT (Units 10–13)

The full path is in [CURRICULUM.md](CURRICULUM.md).
Details, data model and decisions are in [BUILD_PLAN.md](BUILD_PLAN.md). The visual system is in
[DESIGN.md](DESIGN.md) and is also live at `/styleguide`.

## Privacy

Everything runs in your browser. Progress lives in IndexedDB on your machine, so clearing site data erases it;
use **Settings → Download backup** now and then.

The one exception is optional. If you paste a Google Gemini key in **Settings → AI**, the key stays in this
browser and is left out of backups, and the app sends two things straight to Google (never to anyone else):

- your **"explain the code" answers**, with the question, so they can be graded
- for the **Daily 5 coding tasks**, the titles and summaries of the lessons you've passed, the Python you've been
  taught, the titles of your recent tasks, and whether those felt easy or hard. Your own code and answers aren't sent.

Without a key, nothing leaves your machine.

## License

[MIT](LICENSE). Use it, fork it, learn from it.

Bundled third-party software keeps its own license: [Pyodide](https://github.com/pyodide/pyodide) (MPL-2.0),
[Monaco](https://github.com/microsoft/monaco-editor) (MIT), NumPy and matplotlib (BSD-style and PSF-based), and the Onest
and JetBrains Mono fonts (SIL Open Font License).
