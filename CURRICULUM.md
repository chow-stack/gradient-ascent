# Gradient Ascent — Curriculum

This file is the plan for what Gradient Ascent teaches and in what order. Lessons are written from it into
`content/lessons/*.yaml`. Only the next one or two units of each track are planned in full; units further out
are outlines and will change as the app gets used.

**Learner profile:** knows Java (AP CSA level). Python is taught as a mapping from Java, so the basics move
quickly and the time goes to the places where Python and Java differ.

---

## 1. How the curriculum is built

### Structure

**Track → unit → lesson.**

| Level  | Size                         | Ends with                         |
| ------ | ---------------------------- | --------------------------------- |
| Lesson | 7–10 cards, about 12 minutes | Nothing extra; review takes over  |
| Unit   | 6–10 lessons                 | A checkpoint, then a mini-project |
| Track  | 5–7 units                    | A capstone project                |

### The lesson ladder

Every lesson climbs the same ladder, from reading code to writing it. Not every lesson needs every rung, but
the order stays the same.

1. **Learn:** a worked example with labelled steps. You predict the output, then run it.
2. **Predict / concept (2–3 cards):** multiple choice. Each wrong answer is a known mistake (see §2).
3. **Parsons:** put lines in order. From Unit 2 onward, some lines also have a blank to fill in.
4. **Blank:** fill in one missing piece of working code.
5. **Modify** _(new card type)_: working code is given; change it to do something slightly different.
6. **Fix:** buggy code; find and fix the bug. The bug is one of the lesson's target mistakes.
7. **Write:** a small function with visible and hidden tests.
8. **Explain:** say what the code does in plain English.

Modify sits between fix and write on purpose. Research on PRIMM found the jump from "read it" to "write it
yourself" is too big once a task has several lines; changing working code bridges that.

### Checkpoints

A checkpoint ends every unit before the project:

- 10–12 cards drawn from the whole unit, mixed together, mostly predict, fix and write.
- Pass at 80% or more to unlock the next unit.
- Missed cards go into review either way. You can retake the checkpoint the next day.

### Projects

Each unit ends with a mini-project: one program built over 3–5 sessions.

- Each session is one step, checked by tests like a write card.
- Your code carries into the next step. If you get stuck, you can continue from the reference solution instead.
- In the daily session, a project step takes the "new lesson" slot. The review warm-up still comes first.
- Projects aren't added to spaced review; the ideas they use already are.

Each track ends with a larger capstone.

### Track order

Starting all three tracks at once would be too much. They start in stages:

| Stage | Active tracks          | Starts when                                     |
| ----- | ---------------------- | ----------------------------------------------- |
| 1     | Foundations            | Day one                                         |
| 2     | Foundations + Web      | Foundations Unit 2 is passed                    |
| 3     | Foundations + Web + ML | Foundations Unit 3 is passed (ML needs classes) |

With more than one active track, the daily "new lesson" slot rotates between them. A project in progress
always goes first. Reviews already mix all tracks.

### Threads that come back

Some ideas are taught once and then deliberately revisited in a new setting:

| Idea                    | First                  | Again                            | Again                                          |
| ----------------------- | ---------------------- | -------------------------------- | ---------------------------------------------- |
| References and aliasing | Python lists (A1)      | JS objects (B1)                  | React state must be replaced, not changed (B5) |
| Accumulator loops       | Loop patterns (A1)     | `map` / `filter` / `reduce` (B1) | NumPy operations on whole arrays (C4)          |
| Functions as values     | Passing functions (A2) | Closures and callbacks (B1, B3)  | `_backward` closures in micrograd (C2)         |
| Recursion and graphs    | Call stack (A2)        | Trees and BFS/DFS (A4–A5)        | Topological sort for backprop (C2)             |
| Operator overloading    | Dunder methods (A3)    | —                                | `Value.__add__` in micrograd (C2)              |

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
6. **Every answer is checked in real Python** by `npm run content:check` before it ships.

---

## 3. Track A — Foundations (Python)

