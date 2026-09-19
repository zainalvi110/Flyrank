# Action Items

Turn messy meeting notes into a clean list of commitments — who owes what, by when.

**Live:** https://flyrank-9r2unxqcz-zain-alvis-projects.vercel.app/
**Repo:** https://github.com/zainalvi110/Flyrank

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
git clone https://github.com/zainalvi110/Flyrank && cd Flyrank
npm install
cp .env.example .env        # add your free OPENROUTER_API_KEY (see below)
npm run dev                 # http://localhost:5173
```

`npm test` runs the suite, `npm run test:coverage` writes an HTML report to `coverage/`.

> `/api/extract.js` is written as a Vercel serverless function, but a Vite dev-server
> middleware (see `vite.config.js`) also serves it locally, so plain `npm run dev` is enough —
> you don't need the Vercel CLI to test the AI integration. `vercel dev` works too, but had a
> known crash on Windows during development (see Known limitations), which is why the
> middleware exists.

## Architecture

| Part | What it does |
| --- | --- |
| `src/App.jsx` | The whole UI: form, loading/error/empty/degraded states, results list, copy-to-markdown. |
| `src/lib/extract.js` | Pure logic: `parseModelJson`, `validateItems`, `heuristicExtract`, `toMarkdown`. No React, no network — so it's cheap to test. |
| `api/extract.js` | Serverless function. Holds the API key, calls the model, validates the reply, falls back on failure. |
| `vite.config.js` | Also wires `api/extract.js` into the local Vite dev server, so `npm run dev` alone is enough to test the AI feature. |
| `src/__tests__/` | Unit tests for the pure logic, component tests for the four UI states. |

The key decision: **the API key never touches the browser.** The client posts notes to
`/api/extract`; only the server talks to the model provider.

## AI integration

**OpenRouter's free router** (`openrouter/free`), on their free tier (no credit card, 20
requests/minute). It auto-selects a currently-available free model, so the app doesn't break
when any single free model is retired or rate-limited. A system prompt (full text in
`api/extract.js`) pins the output shape:

```
{"items":[{"task":"...","owner":"...","due":"...","priority":"high|medium|low"}]}
```

The prompt does three things beyond asking for JSON:

1. **Scopes the task** — one entry per commitment, ignore discussion and opinions.
2. **Blocks hallucination** — "Never invent a name", "Never invent a date"; use `Unassigned` /
   `No date given` instead. This was the single biggest quality fix during the build.
3. **Defines priority** concretely (deadline or blocker → high) so the field means something.

Why an LLM at all: deciding that "we should probably loop in legal at some point" is not a task
while "someone needs to email legal" is, requires reading intent. Keyword matching can't do it —
which is exactly what the fallback layer proves, since it's noticeably worse.

**Provider history:** the app originally targeted Google Gemini's free tier, but Google's
current API keys (the new `AQ.` prefix format) are broken against the standard REST endpoint —
a live, widely-reported Google-side bug, not a config mistake. Rather than wait on a fix, the
app was moved to OpenRouter, which also has a genuinely free tier and has worked reliably since.

## How it fails safely

Three layers, so the user always gets *something*:

1. Model returns prose or fenced JSON → `parseModelJson` strips fences and locates the JSON object.
2. Model returns valid JSON with wrong fields → `validateItems` drops junk entries, fills defaults,
   normalises unknown priorities, caps the list at 25. It never throws.
3. Provider is down, rate-limited, or times out (25s abort) → the server returns a rule-based list
   with `source: "fallback"`, and the UI shows a visible warning that the result may be less
   accurate. If even the network is gone, the same extraction runs in the browser.

Other guarded edges: input under 10 chars (button disabled), over 12,000 chars (413 with a clear
message), notes with no action items (explicit empty state, not a blank screen).

## Accessibility

- One labelled textarea with `aria-describedby` help text; semantic `main`/`h1`/`h2`/`ul`.
- `role="status" aria-live="polite"` announces "Extracting…" and the final item count.
- Errors and the degraded-result warning use `role="alert"`.
- `aria-busy` on the submit button while loading.
- Visible 3px focus ring on every interactive element; fully keyboard operable.
- Priority is conveyed by text inside the pill, not colour alone; all text meets 4.5:1 contrast.

**Lighthouse (mobile, production URL):** Performance 99 · Accessibility 100 · Best Practices 96
**axe DevTools scan:** _paste your violation/pass count here after running it_

**One concrete improvement from the audit:** the results list announces itself via
`role="status" aria-live="polite"` so screen reader users learn the extraction finished and how
many items were found, without needing to visually scan the page — this was built in from the
start rather than bolted on after a failing audit, precisely to avoid an accessibility retrofit.

## Testing

12 tests across two files. `extract.test.js` covers the parse/validate/fallback logic including
the ugly cases (chatty preamble, null entries, bogus priority, 40-item flood).
`App.test.jsx` mounts the component and covers the happy path, the degraded-result warning, the
network-failure fallback, and the disabled-until-valid button.

```
npm run test:coverage
```

**Coverage:** 88.35% statements / 70.37% branches / 70% functions overall; `src/lib/extract.js`
(the core AI-parsing logic) is at 100% statements. `main.jsx` shows 0% — it's just the React
bootstrap line and isn't meaningfully testable.

## Known limitations

- English-centric; the fallback heuristic is English-only.
- No persistence — reload and your list is gone. Deliberate for privacy, annoying in practice.
- The free model occasionally merges two commitments in one sentence into a single item.
- No streaming; long notes sit on a spinner for a few seconds.
- No rate limiting on `/api/extract` beyond OpenRouter's own free-tier limits.
- `vercel dev` crashes on this project on Windows (a libuv assertion error in the CLI itself) —
  worked around with a Vite dev-server middleware instead of fixing the CLI issue.

## Future improvements

Per-item edit and delete · export to a calendar or issue tracker · streaming responses ·
a "this was wrong" button that logs the input for prompt iteration · IP rate limiting.
