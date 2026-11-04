import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { describe, expect, it } from 'vitest'
import { App } from './App'

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <App />
    </MemoryRouter>,
  )
}

describe('App', () => {
  it('shows the first session on a fresh start', async () => {
    renderAt('/')
    expect(await screen.findByRole('heading', { level: 1, name: 'Your first climb' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Start today’s session/ })).toHaveAttribute('href', '/session?kind=core')
  })

  it('lists the path with the first lesson up next', async () => {
    renderAt('/path')
    expect(await screen.findByRole('heading', { level: 2, name: /Unit 1/ })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Start' })).toBeInTheDocument()
    expect(screen.getAllByRole('listitem').filter((li) => li.dataset.status === 'locked')).toHaveLength(9)
  })

  it('renders the style guide', () => {
    renderAt('/styleguide')
    expect(screen.getByRole('heading', { level: 1, name: 'Style guide' })).toBeInTheDocument()
  })
})
