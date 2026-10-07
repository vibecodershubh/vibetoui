# Vibe To UI
AI UI generator (NOT a full website builder). The user gives a rough idea, an
Interview Agent asks 3-6 high-value questions, a built-in Taste Skill constrains
generation, and the result renders live. The user can select ONE component,
lock others, and ask for a scoped natural-language edit that touches only the
selection.

## Principles
- Intent before generation: never send the raw first prompt to the generator.
- Smallest-change: patches mutate only the selected component. Enforce this
  SERVER-SIDE (replace by id, reject locked ids), never trust the model.
- Structure before markup: canvas = JSON; each component stores its own
  Tailwind HTML snippet (hybrid approach).
- Real UI: preview is sandboxed HTML/Tailwind in an iframe.

## Stack
Next.js (App Router) + TypeScript + Tailwind, Zustand, Zod, @google/genai (Gemini).
LLM provider is Gemini: the key comes from env GEMINI_API_KEY and the model name from env GEMINI_MODEL
(optional GEMINI_INTERVIEW_MODEL). Both are read only in lib/gemini.ts, which is server-only; never
print, log or hardcode them, and never read .env.local in tooling.

## Hackathon rules
- Always keep the app runnable and deployable. Small commits.
- Every LLM call: timeout, Zod validation, strip markdown fences, one retry,
  then a fallback. The UI must never crash on bad model output.
- Add a DEMO_MODE env flag that serves pre-saved good outputs.
- Strip <script> and external URLs from generated HTML.

## Canvas shape
Canvas { designSystem{typography,color,spacing,radius,motion},
components[{id,type,variant,html,props,locked}], metadata{intent,history[]} }
