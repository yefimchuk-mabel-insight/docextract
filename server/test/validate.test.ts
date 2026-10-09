import { describe, expect, it } from "vitest";
import { validateInvoice } from "../src/pipeline/validate.js";
import type { Invoice } from "../src/schema.js";

const good: Invoice = {
  vendorName: "Acme",
  vendorVatId: "ESB12345674",
  customerName: "Client",
  invoiceNumber: "A-1",
  issueDate: "2026-09-01",
  dueDate: "2026-09-30",
  currency: "EUR",
  lineItems: [
    { description: "Work", quantity: 2, unitPrice: 50, amount: 100 },
    { description: "More work", quantity: 1, unitPrice: 0.1, amount: 0.1 },
  ],
  subtotal: 100.1,
  taxRate: 21,
  taxAmount: 21.02,
  total: 121.12,
};

const fields = (inv: Invoice) => validateInvoice(inv).map((i) => `${i.severity}:${i.field}`);

describe("validateInvoice", () => {
  it("accepts a consistent invoice (with cent rounding)", () => {
    expect(validateInvoice(good)).toEqual([]);
  });

  it("flags a line where qty × unit price ≠ amount", () => {
    const inv = { ...good, lineItems: [{ description: "x", quantity: 2, unitPrice: 50, amount: 110 }], subtotal: 110, taxAmount: 23.1, total: 133.1 };
    expect(fields(inv)).toContain("error:lineItems[0].amount");
  });

  it("flags subtotal and total mismatches", () => {
    expect(fields({ ...good, subtotal: 99 })).toEqual(expect.arrayContaining(["error:subtotal"]));
    expect(fields({ ...good, total: 999 })).toEqual(["error:total"]);
  });

  it("flags impossible and inverted dates", () => {
    expect(fields({ ...good, issueDate: "2026-02-30" })).toContain("error:issueDate");
    expect(fields({ ...good, dueDate: "2026-08-01" })).toContain("error:dueDate");
  });

  it("requires identifiers and warns on odd currency", () => {
    const f = fields({ ...good, vendorName: null, invoiceNumber: null, currency: "€" });
    expect(f).toEqual(expect.arrayContaining(["error:vendorName", "error:invoiceNumber", "warning:currency"]));
  });

  it("treats tax rounding differences as a warning, not an error", () => {
    expect(fields({ ...good, taxAmount: 21.5, total: 121.6 })).toEqual(["warning:taxAmount"]);
  });
});
