# Gradient Ascent — Curriculum

This file is the plan for what Gradient Ascent teaches and in what order. Lessons are written from it into
`content/lessons/*.yaml`. Only the next one or two units are planned in full; units further out are outlines and
will change as the app gets used.

**One path:** everything serves one goal, understanding machine learning deeply enough to build a tiny GPT from
scratch. The research behind this order is summarised in §6.

**Learner profile:** took AP CSA (Java) and AP CSP, but much of it didn't stick. Calc AB/BC went well (rusty).
AP Stats plus a college stats class in progress. Goal: deep understanding. Unit checkpoints test what really stuck,
so nothing further is compressed until there's evidence from them.

---

## 1. How the curriculum is built

### Structure

**Path → unit → lesson.**

| Level  | Size                         | Ends with                         |
| ------ | ---------------------------- | --------------------------------- |
| Lesson | 7–10 cards, about 12 minutes | Nothing extra; review takes over  |
| Unit   | 5–10 lessons                 | A checkpoint, then a mini-project |
| Path   | 11 units                     | Train a tiny GPT                  |

### Two daily loops

- **Daily 5:** up to 5 problems from everything already learned, chosen by FSRS. It's the same set all day, takes
  about 5 minutes, and finishing it counts the day for the streak.
- **Lessons:** new material, as many as you want. On a day with nothing to review, finishing a lesson counts the day.

Rules for the Daily 5:

1. A problem enters the pool the day after you first see it, not when the unit ends.
2. The pool grows; the daily count doesn't. Overdue problems wait their turn.
3. At most 2 code-writing problems a day, placed last.
4. Cards with `variants` come back with different numbers or code, so answers can't be memorised.

If reviews keep piling up or checkpoints start failing, that's the signal to do fewer new lessons.

### The lesson ladder

Every lesson climbs the same ladder, from reading code to writing it. Not every lesson needs every rung, but
the order stays the same.

1. **Learn:** a worked example with labelled steps. You predict the output, then run it.
2. **Predict / concept (2–3 cards):** multiple choice. Each wrong answer is a known mistake (see §2).
3. **Parsons:** put lines in order.
4. **Blank:** fill in one missing piece of working code.
5. **Modify** _(planned card type)_: working code is given; change it to do something slightly different.
6. **Fix:** buggy code; find and fix the bug. The bug is one of the lesson's target mistakes.
7. **Write:** a small function with visible and hidden tests.
8. **Explain:** say what the code does in plain English.

Worked examples come first for ideas with many moving parts (backprop, attention). Simple ideas can open with a
prediction instead.

### Checkpoints

A checkpoint ends every unit before the project:

- 10–12 cards drawn from the whole unit, mixed together, mostly predict, fix and write.
- Pass at 80% or more to unlock what follows.
- Missed cards go into review either way. You can retake the checkpoint the next day.

### Projects

Each unit ends with a project: one program built step by step.

- Each step is a write card checked by tests. Its starter includes reference solutions for the earlier steps.
- Project cards aren't added to spaced review; the ideas they use already are.
- Units 5–11 also have a project outside the app, done in a long block (§5).

### Threads that come back

| Idea                    | First                    | Again                 | Again                                  |
| ----------------------- | ------------------------ | --------------------- | -------------------------------------- |
| References and aliasing | Python lists (U1)        | Names and copies (U2) | NumPy views (U3)                       |
| Accumulator loops       | Loop patterns (U1)       | Comprehensions (U2)   | NumPy operations on whole arrays (U3)  |
| Functions as values     | Passing functions (U2)   | —                     | `_backward` closures in micrograd (U6) |
| Operator overloading    | Special methods (U2)     | Vector project (U2)   | `Value.__add__` in micrograd (U6)      |
| Word counts             | Word stats project (U1)  | —                     | Bigram counts (U9, U10)                |
| Likelihood              | Logistic regression (U5) | Probability (U9)      | makemore's loss (U10)                  |

---

## 2. How questions are written