### Unit 1 · Python refresher, mapped from Java _(built)_

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

**To add:** the checkpoint, and modify cards in lessons 4–10.

**Project 1 · Word stats** (4 steps). Functions that analyse a paragraph of text:

1. `clean(text)` → lowercase words with punctuation removed.
2. `word_counts(words)` → a dict of word → count.
3. `most_common(counts)` → the most frequent word, ties go to the first one seen (best-so-far loop).
4. `report(text)` → one f-string summary: word count, unique words, most common, longest word.

### Unit 2 · How Python actually works

Goal: an accurate picture of what Python does in memory, so that surprising behaviour stops being surprising.
Until the Phase 3 code visualizer exists, these lessons lean on predict questions.

| #   | Lesson                       | Teaches                                                                     | Target mistakes                                                                                                    |
| --- | ---------------------------- | --------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| 1   | Names and objects            | Names point at objects; `id`, `is` vs `==`                                  | A variable is a box that holds the value; `is` and `==` are the same                                               |
| 2   | Mutable vs immutable         | Lists change, strings and tuples don't; `sort` vs `sorted`, `append` vs `+` | `s.upper()` changes `s`; `x = x.sort()` keeps the list                                                             |
| 3   | Functions and mutation       | Passing lists into functions; changing vs reassigning a parameter           | Reassigning a parameter changes the caller's variable; changing a list inside a function doesn't affect the caller |
| 4   | Copies                       | `.copy()`, slicing, shallow vs deep copies, `[[0] * 3] * 3`                 | A copy of a list of lists copies the inner lists too                                                               |
| 5   | Scope                        | Local vs global, `UnboundLocalError`, `global`                              | A function can update a global just by assigning to it                                                             |
| 6   | Functions are values         | Passing functions, `lambda`, `sorted(key=...)`, closures                    | A function name followed by no `()` still calls it; a closure stores a copy of the value                           |
| 7   | The call stack and recursion | Frames, base case, the stack unwinding                                      | Recursive calls share one set of variables; a base case is optional                                                |
| 8   | Reading tracebacks           | Read bottom to top, common error types                                      | The line in the error is always the line with the bug                                                              |

**Project 2 · Gradebook** (4 steps). A dict of student → list of scores. Every function must leave its input
unchanged, and the hidden tests check that it does.

1. `add_score(book, name, score)` → a new gradebook with the score added.
2. `averages(book)` → a dict of student → average.
3. `top_student(book)` → the name with the highest average.
4. `curve(book, points)` → a new gradebook with every score raised, capped at 100.

### Unit 3 · Writing real programs _(moved earlier, before data structures, because ML needs classes)_

| #   | Lesson                      | Teaches                                                              | Target mistakes                                                               |
| --- | --------------------------- | -------------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| 1   | Tuples, sets and unpacking  | `a, b = ...`, sets for membership and de-duping                      | A set keeps order; `(5)` is a tuple                                           |
| 2   | Comprehensions              | List and dict comprehensions, filters                                | A comprehension changes the original list                                     |
| 3   | Classes and objects         | `class`, `__init__`, `self`, attributes (vs Java fields)             | `self` is optional; a class attribute is separate for each object             |
| 4   | Special methods             | `__repr__`, `__eq__`, `__add__`, `__mul__`, `__radd__`               | `print(obj)` shows the fields automatically; `2 * v` uses `__mul__`           |
| 5   | Inheritance and composition | `super().__init__`, overriding, "has a" vs "is a"                    | The child's `__init__` runs the parent's automatically                        |
| 6   | Exceptions                  | `raise`, `try`/`except`/`finally`, custom errors                     | `except:` with nothing after is a good default; code after `raise` still runs |
| 7   | Modules and tests           | `import`, `if __name__ == "__main__"`, `assert`, testing like pytest | Importing a file doesn't run its top-level code                               |

**Project 3 · Vector class** (4 steps). A `Vec` class used again in Track C:

