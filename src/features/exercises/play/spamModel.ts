import { MESSAGES } from './spamData.ts'

/** Share of the messages the learner's split() puts in training. */
export const SPAM_TRAIN_FRAC = 0.75

/**
 * The spam filter's side of the Play panel, in Python. It runs beside the learner's program and calls its functions:
 * the app picks the vocabulary (from the training part only) and turns messages into features with the program's
 * own given words() and features(), and the learner's code does the rest.
 * Every reply is plain JSON. Kept apart from the component so content:check can run it against each solution.
 */
export const SPAM_PY = String.raw`import re as _re
import numpy as _np

_sp_raw = ${JSON.stringify(MESSAGES)}

# The program's own words() and features() (given in the starter, so the learner can read them) when it has
# them, and the same code here when it doesn't.
def _sp_words(text):
    f = globals().get("words")
    if callable(f):
        return [str(w) for w in f(text)]
    return _re.findall(r"[a-z0-9']+", text.lower())

def _sp_features(texts, vocab):
    f = globals().get("features")
    if callable(f):
        return _np.asarray(f(texts, vocab), dtype=float).reshape(len(texts), len(vocab))
    X = _np.zeros((len(texts), len(vocab)))
    column = {w: j for j, w in enumerate(vocab)}
    for i, t in enumerate(texts):
        for w in _sp_words(t):
            if w in column:
                X[i, column[w]] = 1.0
    return X

def _sp_f(v):
    try:
        v = float(v)
    except (TypeError, ValueError):
        return None
    return v if v == v and abs(v) < 1e9 else None

def _sp_prepare(seed, use_split, use_dedupe, use_baseline):
    global _sp_T, _sp_y, _sp_tr, _sp_va, _sp_pos, _sp_X, _sp_w, _sp_b
    T = [t for t, _ in _sp_raw]
    L = [l for _, l in _sp_raw]
    if use_dedupe:
        T, L = dedupe(T, L)
        T, L = list(T), [int(l) for l in L]
    n = len(T)
    if use_split:
        tr, va = split(n, ${SPAM_TRAIN_FRAC}, seed)
        tr, va = [int(i) for i in tr], [int(i) for i in va]
    else:
        tr, va = list(range(n)), []
    vocab = sorted({w for i in tr for w in _sp_words(T[i])})
    _sp_pos = {w: j for j, w in enumerate(vocab)}
    _sp_X = _sp_features(T, vocab)
    _sp_T, _sp_y, _sp_tr, _sp_va = T, _np.array(L, dtype=float), tr, va
    _sp_w, _sp_b = _np.zeros(len(vocab)), 0.0
    seen = {T[i] for i in tr}
    base = _sp_f(baseline(_sp_y[tr], _sp_y[va])) if use_baseline and va else None
    return {
        "n": n,
        "spam": int(sum(L)),
        "train": len(tr),
        "val": len(va),
        "words": len(vocab),
        "leaked": sum(T[i] in seen for i in va),
        "baseline": base,
    }

def _sp_probs(idx):
    return _np.asarray(predict(_sp_X[idx], _sp_w, _sp_b), dtype=float)

def _sp_report(use_loss, use_acc):
    out = []
    for idx in (_sp_tr, _sp_va):
        if not idx:
            out += [None, None]
            continue
        p = _sp_probs(idx)
        out.append(_sp_f(loss(p, _sp_y[idx])) if use_loss else None)
        out.append(_sp_f(accuracy(p, _sp_y[idx])) if use_acc else None)
    return out

def _sp_train(steps, lr, use_loss, use_acc):
    global _sp_w, _sp_b
    X, y = _sp_X[_sp_tr], _sp_y[_sp_tr]
    for _ in range(steps):
        _sp_w, _sp_b = step(X, y, _sp_w, _sp_b, lr)
    _sp_w = _np.asarray(_sp_w, dtype=float)
    if not _np.all(_np.isfinite(_sp_w)) or _sp_f(_sp_b) is None:
        return None
    return _sp_report(use_loss, use_acc)

def _sp_score(text):
    x = _sp_features([text], sorted(_sp_pos, key=_sp_pos.get))
    pieces = []
    for piece in text.split():
        known = [_sp_pos[w] for w in _sp_words(piece) if w in _sp_pos]
        pieces.append([piece, _sp_f(sum(_sp_w[j] for j in known)) if known else None])
    return {"p": _sp_f(predict(x, _sp_w, _sp_b)[0]), "pieces": pieces}

def _sp_metrics(threshold, use_pr):
    idx = _sp_va or _sp_tr
    p = _sp_probs(idx)
    y = _sp_y[idx].astype(int)
    pred = (p >= threshold).astype(int)
    counts = [int(((pred == a) & (y == b)).sum()) for a, b in ((1, 1), (1, 0), (0, 1), (0, 0))]
    wrong = [i for i in _np.argsort(-_np.abs(p - 0.5)) if pred[i] != y[i]]
    fooled = [[_sp_T[idx[i]], _sp_f(p[i]), int(y[i])] for i in wrong[:3]]
    pr = [_sp_f(v) for v in precision_recall(pred, y)] if use_pr else None
    return {"counts": counts, "pr": pr, "fooled": fooled, "on": "validation" if _sp_va else "training"}

True`
