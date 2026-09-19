# Deployment checklist — Action Items

**Environment:** Vercel (production) · **Branch:** `main` · **Signed off by:** _<your name>_ · **Date:** _<date>_

## Pre-deploy

- [ ] `npm test` passes locally (12/12)
- [ ] `npm run build` succeeds with no errors
- [ ] `GEMINI_API_KEY` set in Vercel → Settings → Environment Variables (Production), **not** prefixed `VITE_`
- [ ] `.env` is gitignored; `git log -p | grep -i "AIza"` returns nothing
- [ ] Preview deployment clicked through by hand: happy path, empty notes, 20k-char paste

## Post-deploy verification

- [ ] Production URL loads and extracts a real set of notes
- [ ] Error state verified by temporarily setting a bad API key → fallback list + warning appears, no crash
- [ ] Lighthouse run on **mobile**: Performance ___ · Accessibility ___ · Best Practices ___ · SEO ___
- [ ] axe DevTools scan: 0 critical/serious violations
- [ ] Keyboard-only pass: tab to textarea → button → results → copy button, focus always visible

## Monitoring

- Vercel dashboard → Functions → `/api/extract` for invocation count, error rate, and p95 duration.
- Vercel Analytics enabled for page traffic and Core Web Vitals.
- The `reason` field on fallback responses is logged server-side, so upstream failures are
  visible in Vercel's runtime logs rather than silently swallowed.

## Rollback plan

Vercel keeps every deployment. If production breaks:

1. Vercel dashboard → Deployments → last known-good build → **Promote to Production** (~30s, no rebuild).
2. Then fix forward: revert the offending commit on `main` (`git revert <sha> && git push`), which
   triggers a fresh deploy.

If the failure is Google-side rather than ours, no rollback is needed — the fallback layer
already keeps the app usable, so the action is to check the Google AI Studio status page and wait.