1. `__init__` and `__repr__`.
2. `__add__`, `__sub__`, and `__mul__` by a number (plus `__rmul__`).
3. `dot` and `length`.
4. `__eq__` with a tolerance for floats, and errors for vectors of different sizes.

### Unit 4 · Data structures _(outline)_

Stacks, queues (`deque`), linked lists, binary trees, a hash map from scratch, graphs as adjacency lists.
**Project:** undo/redo history for a text editor, built on two stacks.

### Unit 5 · Algorithms _(outline)_

Big-O by feel, linear vs binary search, insertion and merge sort, recursion on trees, BFS and DFS.
**Project:** a maze solver using BFS for the shortest path.

### Capstone · Your own program

You pick from a few specs (for example a word game engine, a budget tracker or a tiny spreadsheet). It's built
with tests over about a week.

---

## 4. Track B — Understand my stack (JS/TS → web → backend)

Needs a JavaScript runner (planned for Phase 3: JavaScript runs natively in a Web Worker; TypeScript is
stripped first).

### Unit 1 · JavaScript for Python and Java people

| #   | Lesson                        | Teaches                                                 | Target mistakes                                                   |
| --- | ----------------------------- | ------------------------------------------------------- | ----------------------------------------------------------------- |
| 1   | Values and variables          | `let` / `const`, one number type, `null` vs `undefined` | `const` makes an object frozen; `5 / 2` is 2                      |
| 2   | Equality and truthiness       | `===` vs `==`, what counts as false                     | `[]` and `"0"` are false like in Python; `==` is safe             |
| 3   | Strings and template literals | `` `${x}` ``, common methods                            | Template literals work with ordinary quotes                       |
| 4   | Functions three ways          | Declarations, arrow functions, default parameters       | An arrow function returning `{ ... }` returns an object           |
| 5   | Arrays and their methods      | `push`, `map`, `filter`, `reduce`, `sort`               | `sort()` sorts numbers by value; `map` changes the original array |
| 6   | Objects and references        | Literals, spread `...`, destructuring                   | Spread makes a deep copy; `b = a` copies an object                |
| 7   | Closures                      | Counters, `let` vs `var` in loops                       | Each loop callback with `var` sees its own value                  |
| 8   | `this`                        | Methods, detached functions, arrow functions            | `this` always means the object the function was written in        |

**Project · To-do logic** (4 steps). Pure functions that never change their input, as practice for React:
`addTodo`, `toggleTodo`, `removeTodo`, `visibleTodos(todos, filter)`.

### Later units _(outline)_

2. **TypeScript:** types, interfaces, unions and narrowing, generics, reading type errors.
3. **Async:** the event loop, callbacks → promises → `async`/`await`. Main target mistake: code after an
   `await` or callback runs in the order it's written.
4. **How the web works:** HTTP, requests and responses, JSON, REST, status codes, CORS.
5. **React mental model:** components, props, state, why things re-render, effects.
6. **Data:** SQL basics, then Postgres/Supabase, auth basics.
7. **Code autopsy:** paste a file from your own projects and get quizzed on it.

**Capstone:** a small full-stack app with a React front end and a database.

---

## 5. Track C — ML / AI

Follows the order of Karpathy's _Neural Networks: Zero to Hero_, with 3Blue1Brown-style visuals. Starts once
Foundations Unit 3 is passed.

### Unit 1 · Math with pictures

All in plain Python, before NumPy.

