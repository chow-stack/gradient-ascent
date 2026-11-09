/**
 * The Python side of the runner. Loaded once into Pyodide (browser worker and the Node content checker),
 * then every run calls `__ga_run(code, tests_json)` and gets a JSON string back.
 *
 * - Each run gets a fresh namespace, so variables never leak between exercises.
 * - stdout is captured; `input()` is disabled (exercises never need it).
 * - Errors report the line in the learner's code (file name "main.py").
 * - Tests are `{call, expect}` pairs of Python expressions, compared with == (floats with isclose).
 *   NumPy values are compared as plain lists, so `np.array([1, 2])` passes `[1, 2]`.
 * - Plots are drawn off-screen and come back as PNGs in `figures`, whether or not the code calls plt.show().
 * - Options (all optional) make a correct-looking answer prove itself:
 *   - `vary`: other values for variables the code sets at the top. The code and the reference solution both
 *     rerun with each set of values, and must print the same thing and give the same value for every test
 *     call. So hard-coding the answer fails.
 *   - `requires` / `forbids`: language features the code must or mustn't use, read from its syntax
 *     (see RULE_LABELS), so a card about `elif` can insist on an `elif`.
 */
export const HARNESS_PY = String.raw`
import ast, base64, io, json, math, os, sys, tokenize, traceback, contextlib, builtins, warnings

os.environ["MPLBACKEND"] = "AGG"
warnings.filterwarnings("ignore", message=".*non-interactive.*")
warnings.filterwarnings("ignore", message=".*parameter as float.*")

def __ga_prepare_plots():
    # Importing matplotlib is slow the first time, so this runs before a run's time limit starts.
    import matplotlib.pyplot as plt
    plt.rcParams["figure.figsize"] = (5, 3)

def __ga_figures():
    plt = sys.modules.get("matplotlib.pyplot")
    if plt is None:
        return []
    images = []
    try:
        for num in plt.get_fignums():
            buf = io.BytesIO()
            plt.figure(num).savefig(buf, format="png", dpi=110, bbox_inches="tight")
            images.append(base64.b64encode(buf.getvalue()).decode("ascii"))
    finally:
        plt.close("all")
    return images

def __ga_no_input(*_args, **_kwargs):
    raise RuntimeError("input() isn't available here. Use a variable instead.")

def __ga_err(e):
    line = None
    tb = e.__traceback__
    while tb is not None:
        if tb.tb_frame.f_code.co_filename == "main.py":
            line = tb.tb_lineno
        tb = tb.tb_next
    if isinstance(e, SyntaxError) and e.filename == "main.py":
        line = e.lineno
    msg = str(e) if not isinstance(e, SyntaxError) else (e.msg or str(e))
    return {"type": type(e).__name__, "message": msg, "line": line}

def __ga_trace(e, code):
    lines = code.splitlines()
    rows = []
    tb = e.__traceback__
    while tb is not None:
        f = tb.tb_frame.f_code
        if f.co_filename == "main.py":
            n = tb.tb_lineno
            text = lines[n - 1].strip() if 0 < n <= len(lines) else ""
            rows.append({"line": n, "where": f.co_name, "code": text})
        tb = tb.tb_next
    return rows

def __ga_same(a, b):
    if hasattr(a, "tolist"):
        a = a.tolist()
    if isinstance(a, (list, tuple)) and isinstance(b, (list, tuple)):
        return type(a) is type(b) and len(a) == len(b) and all(__ga_same(x, y) for x, y in zip(a, b))
    if isinstance(a, bool) or isinstance(b, bool):
        return type(a) is type(b) and a == b
    if isinstance(a, float) or isinstance(b, float):
        try:
            return math.isclose(a, b, rel_tol=1e-9, abs_tol=1e-9)
        except TypeError:
            return False
    return a == b

_GA_KEYWORDS = {"if", "elif", "else", "for", "while", "def", "return", "class", "lambda", "try", "except",
    "break", "continue", "and", "or", "not", "in", "is", "import", "with", "global", "nonlocal", "yield", "raise", "assert"}
_GA_OPS = {ast.Add: "+", ast.Sub: "-", ast.Mult: "*", ast.Div: "/", ast.FloorDiv: "//", ast.Mod: "%",
    ast.Pow: "**", ast.MatMult: "@"}

def __ga_features(code):
    """Everything a requires/forbids rule can name, found in the code's tokens and syntax tree."""
    found = set()
    for tok in tokenize.generate_tokens(io.StringIO(code).readline):
        if tok.type == tokenize.NAME and tok.string in _GA_KEYWORDS:
            found.add(tok.string)
    if "for" in found or "while" in found:
        found.add("loop")
    for node in ast.walk(ast.parse(code)):
        if isinstance(node, (ast.ListComp, ast.SetComp, ast.DictComp, ast.GeneratorExp)):
            found.add("comprehension")
        elif isinstance(node, ast.JoinedStr):
            found.add("fstring")
        elif isinstance(node, ast.AugAssign):
            found.add("augassign")
            found.add("op:" + _GA_OPS.get(type(node.op), "?"))
        elif isinstance(node, ast.BinOp):
            found.add("op:" + _GA_OPS.get(type(node.op), "?"))
        elif isinstance(node, ast.Name):
            found.add("name:" + node.id)
        elif isinstance(node, ast.Attribute):
            found.add("name:" + node.attr)
    return found

def __ga_with(code, values):
    """The code with the first top-level "name = ..." of each name given a new value. None if one is missing."""
    tree = ast.parse(code)
    raw = code.encode("utf-8")
    starts = [0]
    for line in raw.splitlines(keepends=True):
        starts.append(starts[-1] + len(line))
    spans = []
    for name, expr in values.items():
        node = next((n for n in tree.body if isinstance(n, ast.Assign) and len(n.targets) == 1
                     and isinstance(n.targets[0], ast.Name) and n.targets[0].id == name), None)
        if node is None:
            return None
        v = node.value
        spans.append((starts[v.lineno - 1] + v.col_offset, starts[v.end_lineno - 1] + v.end_col_offset, expr))
    for a, b, expr in sorted(spans, reverse=True):
        raw = raw[:a] + expr.encode("utf-8") + raw[b:]
    return raw.decode("utf-8")

def __ga_exec(code, calls):
    """Runs code in a fresh namespace, then evaluates each test call. Returns (stdout, error, values)."""
    ns = {"__name__": "__main__", "input": __ga_no_input}
    out = io.StringIO()
    err = None
    values = []
    with contextlib.redirect_stdout(out):
        try:
            exec(compile(code, "main.py", "exec"), ns)
            for call in calls:
                try:
                    values.append(("ok", eval(compile(call, "main.py", "eval"), ns)))
                except BaseException as e:
                    values.append(("error", type(e).__name__))
        except BaseException as e:
            err = __ga_err(e)
    __ga_figures()
    return out.getvalue(), err, values

def __ga_norm(s):
    return "\n".join(line.rstrip() for line in s.replace("\r\n", "\n").split("\n")).strip()

def __ga_cases(code, solution, vary, calls, output=True):
    rows = []
    for values in vary:
        label = ", ".join(f"{k} = {v}" for k, v in values.items())
        row = {"set": label, "passed": False, "got": None, "expected": None}
        mine = __ga_with(code, values)
        ref = __ga_with(solution, values)
        if ref is None:
            row["error"] = {"type": "ContentError", "message": "the solution doesn't set " + label, "line": None}
        elif mine is None:
            row["missing"] = True
        else:
            expected, ref_err, ref_values = __ga_exec(ref, calls)
            got, err, values = __ga_exec(mine, calls)
            row["expected"] = expected
            row["got"] = got
            if ref_err:
                row["error"] = {"type": "ContentError", "message": "the solution crashes with " + label, "line": None}
            elif err:
                row["error"] = err
            else:
                row["passed"] = not output or __ga_norm(got) == __ga_norm(expected)
                for call, (kind, mine_v), (ref_kind, ref_v) in zip(calls, values, ref_values):
                    if kind != ref_kind or (kind == "ok" and not __ga_same(mine_v, ref_v)) or (kind == "error" and mine_v != ref_v):
                        row["passed"] = False
                        row["call"] = call
                        row["got"] = repr(mine_v) if kind == "ok" else mine_v
                        row["expected"] = repr(ref_v) if ref_kind == "ok" else ref_v
                        break
        rows.append(row)
    return rows

def __ga_run(code, tests_json, opts_json="{}"):
    tests = json.loads(tests_json)
    opts = json.loads(opts_json)
    ns = {"__name__": "__main__", "input": __ga_no_input}
    out = io.StringIO()
    result = {"ok": True, "stdout": "", "error": None, "tests": [], "figures": [], "cases": [], "rules": []}
    with contextlib.redirect_stdout(out):
        try:
            exec(compile(code, "main.py", "exec"), ns)
        except BaseException as e:
            result["ok"] = False
            result["error"] = __ga_err(e)
            result["error"]["trace"] = __ga_trace(e, code)
        if result["ok"]:
            for t in tests:
                row = {"call": t["call"], "expect": t["expect"], "hidden": t.get("hidden", False)}
                try:
                    expected = eval(t["expect"], {})
                    got = eval(compile(t["call"], "main.py", "eval"), ns)
                    row["got"] = repr(got)
                    row["passed"] = bool(__ga_same(got, expected))
                except BaseException as e:
                    row["got"] = None
                    row["passed"] = False
                    row["error"] = __ga_err(e)
                result["tests"].append(row)
    result["figures"] = __ga_figures()
    result["stdout"] = out.getvalue()
    if result["ok"]:
        if opts.get("requires") or opts.get("forbids"):
            found = __ga_features(__ga_scope(code, opts.get("scope")))
            for rule in opts.get("requires", []):
                result["rules"].append({"rule": rule, "kind": "requires", "passed": rule in found})
            for rule in opts.get("forbids", []):
                result["rules"].append({"rule": rule, "kind": "forbids", "passed": rule not in found})
        if opts.get("vary") and opts.get("solution"):
            result["cases"] = __ga_cases(code, opts["solution"], opts["vary"], [t["call"] for t in tests], opts.get("output", True))
    return json.dumps(result)

def __ga_scope(code, name):
    """The source of the top-level function or class called name (empty if it's missing), or all the code."""
    if not name:
        return code
    for node in ast.parse(code).body:
        if isinstance(node, (ast.FunctionDef, ast.ClassDef)) and node.name == name:
            return ast.get_source_segment(code, node) or ""
    return ""

__ga_play_ns = None

def __ga_json(value):
    def plain(o):
        if hasattr(o, "tolist"):
            return o.tolist()
        if isinstance(o, (set, frozenset)):
            return sorted(o, key=repr)
        return repr(o)
    return json.dumps(value, default=plain)

def __ga_play_reply(ok, out, err, value=None):
    return json.dumps({"ok": ok, "stdout": out, "error": err, "value": json.loads(__ga_json(value)) if ok else None})

def __ga_play_load(code, values_json="{}"):
    """Runs the learner's program into a namespace that stays alive, so the Play panel can call into it."""
    global __ga_play_ns
    __ga_play_ns = None
    values = json.loads(values_json)
    src = code
    if values:
        try:
            src = __ga_with(code, values)
        except SyntaxError as e:
            return __ga_play_reply(False, "", __ga_err(e))
        if src is None:
            names = " and ".join(f"{k} = ..." for k in values)
            return __ga_play_reply(False, "", {"type": "Missing", "message": f"Keep {names} at the top of your code.", "line": None})
    ns = {"__name__": "__main__", "input": __ga_no_input}
    ns["__ga_has"] = lambda *names: [n for n in names if callable(ns.get(n))]
    out = io.StringIO()
    err = None
    with contextlib.redirect_stdout(out):
        try:
            exec(compile(src, "main.py", "exec"), ns)
        except BaseException as e:
            err = __ga_err(e)
    __ga_figures()
    if err is None:
        __ga_play_ns = ns
    return __ga_play_reply(err is None, out.getvalue(), err)

def __ga_play_call(src):
    """Runs a few statements in the Play namespace and gives back the last expression's value as JSON."""
    ns = __ga_play_ns
    if ns is None:
        return __ga_play_reply(False, "", {"type": "NotLoaded", "message": "The program isn't loaded.", "line": None})
    out = io.StringIO()
    with contextlib.redirect_stdout(out):
        try:
            tree = ast.parse(src)
            last = tree.body.pop() if tree.body and isinstance(tree.body[-1], ast.Expr) else None
            exec(compile(tree, "<play>", "exec"), ns)
            value = eval(compile(ast.Expression(last.value), "<play>", "eval"), ns) if last else None
            text = __ga_json(value)
        except BaseException as e:
            return __ga_play_reply(False, out.getvalue(), __ga_err(e))
    return json.dumps({"ok": True, "stdout": out.getvalue(), "error": None, "value": json.loads(text)})

def __ga_vocab(codes_json):
    """For each piece of code, the Python it uses: node types, built-ins called, methods called and imports.
    None for code that doesn't parse. Used to keep AI-written tasks to what the learner has been taught."""
    out = []
    for code in json.loads(codes_json):
        try:
            tree = ast.parse(code)
        except SyntaxError:
            out.append(None)
            continue
        found = set()
        for node in ast.walk(tree):
            if isinstance(node, (ast.expr_context, ast.Module, ast.Expression)):
                continue
            found.add("node:" + type(node).__name__)
            if isinstance(node, ast.Call):
                f = node.func
                if isinstance(f, ast.Name) and hasattr(builtins, f.id):
                    found.add("call:" + f.id)
                elif isinstance(f, ast.Attribute):
                    found.add("method:" + f.attr)
            elif isinstance(node, ast.Import):
                for a in node.names:
                    found.add("import:" + a.name.split(".")[0])
            elif isinstance(node, ast.ImportFrom) and node.module:
                found.add("import:" + node.module.split(".")[0])
        out.append(sorted(found))
    return json.dumps(out)

def __ga_trivial(code):
    """True when code only prints fixed values, so printing the answer IS the task."""
    def fixed(n):
        return isinstance(n, ast.Constant)
    for node in ast.parse(code).body:
        if isinstance(node, (ast.Import, ast.ImportFrom)):
            continue
        if not (isinstance(node, ast.Expr) and isinstance(node.value, ast.Call)
                and isinstance(node.value.func, ast.Name) and node.value.func.id == "print"
                and all(fixed(a) for a in node.value.args) and all(fixed(k.value) for k in node.value.keywords)):
            return False
    return True
`

