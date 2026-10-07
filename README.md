# Vibe to UI

**Describe what you're making. Get a considered interface you can refine one section at a time.**

Vibe to UI is an AI UI generator for landing-page-style sections (hero, features, pricing, and so on). You type a
rough idea, a short guided interview turns it into a clear brief, a built-in taste system keeps the result
restrained and consistent, and the page renders live in a sandboxed preview. Then you click **one section**, ask for a
change in plain English, and **only that section changes**. Lock a section and it can never be touched.

> It is a focused design tool, **not** a full website builder: no routing, no backend, no accounts.

**Demo video:** [Watch the product demo](docs/demo.mp4) (MP4, about 6 MB). On GitHub, click the link and the file plays in the viewer.

Built with Next.js (App Router), TypeScript, Tailwind CSS v4, Zustand, Zod, and the Gemini API (`@google/genai`).

---

## Contents

1. [Demo video](#demo-video)
2. [Features](#features)
3. [How it works](#how-it-works)
4. [Quick start](#quick-start)
5. [Configuration](#configuration)
6. [Demo mode](#demo-mode)
7. [Demo script (3 minutes)](#demo-script-3-minutes)
8. [Using the studio](#using-the-studio)
9. [API reference](#api-reference)
10. [Security and privacy](#security-and-privacy)
11. [Deploying to Vercel](#deploying-to-vercel)
12. [Troubleshooting](#troubleshooting)
13. [Testing and development](#testing-and-development)
14. [Project structure](#project-structure)
15. [Limitations](#limitations)

---

## Demo video

A short walkthrough of the product: [docs/demo.mp4](docs/demo.mp4). To follow along yourself, see the
[demo script](#demo-script-3-minutes) (it runs with no API key in [demo mode](#demo-mode)).

---

## Features

| Area | What you get |
|---|---|
| **Guided intake** | 3 to 6 high-value questions, one at a time, as tap-to-answer chips (plus "Something else"). It only asks what would materially change the design, and stops at high confidence or after 6 questions. A progress bar shows how clear the brief is. |
| **Tasteful generation** | A built-in taste system (typography, spacing rhythm, restrained color with one accent, motion only for state, explicit anti-slop rules) plus four **direction presets**: Editorial, Technical, Soft & Friendly, Bold Minimal. |
| **Scoped edits** | Select one section and describe a change. The model sees only that section. The server replaces only that section and refuses locked ones. |
| **Lock, duplicate, undo** | A floating toolbar on the selected section: Lock/Unlock, Duplicate, Undo (with a count), and the edit command box. |
| **Live preview** | A real HTML/Tailwind page in a sandboxed iframe, with a Desktop / Tablet / Mobile switcher, a light and a dark app theme, and a "what changed" flash on edited sections. |
| **Design panel** | Switch direction, change corner radius (Sharp / Soft / Round) and density (Compact / Comfortable / Spacious), see the palette and fonts, and read the section's code. All undoable. |
| **Export** | Download or copy a standalone HTML file (Tailwind from a CDN, fonts, and the design tokens included). |
| **Built to survive a demo** | Demo mode with a saved end-to-end flow, one-click fallback when the API fails, request timeouts everywhere, an error boundary around the preview, and a quiet API status indicator. |

---

## How it works

```
 idea ──► /api/interview ──► brief (Intent) ──► Confirm ──► /api/generate ──► page (JSON components)
            (≤ 6 questions)                                     │
                                                                ▼
                                  sandboxed preview ◄── sanitized Tailwind HTML per section
                                          │
                       select ONE section │  "make it more editorial"
                                          ▼
                                    /api/patch ──► only that section is replaced
```

Four principles shape the code (they are also written down in [`CLAUDE.md`](CLAUDE.md)):

1. **Intent before generation.** The generator never receives the user's raw first message. It gets a structured
   brief (goal, audience, what's being built, visual direction, notes, confidence) plus the design tokens.
2. **Smallest change.** A patch can only change the selected component. This is enforced **on the server**
   (replace by id, reject locked ids, discard anything else the model returns), never left to the model.
3. **Structure before markup.** The page is JSON: `{ designSystem, components[{ id, type, variant, html, props, locked }], metadata }`.
   Each component carries its own Tailwind HTML.
4. **Real UI.** The preview is real HTML and Tailwind in a sandboxed iframe, not a mock.

**Design tokens, not raw values.** Every page uses a small token set (`bg-bg`, `text-ink`, `text-muted`,
`bg-accent`, `border-line`, `rounded-ui`, spacing `s1`..`s6`, `font-heading`, `font-body`). The preview replaces
Tailwind's default colors, fonts and radii with these tokens, so off-palette classes simply produce no styling and every
section inherits the same look. Switching direction or radius re-themes the whole page without regenerating it.

**Every model call is defended.** All calls go through one helper (`src/lib/llm.ts`): a 25s timeout that aborts the
request, markdown-fence stripping and JSON repair, Zod validation, **one retry with the validation error appended**,
and a tidy fallback if it still fails. The UI never crashes on bad model output.

---

## Quick start

**Requirements:** Node.js 20 or newer, npm, and (for live generation) a Gemini API key from
[Google AI Studio](https://aistudio.google.com/).

```bash
git clone https://github.com/vibecodershubh/vibetoui.git
cd vibetoui
npm install
cp .env.example .env.local      # then fill in GEMINI_API_KEY and GEMINI_MODEL
npm run dev                     # http://localhost:3000
```

No key yet? Run everything on saved data, no API calls:

```bash
DEMO_MODE=true npm run dev      # or open http://localhost:3000/?demo=1
```

Next.js reads `.env.local` only when the server starts, so **restart `npm run dev` after editing it**.

---

## Configuration

Set these in `.env.local` (local) or in your host's environment settings (deployed). `.env.local` is git-ignored.
Keep real keys out of `.env.example`.

| Variable | Required | Default | What it does |
|---|---|---|---|
| `GEMINI_API_KEY` | Yes (unless demo) | none | Your Gemini API key. Read only in `src/lib/gemini.ts`, which is server-only. |
| `GEMINI_MODEL` | Yes (unless demo) | none | The model for generation, edits and the interview. Use any current Gemini model your key can use; availability and free quota differ by model and account. |
| `GEMINI_INTERVIEW_MODEL` | No | `GEMINI_MODEL` | A different (often faster or lighter) model for the short interview calls. Quota is counted per model, so this also spreads your usage. |
| `LLM_TIMEOUT_MS` | No | `25000` | Per-attempt model timeout. |
| `DEMO_MODE` | No | off | `true` makes the **whole server** serve saved pages and a scripted interview. No API calls, no key needed. |
| `DEMO_DELAY_SCALE` | No | `1` | Demo mode adds short pauses so loading states are visible. `0` removes them, `2` doubles them. |

**Choosing a model.** Pick one with `GEMINI_MODEL`, then confirm it with `/api/health` (see
[API reference](#api-reference)). If a model is "no longer available to new users" or your daily quota is used up,
the health check says so; switch to another model.

---

## Demo mode

Demo mode plays a complete, pre-saved flow from `demo/*.json`, so a presentation never depends on the network, the
quota, or the model's mood. It has three entry points:

| How | Scope |
|---|---|
| `DEMO_MODE=true` | The whole server. Every visitor gets demo data. |
| `?demo=1` on the URL (`?demo=0` turns it off) | That browser. Remembered. Good for sharing a safe link. |
| **Use demo** in the status indicator, or **Use demo data** after a failure | That browser, one click, no reload. **Go live** switches back. |

In demo mode the interview is scripted, generation returns a saved page, and edits return saved results for the demo
page (and a visible "Edited" note for anything else). Demo data is validated by the same schemas and sanitizer as live
output.

> If the app unexpectedly shows **Demo mode**, one of the three above is on. Check `DEMO_MODE` in your environment,
> open the site with `?demo=0`, or click **Go live**.

**Status indicator** (top bar, next to the logo) shows `Gemini ready`, `Gemini live`, `API unavailable`, or
`Demo mode`. It never calls the model on its own: it checks that Gemini is configured (free) and learns "live" or
"unavailable" from the app's real requests. **Check** makes one tiny model request when you want certainty.

---

## Demo script (3 minutes)

Works in demo mode (identical every time) or live (the questions and HTML will differ).

1. **Open** the app. The headline is *"Describe what you're making."*
2. **Start.** Click the example **A hero for an enterprise AI security product**.
3. **Answer with the chips:** *CISOs and security teams*, then *Landing page*, then *Editorial*. The progress bar fills.
4. **Confirm.** The summary reads *"Landing page for an enterprise AI security product, audience: CISOs and security
   teams, direction: Editorial"*. Click **Confirm**. A skeleton shimmer shows while it builds, then a page appears
   (navbar, hero, features).
5. **Scoped edit.** Click the hero. In the toolbar type `make it more editorial and reduce visual noise` and press
   **Apply**. Only the hero changes (it flashes): the boxed capability cards become a quiet hairline list.
6. **Lock it.** Press **Lock**. The hero shows a *Locked* badge and its input is disabled.
7. **Edit the next section.** Click the features section, type `make the feature section calmer and shorter`, press
   **Apply**. It becomes a numbered list. The locked hero is unchanged, byte for byte.
8. **Extras:** Tablet/Mobile switcher, Light/Dark, the **Code** tab, **Direction**, **Undo**, **Export**.

Reset between runs with **Start over** or by reloading.

---

## Using the studio

- **Left: conversation.** The interview and the summary card (**Confirm** or **Edit**). **Skip, just generate**
  is always available and fills missing details with safe defaults.
- **Center: canvas.** The page in a device frame on a dotted grid. Click a section to select it.
- **Floating toolbar** (on the selected section): *Editing: Hero*, **Lock/Unlock**, **Duplicate**, **Undo (n)**, and the
  edit box. A locked section's box is disabled and the server also refuses it.
- **Right: Design and Code.** *Design*: direction presets, corner radius, density, palette and fonts. *Code*: the
  selected section's HTML (or the whole page), with **Copy**.
- **Top bar:** direction menu, device switcher, light/dark theme, **Export**, and the panel toggle.
- **Keyboard:** everything is reachable by Tab; menus open with Enter and close with Esc; segmented controls use the
  arrow keys; a "Skip to canvas" link appears on first Tab.
- **Export** downloads `vibe-to-ui.html`, a standalone page that loads Tailwind (CDN) and Google Fonts and defines the
  design tokens. It contains only the page, no editor code.

---

## API reference

All routes are JSON, server-side, and validate input with Zod. Requests with unknown fields are rejected (`400`).
Every non-`400` response is usable: on failure you get a `fallback` result and a short, safe `error` message.

### `POST /api/interview`

`{ messages, intent }` → `{ nextQuestion | null, options, intentUpdate, confidence, intent, done, fallback?, error?, demo? }`

Guided intake only; it never generates UI. The stop rules (confidence ≥ 0.8, or 6 questions) and a confidence cap while
the brief is incomplete are enforced by the server, not the model.

### `POST /api/generate`

`{ intent, designSystem, targetType }` → `{ components, fallback?, error?, demo? }`

There is **no field for a raw prompt**. The prompt is built from the taste system, the structured brief and the design
tokens. Output is validated, sanitized, and returned as 3 to 7 components.

### `POST /api/patch`

`{ componentId, request, designSystem, components }` → `{ component, discarded, fallback?, error?, demo? }`

The model receives **only the selected component**. The server: refuses a locked target (`409`) before any model call,
replaces only that id, forces its id, type and lock state, discards any other components the model returns, and sanitizes
the HTML. On model failure it returns the original component unchanged with `fallback: true`.

### `GET /api/health`

| Call | Cost | Result |
|---|---|---|
| `/api/health?mode=config` | free (no model call) | `{ "ok": true, "deep": false }` if Gemini is configured |
| `/api/health` | one tiny model request | `{ "ok": true, "deep": true }` (200) or `{ "ok": false, "reason", "message" }` (503) |

Reasons: `missing_config`, `auth`, `model_not_found`, `quota_exceeded`, `rate_limited`, `timeout`, `unavailable`.
The response never contains key material or raw provider errors. A good result is cached for 5 minutes and a bad one
for 30 seconds, so it cannot be used to burn a small quota. In demo mode it answers `{ "ok": true, "demo": true }`.

### Timeouts

Browser requests give up after 65s (health: 15s); each model attempt after 25s (with one retry); the model-limit lookup
after 5s; and the routes set `maxDuration = 60`. Nothing waits forever.

---

## Security and privacy

- **The API key never reaches the browser.** `src/lib/gemini.ts` is `server-only`; importing it from client code fails
  the build. Keys and provider error text are redacted from logs and responses.
- **Generated HTML is untrusted.** It is sanitized (scripts, `on*` handlers, external `src`/`href` except links, and
  `javascript:` URLs removed) before use, and rendered in an iframe with `sandbox="allow-scripts"` and an opaque origin.
  The frame only accepts messages from its own parent.
- **Server-side enforcement.** Locks and "only this section" are decided in code, not by prompt.
- **No accounts, no database.** The canvas lives in your browser's memory (see [Limitations](#limitations)). Your idea
  and the selected section are sent to the Gemini API to generate results; review Google's terms for your key's tier.
- **Never commit secrets.** `.env*` is git-ignored except `.env.example`, which must stay blank.

---

## Deploying to Vercel

1. Import the repository. Framework preset: **Next.js**. No build settings needed.
2. Add **Environment Variables** for the environments you use (Production and Preview):
   `GEMINI_API_KEY`, `GEMINI_MODEL`, and optionally `GEMINI_INTERVIEW_MODEL`. Leave `DEMO_MODE` unset for a live site,
   or set it to `true` for a safe, always-working showcase. **`.env.local` is not deployed**; set these in Vercel.
3. **Redeploy** after any change to environment variables.
4. **Deployment Protection.** By default Vercel puts Preview (and deployment-specific) URLs behind Vercel login. For a
   public demo, share your **production domain**, or turn off *Vercel Authentication* in Project → Settings →
   Deployment Protection.
5. **Function duration.** The model routes use `maxDuration = 60`. Make sure your plan allows it, or lower
   `LLM_TIMEOUT_MS`.

**Verify a deployment** (replace the URL):

```bash
curl -i "https://YOUR-DOMAIN/api/health?mode=config"   # free: { "ok": true, "deep": false }
curl -i "https://YOUR-DOMAIN/api/health"               # one real model request: { "ok": true, "deep": true }
```

Then open `https://YOUR-DOMAIN/?demo=1` (should run the full demo with no model calls) and finally run one live
interview, generate and edit.

---

## Troubleshooting

| Symptom | Cause and fix |
|---|---|
| Status says **Demo mode** and you didn't choose it | `DEMO_MODE=true` is set (env or `.env.local`), the URL has `?demo=1`, or you clicked *Use demo*. Remove the env var and restart, open `?demo=0`, or click **Go live**. |
| `missing_config` | `GEMINI_API_KEY` or `GEMINI_MODEL` isn't visible to the server. Check the exact names, no spaces around `=`, no comment `#`, then **restart** (or redeploy). |
| `auth` | The key was rejected. Create a fresh key in Google AI Studio and update the variable. |
| `model_not_found` | That model name isn't available to your key (some are retired for new users). Choose another in `GEMINI_MODEL`. |
| `quota_exceeded` | Free keys have small per-model daily limits. Wait for the reset, switch `GEMINI_MODEL` / `GEMINI_INTERVIEW_MODEL` to a model with quota, or enable billing. One full demo run uses roughly 8 requests. |
| `rate_limited` | A per-minute limit. Wait a moment; the app retries once automatically. |
| `timeout` | The model was slow. Try again, use a lighter model, or raise `LLM_TIMEOUT_MS` (within your host's function limit). |
| Deployed site asks you to log in to Vercel | Deployment Protection is on. See [Deploying to Vercel](#deploying-to-vercel). |
| The page is gone after a refresh | By design: the canvas isn't saved yet. Use **Export** to keep a page. |
| `npm run lint` fails to load its config | Your `eslint-config-next` version doesn't match the project (it should be `16.4.0`). Reinstall dependencies from the lockfile. |
| An edit "did nothing" | The section may be locked, or the model returned something invalid twice. The original is kept; try again with a clearer request. |

---

## Testing and development

```bash
npm test             # unit tests: no network and no API key needed
npx tsc --noEmit     # type check
npm run build        # production build
npm run dev          # development server
```

The tests cover the sanitizer and JSON repair, schemas, the interview stop rules, scoped patching (patching one
section leaves the others byte-identical), the saved demo flow, the Gemini call shape and error mapping, timeouts, the
health check (including that it never leaks key material), and the error boundary.

A scratch page at `/canvas` exercises selection and locking with a hard-coded sample. It's a development aid.

---

## Project structure

```
demo/                      saved pages and edit results for demo mode (JSON)
src/
  app/
    page.tsx               the studio
    error.tsx              last-resort error page
    api/{interview,generate,patch,health}/route.ts
  components/
    studio/                shell: top bar, panels, device frame, status, error boundary
    ChatPanel.tsx          interview UI        ComponentToolbar.tsx   floating edit toolbar
    CanvasFrame.tsx        sandboxed preview   SummaryCard.tsx        brief summary
  lib/
    gemini.ts              server-only Gemini client (the only place the key is read)
    llm.ts                 the one model-call helper: timeout, repair, validate, retry, fallback
    taste.ts  prompt.ts    the taste system and prompt builders
    interview.ts patch.ts  intake rules, scoped patching (applyPatch)
    schema.ts              Zod schemas for the canvas, requests and outputs
    html.ts                the HTML sanitizer       theme.ts   design tokens to CSS
    demo.ts                demo mode               health.ts  health checks
  store/                   Zustand stores (interview, generate, patch, studio, health)
```

---

## Limitations

- **Sections, not sites.** One page of stacked sections; no routing, forms backend, or images pipeline.
- **No persistence.** The page lives in the browser's memory. Refreshing loses it (use **Export**).
- **Output quality depends on the model** and on your key's quota. Free tiers are small; use demo mode as a safety net.
- **The preview and the export load Tailwind (CDN) and Google Fonts**, so they need internet access.
- **Not yet included (in progress):** a version-history drawer with one-click restore and Cmd/Ctrl+Z,
  syntax-highlighted code, and device widths of 1280/820/390 with scale-to-fit. For now, use the toolbar's **Undo**.
- **No license file yet.** Add one before sharing the code publicly.

---

*Project principles and conventions for contributors and coding assistants live in [`CLAUDE.md`](CLAUDE.md).*
