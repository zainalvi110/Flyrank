# Reflection

## What was hardest, and why

The hardest part wasn't the AI integration itself — it was the number of small environment
problems standing between "the code is correct" and "the code actually runs." I hit four
separate blockers in a row that had nothing to do with my application logic: a downloaded zip
that silently lost its folder structure, a Google API key format (`AQ.`) that turns out to be
part of an active, unresolved Google-side rollout bug, the Vercel CLI crashing outright on
Windows with a libuv assertion error, and GitHub rejecting password authentication in favor of
a token I hadn't set up yet. None of these were bugs in my code, but each one blocked progress
until I diagnosed it correctly. The lesson I'm taking from this is that "production-ready" is as
much about surviving your own tooling and environment as it is about the application itself —
the brief said this explicitly and I underestimated how literally true it would be.

The second-hardest part was choosing an AI provider. I wanted a free option so I didn't have to
pay for a capstone project, which meant I couldn't just default to the obvious paid API. I ended
up switching providers twice — first to Google Gemini, then to OpenRouter — because Gemini's
newly-issued API keys don't currently work against the standard REST endpoint. That's a real,
live bug affecting other developers right now, not something I did wrong, but I only found that
out after debugging a silent 401 for a while. It reinforced that when something free breaks
in a way that "shouldn't" happen, it's worth checking whether it's a known issue before assuming
the mistake is yours.

## What I'd do differently next time

I'd pick the AI provider and confirm it works with a bare `curl` request *before* wiring it into
the app. I wired the whole extraction pipeline around Gemini first, and only discovered the key
format problem once I tried to actually run it — a five-minute manual test up front would have
caught that immediately instead of costing an afternoon.

I'd also set up local development without relying on the Vercel CLI from the start. Since my
serverless function only needed a POST endpoint and an environment variable, I could have used a
plain Vite dev-server middleware from day one instead of assuming `vercel dev` would work
cross-platform. I only built that workaround after the CLI crashed on me.

## One thing that surprised me

I didn't expect the fallback logic to end up being more interesting than the AI call itself. I
built the rule-based keyword extractor originally as a backup for when the API is down, but
comparing its output side-by-side with the LLM's output made the actual value of the AI
integration obvious in a way it wasn't in the abstract: the rule-based version keeps sentences
like "we should probably loop in legal at some point" because it matches a keyword, while the
LLM correctly drops it as discussion rather than a commitment, and instead catches "someone
needs to email legal" as a real task. Having a deliberately worse baseline sitting right next to
the AI feature made it obvious why the AI layer was worth building in the first place, instead
of me just asserting that it was.