/** One step of the call chain when a run crashed, outermost first. */
export type TraceFrame = { line: number; where: string; code: string }

export type RunError = { type: string; message: string; line: number | null; trace?: TraceFrame[] }

export type TestCase = { call: string; expect: string; hidden?: boolean }

/** What a requires/forbids rule can name. `name:x` is any use of the name or attribute `x`. */
export const RULE_LABELS: Record<string, string> = {
  if: 'an `if`',
  elif: 'an `elif`',
  else: 'an `else`',
  for: 'a `for` loop',
  while: 'a `while` loop',
  loop: 'a loop',
  def: 'a function (`def`)',
  return: '`return`',
  class: 'a class',
  lambda: 'a `lambda`',
  try: '`try`',
  except: '`except`',
  break: '`break`',
  continue: '`continue`',
  and: '`and`',
  or: '`or`',
  not: '`not`',
  in: '`in`',
  is: '`is`',
  import: 'an `import`',
  with: '`with`',
  global: '`global`',
  nonlocal: '`nonlocal`',
  yield: '`yield`',
  raise: '`raise`',
  assert: '`assert`',
  comprehension: 'a comprehension',
  fstring: 'an f-string',
  augassign: 'an update like `+=`',
}

export function ruleLabel(rule: string): string {
  if (rule.startsWith('op:')) return `the \`${rule.slice(3)}\` operator`
  if (rule.startsWith('name:')) return `\`${rule.slice(5)}\``
  return RULE_LABELS[rule] ?? rule
}

