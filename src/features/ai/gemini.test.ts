import { afterEach, describe, expect, it, vi } from 'vitest'
import { checkExplanation, errorMessage, parseExplainCheck } from './gemini'

const answer = 'It adds one to the count twice and then prints 2'
const reply = (points: object[], misconception = '') =>
  JSON.stringify({ keyPoints: points, misconception, feedback: 'Good.' })
const hit = (number: number, evidence = 'adds one to the count') => ({ number, status: 'hit', evidence })

describe('parseExplainCheck', () => {
  it('calls it nailed only when every point is a real hit and nothing is false', () => {
    const r = parseExplainCheck(reply([hit(1), hit(2, 'prints 2')]), 2, answer)
    expect(r.verdict).toBe('nailed')
    expect(parseExplainCheck(reply([hit(1), hit(2, 'prints 2')], 'False claim.'), 2, answer).verdict).toBe('partly')
  })

  it('downgrades a hit whose quote is not in the answer', () => {
    const r = parseExplainCheck(reply([hit(1, 'increments the counter variable')]), 1, answer)
    expect(r.points[0].status).toBe('unclear')
    expect(r.verdict).toBe('missed')
  })

  it('accepts quotes that differ only in case, spacing or quote marks', () => {
    const r = parseExplainCheck(reply([hit(1, '`ADDS   one` to the "count"')]), 1, answer)
    expect(r.points[0].status).toBe('hit')
  })

  it('scores partial answers as partly', () => {
    const r = parseExplainCheck(reply([hit(1), { number: 2, status: 'missed', evidence: '' }]), 2, answer)
    expect(r.verdict).toBe('partly')
  })

  it('rejects malformed or incomplete replies', () => {
    expect(() => parseExplainCheck('not json', 1, answer)).toThrow(/unreadable/)
    expect(() => parseExplainCheck(reply([hit(1)]), 2, answer)).toThrow(/incomplete/)
  })
})

describe('checkExplanation', () => {
  afterEach(() => vi.unstubAllGlobals())
  const card = {
    type: 'explain' as const,
    id: 'c',
    prompt: 'What does this do?',
    code: 'x = 1',
    model: 'Sets x to 1.',
    keyPoints: ['x becomes 1'],
  }
  const ok = (text: string) => ({
    ok: true,
    status: 200,
    json: async () => ({ candidates: [{ content: { parts: [{ text }] } }] }),
  })

  it('sends the key in a header, never the URL, and caches the same answer', async () => {
    const fetchMock = vi.fn(async () => ok(reply([hit(1, 'x is set')])))
    vi.stubGlobal('fetch', fetchMock)
    const first = await checkExplanation(card, 'x is set to one', 'secret-key')
    await checkExplanation(card, 'x is set to one', 'secret-key')
    expect(first.verdict).toBe('nailed')
    expect(fetchMock).toHaveBeenCalledTimes(1)
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit]
    expect(url).toContain('gemini-3.5-flash-lite:generateContent')
    expect(url).not.toContain('secret-key')
    expect((init.headers as Record<string, string>)['x-goog-api-key']).toBe('secret-key')
  })

  it('allows a retry after a failure', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({ ok: false, status: 503, json: async () => ({}) })
      .mockResolvedValueOnce(ok(reply([hit(1, 'one')])))
    vi.stubGlobal('fetch', fetchMock)
    await expect(checkExplanation(card, 'becomes one', 'k')).rejects.toThrow(/busy/)
    await expect(checkExplanation(card, 'becomes one', 'k')).resolves.toMatchObject({ verdict: 'nailed' })
  })

  it('explains key and quota failures', () => {
    expect(errorMessage(400, 'API key not valid. Please pass a valid API key.')).toMatch(/rejected your key/)
    expect(errorMessage(403, '')).toMatch(/rejected your key/)
    expect(errorMessage(429, '')).toMatch(/limit/)
  })
})
