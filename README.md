# Action Items

Turn messy meeting notes into a clean list of commitments — who owes what, by when.

**Live:** `https://<your-app>.vercel.app` · **Repo:** `https://github.com/<you>/action-items`

## Project brief

People leave meetings with pages of notes and no clear list of what they agreed to do, so
follow-ups get dropped. Action Items takes raw pasted notes and returns only the concrete
commitments, each with the owner and due date *as written in the notes* — it never invents a
name or a date. It's for anyone who takes rough notes in a standup or client call and wants a
checklist out of them in five seconds. I chose it because it's a job an LLM is genuinely good
at (fuzzy text in, strict structure out) and a job regex alone does badly — and because the
output is small enough to validate, test, and degrade gracefully.

## Run it locally (under 5 minutes)

```bash
git clone https://github.com/<you>/action-items && cd action-items
npm install
cp .env.example .env        # add your free GEMINI_API_KEY
npm run dev                 # http://localhost:5173
```

`npm test` runs the suite, `npm run test:coverage` writes an HTML report to `coverage/`.

> The `/api/extract` route is a Vercel serverless function. For local API calls use
> `npx vercel dev` instead of `npm run dev`. With plain `npm run dev` the fetch fails and the
> app falls back to browser-side extraction — which is itself a deliberate behaviour, see below.

## Architecture

| Part | What it does |
| --- | --- |
| `src/App.jsx` | The whole UI: form, loading/error/empty/degraded states, results list, copy-to-markdown. |
| `src/lib/extract.js` | Pure logic: `parseModelJson`, `validateItems`, `heuristicExtract`, `toMarkdown`. No React, no network — so it's cheap to test. |
| `api/extract.js` | Serverless function. Holds the API key, calls Gemini, validates the reply, falls back on failure. |
| `src/__tests__/` | Unit tests for the pure logic, component tests for the four UI states. |

The key decision: **the API key never touches the browser.** The client posts notes to
`/api/extract`; only the server talks to Anthropic.

## AI integration

Google's **Gemini 2.5 Flash** via the Generative Language API, on the free tier (no credit card,
~1,500 requests/day). The call sets `responseMimeType: "application/json"`, which makes the model
return parseable JSON at the API level rather than relying on the prompt alone, and a system
prompt that pins the shape:

```
{"items":[{"task":"...","owner":"...","due":"...","priority":"high|medium|low"}]}
```

The prompt (full text in `api/extract.js`) does three things beyond asking for JSON:

1. **Scopes the task** — one entry per commitment, ignore discussion and opinions.
2. **Blocks hallucination** — "Never invent a name", "Never invent a date"; use `Unassigned` /
   `No date given` instead. This was the single biggest quality fix during the build.
3. **Defines priority** concretely (deadline or blocker → high) so the field means something.

Why an LLM at all: deciding that "we should probably loop in legal at some point" is not a task
while "someone needs to email legal" is, requires reading intent. Keyword matching can't do it —
which is exactly what the fallback layer proves, since it's noticeably worse.

## How it fails safely

Three layers, so the user always gets *something*:

1. Model returns prose or fenced JSON (still possible on a retry or a different model) → `parseModelJson` strips fences and locates the JSON object.
2. Model returns valid JSON with wrong fields → `validateItems` drops junk entries, fills defaults,
   normalises unknown priorities, caps the list at 25. It never throws.
3. API is down, rate-limited (a 429 from the free tier is realistic), or times out (25s abort) → the server returns a rule-based list with
   `source: "fallback"`, and the UI shows a visible warning that the result may be less accurate.
   If even the network is gone, the same extraction runs in the browser.

Other guarded edges: input under 10 chars (button disabled), over 12,000 chars (413 with a clear
message), notes with no action items (explicit empty state, not a blank screen).

## Accessibility

- One labelled textarea with `aria-describedby` help text; semantic `main`/`h1`/`h2`/`ul`.
- `role="status" aria-live="polite"` announces "Extracting…" and the final item count.
- Errors and the degraded-result warning use `role="alert"`.
- `aria-busy` on the submit button while loading.
- Visible 3px focus ring on every interactive element; fully keyboard operable.
- Priority is conveyed by text inside the pill, not colour alone; all text meets 4.5:1 contrast.

## Testing

12 tests across two files. `extract.test.js` covers the parse/validate/fallback logic including
the ugly cases (chatty preamble, null entries, bogus priority, 40-item flood).
`App.test.jsx` mounts the component and covers the happy path, the degraded-result warning, the
network-failure fallback, and the disabled-until-valid button.

```
npm run test:coverage
```

_Paste your coverage output and a screenshot here._

## Known limitations

- English-centric; the fallback heuristic is English-only.
- No persistence — reload and your list is gone. Deliberate for privacy, annoying in practice.
- Haiku occasionally merges two commitments in one sentence into a single item.
- No streaming; long notes sit on a spinner for a few seconds.
- No rate limiting on `/api/extract` beyond Vercel's defaults.

## Future improvements

Per-item edit and delete · export to a calendar or issue tracker · streaming responses ·
a "this was wrong" button that logs the input for prompt iteration · IP rate limiting.
