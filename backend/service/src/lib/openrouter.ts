import { env } from "../config/env.js";
import { logger } from "./logger.js";

interface OpenRouterChatChoice {
  message?: { content?: string };
}

interface OpenRouterChatResponse {
  choices?: OpenRouterChatChoice[];
}

export const ENRICHMENT_MODELS = [
  "openai/gpt-4o-mini",
  "google/gemini-2.5-flash",
  // claude-3-5-haiku (the original hook's model) is gone from OpenRouter's
  // catalog too - bumped to the current Haiku generation.
  "anthropic/claude-haiku-4.5",
];

/**
 * Tries each model in order against OpenRouter's chat completions endpoint,
 * returning the first non-empty response. Throws only if every model fails.
 */
export async function fetchWithFallback(prompt: string, models: string[]): Promise<string> {
  let lastError: unknown;

  for (const model of models) {
    try {
      const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${env.OPENROUTER_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model,
          messages: [{ role: "user", content: prompt }],
        }),
        signal: AbortSignal.timeout(120_000),
      });

      if (!res.ok) {
        logger.warn({ model, status: res.status }, "[openrouter] Model failed, trying next");
        continue;
      }

      const parsed = (await res.json()) as OpenRouterChatResponse;
      const content = parsed.choices?.[0]?.message?.content;
      if (content) {
        logger.info({ model }, "[openrouter] Success");
        return content;
      }
      lastError = new Error("Empty content in response");
    } catch (err) {
      logger.warn({ model, err }, "[openrouter] Model errored, trying next");
      lastError = err;
    }
  }

  throw new Error(`All AI models failed. Last error: ${String(lastError)}`);
}

/** Strips markdown code fences and trims to the outermost JSON object/array. */
export function extractJson(raw: string): string {
  let text = raw.replace(/```json/g, "").replace(/```/g, "").trim();

  const firstObj = text.indexOf("{");
  const firstArr = text.indexOf("[");
  const isArray = firstArr !== -1 && (firstObj === -1 || firstArr < firstObj);

  const open = isArray ? "[" : "{";
  const close = isArray ? "]" : "}";
  const start = text.indexOf(open);
  const end = text.lastIndexOf(close);
  if (start !== -1 && end !== -1) {
    text = text.substring(start, end + 1);
  }
  return text;
}
