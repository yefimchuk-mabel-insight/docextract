import type { ExtractionInput, ExtractionProvider, ProviderResult } from "./types.js";

/**
 * Offline, rule-based extractor so the demo runs with zero API keys.
 * It understands common invoice labels. It is NOT meant to compete with an
 * LLM on messy real-world layouts; it exists so anyone can clone the repo,
 * run it, and see the full pipeline (validation + review) end to end.
 */
export class HeuristicProvider implements ExtractionProvider {
  readonly name = "demo";

  async extract({ pages }: ExtractionInput): Promise<ProviderResult> {
    const text = pages.join("\n");
    // pdf-text joins glyph runs with two spaces, so each line splits into "cells".
    const rows = text
      .split("\n")
      .map((l) => l.split(/\s{2,}/).map((c) => c.trim()).filter(Boolean))
      .filter((r) => r.length > 0);

    const field = (...labels: string[]) => {
      for (const label of labels) {
        const re = new RegExp(`^${label}\\s*[:#]?\\s*(.*)$`, "i");
        for (const cells of rows) {
          for (let i = 0; i < cells.length; i++) {
            const m = cells[i]!.match(re);
            if (!m) continue;
            const value = m[1]?.trim() || cells[i + 1];
            if (value) return value;
          }
        }
      }
      return null;
    };

    const firstCell = (re: RegExp) => rows.find((r) => re.test(r[0] ?? ""));
    const taxRow = firstCell(/^(VAT|Tax|IVA)\b.*%/i);
    const totalRow = firstCell(/^(Total|Amount due|Grand total)\b/i);

    return {
      model: "rule-based (no API key)",
      raw: {
        vendorName: rows[0]?.[0] ?? null,
        vendorVatId: field("VAT ID", "VAT No", "Tax ID", "NIF", "CIF"),
        customerName: field("Bill to", "Billed to", "Customer"),
        invoiceNumber: field("Invoice No", "Invoice number", "Invoice #"),
        issueDate: toIsoDate(field("Issue date", "Invoice date", "Date")),
        dueDate: toIsoDate(field("Due date", "Payment due")),
        currency: detectCurrency(text),
        lineItems: parseLineItems(rows),
        subtotal: toNumber(field("Subtotal", "Net total")),
        taxRate: toNumber(taxRow?.[0]?.match(/(\d+(?:[.,]\d+)?)\s*%/)?.[1]),
        taxAmount: toNumber(taxRow?.at(-1)),
        total: toNumber(totalRow?.at(-1)),
      },
    };
  }
}

const MONTHS: Record<string, string> = {
  jan: "01", feb: "02", mar: "03", apr: "04", may: "05", jun: "06",
  jul: "07", aug: "08", sep: "09", oct: "10", nov: "11", dec: "12",
};

export function toIsoDate(s: string | null): string | null {
  if (!s) return null;
  let m = s.match(/(\d{4})-(\d{2})-(\d{2})/);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  m = s.match(/(\d{1,2})\s+([A-Za-z]{3})[a-z]*\.?\s+(\d{4})/);
  if (m && MONTHS[m[2]!.toLowerCase()]) return `${m[3]}-${MONTHS[m[2]!.toLowerCase()]}-${m[1]!.padStart(2, "0")}`;
  m = s.match(/(\d{1,2})[/.](\d{1,2})[/.](\d{4})/); // European day-first
  if (m) return `${m[3]}-${m[2]!.padStart(2, "0")}-${m[1]!.padStart(2, "0")}`;
  return s; // leave as-is; validation will flag it
}

export function toNumber(s: string | null | undefined): number | null {
  if (!s) return null;
  const cleaned = s.replace(/[^\d.,-]/g, "");
  if (!cleaned) return null;
  // "1.234,56" (EU) vs "1,234.56" (UK/US)
  const normalized =
    cleaned.lastIndexOf(",") > cleaned.lastIndexOf(".")
      ? cleaned.replace(/\./g, "").replace(",", ".")
      : cleaned.replace(/,/g, "");
  const n = Number(normalized);
  return Number.isFinite(n) ? n : null;
}

const isNumeric = (c: string) => /^-?[\d.,]+$/.test(c);

function detectCurrency(text: string): string | null {
  const code = text.match(/\b(EUR|USD|GBP|CHF|PLN|UAH)\b/);
  if (code) return code[1]!;
  if (text.includes("€")) return "EUR";
  if (text.includes("£")) return "GBP";
  if (text.includes("$")) return "USD";
  return null;
}

/** Rows between the table header ("Description ... Amount") and the totals block. */
function parseLineItems(rows: string[][]) {
  const start = rows.findIndex((r) => /description/i.test(r[0] ?? "") && r.some((c) => /amount|total/i.test(c)));
  if (start < 0) return [];
  const items = [];
  for (const cells of rows.slice(start + 1)) {
    if (/^(subtotal|net|total|vat|tax)\b/i.test(cells[0] ?? "")) break;
    if (cells.length < 4) continue;
    const last3 = cells.slice(-3);
    if (!last3.every(isNumeric)) continue;
    const [qty, unit, amount] = last3.map((n) => toNumber(n) ?? 0);
    items.push({ description: cells.slice(0, -3).join(" "), quantity: qty!, unitPrice: unit!, amount: amount! });
  }
  return items;
}
