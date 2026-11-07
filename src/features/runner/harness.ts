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
 */
export const HARNESS_PY = String.raw`
import base64, io, json, math, os, sys, traceback, contextlib, builtins, warnings

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

def __ga_run(code, tests_json):
    tests = json.loads(tests_json)
    ns = {"__name__": "__main__", "input": __ga_no_input}
    out = io.StringIO()
    result = {"ok": True, "stdout": "", "error": None, "tests": [], "figures": []}
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
    return json.dumps(result)
`

/** One step of the call chain when a run crashed, outermost first. */
export type TraceFrame = { line: number; where: string; code: string }

export type RunError = { type: string; message: string; line: number | null; trace?: TraceFrame[] }

export type TestCase = { call: string; expect: string; hidden?: boolean }

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
  /** Set by the client when the run was stopped (infinite loop, too slow). */
  timedOut?: boolean
}

/** Normalizes printed output for comparison: trims trailing spaces on each line and trailing blank lines. */
export function normalizeOutput(s: string): string {
  return s
    .replace(/\r\n/g, '\n')
    .split('\n')
    .map((l) => l.trimEnd())
    .join('\n')
    .trim()
}

/** Did a run satisfy the exercise? Checks for errors, every test, and the expected printed output if given. */
export function runPassed(r: RunResult, expectOutput?: string): boolean {
  if (!r.ok || r.timedOut) return false
  if (r.tests.some((t) => !t.passed)) return false
  if (expectOutput !== undefined && normalizeOutput(r.stdout) !== normalizeOutput(expectOutput)) return false
  return true
}
