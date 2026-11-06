# Gradient Ascent — Design System: **Summit**

> Living document. The code is the source of truth for values: `src/styles/tokens.css` (tokens) and
> `src/styles/components.css` (`ga-*` component classes). The live reference is `/styleguide`.
> Change a value there first, then update this file.

## 1. Feel

Professional and calm like a good dev tool, but with the pull of a game: clear progress, instant feedback,
a mascot who reacts. Think "Mimo's structure, our own night-mountain look".

- **Layered indigo night.** Surfaces get lighter as they come forward: bg → sidebar → surface → choice → raised.
- **One orange means "go".** The primary action is the only bright orange thing on screen.
- **Soft blue means "you".** Focus rings, selection, and the current item use sky.
- **Hairlines, not boxes.** 1px borders at 8% white separate layers; shadows are small and only on buttons/popovers.
- **Dark only** for now. One theme done well.

## 2. Craft rules (don'ts)

- No gradients on surfaces, buttons or text. No glows.
- No eyebrow/kicker labels above headings ("LESSON 3 ·"). Put that info in a caption under the content.
- No colored side-borders wider than 1px.
- No emoji as icons. Icons are **lucide-react**, 16–18px, stroke 2.
- Mono font only for code, keys and token names — never as decoration.
- Text contrast ≥ 4.5:1 (body text on every surface). `faint` is for captions only.
- Selection, scrollbar and focus are themed (see `global.css`). Never remove focus outlines.
- Motion respects `prefers-reduced-motion` (durations collapse to 0, Adam stops).

## 3. Color tokens

Use as Tailwind utilities (`bg-surface`, `text-muted`, `border-border`) or `var(--color-*)`.

| Group    | Token                                           | Value                                             | Use                                        |
| -------- | ----------------------------------------------- | ------------------------------------------------- | ------------------------------------------ |
| Surfaces | `bg`                                            | `#14152b`                                         | Page background                            |
|          | `sidebar`                                       | `#181a33`                                         | Sidebar, mobile tab bar                    |
|          | `surface`                                       | `#1c1e3a`                                         | Cards, lesson panel                        |
|          | `choice`                                        | `#20234a`                                         | Answer choices, inputs                     |
|          | `raised`                                        | `#262950`                                         | Hover, active nav item, inline code        |
|          | `progress-track`                                | `#2c2f58`                                         | Empty part of progress bars                |
| Lines    | `border`                                        | `rgb(255 255 255 / .08)`                          | Default hairline                           |
|          | `border-strong`                                 | `rgb(255 255 255 / .17)`                          | Hover / emphasized hairline                |
| Text     | `text`                                          | `#f1f2fa`                                         | Primary text                               |
|          | `muted`                                         | `#a9accb`                                         | Secondary text                             |
|          | `faint`                                         | `#8a8db4`                                         | Captions, disabled                         |
| Brand    | `accent`                                        | `#ff7a2f`                                         | Primary button, streak, current progress   |
|          | `accent-hover` / `accent-press`                 | `#ff8b48` / `#e9681f`                             | Button states                              |
|          | `on-accent`                                     | `#1e0c02`                                         | Text on orange                             |
| Feedback | `sky`                                           | `#8fcbff`                                         | Focus, selection, info                     |
|          | `success` / `on-success`                        | `#3ddc97` / `#04200f`                             | Correct                                    |
|          | `danger` / `on-danger`                          | `#ff6b81` / `#2b0610`                             | Wrong                                      |
|          | `xp`                                            | `#ffc94d`                                         | XP, rewards                                |
| Tracks   | `track-foundations`                             | `#8fcbff`                                         | Track A — Python & fundamentals            |
|          | `track-web`                                     | `#b49bff`                                         | Track B — JS/TS/React/backend              |
|          | `track-ml`                                      | `#ff8fc8`                                         | Track C — ML/AI                            |
| Code     | `code-bg` / `code-chrome`                       | `#101127` / `#191b38`                             | Code body / header bar                     |
|          | `code-text` / `code-gutter`                     | `#e4e6f6` / `#565a86`                             | Code text / line numbers                   |
| Syntax   | `syn-kw` `syn-str` `syn-num` `syn-fn` `syn-com` | `#ff9e64` `#a5d98a` `#ffc94d` `#8fcbff` `#6e7299` | Keyword, string, number, function, comment |

