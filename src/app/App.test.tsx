import { cleanup, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { afterEach, describe, expect, it } from 'vitest'
import { lessons } from '../features/content/content'
import { App } from './App'

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <App />
    </MemoryRouter>,
  )
}

afterEach(cleanup)

describe('App', () => {
  it('on a fresh start, the first lesson is the way in and the Daily 5 waits', async () => {
    renderAt('/')
    expect(await screen.findByRole('heading', { level: 1, name: 'Daily 5' })).toBeInTheDocument()
    expect(screen.getByText('Starts after your first lesson.')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Start/ })).toHaveAttribute('href', '/session?kind=lesson')
  })

  it('lists the path with the first lesson up next', async () => {
    renderAt('/path')
    expect(await screen.findByRole('heading', { level: 2, name: /Unit 1/ })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Start' })).toBeInTheDocument()
    expect(screen.getAllByRole('listitem').filter((li) => li.dataset.status === 'locked')).toHaveLength(
      lessons.length - 1,
    )
  })

  it('renders the style guide', () => {
    renderAt('/styleguide')
    expect(screen.getByRole('heading', { level: 1, name: 'Style guide' })).toBeInTheDocument()
  })
})
