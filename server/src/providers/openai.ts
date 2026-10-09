import OpenAI from "openai";
import { SYSTEM_PROMPT, parseJsonLoose, userPrompt } from "./prompt.js";
import type { ExtractionInput, ExtractionProvider, ProviderResult } from "./types.js";

/** Uses JSON mode on the text layer; cheap and fast for digital PDFs. */
export class OpenAIProvider implements ExtractionProvider {
  readonly name = "openai";
  private client: OpenAI;

  constructor(
    apiKey: string,
    private model = process.env.OPENAI_MODEL ?? "gpt-4.1-mini",
  ) {
    this.client = new OpenAI({ apiKey });
  }

  async extract({ pages }: ExtractionInput): Promise<ProviderResult> {
    const res = await this.client.chat.completions.create({
      model: this.model,
      temperature: 0,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: userPrompt(pages) },
      ],
    });
    const text = res.choices[0]?.message?.content ?? "";
    return { raw: parseJsonLoose(text), model: this.model };
  }
}