## 4. Type

- **Onest Variable** for all reading text; **JetBrains Mono Variable** for code. Both self-hosted (`@fontsource-variable`).
- Weights: body 450, strong 600, headings 650.

| Token          | Size | Use                          |
| -------------- | ---- | ---------------------------- |
| `text-display` | 40   | Celebration screens only     |
| `text-h1`      | 30   | Page title                   |
| `text-h2`      | 23   | Lesson prompt, section title |
| `text-h3`      | 18   | Card title                   |
| `text-body`    | 16   | Default                      |
| `text-small`   | 14   | Secondary, labels            |
| `text-caption` | 13   | Meta info (faint)            |
| `text-code`    | 14.5 | Code blocks                  |

Headings use `text-wrap: balance`. Keep reading width ≤ 65ch.

## 5. Shape, depth, motion

- Radius: `sm` 8 (keys, tags) · `md` 12 (buttons, choices, inputs) · `lg` 18 (cards, panels) · `pill`.
- Shadows: `--shadow-button` (1px top highlight + soft drop), `--shadow-button-pressed`, `--shadow-pop` (popovers).
- Easing: `ease-out` for UI, `ease-spring` for rewards. Durations are tokens and collapse to 0 under reduced motion.
- Spacing: Tailwind's 4px scale. Cards pad 20px; lesson panel 24–32px; page gutter 16px mobile / 24px desktop.

## 6. Components (`components.css`)

| Class                                                                 | What                                              | Notes                                                                                                                  |
| --------------------------------------------------------------------- | ------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| `ga-btn` + `--primary/--secondary/--ghost/--success/--danger`, `--sm` | Buttons (`<Button>`)                              | 46px tall (sm smaller), weight 600, presses down 1px. Optional `kbd` hint (`↵`).                                       |
| `ga-kbd`                                                              | Key hint                                          | Small mono key cap inside buttons/choices                                                                              |
| `ga-card`                                                             | Card (`<Card>`)                                   | `surface` + hairline + `lg` radius                                                                                     |
| `ga-tag`                                                              | Neutral label (`<Tag>`)                           | Exercise type                                                                                                          |
| `ga-chip`                                                             | Stat pill (`<Chip>`)                              | Streak / XP / freezes; icon tinted, sr-only label                                                                      |
| `ga-bar` / `ga-bar-fill`                                              | Progress bar (`<ProgressBar>`)                    | 6px, orange fill                                                                                                       |
| `ga-segments`                                                         | Segmented lesson progress (`<SegmentedProgress>`) | One segment per step; `data-done`, `data-current`                                                                      |
| `ga-code` (+ `--numbered`)                                            | Code block (`<CodeBlock>`)                        | Header bar with filename, optional Run; line numbers only when an exercise refers to them; `data-hl` highlights a line |
| `ga-blank`                                                            | Fill-in slot in code                              | `data-state="correct                                                                                                   | wrong"`                                        |
| `ga-choice` / `ga-choice-key`                                         | Answer choice                                     | Number key 1–4; `data-state="selected                                                                                  | correct                                        | wrong | dim"` |
| `ga-footer`                                                           | Feedback bar                                      | Slides up after Check; `data-state="correct                                                                            | wrong"`; Adam + title + explanation + Continue |
| `ga-hint`                                                             | Hint panel                                        | Sky-tinted, opened from the Hint button                                                                                |
| `ga-sidebar` / `ga-nav-item`                                          | App navigation                                    | Active item: `raised` bg + orange icon (`aria-current=page`)                                                           |
| `ga-icon-btn`                                                         | Square icon button                                | Close lesson, etc.                                                                                                     |
| `ga-shake`, `ga-pop`, `ga-feedback-in`                                | One-shot animations                               | Wrong answer shake, reward pop, footer entrance                                                                        |

## 7. Layouts

