# Gradient Ascent — Curriculum

This file is the plan for what Gradient Ascent teaches and in what order. Lessons are written from it into
`content/lessons/*.yaml`. Only the next one or two units are planned in full; units further out are outlines and
will change as the app gets used.

**One path:** everything serves one goal, understanding machine learning deeply enough to build a tiny GPT from
scratch. The research behind this order is summarised in §6.

**Who it's for:** anyone starting Python from zero and aiming at machine learning, with no other language assumed. Units
are being rewritten to match. Math units still assume my background (Calc AB/BC, rusty; AP Stats plus a college stats class),
to be revisited if the project is shared. Goal: deep understanding. Unit checkpoints test what really stuck, so nothing further
is compressed until there's evidence from them.

---

## 1. How the curriculum is built

### Structure

**Path → unit → lesson.**

| Level  | Size                          | Ends with                         |
| ------ | ----------------------------- | --------------------------------- |
| Lesson | 10–16 cards, about 15 minutes | Nothing extra; review takes over  |
| Unit   | 5–10 lessons                  | A checkpoint, then a mini-project |
| Path   | 11 units                      | Train a tiny GPT                  |

### Two daily loops

- **Daily 5:** 3 quick review cards chosen by FSRS, then 2 new coding tasks written by the AI from what's been
  learned. It's the same set all day, and finishing it counts the day for the streak. Without an AI key, or before
  functions are taught, it's 5 review problems instead.
- **Lessons:** new material, as many as you want. On a day with nothing to review, finishing a lesson counts the day.

Rules for the Daily 5:

1. A problem enters the pool the day after you first see it, not when the unit ends.
2. The pool grows; the daily count doesn't. Overdue problems wait their turn.
3. At most 2 code-writing problems a day, placed last. With coding tasks, the review cards have no code at all.
4. Cards with `variants` come back with different numbers or code, so answers can't be memorised.
5. Coding tasks (`src/features/fresh/`): each passed lesson with code exercises is a topic with its own FSRS schedule,
   and the 2 most due topics, from different units when possible, each get a task. Gemini writes a medium task for the
   topic: one function, 3 visible and 5 hidden tests, 2 hints. Before it's used, the reference solution must pass
   every test in real Python and use only Python found in the passed lessons' code; otherwise the problem goes back
   to the AI, up to 3 tries. Tasks are pitched a notch easier or harder from how the last few went.

If reviews keep piling up or checkpoints start failing, that's the signal to do fewer new lessons.

### How a lesson is built

_The format from the pilot lesson. Units 1 to 4 all use it._

Each lesson is about 15 minutes and about 10–16 cards. It teaches properly, in small pieces, and ends with writing code alone.

- **Explanation:** about 100–150 words per idea, in cards with an activity after each one or two. That's usually 400–750 words
  a lesson. Split a lesson that goes past that, rather than thinning it out.
- **What each idea covers:** what it does, why it works that way, the error or mistake people run into, and how it connects to
  what comes next.
- **Go deeper:** optional extra depth on a card, collapsed until opened.
- **Reread:** the teaching stays one button away during lessons and practice.
- **Opening:** a concrete goal, then a labelled example if the notation is new, or a prediction if the idea is about
  behaviour and I can reason from what I know. A prediction with nothing to go on is only a guess.
- **Order:** reading before writing, but activities are chosen by concept rather than running every lesson through the same list:
  - Blank for new syntax.
  - Predict for control flow and anything people often get wrong.
  - Parsons for patterns, but never in place of writing.
  - Fix, using a target mistake as the bug.
  - Explain early, on the example, not only at the end.
- **Ending:** an unaided write, one question from an earlier lesson, then a short recap.
- **Goal and recap cards** keep the body short and put the substance in `points`, one line each. Goal: the body says
  why the lesson matters, and `points` lists what you'll do, starting with a verb. Recap: `points` lists the key facts,
  and the body is only the `Next:` line.
- **Practice of a new idea stays together in its first lesson.** Mixing belongs in the Daily 5 and reviews.

Default order: goal → idea with labelled example → quick check → explain → next idea → check → next idea → blank → fix →
worked example → write → earlier-lesson question → recap.

Two other shapes to try when they fit, neither tested yet:

- **Predict and modify (control flow, functions):** goal → predict → run → explanation → two "what if" traces → second example →
  modify → write → explain.