1. **Each lesson names 2–4 target mistakes.** They come from research collections of novice mistakes
   ([progmiscon.org](https://progmiscon.org), Sorva 2012, Kohn 2017) and from Java habits that break in Python.
2. **Each wrong answer matches exactly one mistake.** Picking it should tell you what you misunderstood.
   A wrong answer that is just random is a wasted option.
3. **Fix cards use a target mistake as the bug.** Not a typo.
4. **Explanations name the mistake.** The `why` says what the wrong belief is, not only what is right.
5. **Write tasks are small.** One function, one idea, and hidden tests for the edge cases (empty list,
   negatives, ties).
6. **Every answer is checked in real Python** by `npm run content:check` before it ships. That includes every variant.
7. **Math and code cards should have variants** with fresh values. Retrieval over restudy is unproven in math, while
   spacing helps modestly, so the skill being practised has to be working it out rather than recalling an answer.
8. **Visuals need work around them.** A prediction first and a graded question after.

---

## 3. The path

### Unit 1 · Python from Java _(built)_

| #   | Lesson                | Teaches                                        | Target mistakes                                                                                 |
| --- | --------------------- | ---------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| 1   | Variables and print   | Names, reassignment, `print` with commas, swap | `a = b` links the two forever; commas print nothing between values; names aren't case-sensitive |
| 2   | Numbers and math      | `int` vs `float`, `/`, `//`, `%`               | `/` drops the decimal like in Java; `//` rounds toward zero with negatives                      |
| 3   | Strings and f-strings | Indexing, slicing, f-strings                   | The slice end is included; `"a" + 1` works like Java; strings can be changed in place           |
| 4   | Functions             | `def`, `return`, default arguments             | Printing is the same as returning; a function with no `return` gives back 0                     |
| 5   | Booleans and if       | `and`/`or`/`not`, `elif`, indentation          | `=` compares; every matching `elif` runs; indentation is just style                             |
| 6   | while loops           | Loop conditions, `+=`                          | `i++` exists; the condition is checked constantly rather than once per pass                     |
| 7   | for loops and range   | `for` over items, `range`                      | `range(n)` includes `n`; changing the loop variable changes how many times it runs              |
| 8   | Lists                 | Methods, slicing, aliasing                     | `b = a` copies the list; a "best so far" can start at 0                                         |
| 9   | Dictionaries          | Keys, `.get`, counting                         | A missing key gives `None`; looping over a dict gives values                                    |
| 10  | Loop patterns         | Count, sum, find, best                         | `return` inside the loop still checks every item; `>=` and `>` treat ties the same              |

**Checkpoint:** built. **Project · Word stats** _(built)_: `clean`, `word_counts`, `most_common`, `report`.

### Unit 2 · Python for ML code _(built)_

Merges the old "How Python works" and "Writing real programs" units, keeping what ML code actually uses. The test
for each topic was whether micrograd, PyTorch's `nn.Module` and `Dataset`, or nanoGPT's model file needs it.

| #   | Lesson                          | Teaches                                                                            | Target mistakes                                                                                    |
| --- | ------------------------------- | ---------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| 1   | A first look at a neural net    | Guided TensorFlow Playground: layers, curved boundaries, learning rate             | A network with no hidden layer can draw any boundary; lower training loss alone means a good model |
| 2   | Names and changes               | Names point at objects, `is` vs `==`, mutation vs reassignment, scope              | `x = x.sort()` keeps the list; reassigning a parameter changes the caller's variable               |
| 3   | Copies                          | `.copy()`, shallow vs deep, `[[0] * 3] * 3`, `sorted`                              | A copy of a list of lists copies the inner lists too                                               |
| 4   | Functions as values             | Passing functions, `lambda`, `key=`, closures                                      | A name without `()` still calls it; a closure stores a copy of the value                           |
| 5   | Tuples, zip, comprehensions     | Unpacking, sets, `zip`, `enumerate`, comprehensions, generator expressions         | `(5)` is a tuple; a set keeps order; a comprehension changes the original                          |
| 6   | Classes and objects             | `class`, `__init__`, `self`, instance vs class attributes                          | `self` is optional; a class attribute is separate for each object                                  |
| 7   | Special methods                 | `__repr__`, `__eq__`, `__add__`, `__mul__`, `__rmul__`                             | `print(obj)` shows the fields automatically; `2 * v` uses `__mul__`                                |
| 8   | Objects that act like functions | `__call__`, `__len__`, `__getitem__`, `super().__init__`                           | A child's `__init__` runs the parent's automatically; `model(x)` needs a method named `model`      |
| 9   | Reading errors                  | Tracebacks bottom to top, common errors, debugging with `print`, `raise`, `assert` | The line in the error is always the line with the bug; bare `except:` is a good default            |

**Checkpoint:** built. **Project · Vector class** _(built)_: `__init__`/`__repr__`, arithmetic, `dot`/`length`,
`__eq__` with a float tolerance.

Moved out on purpose: recursion and DFS are taught in micrograd (U6), where they're needed. Custom decorators,
generator functions, packaging and the `if __name__` check wait until local projects need them.

### Unit 3 · NumPy, shapes and plots _(next)_

Vectorizing loops, indexing and views, axes, broadcasting, dot product and cosine similarity, the matrix product as
a table of dot products, transpose, `matplotlib`. **Exit test:** predict shapes and vectorize loops.

### Unit 4 · Calculus refresh and gradient descent

Opens with a 5-minute diagnostic (slope, power rule, composition, logs, numeric derivatives) that skips whatever
survived. Then nudging, the chain rule, partial derivatives and gradients (AB/BC usually skips these two), gradient
descent. **Project · Fit a line** in NumPy, with a gradient check.

### Unit 5 · First models, judged honestly

Log-odds, logistic regression as one neuron, cross-entropy, train/validation/test splits, baselines, learning curves,
precision and recall, leakage. The stats background should make metrics quick. **Exit test:** beat a baseline with no
leakage. **Long block:** a real table in a notebook, with git.

### Unit 6 · micrograd

A `Value` class with `+`, `*`, `tanh`, closures for `_backward`, recursion, DFS and topological sort. Main target
mistake: setting `grad =` instead of adding `grad +=` when a value is used twice. **Exit test:** matches numeric
gradients. **Long block:** code along with Karpathy's video.

### Unit 7 · MLP and silent bugs

Neuron → layer → MLP, the training loop, expected initial loss, overfitting one batch, diagnosing loss curves,
planted bugs. **Long block:** rebuild it in real PyTorch on Colab and compare gradients.

**Decision point at the end of this unit:** review this path, including whether to go on to data science or AI
engineering, and whether Unit 8 stays here or moves after the GPT.

### Unit 8 · Trees and real tables

pandas basics, one small tree by hand, forests, boosting, cross-validation. **Exit test:** an honest comparison of
logistic regression, boosting and an MLP.

### Unit 9 · Probability for language models

Starts with a diagnostic, because AP Stats plus college stats should cover distributions, conditional probability and
sampling. New material is likely softmax, log-likelihood, negative log-likelihood and cross-entropy.
**Exit test:** compute NLL by hand; a working bigram sampler.

### Unit 10 · makemore in NumPy

Bigrams to an MLP with embeddings. Backprop Ninja becomes optional graded drills; WaveNet is optional.
**Long block:** makemore in PyTorch.

### Unit 11 · Attention to tiny GPT

Masked attention, then a small GPT trained in the browser. Measured on one fast machine: about 30K parameters train
5,000 steps in about 87 seconds, and about 110K in about 13 minutes. Check text quality on real data before fixing the
final size. **Long block:** "Let's build GPT" plus nanoGPT on a GPU.

### After the path

Depends on the goal chosen at the Unit 7 decision point:

| Goal                         | Next                                                                     |
| ---------------------------- | ------------------------------------------------------------------------ |
| Deep understanding (current) | Reproduce a small GPT in PyTorch, read papers                            |
| AI engineering               | Evals first, then context, retrieval and tools, on a real app            |
| ML engineering               | PyTorch depth, data pipelines, serving, monitoring, interview track      |
| Research                     | Paper reproductions; return to eigenvectors, SVD and probability         |
| Data science                 | Statistics, experiment design, SQL; Unit 8 moves before Unit 6 and grows |

---

## 4. Parked

| What                                    | Status                                              |
| --------------------------------------- | --------------------------------------------------- |
| Web track (JS, TS, async, React, SQL)   | Paused. No JS/TS runner, no track rotation          |
| Linked lists, general trees, sorts, BFS | Optional interview track, only when job hunting     |
| Practical AI engineering (RAG, evals)   | After the path, or sooner if the goal changes       |
| Determinants, Gaussian elimination, SVD | Only if a later goal or classical method needs them |

The test for any math lesson: **name the later line of code that needs it.** If no line does, it waits.

---

## 5. What stays outside the app

The app handles retrieval and small steps. Twenty minutes a day is only about 122 hours a year, and some skills can't
be auto-graded in a short session.

- From about Unit 5, one weekend block of 90–180 minutes covers first exposures to hard ideas (Karpathy's videos),
  real PyTorch and messy data.
- Long blocks should count toward the streak once they're tracked in the app.
- **Learning mode vs building mode:** attempt first, use AI only for concepts and hints when learning. Vibecoding is
  fine when building, but it doesn't count as ML practice, and neither does working on this app.

Signals that matter more than XP: delayed unaided tasks, completed long blocks, and real models trained.

---

## 6. What the app needs for this

- [x] Unit checkpoints and unit-level unlocking.
- [x] Daily 5, with one fixed set a day and its own streak rule.
- [x] Card variants with fresh values, each checked in real Python.
- [x] Projects as step-by-step write cards, kept out of spaced review.
- [x] NumPy, self-hosted so it works offline.
- [ ] **Modify** card type: starting code plus an instruction, checked by tests.
- [ ] Parsons cards with blanks inside lines.
- [ ] Feedback for each wrong choice (a `why` per option, naming the mistake).
- [ ] Plots and shape output (matplotlib) for Unit 3.
- [ ] Watch-with-prediction and long-block lesson types.
- [ ] A "mistake to card" button for errors made in outside projects.

---

## 7. Research behind these choices

No controlled study compares ML learning orders, so this path is reasoned judgment from course syllabi, the math each
step needs, and general learning science.

- ML order and prerequisites: [Karpathy: Zero to Hero](https://karpathy.ai/zero-to-hero.html),
  [CS229](https://cs229.stanford.edu/), [fast.ai](https://course.fast.ai/), [Parr & Howard](https://arxiv.org/abs/1802.01528)
- Guidance beats unassisted discovery: [Alfieri et al. 2011](https://www.fisme.science.uu.nl/publicaties/literatuur/2011_alfieri_discovery_learning.pdf)
- Visuals need active use: [Hundhausen et al.](https://www.academia.edu/15636659/A_Meta_Study_of_Algorithm_Visualization_Effectiveness),
  [exploRNN](https://arxiv.org/pdf/2012.06326)
- AI assistance and skill: [Anthropic](https://www.anthropic.com/research/AI-assistance-coding-skills),
  [Bastani et al. 2025](https://ideas.repec.org/a/nas/journl/v122y2025pe2422633122.html)
- Spacing and retrieval in math: [Murray et al.](https://eprints.whiterose.ac.uk/id/eprint/229807)
- Spaced repetition limits: [Nielsen](https://augmentingcognition.com/ltm.html)
- Silent training bugs: [Karpathy's recipe](https://karpathy.github.io/2019/04/25/recipe/),
  [scikit-learn pitfalls](https://scikit-learn.org/stable/common_pitfalls.html)
- Tracing, then explaining, then writing:
  [Raspberry Pi: code tracing](https://static.raspberrypi.org/files/curriculum/quickreads/14-Pedagogy_Summary_Code_Tracing_V4_2023.pdf)
- PRIMM and use-modify-create (limited evidence, still a sensible bridge):
  [Sentance et al.](https://eprints.gla.ac.uk/229013),
  [Use-Modify-Create](https://textbooks.cs.ksu.edu/tlcs/4-designing-cs-lessons/04-use-modify-create)
- Parsons problems: [Faded Parsons (CHI 2021)](https://acelab.berkeley.edu/wp-content/papercite-data/pdf/parsons-chi2021.pdf),
  [Poulsen et al.](https://arxiv.org/abs/2211.09609)
- Wrong answers built from real mistakes: [progmiscon.org](https://progmiscon.org)
