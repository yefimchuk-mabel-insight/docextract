import { z } from "zod";

/**
 * The target shape for an extracted invoice.
 * Every LLM provider must return data that parses against this schema;
 * anything that doesn't is rejected before it reaches the review screen.
 */
export const LineItemSchema = z.object({
  description: z.string().min(1),
  quantity: z.number().nonnegative(),
  unitPrice: z.number(),
  amount: z.number(),
});

export const InvoiceSchema = z.object({
  vendorName: z.string().nullable(),
  vendorVatId: z.string().nullable(),
  customerName: z.string().nullable(),
  invoiceNumber: z.string().nullable(),
  issueDate: z.string().nullable().describe("ISO 8601 date, YYYY-MM-DD"),
  dueDate: z.string().nullable().describe("ISO 8601 date, YYYY-MM-DD"),
  currency: z.string().nullable().describe("ISO 4217 code, e.g. EUR"),
  lineItems: z.array(LineItemSchema),
  subtotal: z.number().nullable(),
  taxRate: z.number().nullable().describe("Percent, e.g. 21 for 21%"),
  taxAmount: z.number().nullable(),
  total: z.number().nullable(),
});

export type LineItem = z.infer<typeof LineItemSchema>;
export type Invoice = z.infer<typeof InvoiceSchema>;

/** Scalar fields shown and editable in the review UI, in display order. */
export const SCALAR_FIELDS = [
  "vendorName",
  "vendorVatId",
  "customerName",
  "invoiceNumber",
  "issueDate",
  "dueDate",
  "currency",
  "subtotal",
  "taxRate",
  "taxAmount",
  "total",
] as const satisfies readonly (keyof Invoice)[];

export type ScalarField = (typeof SCALAR_FIELDS)[number];

/** JSON Schema handed to LLMs that support structured output. */
export const invoiceJsonSchema = z.toJSONSchema(InvoiceSchema);
