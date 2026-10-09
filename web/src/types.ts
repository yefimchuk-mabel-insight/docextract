// Mirrors server/src/schema.ts and pipeline types. Kept small on purpose.
export interface LineItem {
  description: string;
  quantity: number;
  unitPrice: number;
  amount: number;
}

export interface Invoice {
  vendorName: string | null;
  vendorVatId: string | null;
  customerName: string | null;
  invoiceNumber: string | null;
  issueDate: string | null;
  dueDate: string | null;
  currency: string | null;
  lineItems: LineItem[];
  subtotal: number | null;
  taxRate: number | null;
  taxAmount: number | null;
  total: number | null;
}

export interface Issue {
  field: string;
  severity: "error" | "warning";
  message: string;
}

export type DocumentStatus = "needs_review" | "ready" | "approved" | "failed";

export interface ExtractedDocument {
  id: string;
  fileName: string;
  status: DocumentStatus;
  provider: string;
  model: string;
  pageCount: number;
  durationMs: number;
  data: Invoice | null;
  issues: Issue[];
  createdAt: string;
  approvedAt?: string;
}

export interface Sample {
  name: string;
  url: string;
}
