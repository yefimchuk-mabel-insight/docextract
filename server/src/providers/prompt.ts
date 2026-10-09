import { invoiceJsonSchema } from "../schema.js";

export const SYSTEM_PROMPT = `You extract structured data from invoices.

Rules:
- Return ONLY JSON that matches the provided JSON Schema. No prose, no markdown.
- Copy values exactly as printed. Never invent or "fix" numbers; if totals look wrong, still return what the document says.
- Use null for anything that is not present in the document.
- Dates as YYYY-MM-DD. Currency as an ISO 4217 code (e.g. "EUR", "USD", "GBP").
- Numbers as plain JSON numbers without currency symbols or thousands separators.
- taxRate is a percentage number (21 means 21%).`;

export const SCHEMA_TEXT = JSON.stringify(invoiceJsonSchema);

export function userPrompt(pages: string[]): string {
  const body = pages.map((p, i) => `--- Page ${i + 1} ---\n${p}`).join("\n\n");
  return `JSON Schema:\n${SCHEMA_TEXT}\n\nDocument text:\n${body}`;
}

/** Models sometimes wrap JSON in ``` fences despite instructions. */
export function parseJsonLoose(text: string): unknown {
  const trimmed = text.trim().replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/, "");
  return JSON.parse(trimmed);
}
