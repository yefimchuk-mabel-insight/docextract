import type { Invoice } from "../schema.js";

const esc = (v: unknown) => {
  const s = v == null ? "" : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

/** One row per line item, invoice header fields repeated: easy to load into a spreadsheet or ERP. */
export function toCsv(inv: Invoice): string {
  const header = [
    "invoiceNumber", "vendorName", "vendorVatId", "customerName", "issueDate", "dueDate", "currency",
    "lineDescription", "quantity", "unitPrice", "lineAmount", "subtotal", "taxRate", "taxAmount", "total",
  ];
  const head = [inv.invoiceNumber, inv.vendorName, inv.vendorVatId, inv.customerName, inv.issueDate, inv.dueDate, inv.currency];
  const tail = [inv.subtotal, inv.taxRate, inv.taxAmount, inv.total];
  const rows = (inv.lineItems.length ? inv.lineItems : [null]).map((li) =>
    [...head, li?.description, li?.quantity, li?.unitPrice, li?.amount, ...tail].map(esc).join(","),
  );
  return [header.join(","), ...rows].join("\n") + "\n";
}
