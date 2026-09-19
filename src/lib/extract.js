// Pure helpers shared by the browser and the serverless function.
// Keeping them pure is what makes the AI layer testable without a network call.

export const PRIORITIES = ['high', 'medium', 'low']

/** Strip markdown fences the model sometimes adds, then parse. Throws on bad JSON. */
export function parseModelJson(text) {
  if (typeof text !== 'string' || !text.trim()) throw new Error('Empty model response')
  const cleaned = text.replace(/```(?:json)?/gi, '').trim()
  const start = cleaned.indexOf('{')
  const end = cleaned.lastIndexOf('}')
  if (start === -1 || end === -1) throw new Error('No JSON object in model response')
  return JSON.parse(cleaned.slice(start, end + 1))
}

/** Coerce anything the model returns into a safe, renderable shape. Never throws. */
export function validateItems(data) {
  const raw = Array.isArray(data) ? data : Array.isArray(data?.items) ? data.items : []
  return raw
    .filter((i) => i && typeof i.task === 'string' && i.task.trim().length > 2)
    .slice(0, 25)
    .map((i, index) => ({
      id: `item-${index}`,
      task: i.task.trim().slice(0, 300),
      owner: typeof i.owner === 'string' && i.owner.trim() ? i.owner.trim().slice(0, 60) : 'Unassigned',
      due: typeof i.due === 'string' && i.due.trim() ? i.due.trim().slice(0, 40) : 'No date given',
      priority: PRIORITIES.includes(String(i.priority).toLowerCase())
        ? String(i.priority).toLowerCase()
        : 'medium'
    }))
}

/** Offline fallback: if the API is down or over quota the app still does something useful. */
export function heuristicExtract(notes = '') {
  const cues = /(will|should|需要|todo|action|follow up|send|write|fix|review|email|schedule|by friday|by monday)/i
  return notes
    .split(/\r?\n/)
    .map((l) => l.replace(/^[-*•\d.\s]+/, '').trim())
    .filter((l) => l.length > 5 && cues.test(l))
    .slice(0, 25)
    .map((task, index) => ({
      id: `item-${index}`,
      task: task.slice(0, 300),
      owner: (task.match(/^([A-Z][a-z]+)\b/) || [])[1] || 'Unassigned',
      due: (task.match(/by\s+[A-Za-z0-9 ]{3,20}/i) || [])[0] || 'No date given',
      priority: 'medium'
    }))
}

export function toMarkdown(items) {
  return items.map((i) => `- [ ] ${i.task} — ${i.owner} (${i.due}, ${i.priority})`).join('\n')
}
