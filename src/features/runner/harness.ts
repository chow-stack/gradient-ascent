/**
 * The Python side of the runner. Loaded once into Pyodide (browser worker and the Node content checker),
 * then every run calls `__ga_run(code, tests_json)` and gets a JSON string back.
 *
 * - Each run gets a fresh namespace, so variables never leak between exercises.
 * - stdout is captured; `input()` is disabled (exercises never need it).
 * - Errors report the line in the learner's code (file name "main.py").
 * - Tests are `{call, expect}` pairs of Python expressions, compared with == (floats with isclose).
 */
export const HARNESS_PY = String.raw`
import io, json, math, sys, traceback, contextlib, builtins

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

def __ga_same(a, b):
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
    result = {"ok": True, "stdout": "", "error": None, "tests": []}
    with contextlib.redirect_stdout(out):
        try:
            exec(compile(code, "main.py", "exec"), ns)
        except BaseException as e:
            result["ok"] = False
            result["error"] = __ga_err(e)
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
    result["stdout"] = out.getvalue()
    return json.dumps(result)
`

export type RunError = { type: string; message: string; line: number | null }

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
