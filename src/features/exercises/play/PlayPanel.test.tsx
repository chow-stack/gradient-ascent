import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { PlayReply } from '../../runner/harness'
import { PlayPanel } from './PlayPanel'

const playLoad = vi.fn<(code: string, values?: Record<string, string>) => Promise<PlayReply>>()
const playCall = vi.fn<(src: string) => Promise<PlayReply>>()
vi.mock('../../runner/python', () => ({
  playLoad: (code: string, values?: Record<string, string>) => playLoad(code, values),
  playCall: (src: string) => playCall(src),
}))

const ok = (value: unknown = null, stdout = ''): PlayReply => ({ ok: true, stdout, error: null, value })
const crash = (type: string, message: string, line: number | null): PlayReply => ({
  ok: false,
  stdout: '',
  error: { type, message, line },
  value: null,
})

afterEach(cleanup)

beforeEach(() => {
  playLoad.mockReset()
  playCall.mockReset()
})

describe('PlayPanel', () => {
  it('asks for the first function the game needs', async () => {
    playLoad.mockResolvedValue(ok())
    playCall.mockResolvedValue(ok([]))
    render(<PlayPanel kind="hangman" code="lives = 6" />)
    expect(await screen.findByText(/to see the word/)).toHaveTextContent('Write masked() to see the word.')
    expect(playCall).toHaveBeenCalledWith('__ga_has("masked", "misses", "status", "next_guess")')
  })

  it('asks for predict() before drawing the line fit', async () => {
    playLoad.mockResolvedValue(ok())
    playCall.mockResolvedValue(ok([]))
    render(<PlayPanel kind="fit" code="import numpy as np" />)
    expect(await screen.findByText(/to draw your line/)).toHaveTextContent('Write predict() to draw your line.')
    expect(playCall).toHaveBeenCalledWith('__ga_has("predict", "loss", "gradients", "step", "check")')
  })

  it('asks for sigmoid() and predict() before scoring messages', async () => {
    playLoad.mockResolvedValue(ok())
    playCall.mockResolvedValue(ok(['sigmoid']))
    render(<PlayPanel kind="spam" code="import numpy as np" />)
    expect(await screen.findByText(/to score messages/)).toHaveTextContent(
      'Write sigmoid() and predict() to score messages.',
    )
  })

  it("shows the program's crash with its line, instead of the game", async () => {
    playLoad.mockResolvedValue(crash('NameError', "name 'x' is not defined", 3))
    render(<PlayPanel kind="wordle" code="print(x)" />)
    expect(await screen.findByRole('alert')).toHaveTextContent(
      "Your program crashed with NameError: name 'x' is not defined (line 3)",
    )
  })

  it('shows what the program printed while loading', async () => {
    playLoad.mockResolvedValue(ok(null, 'hello from main\n'))
    playCall.mockResolvedValue(ok([]))
    render(<PlayPanel kind="life" code='print("hello from main")' />)
    expect(await screen.findByText('hello from main')).toBeInTheDocument()
  })

  it('flags changed code and loads the new version on Restart', async () => {
    playLoad.mockResolvedValue(ok())
    playCall.mockResolvedValue(ok([]))
    const { rerender } = render(<PlayPanel kind="blackjack" code="v = 1" />)
    await screen.findByText('Running your code.')
    rerender(<PlayPanel kind="blackjack" code="v = 2" />)
    expect(screen.getByText('Your code changed since this loaded.')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Restart' }))
    await waitFor(() => expect(playLoad).toHaveBeenLastCalledWith('v = 2', undefined))
    expect(await screen.findByText('Running your code.')).toBeInTheDocument()
  })

  it('reruns the whole program each round for rock, paper, scissors, carrying the score', async () => {
    playLoad.mockResolvedValue(ok(null, 'You win\n'))
    playCall.mockResolvedValue(
      ok({ result: 'win', reason: 'rock crushes scissors', wins: 1, losses: 0, winner: 'nobody' }),
    )
    render(<PlayPanel kind="rps" code="player = 'rock'" />)
    expect(playLoad).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: /Rock/ }))
    expect(await screen.findByText('You win', { selector: 'p' })).toBeInTheDocument()
    expect(playLoad.mock.calls[0][1]).toMatchObject({ player: '"rock"' })
    expect(playLoad.mock.calls[0][1]).not.toHaveProperty('wins')

    fireEvent.click(screen.getByRole('button', { name: /Paper/ }))
    await waitFor(() => expect(playLoad).toHaveBeenCalledTimes(2))
    expect(playLoad.mock.calls[1][1]).toMatchObject({ player: '"paper"', wins: '1', losses: '0' })
  })
})
