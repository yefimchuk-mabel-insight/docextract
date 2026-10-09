import { AnthropicProvider } from "./anthropic.js";
import { GeminiProvider } from "./gemini.js";
import { HeuristicProvider } from "./heuristic.js";
import { OpenAIProvider } from "./openai.js";
import type { ExtractionProvider } from "./types.js";

/**
 * Picks a provider from the environment. With no key set the app still runs,
 * using the offline rule-based extractor, so the demo works out of the box.
 */
export function providerFromEnv(env = process.env): ExtractionProvider {
  const wanted = env.EXTRACTION_PROVIDER?.toLowerCase();
  if ((wanted === "anthropic" || !wanted) && env.ANTHROPIC_API_KEY) return new AnthropicProvider(env.ANTHROPIC_API_KEY);
  if ((wanted === "openai" || !wanted) && env.OPENAI_API_KEY) return new OpenAIProvider(env.OPENAI_API_KEY);
  if ((wanted === "gemini" || !wanted) && env.GEMINI_API_KEY) return new GeminiProvider(env.GEMINI_API_KEY);
  return new HeuristicProvider();
}

export type { ExtractionProvider } from "./types.js";
