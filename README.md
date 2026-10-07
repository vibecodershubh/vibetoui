# Vibe to UI

Describe what you're making. A short guided interview turns a rough idea into a clear brief, a built-in
taste skill constrains generation, and the result renders live. Select one section, lock the others, and
ask for a scoped natural-language edit that touches only the selection.

Next.js (App Router) + TypeScript + Tailwind, Zustand, Zod, and the Gemini API (`@google/genai`).

## Setup

```bash
npm install
cp .env.example .env.local   # then fill in GEMINI_API_KEY and GEMINI_MODEL
npm run dev                  # http://localhost:3000
```

| Variable | Required | What it does |
|---|---|---|
| `GEMINI_API_KEY` | yes (unless `DEMO_MODE`) | Gemini API key. Read only in `src/lib/gemini.ts` (server-only). Never commit it. |
| `GEMINI_MODEL` | yes (unless `DEMO_MODE`) | Model used for generation, patches and the interview, e.g. `gemini-2.5-flash`. |
| `GEMINI_INTERVIEW_MODEL` | no | A different (faster) model for the short interview calls. Defaults to `GEMINI_MODEL`. |
| `LLM_TIMEOUT_MS` | no | Per-attempt model timeout. Default 25000. |
| `DEMO_MODE` | no | `true` serves saved pages and a scripted interview with no API calls (no key needed). |

If a required variable is missing, the app does not crash: the UI shows a clear message and falls back to a
tidy placeholder block. `.env.local` is gitignored; keep real keys out of `.env.example`.

## How the model is called

`src/lib/llm.ts` is the one shared helper. Every call goes through `ai.models.generateContent` with
`config.systemInstruction` (the taste skill and rules) and `responseMimeType: "application/json"`, then:
25s timeout (aborts the request), markdown-fence stripping and JSON repair, Zod validation, one retry with the
validation error appended, and a fallback component if it still fails. `DEMO_MODE` bypasses the model entirely.

## Testing

```bash
npm test            # unit tests (no network, no API key needed)
npx tsc --noEmit
npm run build
```

### Check the Gemini connection: `/api/health`

With `npm run dev` running and your key in `.env.local`:

```bash
curl -i http://localhost:3000/api/health
```

- Healthy: `200` and `{"ok":true}` (it makes one tiny Gemini call).
- Not healthy: `503` and `{"ok":false,"reason":"auth" | "model_not_found" | "missing_config" | ...,"message":"..."}`.
- The response never contains key material or raw provider errors. Results are cached for ~15s.
- With `DEMO_MODE=true` it answers `{"ok":true,"demo":true}` without calling Gemini.

### Try the full flow: interview, generate, patch

Open http://localhost:3000, then:

1. Type an idea (or click an example), answer the questions, and press **Confirm**. This calls
   `/api/interview` for each question and `/api/generate` once.
2. Click a section in the preview. The toolbar appears ("Editing: Hero").
3. Type e.g. "make it more editorial and reduce visual noise" and press **Apply**. This calls `/api/patch`.
   Only that section changes; the rest stay byte-identical. Undo with Cmd/Ctrl+Z or the History drawer.

Server-side failures are logged to the terminal running `next dev` with the prefix `[llm:generate]`,
`[llm:patch]`, `[llm:interview]` or `[health]` (key material is redacted from logs).