- **Purpose first (recurring and ML patterns):** real outcome → working pattern with named parts → why each part exists → Parsons
  → trace → adapt to new data → write → recap.

### Checkpoints

A checkpoint ends every unit before the project:

- 10–12 cards drawn from the whole unit, mixed together, mostly predict, fix and write. The app adds 4 more from the
  unit's lessons, in a version not seen there, and shuffles them.
- It runs as a test: no hints and no feedback per question. The learner moves freely with Back, Next and the question
  bar, and can change any answer until they submit the whole checkpoint. Blank questions count as wrong (the app warns
  first). The results screen lists what was right and wrong without the answers.
- Pass at 80% or more to unlock what follows.
- Missed cards go into review either way. A failed checkpoint can be retaken straight away, and each retake moves its own
  questions on to their next version.

### Projects

Each unit ends with a project: a real, playable program that uses only that unit's ideas. You write the brain; the app
draws the board.

- **A Play tab.** Each project is a game or tool whose logic is the learner's code: rock, paper, scissors, Hangman,
  Wordle, blackjack, the Game of Life, a doodle recogniser. The app loads the program once and calls its functions as you
  click, so it plays with whatever's written so far, and Restart loads the latest code. Unit 1 has no functions yet, so
  each round reruns the whole program with the move set at the top and the score carried over.
- **One brief, one editor, a milestone checklist.** The brief is short: what you're building and how to play it. There's
  no step-by-step code: you plan and write the whole program yourself.
- **Behaviour is graded, not exact text.** Milestones test values and functions, with `vary` reruns. What a program
  prints is up to the learner and shows up in the Play tab.
- **Make it yours.** Once every milestone passes, a few ungraded ideas appear for taking it further.
- **Milestones tick off as they pass.** Check runs the whole program against each milestone separately, so the checklist shows
  how far it has got. A milestone has its own tests, `vary` reruns and concept rules (which can be scoped to one function).
- **Hints only on request.** "Stuck? Show me the next step" shows the next hint for the first unfinished milestone. The last
  hint can be close to the code.
- **Saved as you type**, so a project can be left and finished another day. Practising a project later starts it fresh.
- Projects aren't added to spaced review; the ideas they use already are.
- Units 5–11 also have a project outside the app, done in a long block (§5).

### Threads that come back

| Idea                    | First                    | Again                 | Again                                  |
| ----------------------- | ------------------------ | --------------------- | -------------------------------------- |
| References and aliasing | Python lists (U1)        | Names and copies (U2) | NumPy views (U3)                       |
| Accumulator loops       | Loop patterns (U1)       | Comprehensions (U2)   | NumPy operations on whole arrays (U3)  |
| Functions as values     | Passing functions (U4)   | —                     | `_backward` closures in micrograd (U8) |
| Operator overloading    | Special methods (U4)     | Blackjack (U4)        | `Value.__add__` in micrograd (U8)      |
| Search by elimination   | Wordle bot (U3)          | —                     | Entropy and information (U9)           |
| Likelihood              | Logistic regression (U7) | Probability (U11)     | makemore's loss (U12)                  |

---

## 2. How questions are written

