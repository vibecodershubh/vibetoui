# Vibe to UI

Describe what you're making. A short guided interview turns a rough idea into a clear brief, a built-in
taste skill constrains generation, and the result renders live. Select one section, lock the others, and
ask for a scoped natural-language edit that touches only the selection.

Next.js (App Router) + TypeScript + Tailwind, Zustand, Zod, and the Gemini API (`@google/genai`).

## Setup

```bash
npm install
cp .env.example .env.local     # then fill in GEMINI_API_KEY and GEMINI_MODEL
npm run dev                    # http://localhost:3000
```

No key yet? Run the whole app on saved data: `DEMO_MODE=true npm run dev` (or open `http://localhost:3000/?demo=1`).

### Environment variables

| Variable | Required | What it does |
|---|---|---|
| `GEMINI_API_KEY` | yes (unless demo) | Gemini API key. Read only in `src/lib/gemini.ts` (server-only). Never commit it. |
| `GEMINI_MODEL` | yes (unless demo) | Model for generation, patches and the interview, e.g. `gemini-2.5-flash`. |
| `GEMINI_INTERVIEW_MODEL` | no | A different (faster) model for the short interview calls. Defaults to `GEMINI_MODEL`. |
| `LLM_TIMEOUT_MS` | no | Per-attempt model timeout. Default 25000. |
| `DEMO_MODE` | no | `true` makes the whole server serve saved pages and a scripted interview. No API calls, no key needed. |

`.env.local` is gitignored; keep real keys out of `.env.example`. Next reads env files at startup, so restart
the server after editing `.env.local`.

## Demo mode, fallbacks and status

- **Saved flow.** In demo mode the app plays the exact flow below from pre-saved JSON in `demo/`:
  `ai-security.json` (the generated page) and `ai-security-patches.json` (the saved edit results).
- **Three ways in:** `DEMO_MODE=true` (server-wide), `?demo=1` on the URL (remembered in the browser; `?demo=0` turns
  it off), or the **Use demo** link in the status indicator.
- **Status indicator** (top bar, next to the logo): `Gemini ready` (configured, nothing tried yet), `Gemini live`
  (a real request just worked), `API unavailable` (a real request failed, or Gemini isn't configured), `Demo mode`.
  It **makes no model calls on its own**: it checks the configuration (free) and learns from the app's real requests.
  **Check** makes one tiny Gemini request when you want certainty; **Use demo** / **Go live** switch modes.
- **If the API fails mid-demo:** click **Use demo** in the status indicator, or **Use demo data** next to *Try again*
  after a failed generation. Nothing else changes; every request now serves saved data.
- **If the preview crashes:** an error boundary shows "The preview hit a problem" with *Reload preview*,
  *Undo last change* and *Start over*. The rest of the studio stays up.
- **Demo pacing.** Demo mode adds short pauses (interview 0.35s, generate 1.4s, edit 0.9s) so the skeleton shimmer and
  "Editing…" are visible. Set `DEMO_DELAY_SCALE=0` to remove them (or `2` to slow them down).
- **Timeouts everywhere:** every browser request is cut off after 65s (health: 15s); each model attempt after 25s
  (`LLM_TIMEOUT_MS`), with one retry; the server routes have `maxDuration = 60`. Nothing can hang forever.

## Gemini quota (read this before a live demo)

Free-tier Gemini keys allow only about **20 requests per day per model**. One full run of the demo script uses
roughly 8 (about 4 interview turns, 1 generation, 1 to 3 edits), and each **Check** is one more. When the quota is
gone, requests fail with HTTP 429 and the app says "Gemini's quota for this key is used up" (it does not retry a
daily limit). Use a key with billing enabled for live demos, and keep **Use demo** as your safety net.

## Demo script (about 3 minutes)

Run with `DEMO_MODE=true` (deterministic) or live with a working key. In demo mode the chips and results are
exactly as below; live, the interviewer's questions and the model's HTML will differ.

1. **Open** `http://localhost:3000`. The status shows `Demo mode` (or `Gemini live`). *"Describe what you're making."*
2. **Start.** Click the example **A hero for an enterprise AI security product**. The conversation opens on the left.
3. **Answer three questions with the chips:** *CISOs and security teams* → *Landing page* → *Editorial*. The thin
   progress bar fills as the brief becomes clear.
4. **Confirm.** The summary card reads "Landing page for an enterprise AI security product, audience: CISOs and security
   teams, direction: Editorial". Click **Confirm**. A skeleton shimmer shows while it builds, then the page
   appears: navbar, hero and feature section for "Northgate".
5. **Scoped edit.** Click the hero. A toolbar appears: **Editing: Hero**. Type `make it more editorial and reduce
   visual noise` and press **Apply**. Only the hero changes (it flashes): the boxed capability cards become a quiet
   hairline list. The navbar and features are untouched.
6. **Lock it.** In the toolbar press **Lock**. The hero shows a *Locked* badge and its input is disabled
   ("Unlock this section to edit it").
7. **Edit the next section.** Click the feature section, type `make the feature section calmer and shorter`, press
   **Apply**. It becomes a numbered list, one line each. The locked hero is byte-for-byte unchanged.
8. **Extras to mention (30s):** switch **Tablet / Mobile** (the page reflows), toggle **Light / Dark**, open the
   **Code** tab (select a section to see only its HTML), **Direction** menu (re-themes the page), **Undo** in the
   toolbar, **Export** (downloads standalone HTML).

If you need to reset between runs: **Start over** in the conversation panel, or reload.

## How the model is called

`src/lib/llm.ts` is the one shared helper. Every call goes through `ai.models.generateContent` with
`config.systemInstruction` (the taste skill and rules) and `responseMimeType: "application/json"`, then:
a 25s timeout (it aborts the request), markdown-fence stripping and JSON repair, Zod validation, one retry with the
validation error appended, and a fallback component if it still fails. Patches are enforced on the server: the model
sees only the selected component, a locked section never reaches the model, only that id is replaced, and extra
components in its reply are discarded.

## Testing

```bash
npm test            # unit tests (no network, no API key needed)
npx tsc --noEmit
npm run build
```

### Check the Gemini connection: `/api/health`

```bash
curl -i http://localhost:3000/api/health
```

- Healthy: `200` and `{"ok":true,"deep":true}` (one tiny Gemini call).
- `curl -i "http://localhost:3000/api/health?mode=config"` is free: it only checks that Gemini is configured (`{"ok":true,"deep":false}`).
- Not healthy: `503` and `{"ok":false,"reason":"auth" | "model_not_found" | "missing_config" | "quota_exceeded" | "rate_limited" | ...,"message":"..."}`.
- The response never contains key material or raw provider errors. A good result is cached for 5 minutes and a bad one for 30 seconds.
- In demo mode it answers `{"ok":true,"demo":true}` without calling Gemini.

Server-side failures are logged in the terminal with the prefixes `[llm:generate]`, `[llm:patch]`, `[llm:interview]`
and `[health]` (key material is redacted).

## Deploying to Vercel

1. Import the repo. Framework: Next.js. No build settings needed.
2. Add **Environment Variables** (Production and Preview): `GEMINI_API_KEY`, `GEMINI_MODEL`, optionally
   `GEMINI_INTERVIEW_MODEL`. Leave `DEMO_MODE` unset for live, or set it to `true` for a safe fallback deployment.
3. Redeploy after changing env vars (they are read at build and start).
4. Check the deployment: see the checklist in the project notes (`/api/health`, one full interview → generate → patch).
5. The model routes set `maxDuration = 60`. Your Vercel plan must allow functions that long, or lower `LLM_TIMEOUT_MS`.
