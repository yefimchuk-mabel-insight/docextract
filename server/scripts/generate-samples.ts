/**
 * Generates fictional sample invoices for the demo and tests.
 * All companies, people and numbers are made up.
 *
 *   npm run samples
 */
import { createWriteStream, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import PDFDocument from "pdfkit";

interface Sample {
  file: string;
  vendor: string;
  vendorAddress: string;
  vatId: string;
  invoiceNo: string;
  issueDate: string;
  dueDate: string;
  billTo: string;
  currency: "EUR" | "GBP" | "USD";
  symbol: string;
  taxLabel: string;
  taxRate: number;
  items: { description: string; qty: number; unit: number; amountOverride?: number }[];
  totalOverride?: number;
}

const samples: Sample[] = [
  {
    file: "01-clean-invoice.pdf",
    vendor: "Northwind Cloud Services S.L.",
    vendorAddress: "Carrer de la Marina 12, 08005 Barcelona, Spain",
    vatId: "ESB12345674",
    invoiceNo: "NW-2026-0142",
    issueDate: "14 Sep 2026",
    dueDate: "14 Oct 2026",
    billTo: "Brightleaf Analytics Ltd",
    currency: "EUR",
    symbol: "€",
    taxLabel: "VAT",
    taxRate: 21,
    items: [
      { description: "Managed Kubernetes cluster (Sep)", qty: 1, unit: 640 },
      { description: "Object storage, 2 TB", qty: 2, unit: 45.5 },
      { description: "Support hours", qty: 6, unit: 85 },
    ],
  },
  {
    file: "02-totals-mismatch.pdf",
    vendor: "Harbour & Finch Design Studio",
    vendorAddress: "14 Quay Street, Bristol BS1 4DB, United Kingdom",
    vatId: "GB123456789",
    invoiceNo: "HF-1088",
    issueDate: "2026-09-02",
    dueDate: "2026-09-30",
    billTo: "Oakridge Property Group",
    currency: "GBP",
    symbol: "£",
    taxLabel: "VAT",
    taxRate: 20,
    items: [
      { description: "Brand identity workshop", qty: 1, unit: 1200 },
      { description: "Logo concepts", qty: 3, unit: 350 },
      { description: "Print-ready brochure layout", qty: 2, unit: 480, amountOverride: 980 },
    ],
    // The vendor's own arithmetic is off: exactly the kind of thing validation should catch.
    totalOverride: 4026,
  },
  {
    file: "03-us-consulting.pdf",
    vendor: "Lumen Ridge Consulting LLC",
    vendorAddress: "500 Market Street, Suite 210, Denver, CO 80202, USA",
    vatId: "EIN 84-1234567",
    invoiceNo: "LRC-2026-031",
    issueDate: "10 September 2026",
    dueDate: "10 October 2026",
    billTo: "Cascade Health Partners",
    currency: "USD",
    symbol: "$",
    taxLabel: "Tax",
    taxRate: 0,
    items: [
      { description: "Data migration assessment", qty: 12, unit: 150 },
      { description: "Pipeline implementation", qty: 30, unit: 140 },
    ],
  },
];

const fmt = (n: number) => n.toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

function render(s: Sample, outDir: string) {
  const doc = new PDFDocument({ size: "A4", margin: 50, info: { Title: `Invoice ${s.invoiceNo}`, Author: s.vendor } });
  doc.pipe(createWriteStream(join(outDir, s.file)));

  const rows = s.items.map((i) => ({ ...i, amount: i.amountOverride ?? Math.round(i.qty * i.unit * 100) / 100 }));
  const subtotal = Math.round(rows.reduce((a, r) => a + r.amount, 0) * 100) / 100;
  const tax = Math.round(subtotal * s.taxRate) / 100;
  const total = s.totalOverride ?? Math.round((subtotal + tax) * 100) / 100;

  doc.font("Helvetica-Bold").fontSize(18).fillColor("#111827").text(s.vendor, 50, 50);
  doc.font("Helvetica").fontSize(9).fillColor("#4b5563").text(s.vendorAddress, 50, 74);
  doc.text(`VAT ID: ${s.vatId}`, 50, 88);

  doc.font("Helvetica-Bold").fontSize(26).fillColor("#2563eb").text("INVOICE", 380, 50, { width: 165, align: "right" });

  doc.fontSize(10).fillColor("#111827");
  const meta: [string, string][] = [
    ["Invoice No:", s.invoiceNo],
    ["Issue date:", s.issueDate],
    ["Due date:", s.dueDate],
  ];
  meta.forEach(([k, v], i) => {
    doc.font("Helvetica-Bold").text(k, 50, 130 + i * 16);
    doc.font("Helvetica").text(v, 130, 130 + i * 16);
  });
  doc.font("Helvetica-Bold").text("Bill to:", 330, 130);
  doc.font("Helvetica").text(s.billTo, 380, 130);

  // Table
  let y = 210;
  doc.rect(50, y - 6, 495, 22).fill("#f3f4f6");
  doc.fillColor("#111827").font("Helvetica-Bold").fontSize(10);
  doc.text("Description", 58, y);
  doc.text("Qty", 330, y, { width: 40, align: "right" });
  doc.text("Unit price", 380, y, { width: 75, align: "right" });
  doc.text("Amount", 465, y, { width: 75, align: "right" });
  doc.font("Helvetica");
  for (const r of rows) {
    y += 26;
    doc.text(r.description, 58, y, { width: 260 });
    doc.text(String(r.qty), 330, y, { width: 40, align: "right" });
    doc.text(fmt(r.unit), 380, y, { width: 75, align: "right" });
    doc.text(fmt(r.amount), 465, y, { width: 75, align: "right" });
  }
  y += 24;
  doc.moveTo(50, y).lineTo(545, y).strokeColor("#e5e7eb").stroke();

  const totals: [string, string, boolean][] = [
    ["Subtotal", fmt(subtotal), false],
    [`${s.taxLabel} (${s.taxRate}%)`, fmt(tax), false],
    ["Total", `${s.currency} ${fmt(total)}`, true],
  ];
  totals.forEach(([k, v, bold], i) => {
    const ty = y + 14 + i * 20;
    doc.font(bold ? "Helvetica-Bold" : "Helvetica").fontSize(bold ? 12 : 10);
    doc.text(k, 330, ty, { width: 120 });
    doc.text(v, 430, ty, { width: 110, align: "right" });
  });

  doc.font("Helvetica").fontSize(8).fillColor("#9ca3af")
    .text(`Fictional sample document generated for the docextract demo. Payment in ${s.symbol} within terms.`, 50, 770, {
      width: 495,
      align: "center",
    });
  doc.end();
}

const outDir = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "samples");
mkdirSync(outDir, { recursive: true });
samples.forEach((s) => render(s, outDir));
console.log(`Wrote ${samples.length} samples to ${outDir}`);
