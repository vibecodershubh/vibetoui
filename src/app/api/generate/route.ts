import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { DEMO_HERO_HTML } from "@/lib/demo";
import { sanitizeHtml, stripFences } from "@/lib/html";

const RequestSchema = z.object({
  prompt: z.string().trim().max(2000).default(""),
});

// Model output must at least look like an HTML element.
const HtmlSchema = z
  .string()
  .min(20)
  .refine((s) => /<[a-z][\s\S]*>/i.test(s), "not HTML");

const MODEL = process.env.ANTHROPIC_MODEL || "claude-opus-5-5";
const TIMEOUT_MS = 60_000;
const ATTEMPTS = 2; // first try + one retry

const SYSTEM =
  "Return one Tailwind HTML hero section, HTML only. " +
  "No markdown, no explanations, no <script> tags, no external images or URLs.";

async function generateOnce(client: Anthropic, idea: string): Promise<string> {
  const response = await client.messages.create(
    {
      model: MODEL,
      max_tokens: 8000,
      system: SYSTEM,
      messages: [
        { role: "user", content: idea ? `Topic: ${idea}` : "Topic: a generic SaaS product" },
      ],
    },
    { timeout: TIMEOUT_MS, maxRetries: 0 },
  );

  if (response.stop_reason === "refusal") throw new Error("Model declined the request");

  const text = response.content
    .filter((b) => b.type === "text")
    .map((b) => b.text)
    .join("");
  return HtmlSchema.parse(sanitizeHtml(stripFences(text)));
}

export async function POST(request: Request) {
  const parsed = RequestSchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return Response.json({ error: "Invalid request." }, { status: 400 });
  }

  if (process.env.DEMO_MODE === "true") {
    return Response.json({ html: DEMO_HERO_HTML, demo: true });
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    return Response.json(
      { error: "ANTHROPIC_API_KEY is not set. Add it to .env.local or set DEMO_MODE=true." },
      { status: 500 },
    );
  }

  const client = new Anthropic();
  let lastError: unknown;
  for (let attempt = 1; attempt <= ATTEMPTS; attempt++) {
    try {
      const html = await generateOnce(client, parsed.data.prompt);
      return Response.json({ html });
    } catch (err) {
      lastError = err;
      console.error(`[generate] attempt ${attempt} failed:`, err);
      // Bad credentials or bad request won't fix themselves on retry.
      if (err instanceof Anthropic.AuthenticationError || err instanceof Anthropic.BadRequestError) break;
    }
  }

  return Response.json({ error: friendlyMessage(lastError) }, { status: 502 });
}

function friendlyMessage(err: unknown): string {
  if (err instanceof Anthropic.AuthenticationError) return "The API key was rejected. Check ANTHROPIC_API_KEY.";
  if (err instanceof Anthropic.NotFoundError) return `Model "${MODEL}" was not found. Check ANTHROPIC_MODEL.`;
  if (err instanceof Anthropic.RateLimitError) return "Rate limited by the API. Wait a moment and try again.";
  if (err instanceof Anthropic.APIConnectionTimeoutError) return "The model took too long to respond. Try again.";
  if (err instanceof Anthropic.APIConnectionError) return "Couldn't reach the Anthropic API. Check your connection.";
  if (err instanceof Anthropic.APIError) return "The model API returned an error. Try again.";
  if (err instanceof z.ZodError) return "The model returned something that wasn't usable HTML. Try again.";
  return "Something went wrong generating the UI. Try again.";
}
