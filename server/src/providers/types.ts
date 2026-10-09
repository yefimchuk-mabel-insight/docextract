export interface ExtractionInput {
  /** Text rebuilt from the PDF, one string per page. */
  pages: string[];
  /** Original file, for providers that read PDFs natively (scans, complex layouts). */
  pdf: Uint8Array;
}

export interface ProviderResult {
  /** Raw model output before schema validation. Untrusted. */
  raw: unknown;
  model: string;
}

/**
 * One interface for every model vendor, so the pipeline, validation and UI
 * don't care which LLM is behind it. Swapping vendors is a config change.
 */
export interface ExtractionProvider {
  readonly name: string;
  extract(input: ExtractionInput): Promise<ProviderResult>;
}
