import { GoogleGenAI } from "@google/genai";
import { SYSTEM_PROMPT, parseJsonLoose, userPrompt } from "./prompt.js";
import type { ExtractionInput, ExtractionProvider, ProviderResult } from "./types.js";

/** Gemini (also available through Vertex AI) reads the PDF natively. */
export class GeminiProvider implements ExtractionProvider {
  readonly name = "gemini";
  private client: GoogleGenAI;

  constructor(
    apiKey: string,
    private model = process.env.GEMINI_MODEL ?? "gemini-2.5-flash",
  ) {
    this.client = new GoogleGenAI({ apiKey });
  }

  async extract({ pages, pdf }: ExtractionInput): Promise<ProviderResult> {
    const res = await this.client.models.generateContent({
      model: this.model,
      contents: [
        {
          role: "user",
          parts: [
            { inlineData: { mimeType: "application/pdf", data: Buffer.from(pdf).toString("base64") } },
            { text: userPrompt(pages) },
          ],
        },
      ],
      config: {
        systemInstruction: SYSTEM_PROMPT,
        temperature: 0,
        responseMimeType: "application/json",
      },
    });
    return { raw: parseJsonLoose(res.text ?? ""), model: this.model };
  }
}
