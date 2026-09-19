import { parseModelJson, validateItems, heuristicExtract } from '../src/lib/extract.js'

export const SYSTEM_PROMPT = `You extract action items from messy meeting notes.
Return ONLY a JSON object, no prose and no markdown fences, in this exact shape:
{"items":[{"task":"...","owner":"...","due":"...","priority":"high|medium|low"}]}
Rules:
- One entry per concrete commitment somebody made. Ignore discussion, opinions and background.
- "owner" is the person named in the notes, or "Unassigned" if nobody is named. Never invent a name.
- "due" is copied from the notes ("next Friday"), or "No date given". Never invent a date.
- priority: high if a deadline or blocker is mentioned, low if it is a nice-to-have, else medium.
- If there are no action items, return {"items":[]}.`

// openrouter/free auto-selects a currently-working free model, so this app
// isn't broken by any single free model being retired or rate-limited.
const MODEL = 'openrouter/free'
const ENDPOINT = 'https://openrouter.ai/api/v1/chat/completions'

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const notes = (req.body?.notes || '').toString()
  if (notes.trim().length < 10) return res.status(400).json({ error: 'Please paste at least a line or two of notes.' })
  if (notes.length > 12000) return res.status(413).json({ error: 'Notes are too long. Try under 12,000 characters.' })

  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 25000)

    const r = await fetch(ENDPOINT, {
      method: 'POST',
      signal: controller.signal,
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`
      },
      body: JSON.stringify({
        model: MODEL,
        temperature: 0.2,
        max_tokens: 1200,
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: notes }
        ]
      })
    })
    clearTimeout(timeout)

    if (!r.ok) throw new Error(`Upstream ${r.status}`) // 429 = free-tier rate limit, handled below
    const data = await r.json()
    const text = data.choices?.[0]?.message?.content || ''
    const items = validateItems(parseModelJson(text))
    return res.status(200).json({ items, source: 'ai' })
  } catch (err) {
    // Degrade, don't die: return the rule-based result and tell the UI it is second-best.
    const items = heuristicExtract(notes)
    return res.status(200).json({ items, source: 'fallback', reason: err.message })
  }
}