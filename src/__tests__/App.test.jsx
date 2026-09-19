import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import App from '../App.jsx'

const NOTES = 'Priya will send the pricing deck by Friday.'

beforeEach(() => { vi.restoreAllMocks() })

describe('App', () => {
  it('disables submit until there is enough text', async () => {
    render(<App />)
    const button = screen.getByRole('button', { name: /extract action items/i })
    expect(button).toBeDisabled()
    await userEvent.type(screen.getByLabelText(/meeting notes/i), NOTES)
    expect(button).toBeEnabled()
  })

  it('renders the items returned by the API (happy path)', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ source: 'ai', items: [{ id: 'item-0', task: 'Send pricing deck', owner: 'Priya', due: 'Friday', priority: 'high' }] })
    }))
    render(<App />)
    await userEvent.type(screen.getByLabelText(/meeting notes/i), NOTES)
    await userEvent.click(screen.getByRole('button', { name: /extract action items/i }))
    expect(await screen.findByText('Send pricing deck')).toBeInTheDocument()
    expect(screen.getByText(/Priya · Friday/)).toBeInTheDocument()
  })

  it('warns the user when the result came from the fallback', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ source: 'fallback', items: [{ id: 'item-0', task: 'Send deck', owner: 'Priya', due: 'Friday', priority: 'medium' }] })
    }))
    render(<App />)
    await userEvent.type(screen.getByLabelText(/meeting notes/i), NOTES)
    await userEvent.click(screen.getByRole('button', { name: /extract action items/i }))
    expect(await screen.findByRole('alert')).toHaveTextContent(/less accurate/i)
  })

  it('falls back locally when the network fails entirely', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')))
    render(<App />)
    await userEvent.type(screen.getByLabelText(/meeting notes/i), NOTES)
    await userEvent.click(screen.getByRole('button', { name: /extract action items/i }))
    await waitFor(() => expect(screen.getByRole('alert')).toBeInTheDocument())
    expect(screen.getByText('Priya will send the pricing deck by Friday.', { selector: '.task' })).toBeInTheDocument()
  })
})