- **App shell:** 240px sidebar (logo lockup, nav, Style guide at the bottom) + header with stat chips + main column ≤ 1040px.
  Below `md` the sidebar becomes a bottom tab bar. Unbuilt sections show as disabled "Soon" items.
- **Lesson:** top bar (close · segmented progress · streak) → prompt (tag, h2, code, choices) → feedback footer.
  Keyboard first: 1–4 pick, Enter checks/continues.
- **Today (home):** the Daily 5 with Adam on its staircase, then the next lesson, then the week.

## 8. Adam the mountain goat

Mascot, named after the Adam optimizer. Flat cream fur, curled horns, orange bandana (brand orange), one ink outline weight
so he reads from 32px to 200px. Component: `src/components/Adam.tsx`.

| Mood    | Face                                 | Animation                                                     | When                             |
| ------- | ------------------------------------ | ------------------------------------------------------------- | -------------------------------- |
| `idle`  | Smile                                | Breathing bob (3.6s), blink (4.8s), occasional ear flick (7s) | Default                          |
| `happy` | Closed happy eyes, open mouth, blush | Double hop (760ms)                                            | Correct answer, finished session |
| `think` | Raised brow, eyes to the side        | Head tilt, held                                               | Hint open, AI thinking           |
| `oops`  | Worried brows, small "o" mouth       | Flinch + droop (560ms)                                        | Wrong answer                     |

- Reactions replay when the mood changes (remount with a `key` to force a replay).
- `animated={false}` for small/static uses (sidebar logo, ≤ 48px).
- All motion stops under `prefers-reduced-motion`.
- Adam never blocks content and never shames. He reacts; the text explains.

## 9. Voice

- Short, direct, friendly. "Nice — that's right." / "Not quite." then **why** in one sentence.
- Explain with the actual values ("0 + 3 + 1 + 4 = 8"), not generic praise.
- No guilt about streaks. Missing a day is fine; freezes exist.
- Second person, present tense, sentence case for everything.

## 10. Lesson engine components (Phase 2)

| Class                    | What                                  | Notes                                                                               |
| ------------------------ | ------------------------------------- | ----------------------------------------------------------------------------------- |
| `ga-code .ln-label`      | Subgoal label row inside a code block | Sky, sans, above the line it names (worked examples)                                |
| `ga-editor`              | Monaco frame                          | Same surface as `ga-code`; sky border on focus; error line tinted danger            |
| `ga-output`, `ga-test`   | Run output + test rows                | Printed text, error with line, ✓/✗ per test; hidden tests only shown when they fail |
| `ga-line`, `ga-dropzone` | Parsons line blocks                   | Mono, fixed indentation; click to place / remove                                    |
| `ga-textarea`            | Free-text answer (explain)            | `choice` surface, sky focus border                                                  |
| `ga-prose`               | Lesson text                           | Inline `code` gets a raised pill                                                    |
| `ga-day[data-frozen]`    | Streak week dot covered by a freeze   | Sky snowflake                                                                       |

Daily 5:

| Class         | What                              | Notes                                                                                                             |
| ------------- | --------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| `ga-tile`     | One problem                       | `data-state="clean\|assisted\|missed"` (check on success, check on xp, X on danger); `data-current` is a sky ring |
| `ga-tile-row` | Flat row in the session's top bar | A tile flips when its answer lands                                                                                |
| `ga-steps`    | The tiles as a rising staircase   | Adam stands on tile `--at`. `data-flip` flips tiles in turn; `data-wave` bounces them after a clean sweep         |
| `ga-settle`   | Text arriving after the climb     | Used once, on the finish screen                                                                                   |

The finish is the one authored moment: tiles flip one by one as Adam climbs to the top, then the words arrive. Under
reduced motion everything is simply in its final place. Keep this screen to a heading, streak, XP and one next step.

Session layout: full screen (no sidebar). Sticky top bar (exit · segmented progress · session XP), centered card
column ≤ 760px, sticky feedback footer. Keyboard: Enter checks/continues everywhere (also from read-only fields),
1–4 picks a choice, ⌘/Ctrl+Enter checks from inside the editor.
