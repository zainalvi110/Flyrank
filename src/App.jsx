import { useState } from 'react'
import { heuristicExtract, toMarkdown } from './lib/extract.js'

const SAMPLE = `Standup 12 May
Priya will send the revised pricing deck to the client by Friday.
We talked about the onboarding drop-off for a while.
Sam should fix the failing signup test before the release.
Someone needs to email legal about the contract.`

export default function App() {
  const [notes, setNotes] = useState('')
  const [items, setItems] = useState([])
  const [status, setStatus] = useState('idle') // idle | loading | done | error
  const [error, setError] = useState('')
  const [degraded, setDegraded] = useState(false)
  const [copied, setCopied] = useState(false)

  async function onSubmit(e) {
    e.preventDefault()
    setStatus('loading'); setError(''); setDegraded(false); setCopied(false)
    try {
      const res = await fetch('/api/extract', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ notes })
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Something went wrong.')
      setItems(data.items)
      setDegraded(data.source === 'fallback')
      setStatus('done')
    } catch (err) {
      // Last resort: the network itself failed, so extract in the browser.
      const local = heuristicExtract(notes)
      if (local.length) {
        setItems(local); setDegraded(true); setStatus('done')
      } else {
        setItems([]); setError(err.message || 'Could not reach the server.'); setStatus('error')
      }
    }
  }

  async function copyList() {
    await navigator.clipboard.writeText(toMarkdown(items))
    setCopied(true)
  }

  const busy = status === 'loading'

  return (
    <main className="wrap">
      <h1>Action Items</h1>
      <p className="lede">
        Paste raw meeting notes. Get back only the things someone actually committed to,
        with the owner and date as written in your notes.
      </p>

      <form onSubmit={onSubmit}>
        <label htmlFor="notes">Meeting notes</label>
        <p id="notes-help" className="help">Plain text. Nothing is stored — notes are sent once and discarded.</p>
        <textarea
          id="notes"
          aria-describedby="notes-help"
          rows={10}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Paste your notes here…"
        />
        <div className="row">
          <button type="submit" disabled={busy || notes.trim().length < 10} aria-busy={busy}>
            {busy ? 'Extracting…' : 'Extract action items'}
          </button>
          <button type="button" className="ghost" onClick={() => setNotes(SAMPLE)}>
            Use sample notes
          </button>
        </div>
      </form>

      <p role="status" aria-live="polite" className="sr-status">
        {busy ? 'Extracting action items, please wait.' : status === 'done' ? `${items.length} action items found.` : ''}
      </p>

      {status === 'error' && (
        <p role="alert" className="error">{error} Please try again in a moment.</p>
      )}

      {degraded && status === 'done' && (
        <p role="alert" className="warn">
          The AI service was unavailable, so this list was built with simple keyword matching. It may be less accurate.
        </p>
      )}

      {status === 'done' && items.length === 0 && (
        <p className="empty">No clear action items in those notes. Try notes that name who is doing what.</p>
      )}

      {items.length > 0 && (
        <section aria-labelledby="results-heading">
          <h2 id="results-heading">Action items</h2>
          <ul className="items">
            {items.map((i) => (
              <li key={i.id}>
                <span className={`pill p-${i.priority}`}>{i.priority} priority</span>
                <p className="task">{i.task}</p>
                <p className="meta">{i.owner} · {i.due}</p>
              </li>
            ))}
          </ul>
          <button type="button" className="ghost" onClick={copyList}>
            {copied ? 'Copied to clipboard' : 'Copy as markdown checklist'}
          </button>
        </section>
      )}
    </main>
  )
}
