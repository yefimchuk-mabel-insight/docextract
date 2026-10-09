import type { Invoice } from "../schema.js";

export type Severity = "error" | "warning";

export interface Issue {
  /** Field path the issue belongs to, e.g. "total" or "lineItems[2].amount". */
  field: string;
  severity: Severity;
  message: string;
}

/** Money comparisons tolerate rounding to the cent. */
const CENT = 0.01;
const money = (n: number) => Math.round(n * 100) / 100;
const close = (a: number, b: number) => Math.abs(a - b) <= CENT + 1e-9;

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const isValidIsoDate = (s: string) => {
  if (!ISO_DATE.test(s)) return false;
  const d = new Date(`${s}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().startsWith(s);
};

/**
 * Business-rule validation that runs after schema validation.
 *
 * The point: an LLM can return perfectly well-formed JSON that is still wrong.
 * These checks catch the mistakes that matter in accounting (totals that don't
 * add up, impossible dates, missing identifiers) so a human reviews them
 * instead of bad data being saved silently.
 */
export function validateInvoice(inv: Invoice): Issue[] {
  const issues: Issue[] = [];
  const add = (field: string, severity: Severity, message: string) =>
    issues.push({ field, severity, message });

  // Required identifiers
  if (!inv.vendorName) add("vendorName", "error", "Vendor name is missing.");
  if (!inv.invoiceNumber) add("invoiceNumber", "error", "Invoice number is missing.");
  if (!inv.total && inv.total !== 0) add("total", "error", "Total is missing.");
  if (!inv.currency) add("currency", "warning", "Currency not detected.");
  else if (!/^[A-Z]{3}$/.test(inv.currency))
    add("currency", "warning", `"${inv.currency}" is not an ISO 4217 code.`);

  // Dates
  for (const f of ["issueDate", "dueDate"] as const) {
    const v = inv[f];
    if (v && !isValidIsoDate(v)) add(f, "error", `"${v}" is not a valid YYYY-MM-DD date.`);
  }
  if (!inv.issueDate) add("issueDate", "warning", "Issue date not detected.");
  if (inv.issueDate && inv.dueDate && isValidIsoDate(inv.issueDate) && isValidIsoDate(inv.dueDate)) {
    if (inv.dueDate < inv.issueDate) add("dueDate", "error", "Due date is before the issue date.");
  }

  // Line items: quantity × unit price = amount
  inv.lineItems.forEach((li, i) => {
    const expected = money(li.quantity * li.unitPrice);
    if (!close(expected, li.amount)) {
      add(
        `lineItems[${i}].amount`,
        "error",
        `${li.quantity} × ${li.unitPrice} = ${expected}, but the amount says ${li.amount}.`,
      );
    }
  });

  // Sum of lines = subtotal
  if (inv.lineItems.length > 0 && inv.subtotal != null) {
    const sum = money(inv.lineItems.reduce((s, li) => s + li.amount, 0));
    if (!close(sum, inv.subtotal)) {
      add("subtotal", "error", `Line items add up to ${sum}, but the subtotal says ${inv.subtotal}.`);
    }
  }

  // Tax rate × subtotal = tax amount
  if (inv.subtotal != null && inv.taxRate != null && inv.taxAmount != null) {
    const expected = money((inv.subtotal * inv.taxRate) / 100);
    if (!close(expected, inv.taxAmount)) {
      add("taxAmount", "warning", `${inv.taxRate}% of ${inv.subtotal} is ${expected}, but tax says ${inv.taxAmount}.`);
    }
  }

  // Subtotal + tax = total
  if (inv.subtotal != null && inv.total != null) {
    const expected = money(inv.subtotal + (inv.taxAmount ?? 0));
    if (!close(expected, inv.total)) {
      add("total", "error", `Subtotal + tax = ${expected}, but the total says ${inv.total}.`);
    }
  }

  return issues;
}
