import { randomUUID } from "node:crypto";
import { InvoiceSchema, type Invoice } from "../schema.js";
import type { ExtractionProvider } from "../providers/types.js";
import { extractPdfText } from "./pdf-text.js";
import { validateInvoice, type Issue } from "./validate.js";

export type DocumentStatus = "needs_review" | "ready" | "approved" | "failed";

export interface ExtractedDocument {
  id: string;
  fileName: string;
  status: DocumentStatus;
  provider: string;
  model: string;
  pageCount: number;
  durationMs: number;
  /** null when the model output could not be parsed into the schema at all. */
  data: Invoice | null;
  issues: Issue[];
  createdAt: string;
  approvedAt?: string;
}

/** Errors (not warnings) block automatic acceptance and route to a human. */
export function statusFor(issues: Issue[]): DocumentStatus {
  return issues.some((i) => i.severity === "error") ? "needs_review" : "ready";
}

/**
 * The whole pipeline in one place:
 * PDF -> text layer -> LLM -> schema validation -> business rules -> status.
 */
export async function runExtraction(
  provider: ExtractionProvider,
  fileName: string,
  pdf: Uint8Array,
): Promise<ExtractedDocument> {
  const started = performance.now();
  // pdf.js may transfer (detach) the buffer it is given, so hand it a copy.
  const { pages, pageCount } = await extractPdfText(pdf.slice());
  const base = {
    id: randomUUID(),
    fileName,
    provider: provider.name,
    pageCount,
    createdAt: new Date().toISOString(),
  };

  let raw: unknown;
  let model = "unknown";
  try {
    ({ raw, model } = await provider.extract({ pages, pdf }));
  } catch (err) {
    return {
      ...base,
      model,
      status: "failed",
      durationMs: Math.round(performance.now() - started),
      data: null,
      issues: [{ field: "document", severity: "error", message: `Extraction failed: ${(err as Error).message}` }],
    };
  }

  const parsed = InvoiceSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      ...base,
      model,
      status: "failed",
      durationMs: Math.round(performance.now() - started),
      data: null,
      issues: parsed.error.issues.map((i) => ({
        field: i.path.join(".") || "document",
        severity: "error" as const,
        message: `Model output does not match the schema: ${i.message}`,
      })),
    };
  }

  const issues = validateInvoice(parsed.data);
  return {
    ...base,
    model,
    status: statusFor(issues),
    durationMs: Math.round(performance.now() - started),
    data: parsed.data,
    issues,
  };
}
