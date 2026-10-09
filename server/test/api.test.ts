import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { buildApp } from "../src/app.js";
import { HeuristicProvider } from "../src/providers/heuristic.js";
import type { ExtractionProvider } from "../src/providers/types.js";

const samplesDir = join(import.meta.dirname, "..", "..", "samples");

function multipart(fileName: string, body: Buffer) {
  const boundary = "----docextract";
  const payload = Buffer.concat([
    Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="${fileName}"\r\nContent-Type: application/pdf\r\n\r\n`),
    body,
    Buffer.from(`\r\n--${boundary}--\r\n`),
  ]);
  return { payload, headers: { "content-type": `multipart/form-data; boundary=${boundary}` } };
}

describe("API (end to end with the offline extractor)", () => {
  let app: Awaited<ReturnType<typeof buildApp>>;
  beforeAll(async () => {
    app = await buildApp({ provider: new HeuristicProvider(), samplesDir });
  });
  afterAll(() => app.close());

  it("extracts a clean invoice and marks it ready", async () => {
    const res = await app.inject({ method: "POST", url: "/api/extract?sample=01-clean-invoice.pdf" });
    expect(res.statusCode).toBe(200);
    const doc = res.json();
    expect(doc.status).toBe("ready");
    expect(doc.data).toMatchObject({
      vendorName: "Northwind Cloud Services S.L.",
      invoiceNumber: "NW-2026-0142",
      customerName: "Brightleaf Analytics Ltd",
      issueDate: "2026-09-14",
      currency: "EUR",
      subtotal: 1241,
      taxRate: 21,
      taxAmount: 260.61,
      total: 1501.61,
    });
    expect(doc.data.lineItems).toHaveLength(3);
    expect(doc.data.lineItems[1].description).toBe("Object storage, 2 TB");
  });

  it("routes an invoice with bad arithmetic to review, then lets a human fix and approve it", async () => {
    const doc = (await app.inject({ method: "POST", url: "/api/extract?sample=02-totals-mismatch.pdf" })).json();
    expect(doc.status).toBe("needs_review");
    expect(doc.issues.map((i: { field: string }) => i.field)).toEqual(["lineItems[2].amount", "total"]);

    // Approval is blocked while errors remain.
    expect((await app.inject({ method: "POST", url: `/api/documents/${doc.id}/approve` })).statusCode).toBe(422);

    // Reviewer corrects the line and the totals.
    const fixed = structuredClone(doc.data);
    fixed.lineItems[2].amount = 960;
    fixed.subtotal = 3210;
    fixed.taxAmount = 642;
    fixed.total = 3852;
    const saved = (await app.inject({ method: "PUT", url: `/api/documents/${doc.id}`, payload: fixed })).json();
    expect(saved.issues).toEqual([]);
    expect(saved.status).toBe("ready");

    const approved = (await app.inject({ method: "POST", url: `/api/documents/${doc.id}/approve` })).json();
    expect(approved.status).toBe("approved");

    const csv = await app.inject({ method: "GET", url: `/api/documents/${doc.id}/export.csv` });
    expect(csv.headers["content-type"]).toContain("text/csv");
    expect(csv.body.trim().split("\n")).toHaveLength(4); // header + 3 lines
  });

  it("accepts an uploaded PDF and rejects non-PDF files", async () => {
    const pdf = readFileSync(join(samplesDir, "03-us-consulting.pdf"));
    const ok = await app.inject({ method: "POST", url: "/api/extract", ...multipart("inv.pdf", pdf) });
    expect(ok.json().data.total).toBe(6000);

    const bad = await app.inject({ method: "POST", url: "/api/extract", ...multipart("x.pdf", Buffer.from("hello")) });
    expect(bad.statusCode).toBe(415);
  });

  it("does not allow path traversal on samples", async () => {
    const res = await app.inject({ method: "GET", url: "/api/samples/..%2Fpackage.json" });
    expect(res.statusCode).toBe(404);
  });

  it("reports a failed extraction instead of crashing when the model returns junk", async () => {
    const junk: ExtractionProvider = { name: "junk", extract: async () => ({ raw: { total: "lots" }, model: "junk" }) };
    const junkApp = await buildApp({ provider: junk, samplesDir });
    const doc = (await junkApp.inject({ method: "POST", url: "/api/extract?sample=01-clean-invoice.pdf" })).json();
    expect(doc.status).toBe("failed");
    expect(doc.data).toBeNull();
    expect(doc.issues.length).toBeGreaterThan(0);
    await junkApp.close();
  });
});