export const isRule = (rule: string) =>
  rule in RULE_LABELS || /^op:(\+|-|\*|\/|\/\/|%|\*\*|@)$/.test(rule) || /^name:\w+$/.test(rule)

/** Extra checks on a run. See the harness notes above. */
export type RunOptions = {
  solution?: string
  vary?: Record<string, string>[]
  requires?: string[]
  forbids?: string[]
  /** Compare printed output on the reruns too (default). Project milestones that aren't about printing turn it off. */
  output?: boolean
  /** Check requires/forbids only inside this top-level function or class. */
  scope?: string
}

/** One rerun with other values: what the code printed, and what the solution printed. */
export type CaseResult = {
  set: string
  passed: boolean
  got: string | null
  expected: string | null
  /** The code no longer sets one of these names at the top. */
  missing?: boolean
  /** Set when a checked value differed, rather than the printed output. */
  call?: string
  error?: RunError
}

export type RuleResult = { rule: string; kind: 'requires' | 'forbids'; passed: boolean }

export type TestResult = {
  call: string
  expect: string
  hidden: boolean
  got: string | null
  passed: boolean
  error?: RunError
}

export type RunResult = {
  ok: boolean
  stdout: string
  error: RunError | null
  tests: TestResult[]
  /** PNGs of any plots the code drew, base64 encoded. */
  figures?: string[]
  cases?: CaseResult[]
  rules?: RuleResult[]
  /** Set by the client when the run was stopped (infinite loop, too slow). */
  timedOut?: boolean
}

/** What a Play panel call gives back: the value of its last expression, as JSON, and anything printed. */
export type PlayReply<T = unknown> = { ok: boolean; stdout: string; error: RunError | null; value: T | null }

/** Normalizes printed output for comparison: trims trailing spaces on each line and trailing blank lines. */
export function normalizeOutput(s: string): string {
  return s
    .replace(/\r\n/g, '\n')
    .split('\n')
    .map((l) => l.trimEnd())
    .join('\n')
    .trim()
}

/** Did a run satisfy the exercise? Checks for errors, every test, the printed output, other values and rules. */
export function runPassed(r: RunResult, expectOutput?: string): boolean {
  if (!r.ok || r.timedOut) return false
  if (r.tests.some((t) => !t.passed)) return false
  if (expectOutput !== undefined && normalizeOutput(r.stdout) !== normalizeOutput(expectOutput)) return false
  if (r.cases?.some((c) => !c.passed)) return false
  if (r.rules?.some((c) => !c.passed)) return false
  return true
}