| #   | Lesson                    | Teaches                                                              | Target mistakes                                                       |
| --- | ------------------------- | -------------------------------------------------------------------- | --------------------------------------------------------------------- |
| 1   | Functions and slopes      | Functions as machines, plotting, rise over run                       | A steeper line has a smaller slope                                    |
| 2   | The derivative by nudging | `(f(x + h) - f(x)) / h` with a small `h`                             | The derivative is the function's value; a bigger `h` is more accurate |
| 3   | Rules worth knowing       | Power, sum and constant rules; `exp` and `tanh` derivatives as facts | The derivative of `x**2` is `x`                                       |
| 4   | Several inputs            | Partial derivatives: nudge one input, hold the rest                  | Nudging two inputs at once gives one partial derivative               |
| 5   | The chain rule            | Multiply local slopes along a chain (the core of backprop)           | Slopes along a chain add                                              |
| 6   | Gradients                 | The gradient points uphill (gradient _ascent_)                       | The gradient points downhill                                          |
| 7   | Gradient descent          | Step against the gradient, learning rate, a loss going down          | A bigger learning rate is always faster                               |
| 8   | Vectors and dot products  | Lists as vectors, dot product as a weighted sum                      | The dot product gives a vector                                        |

**Project · Fit a line** (4 steps). Fit `y = w * x + b` to points with gradient descent you write yourself:
the prediction, the loss (mean squared error), the gradients, then the training loop with the loss shrinking.

### Later units _(outline)_

2. **micrograd:** a `Value` class with `+`, `*`, `tanh`; the computation graph; `backward` with a
   topological sort. Main target mistake: setting `grad =` instead of adding `grad +=` when a value is used
   twice.
3. **Neuron → layer → MLP:** a training loop on a tiny dataset, loss curves, learning-rate experiments.
4. **NumPy and tensors:** arrays, shapes, broadcasting, matrix multiplication (Pyodide includes NumPy).
5. **makemore:** a character-level name generator, from bigrams to an MLP with embeddings.
6. **Attention → tiny GPT.**
7. **Practical AI engineering:** tokens, embeddings, RAG, calling LLM APIs well, evals.

**Capstone:** train a tiny GPT on a small text and generate from it.

---

## 6. What the app needs for this

Things this curriculum uses that the app doesn't support yet:

- [ ] **Modify** card type: starting code plus an instruction, checked by tests.
- [ ] Parsons cards with blanks inside lines.
- [ ] Feedback for each wrong choice (a `why` per option, naming the mistake).
- [ ] Unit checkpoints and unit-level unlocking.
- [ ] Projects: multi-step write cards where your code carries into the next step.
- [ ] Rotating the new-lesson slot between active tracks.
- [ ] A JavaScript/TypeScript runner (Track B).

---

## 7. Research behind these choices

- Tracing, then explaining, then writing:
  [Raspberry Pi: code tracing](https://static.raspberrypi.org/files/curriculum/quickreads/14-Pedagogy_Summary_Code_Tracing_V4_2023.pdf),
  [study of prerequisite skills (2024)](https://arxiv.org/html/2410.12967v2)
- PRIMM and use-modify-create: [Sentance et al. PRIMM study](https://eprints.gla.ac.uk/229013),
  [Raspberry Pi: PRIMM](https://static.raspberrypi.org/files/curriculum/quickreads/11-Pedagogy_Summary_PRIMM_V4_2023.pdf),
  [Use-Modify-Create](https://textbooks.cs.ksu.edu/tlcs/4-designing-cs-lessons/04-use-modify-create)
- Parsons problems with blanks:
  [Faded Parsons problems (CHI 2021)](https://acelab.berkeley.edu/wp-content/papercite-data/pdf/parsons-chi2021.pdf),
  [Parsons variations (2025)](https://arxiv.org/abs/2512.22407v1)
- Wrong answers built from real mistakes:
  [Python misconceptions (2025)](https://drops.dagstuhl.de/storage/01oasics/oasics-vol134-programming2025/html/OASIcs.Programming.2025.21/OASIcs.Programming.2025.21.html),
  [concept inventory for intro programming (SIGCSE 2016)](https://www.aminer.org/pub/573696ea6e3b12023e5e85f8/developing-a-computer-science-concept-inventory-for-introductory-programming),
  [progmiscon.org](https://progmiscon.org)
- Projects that bring topics back: [spiral project-based course (ETSU)](https://dc.etsu.edu/etsu-works/13085)
- ML order and prerequisites: [Karpathy: Zero to Hero](https://karpathy.ai/zero-to-hero.html)
