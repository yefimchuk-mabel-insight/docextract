import { existsSync } from "node:fs";
import { readFile, readdir } from "node:fs/promises";
import { basename, join, resolve } from "node:path";
import multipart from "@fastify/multipart";
import fastifyStatic from "@fastify/static";
import Fastify from "fastify";
import { runExtraction, statusFor } from "./pipeline/extract.js";
import { toCsv } from "./pipeline/export.js";
import { validateInvoice } from "./pipeline/validate.js";
import type { ExtractionProvider } from "./providers/types.js";
import { InvoiceSchema } from "./schema.js";
import { DocumentStore } from "./store.js";

const MAX_PDF_BYTES = 10 * 1024 * 1024;

export interface AppOptions {
  provider: ExtractionProvider;
  samplesDir: string;
  /** Built React app to serve in production. Optional in dev/tests. */
  webDir?: string;
  logger?: boolean;
}

export async function buildApp({ provider, samplesDir, webDir, logger = false }: AppOptions) {
  const app = Fastify({ logger });
  const store = new DocumentStore();

  await app.register(multipart, { limits: { fileSize: MAX_PDF_BYTES, files: 1 } });

  app.get("/api/health", async () => ({ ok: true, provider: provider.name }));

  // Sample invoices so visitors can try the demo without their own files.
  app.get("/api/samples", async () => {
    const files = (await readdir(samplesDir)).filter((f) => f.endsWith(".pdf")).sort();
    return files.map((name) => ({ name, url: `/api/samples/${encodeURIComponent(name)}` }));
  });

  app.get<{ Params: { name: string } }>("/api/samples/:name", async (req, reply) => {
    const name = basename(req.params.name); // no path traversal
    const path = join(samplesDir, name);
    if (!name.endsWith(".pdf") || !existsSync(path)) return reply.code(404).send({ error: "Not found" });
    return reply.type("application/pdf").send(await readFile(path));
  });

  app.post<{ Querystring: { sample?: string } }>("/api/extract", async (req, reply) => {
    let fileName: string;
    let pdf: Uint8Array;

    if (req.query.sample) {
      fileName = basename(req.query.sample);
      const path = join(samplesDir, fileName);
      if (!existsSync(path)) return reply.code(404).send({ error: "Sample not found" });
      pdf = new Uint8Array(await readFile(path));
    } else {
      const file = await req.file();
      if (!file) return reply.code(400).send({ error: "Upload a PDF in the 'file' field." });
      const buf = await file.toBuffer();
      if (file.file.truncated) return reply.code(413).send({ error: "PDF is larger than 10 MB." });
      if (buf.subarray(0, 5).toString() !== "%PDF-") return reply.code(415).send({ error: "That file is not a PDF." });
      fileName = file.filename;
      pdf = new Uint8Array(buf);
    }

    const doc = await runExtraction(provider, fileName, pdf);
    return store.save(doc);
  });

  app.get<{ Params: { id: string } }>("/api/documents/:id", async (req, reply) => {
    const doc = store.get(req.params.id);
    return doc ?? reply.code(404).send({ error: "Not found" });
  });

  // Reviewer edits: re-validate on every save so the UI always shows current issues.
  app.put<{ Params: { id: string }; Body: unknown }>("/api/documents/:id", async (req, reply) => {
    const doc = store.get(req.params.id);
    if (!doc) return reply.code(404).send({ error: "Not found" });
    if (doc.status === "approved") return reply.code(409).send({ error: "Document is already approved." });
    const parsed = InvoiceSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: "Invalid invoice data", details: parsed.error.issues });
    const issues = validateInvoice(parsed.data);
    return store.save({ ...doc, data: parsed.data, issues, status: statusFor(issues) });
  });

  app.post<{ Params: { id: string } }>("/api/documents/:id/approve", async (req, reply) => {
    const doc = store.get(req.params.id);
    if (!doc?.data) return reply.code(404).send({ error: "Not found" });
    if (doc.issues.some((i) => i.severity === "error")) {
      return reply.code(422).send({ error: "Resolve all errors before approving.", issues: doc.issues });
    }
    return store.save({ ...doc, status: "approved", approvedAt: new Date().toISOString() });
  });

  app.get<{ Params: { id: string; format: string } }>("/api/documents/:id/export.:format", async (req, reply) => {
    const doc = store.get(req.params.id);
    if (!doc?.data) return reply.code(404).send({ error: "Not found" });
    const name = (doc.data.invoiceNumber ?? doc.id).replace(/[^\w.-]/g, "_");
    if (req.params.format === "csv") {
      return reply
        .type("text/csv")
        .header("content-disposition", `attachment; filename="${name}.csv"`)
        .send(toCsv(doc.data));
    }
    if (req.params.format === "json") {
      return reply
        .header("content-disposition", `attachment; filename="${name}.json"`)
        .send(doc.data);
    }
    return reply.code(400).send({ error: "Use .json or .csv" });
  });

  if (webDir && existsSync(webDir)) {
    await app.register(fastifyStatic, { root: resolve(webDir) });
    app.setNotFoundHandler((req, reply) =>
      req.url.startsWith("/api/") ? reply.code(404).send({ error: "Not found" }) : reply.sendFile("index.html"),
    );
  }

  return app;
}
