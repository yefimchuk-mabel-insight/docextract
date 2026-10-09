import type { ExtractedDocument } from "./pipeline/extract.js";

/**
 * In-memory store. Deliberately simple for the demo; in production this is a
 * PostgreSQL table (documents + extraction_versions for the audit trail).
 */
export class DocumentStore {
  private docs = new Map<string, ExtractedDocument>();
  private readonly limit: number;

  constructor(limit = 200) {
    this.limit = limit;
  }

  save(doc: ExtractedDocument) {
    this.docs.set(doc.id, doc);
    // Keep memory bounded on a public demo.
    while (this.docs.size > this.limit) {
      const oldest = this.docs.keys().next().value;
      if (oldest === undefined) break;
      this.docs.delete(oldest);
    }
    return doc;
  }

  get(id: string) {
    return this.docs.get(id);
  }
}
