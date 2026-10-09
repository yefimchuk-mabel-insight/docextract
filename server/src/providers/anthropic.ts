import Anthropic from "@anthropic-ai/sdk";
import { SYSTEM_PROMPT, parseJsonLoose, userPrompt } from "./prompt.js";
import type { ExtractionInput, ExtractionProvider, ProviderResult } from "./types.js";

/** Claude reads the PDF natively, so layout and scanned pages are covered too. */
export class AnthropicProvider implements ExtractionProvider {
  readonly name = "anthropic";
  private client: Anthropic;

  constructor(
    apiKey: string,
    private model = process.env.ANTHROPIC_MODEL ?? "claude-sonnet-4-5",
  ) {
    this.client = new Anthropic({ apiKey });
  }

  async extract({ pages, pdf }: ExtractionInput): Promise<ProviderResult> {
    const res = await this.client.messages.create({
      model: this.model,
      max_tokens: 4096,
      temperature: 0,
      system: SYSTEM_PROMPT,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "document",
              source: {
                type: "base64",
                media_type: "application/pdf",
                data: Buffer.from(pdf).toString("base64"),
              },
            },
            { type: "text", text: userPrompt(pages) },
          ],
        },
      ],
    });
    const text = res.content
      .map((b) => (b.type === "text" ? b.text : ""))
      .join("");
    return { raw: parseJsonLoose(text), model: this.model };
  }
}
