import type { PlayKind } from '../../content/schema'
import { SPAM_PY } from './spamModel.ts'

/** The functions and classes each game calls. It plays with whichever of them the program defines so far. */
export const PLAY_NEEDS: Record<PlayKind, string[]> = {
  rps: [],
  hangman: ['masked', 'misses', 'status', 'next_guess'],
  wordle: ['score', 'remaining', 'pick'],
  blackjack: ['Card', 'Deck', 'Hand', 'dealer_turn', 'outcome'],
  life: ['neighbours', 'step', 'random_world', 'stamp'],
  doodle: ['flatten', 'distances', 'predict'],
  fit: ['predict', 'loss', 'gradients', 'step', 'check'],
  spam: ['sigmoid', 'predict', 'loss', 'step', 'split', 'dedupe', 'accuracy', 'baseline', 'precision_recall'],
}

/** What a game gets: the learner's program, loaded and callable. */
export type PlayApi = {
  has: (name: string) => boolean
  /** Runs Python in the loaded program. Null when it crashed; the panel shows the error, labelled `what`. */
  call: <T>(src: string, what: string) => Promise<T | null>
  /** Loads the program again with new values for variables at its top (games that rerun the whole program). */
  load: (values: Record<string, string>) => Promise<{ ok: boolean; stdout: string }>
  /** The program as it is in the editor now. */
  code: string
}

/** A Python literal for a string, number or list of them. JSON's syntax is valid Python for these. */
export const py = (v: string | number | (string | number)[] | (string | number)[][]) => JSON.stringify(v)

/** The letters on the on-screen keyboards. */
export const KEY_ROWS = ['qwertyuiop', 'asdfghjkl', 'zxcvbnm']

/**
 * How content:check proves a project's solution can drive its game: load the solution (with these values at its
 * top, for games that rerun it), then run this Python. Its last line must be True.
 */
export const PLAY_SMOKE: Record<PlayKind, { values?: Record<string, string>; check: string }> = {
  rps: {
    values: { player: '"paper"', computer: '"rock"', wins: '2', losses: '0' },
    check: 'result == "win" and wins == 3 and winner == "you" and isinstance(reason, str)',
  },
  hangman: {
    check:
      'masked("goat", "ta") == "__at" and misses("goat", "x") == 1 and status("goat", "goat") == "won" and len(next_guess("")) == 1',
  },
  wordle: {
    check:
      'score("crane", "cider") == "GY--Y" and remaining(["cider", "crane"], "crane", "GY--Y") == ["cider"] and pick(["crane", "cider"]) in ["crane", "cider"]',
  },
  blackjack: {
    check: `_d = Deck()
_d.shuffle()
_h = Hand([])
_h.add(_d.deal())
_h.add(_d.deal())
_p = Hand([_d.deal(), _d.deal()])
dealer_turn(_h, _d)
all(isinstance(repr(c), str) for c in _h.cards) and _h.total() >= 17 and outcome(_p, _h) in ["win", "lose", "push"] and len(_d) < 52`,
  },
  life: {
    check: `_np = __import__("numpy")
_g = random_world(26, 40, 0.3, 1)
_g.shape == (26, 40) and step(_g).shape == (26, 40) and neighbours(_g).shape == (26, 40) and stamp(_g, _np.ones((3, 3), int), 1, 1).shape == (26, 40)`,
  },
  doodle: {
    check: `_x = train[0].reshape(-1)
str(predict(flatten(train), labels, _x)) == str(labels[0]) and len(distances(flatten(train), _x)) == len(train)`,
  },
  fit: {
    check: `_np = __import__("numpy")
_x = _np.array([-1.0, 0.0, 1.0])
_y = _np.array([-1.0, 1.0, 3.0])
_s = step(0.0, 0.0, _x, _y, 0.1)
len(predict(1.0, 0.0, _x)) == 3 and float(loss(2.0, 1.0, _x, _y)) == 0.0 and len(gradients(0.0, 0.0, _x, _y)) == 2 and len(_s) == 2 and max(check(0.5, 0.5, _x, _y)) < 1e-5`,
  },
  // Plays a whole game the way the panel does: prepare, train, score a message, measure.
  spam: {
    check: `${SPAM_PY}
_d = _sp_prepare(0, True, True, True)
_r0 = _sp_report(True, True)
_r = _sp_train(300, 0.5, True, True)
_s = _sp_score("Win a free prize, call now")
_m = _sp_metrics(0.5, True)
(_d["leaked"] == 0 and _d["val"] > 0 and abs(_r0[0] - 0.6931) < 1e-3 and _r is not None and _r[3] > _d["baseline"]
    and _s["p"] > 0.5 and len(_s["pieces"]) == 6 and sum(_m["counts"]) == _d["val"] and len(_m["pr"]) == 2)`,
  },
}

/** Every grid cell on the straight line from a to b, so a fast drag doesn't leave gaps. */
export function cellsBetween(a: { x: number; y: number }, b: { x: number; y: number }) {
  const n = Math.max(Math.abs(b.x - a.x), Math.abs(b.y - a.y))
  const out: { x: number; y: number }[] = []
  for (let i = 0; i <= n; i++) {
    const t = n === 0 ? 0 : i / n
    out.push({ x: Math.round(a.x + (b.x - a.x) * t), y: Math.round(a.y + (b.y - a.y) * t) })
  }
  return out
}