1. **Each lesson names 2–4 target mistakes.** They come from research collections of novice mistakes
   ([progmiscon.org](https://progmiscon.org), Sorva 2012, Kohn 2017) and from what someone new to programming would assume.
2. **Each wrong answer matches exactly one mistake.** Picking it should tell you what you misunderstood.
   A wrong answer that is just random is a wasted option.
3. **Fix cards use a target mistake as the bug.** Not a typo.
4. **Explanations name the mistake.** The `why` says what the wrong belief is, not only what is right. Choice cards
   also give each wrong option its own note in `misses`, shown when that option is picked, so the learner hears about
   their own mistake. New units have them on every choice card from Unit 6 on; older units get them on the most-missed
   cards over time.
5. **Write tasks are small.** One function, one idea, and hidden tests for the edge cases (empty list,
   negatives, ties).
6. **Every answer is checked in real Python** by `npm run content:check` before it ships. That includes every variant.
7. **Math and code cards should have variants** with fresh values. Retrieval over restudy is unproven in math, while
   spacing helps modestly, so the skill being practised has to be working it out rather than recalling an answer.
8. **Visuals need work around them.** A prediction first and a graded question after.
9. **A check must tell a real answer from a fake one.** Output alone isn't enough, since `size = "medium"` prints the
   same as working it out. So code cards also use:
   - `vary`: other values for the variables at the top of the code. The answer and the solution rerun with each and must
     print the same and give the same test values.
   - Hidden tests with other inputs, for functions.
   - `requires` / `forbids`: the concept the card is about (`elif`, a loop, a comprehension, `name:zip`), or what it must
     do without (no loops in the NumPy unit).

   `content:check` tries hard-coded fakes against every code card and project milestone (printing the expected output,
   assigning the expected values, functions that return the first expected value) and fails if any of them pass.

10. **Modify is a way of writing cards, not a card type.** A write card whose starter is complete, working code plus an
    instruction to change it ("make it also count negatives") is a Modify card, the M in PRIMM. Its tests check the
    change. Use it when a concept is new enough that writing from a blank editor is too big a step.
11. **Explain cards are graded by AI when there's a key.** It marks each key point hit, missed or unclear and picks
    Nailed it, Partly or Missed it. "AI got it wrong" lets you grade yourself instead; the learner's grade counts and the
    disagreement is saved. With no key, offline, or on an error, you compare with a good answer and grade yourself.

---

## 3. The path

### The Python rewrite

The old "Python from Java" unit has been replaced by three units with no Java assumed: Programs and values, Functions and repetition, and Collections and libraries. All three are done. Java is gone from the app and from every lesson.

`def` after `if` and before loops is a practical choice: courses disagree, and no controlled study settles it. Spend extra care on
assignment as a lasting equation, which has the strongest evidence of any novice mistake here (Kohn 2017). Python for ML code stays, with its
error lesson moving from introduction to consolidation.

### Unit 1 · Programs and values _(built)_

| #   | Lesson                   | Teaches                                                                  | Target mistakes                                                                     |
| --- | ------------------------ | ------------------------------------------------------------------------ | ----------------------------------------------------------------------------------- |
| 1   | What a program is        | `print`, running top to bottom, text vs numbers, comments                | Lines run all at once; quotes are optional                                          |
| 2   | When code goes wrong     | Three kinds of problem, reading a message, a routine for getting unstuck | Errors mean failure; lines before the error didn't run                              |
| 3   | Numbers and maths        | `int`, `float`, `/`, `//`, `%`, `**`, order of operations                | `^` means power; `/` gives a whole number                                           |
| 4   | Variables                | Storing values, names, tracing                                           | `=` as a maths equation; reversed assignment; a misspelled name                     |
| 5   | Changing variables       | Reassignment, `x = x + 1`, `+=`                                          | Assignment as a lasting link, which is the main mistake this unit targets           |
| 6   | Working with text        | Quotes, indexes, negative indexes, slices, `len`                         | Names vs text; counting from 1; the slice end included; a length used as an index   |
| 7   | Building text            | f-strings, `int()`, `float()`, `str()`, string methods                   | Forgetting the `f`; `"a" + 1`; `int()` rounding; methods changing the string        |
| 8   | Calling functions        | Arguments, return values, nested calls, `print` vs returning             | Reading nested calls left to right; `print` gives back a value; missing parentheses |
| 9   | True and False           | Comparisons, `and`, `or`, `not`, ranges                                  | `=` for `==`; `x == 1 or 2`; `and` and `or` confused                                |
| 10  | Making decisions with if | `if`, `else`, indentation, default-then-update                           | `if` repeats like a loop; `else` with a condition; indentation is only style        |
| 11  | Many choices with elif   | `elif`, first match wins, chain vs separate `if`s, boundaries            | Every matching branch runs; order doesn't matter; `>` vs `>=`                       |

**Checkpoint:** built (12 cards). **Project · Rock, paper, scissors** _(built)_: the brain of the game. `result` with `if`/`elif` and `or`, the score in `wins` and `losses` (carried into the next round by the Play tab), a `reason` sentence, and a `winner` for a first-to-three match. Checked with every pair of moves.

### Unit 2 · Functions and repetition _(built)_

| #   | Lesson                 | Teaches                                                      | Target mistakes                                                                            |
| --- | ---------------------- | ------------------------------------------------------------ | ------------------------------------------------------------------------------------------ |
| 1   | Writing a function     | `def`, calling, parameters, arguments, define before calling | A `def` runs its body; missing parentheses; arguments matched by name rather than position |
| 2   | Giving back a value    | `return`, `None`, `return` ending the function               | `print` is the same as `return`; lines after `return` still run; a lost return value       |
| 3   | Functions that decide  | `return` inside `if`, every path returning, booleans, guards | A path that falls off the end and gives `None`; `== True`; the order of checks             |
| 4   | Names inside functions | Local variables, parameters as separate variables, defaults  | A function changing an outside variable; `UnboundLocalError`; defaults placed first        |
| 5   | Repeating with while   | `while`, tracing with a table                                | The condition is watched all the time; `if` repeats; a line in the wrong block             |
| 6   | Building up a result   | Accumulators, totals, counts, products, text                 | Resetting inside the loop; `return` inside the loop; starting a product at 0               |
| 7   | When loops go wrong    | Infinite loops, off-by-one, `break`, debugging with `print`  | Forgetting the update; updating the wrong variable; `<` vs `<=`                            |
| 8   | Counting with for      | `for`, `range` with start, stop and step, `for` vs `while`   | `range(n)` includes `n`; counting down with no step; changing `i` changes the loop         |
| 9   | Looping over text      | `for` over a string, `in`, positions, searching              | `else: return False` in a search; `word[i + 1]` past the end                               |
| 10  | Loops inside loops     | Nested loops, grids, `end=`, every pair                      | Inner loop runs once; a shared variable; an accumulator at the wrong level; `break` scope  |
| 11  | Reading a traceback    | Tracebacks through calls, finding the cause                  | Reading from the top; assuming the crash line is the bug                                   |

**Checkpoint:** built (12 cards). **Project · Hangman, and a bot that plays it** _(built)_: `masked`, `misses` and `status` run the game in the Play tab, with the guesses kept as one string (no lists yet). Then `next_guess` walks a string of letters in order of how common they are, and the bot plays by itself.

### Unit 3 · Collections and libraries _(built)_

| #   | Lesson                          | Teaches                                                           | Target mistakes                                                                            |
| --- | ------------------------------- | ----------------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| 1   | Lists                           | Making lists, indexes, slices, changing an item, `+` and `*`      | `IndexError`; assigning past the end grows the list; `*` multiplies each number            |
| 2   | Growing and sorting lists       | `append`, `insert`, `extend`, `pop`, `remove`, `sort`, `sorted`   | `x = a.sort()` gives `None`; methods vs built-ins                                          |
| 3   | Looping over lists              | `for` over items, positions when you need them                    | Assigning to the loop variable changes the list; removing during a loop                    |
| 4   | Count, sum, find, best          | The standard list patterns                                        | A best that starts at 0; `else: return False` in a search; an empty list                   |
| 5   | Two names, one list             | Aliasing, copies, lists passed to functions                       | `b = a` makes a copy; assigning to a parameter changes the caller's list                   |
| 6   | Lists of lists                  | Grids, rows and columns, nested loops                             | Row and column swapped; `[[0] * n] * m` sharing a row                                      |
| 7   | From text to lists and back     | `split`, `join`, cleaning, converting pieces                      | Pieces are still strings; `join` on numbers; `join` called on the list                     |
| 8   | Dictionaries                    | Keys and values, adding, `in`, `.get`, character-to-number tables | `KeyError`; a missing key giving `None` with `[]`; a list as a key                         |
| 9   | Counting with a dictionary      | The counting pattern, grouping, pairs                             | `counts[w] += 1` on a new key; resetting inside the loop; `The` and `the` as separate keys |
| 10  | Looping over a dictionary       | Keys, `.values()`, `.items()`, the top item, counts to fractions  | A loop gives values; `max(d)` compares by count; changing a dict's size during a loop      |
| 11  | Using libraries                 | `import`, `math`, `random`, seeds, `as`, `from`                   | Missing import or prefix; `randint` excludes the end; `shuffle` gives back a list          |
| 12  | Numbers that don't quite add up | Float precision, tolerance, formatting decimals                   | `==` on floats; `while x != 1.0`; rounding in the middle of a calculation                  |

**Checkpoint:** built (12 cards). **Project · Wordle, and a bot that solves it** _(built)_: `score` colours a guess, then handles repeated letters with a dictionary of spare letters. `remaining` keeps the words that would have scored the same, and `pick` chooses the word whose different letters are most common. The bot averages three guesses on the app's 484 words.

### Unit 4 · Python for ML code _(built)_

Rewritten in the current format. Each topic had to earn its place: micrograd, PyTorch's `nn.Module` and `Dataset`, or nanoGPT's model file has to need it. Names, copies and reading tracebacks moved out, because Units 2 and 3 now teach them, and this unit no longer assumes that you've seen a class before.

| #   | Lesson                                    | Teaches                                                                           | Target mistakes                                                                                        |
| --- | ----------------------------------------- | --------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| 1   | A first look at a neural net              | Neurons, layers, loss, TensorFlow Playground                                      | A network with no hidden layer can draw any boundary; low training loss alone means a good model       |
| 2   | Tuples and unpacking                      | Tuples, unpacking, swapping, returning several values, tuple keys                 | `(5)` is a tuple; filling in a tuple afterwards; the wrong number of names                             |
| 3   | Walking lists together                    | `zip`, `enumerate`, `zip(text, text[1:])`, dot products                           | `zip` warns about different lengths; position and item the wrong way round                             |
| 4   | List comprehensions                       | Transforming, filtering, choosing, nested                                         | `if` at the end vs `if`-`else` at the front; a comprehension changes the original                      |
| 5   | Sets and building dictionaries            | Sets, dict comprehensions, generator expressions, `any`, `all`, encode and decode | A set keeps order; `{}` is an empty set; reusing a generator                                           |
| 6   | Functions as values                       | Passing functions, `lambda`, `key=`                                               | A name without `()` calls it; `key=len()`; `key` changes what you get back                             |
| 7   | Functions that remember                   | Closures, `nonlocal`, functions made in a loop                                    | A closure stores a copy of the value; assigning without `nonlocal`; `return f()`                       |
| 8   | Your first class                          | `class`, `__init__`, attributes, methods, `self`                                  | `self` is optional; `size = size` stores it; `__init__` runs at definition                             |
| 9   | Objects and shared data                   | Aliases, class attributes, `[]` as a default, objects holding objects, `deepcopy` | `b = a` makes a new object; a class attribute is separate for each object; `self.items = items` copies |
| 10  | Making operators work                     | `__repr__`, `__add__`, `__eq__`, `__lt__`                                         | `print(obj)` shows the fields; `+` should change `self`; `==` compares values by default               |
| 11  | Mixing objects and numbers                | `isinstance`, `__rmul__`, `__radd__`, `__rsub__`, `sum`                           | `2 * v` uses `__mul__`; `sum` only needs `__add__`; the order in `__rsub__`                            |
| 12  | Objects that act like functions and lists | `__call__`, `__len__`, `__getitem__`, a `Dataset`                                 | `model(x)` needs a method named `model`; a `__getitem__` with no end never stops a loop                |
| 13  | Building on a class                       | Inheritance, overriding, `super().__init__()`, `forward`                          | A child's `__init__` runs the parent's automatically; `self` in a parent's method is the parent        |
| 14  | Raising and catching errors               | `raise`, `try`, `except`, `assert`, debugging silent bugs                         | Giving back a made-up 0; bare `except:` is a good default; no crash means no bug                       |

**Checkpoint:** built (13 cards). **Project · Blackjack** _(built)_: `Card` with `__repr__` and `value`, `Deck` with `__len__`, `deal`, `shuffle` and a `ValueError` when empty, `Hand` with aces that drop to 1, then `dealer_turn` and `outcome`. The Play tab deals real hands with these classes.

Moved out on purpose: recursion and DFS are taught in micrograd (U8), where they're needed. Custom decorators, generator functions, packaging and the `if __name__` check wait until local projects need them.

### Unit 5 · NumPy, shapes and plots _(built)_

Written in the current format. Each lesson's code runs in real NumPy, and plots appear below the output when you run them.

| #   | Lesson                    | Teaches                                                                                   | Target mistakes                                                                                     |
| --- | ------------------------- | ----------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| 1   | Why NumPy                 | `np.array`, item-by-item arithmetic, `dtype`, `.tolist()`, speed                          | `*` repeats an array; an integer array keeps decimals; arrays have `append`                         |
| 2   | Shapes                    | `.shape`, `.ndim`, `.size`, `zeros`, `arange`, `linspace`, `reshape`, `-1`                | Columns come first; `np.zeros(2, 3)`; `.shape()`; `(3,)` and `(3, 1)` are the same                  |
| 3   | Indexing and slicing      | `a[r, c]`, `a[:, c]`, blocks, assigning to sections, splitting inputs from labels         | `a[0]` is a column; a number and a slice give the same shape; row and column swapped                |
| 4   | Views and copies          | Views, `.copy()`, `a += 1` vs `a = a + 1`, `a[:] = 0`, saving weights                     | An array slice is a copy; `w = w - ...` updates the caller; `best = w` saves a snapshot             |
| 5   | Selecting with conditions | Masks, `&`, `\|`, `~`, `.any()`, counting, accuracy, `np.where`, picking by position      | `and` on arrays; `if a > 2`; `.sum()` for a fraction; `np.where` with one argument gives values     |
| 6   | Vectorising loops         | Summaries, `argmax`, `np.sqrt`/`exp`/`log`, `nan`, loop recipes, which loops stay         | `max` for a position; `math.sqrt` on an array; `(a.sum()) ** 2`; every loop can go                  |
| 7   | Axes                      | "The axis vanishes", `argmax(axis=1)`, `keepdims`, standardising                          | `axis=0` gives one per row; `argmax()` with no axis; dropping `keepdims`                            |
| 8   | Broadcasting              | The right-aligned rule, `(3,)` with `(3, 1)`, `None`, every distance with no loops        | Shapes line up on the left; `preds - y` with `(n, 1)` and `(n,)` is fine; no error means it's right |
| 9   | Dot product and cosine    | `@`, what it measures, `np.linalg.norm`, normalising, cosine similarity                   | `*` and `@` are the same; size doesn't affect a dot product; missing parentheses in the formula     |
| 10  | The matrix product        | A table of dot products, the shape rule, `.T`, `X @ w`, a layer, a two-layer forward pass | `*` on matrices; `A @ B` equals `B @ A`; `@` broadcasts; a layer needs a loop                       |
| 11  | Randomness and batches    | `default_rng`, seeds, `normal`, `permutation`, `choice`, `concatenate`, `stack`, batches  | Shuffling inputs and labels separately; recreating the generator; `integers` includes its end       |
| 12  | Plots                     | `plot`, `scatter`, `hist`, `imshow`, labels, reading a loss curve                         | Different lengths; `arange` takes a count; flat loss means finished; a mean shows the whole picture |

**Checkpoint:** built (15 cards), including rewriting two loops. **Project · Game of Life** _(built)_: `neighbours` adds up 8 shifted copies made with `np.roll`, `step` applies the rules with masks and no loops, `random_world` uses a seeded generator, and `stamp` pastes a pattern into a copy. The Play tab animates it, with gliders and a glider gun. **Project · Doodle recogniser** _(built)_: nearest neighbours on 5×5 doodles with no loops in the maths. Flatten, distances, one prediction, all predictions at once by broadcasting, then accuracy and why one doodle fools it. In the Play tab you draw a doodle, it names it and shows the closest one it knows, and you can teach it new shapes.

**Exit test:** predict shapes and vectorise loops. It's the checkpoint.

### Unit 6 · Calculus refresh and gradient descent _(built)_

Every rule is checked against a nudge in code, so no calculus background is assumed. The planned diagnostic that skips
lessons isn't built: the app has no way to skip lessons yet.

| #   | Lesson                            | Teaches                                                                                       | Target mistakes                                                                                         |
| --- | --------------------------------- | --------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| 1   | Slope by nudging                  | Slope of a line, its sign, `(f(x + h) - f(x)) / h`, choosing `h`                              | Rise over run between far-apart points is the slope at a point; `h = 1e-15` is more exact; nudging by 1 |
| 2   | Derivative rules                  | Power rule, sums and constants, `exp`, `log`, checking a rule with a nudge, a valley's bottom | Not lowering the power; a constant's slope is the constant; `exp`'s slope at 0 is 0                     |
| 3   | The chain rule                    | Outer slope at the inner value times inner slope, longer chains, `(w * x - y) ** 2`           | Dropping the inner slope; adding slopes; outer slope worked out at `x`                                  |
| 4   | Partial derivatives and gradients | One input at a time, the gradient points uphill, `numeric_grad` with copies                   | Nudging every input at once; the gradient points downhill; `q = p` instead of a copy                    |
| 5   | Gradient descent                  | `w = w - lr * grad(w)`, learning rates, diverging, loss curves, many weights at once          | `+` instead of `-`; bigger rates are always faster; stop when the gradient is exactly 0                 |
| 6   | Fitting a line                    | Predictions for a whole array, MSE, `dw` and `db` with NumPy, the training loop               | `y - pred` flips the gradient; sum instead of mean; dropping the `* x`                                  |
| 7   | Checking gradients                | Central difference, relative error, a planted bug, checking at ordinary points                | A falling loss proves the gradient; `/ 2 * h`; checking at the bottom, where everything is 0            |

**Checkpoint:** built (12 cards), including writing a whole training loop. **Project · Fit a line** _(built)_: `predict`,
`loss`, `gradients`, `step` and a `check` against central differences, from scratch. The Play tab plots the data and the
line beside the loss valley for every `w` and `b`, with the path gradient descent takes. Click to add points, pick where
to start, and try learning rates from creeping to diverging.

**Exit test:** the checkpoint.

### Unit 7 · First models, judged honestly _(built)_

The first half builds logistic regression from Unit 6's loop: a sigmoid on a score, then cross-entropy and its gradient.
The second half is about not fooling yourself. Every metric is worked out in NumPy with masks, so the stats background
makes it quick.

| #   | Lesson                        | Teaches                                                                                         | Target mistakes                                                                                           |
| --- | ----------------------------- | ----------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| 1   | From a score to a probability | Classification, why a line fails, `sigmoid`, its shape, probability then class                  | A line's output is a probability; `sigmoid(0)` is 0; the probability is the class                         |
| 2   | Log-odds                      | Odds, log-odds, `sigmoid` undoing the log, what a weight means, the boundary at `z = 0`         | Odds are a probability; a weight of 2 doubles the probability; the boundary is at `z = 0.5`               |
| 3   | One neuron                    | `X @ w + b`, many features, classifying, the boundary as a straight line, what it can't learn   | `X * w` for `X @ w`; thresholding `z` at 0.5; more training fixes a curved boundary                       |
| 4   | Cross-entropy                 | `-log` of the truth's probability, the binary formula, why not MSE, `np.clip`, the first loss   | Dropping the minus; only the `y * log(p)` term; `log(0)`; MSE is fine for probabilities                   |
| 5   | Training logistic regression  | The slope `p - y`, `X.T @ (p - y) / n`, the loop, accuracy, loss falling after accuracy is 100% | `z` in place of `p`; a sum in place of a mean; comparing probabilities with labels                        |
| 6   | Train, validation and test    | Memorising random labels, one shuffled split, validation for choices, test once                 | Scoring on training data; shuffling `X` and `y` separately; tuning on the test set; splitting sorted data |
| 7   | Baselines                     | The majority class, imbalanced data, the training mean, noise in a small validation set         | 95% accuracy means a good model; the baseline from validation labels; a 2% win on 50 examples is real     |
| 8   | Precision and recall          | Four counts with masks, precision, recall, the threshold trade-off                              | Precision and recall swapped; a higher threshold raises both; dividing by zero when nothing is flagged    |
| 9   | Learning curves               | Training and validation loss together, overfitting, underfitting, early stopping                | A falling training loss means it's improving; a gap means underfitting; `best = w` without a copy         |
| 10  | Leakage                       | Standardising with training statistics, features from the future, duplicates, splitting by time | Standardising before splitting; a feature recorded after the outcome; duplicates on both sides            |

**Checkpoint:** built (12 cards). **Project · Spam filter** _(built)_: `sigmoid` and `predict`, the cross-entropy
`loss`, a gradient `step`, `split` into training and validation, `dedupe` so copies of one message can't land on both
sides, `accuracy` and the majority `baseline`, then `precision_recall`. In the Play tab you train it on 174 messages and
watch both loss curves, type any message to see its probability and the words that pushed it, and drag the threshold to
trade precision for recall. Until `dedupe` exists, it warns how many validation messages it already saw in training.

**Exit test:** beat the baseline with no leakage. It's the project. **Long block:** a real table in a notebook, with git.

### Unit 8 · micrograd

A `Value` class with `+`, `*`, `tanh`, closures for `_backward`, recursion, DFS and topological sort. Main target
mistake: setting `grad =` instead of adding `grad +=` when a value is used twice. **Exit test:** matches numeric
gradients. **Long block:** code along with Karpathy's video.

### Unit 9 · MLP and silent bugs

Neuron → layer → MLP, the training loop, expected initial loss, overfitting one batch, diagnosing loss curves,
planted bugs. **Long block:** rebuild it in real PyTorch on Colab and compare gradients.

**Decision point at the end of this unit:** review this path, including whether to go on to data science or AI
engineering, and whether Unit 10 stays here or moves after the GPT.

### Unit 10 · Trees and real tables

pandas basics, one small tree by hand, forests, boosting, cross-validation. **Exit test:** an honest comparison of
logistic regression, boosting and an MLP.

### Unit 11 · Probability for language models

Starts with a diagnostic, because AP Stats plus college stats should cover distributions, conditional probability and
sampling. New material is likely softmax, log-likelihood, negative log-likelihood and cross-entropy.
**Exit test:** compute NLL by hand; a working bigram sampler.

### Unit 12 · makemore in NumPy

Bigrams to an MLP with embeddings. Backprop Ninja becomes optional graded drills; WaveNet is optional.
**Long block:** makemore in PyTorch.

### Unit 13 · Attention to tiny GPT

Masked attention, then a small GPT trained in the browser. Measured on one fast machine: about 30K parameters train
5,000 steps in about 87 seconds, and about 110K in about 13 minutes. Check text quality on real data before fixing the
final size. **Long block:** "Let's build GPT" plus nanoGPT on a GPU.

### After the path

Depends on the goal chosen at the Unit 9 decision point:

| Goal                         | Next                                                                      |
| ---------------------------- | ------------------------------------------------------------------------- |
| Deep understanding (current) | Reproduce a small GPT in PyTorch, read papers                             |
| AI engineering               | Evals first, then context, retrieval and tools, on a real app             |
| ML engineering               | PyTorch depth, data pipelines, serving, monitoring, interview track       |
| Research                     | Paper reproductions; return to eigenvectors, SVD and probability          |
| Data science                 | Statistics, experiment design, SQL; Unit 10 moves before Unit 8 and grows |

---

## 4. Parked

| What                                              | Status                                                                                |
| ------------------------------------------------- | ------------------------------------------------------------------------------------- |
| Web track (JS, TS, async, React, SQL)             | Paused. No JS/TS runner, no track rotation                                            |
| Linked lists, general trees, sorts, BFS           | Optional interview track, only when job hunting                                       |
| Practical AI engineering (RAG, evals)             | After the path, or sooner if the goal changes                                         |
| Determinants, Gaussian elimination, SVD           | Only if a later goal or classical method needs them                                   |
| Applied track (pandas, trees, pre-trained models) | A possible branch after Unit 3, for people who want to use ML on real data. See below |

**Applied track.** A shorter route for students who want to use ML rather than build it from scratch. It would branch after Unit 3, skip the classes in Unit 4 and the
calculus, and reuse Unit 7 (first models) and Unit 10 (pandas, trees, forests) rather than being a parallel curriculum. Name tracks by goal, not by major. Pandas and scikit-learn
run in Pyodide, but fine-tuning a pre-trained model needs PyTorch and usually a GPU, so that part would happen outside the app, in Colab. **Start it when:** real students ask for it, or a
contributor offers to write it, or the main goal changes from understanding ML deeply to serving many students. It needs some engine work too, because the app assumes one line of lessons:
choosing a track, what counts as next, and what goes in Daily 5.

The test for any math lesson: **name the later line of code that needs it.** If no line does, it waits.

---

## 5. What stays outside the app

The app handles retrieval and small steps. Twenty minutes a day is only about 122 hours a year, and some skills can't
be auto-graded in a short session.

- From about Unit 7, one weekend block of 90–180 minutes covers first exposures to hard ideas (Karpathy's videos),
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
- [x] Projects as one brief and editor with a milestone checklist, saved as you type, kept out of spaced review.
- [x] Checks that can't be passed by hard-coding: `vary` reruns, hidden tests, concept rules, and a cheat test in `content:check`.
- [x] AI grading of explain cards, with self-grading as the fallback and when the learner disagrees.
- [x] NumPy, self-hosted so it works offline.
- [x] **Modify** cards: written as write cards whose starter is working code to change (§2), so no new type.
- [ ] Parsons cards with blanks inside lines.
- [x] Feedback for each wrong choice: a note per option in `misses`, naming the mistake.
- [x] Plots (matplotlib), shown below a run's output.
- ~~A shape viewer.~~ Dropped: printing `.shape` is taught as the habit, and it works everywhere, not just in the app.
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
