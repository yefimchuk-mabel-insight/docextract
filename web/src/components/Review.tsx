import { useEffect, useRef, useState } from "react";
import { api } from "../api";
import { PdfView } from "./PdfView";
import type { ExtractedDocument, Invoice, Issue, LineItem } from "../types";

type ScalarKey = Exclude<keyof Invoice, "lineItems">;

const FIELDS: { key: ScalarKey; label: string; kind: "text" | "number" | "date" }[] = [
  { key: "vendorName", label: "Vendor", kind: "text" },
  { key: "vendorVatId", label: "Vendor VAT / tax ID", kind: "text" },
  { key: "customerName", label: "Bill to", kind: "text" },
  { key: "invoiceNumber", label: "Invoice number", kind: "text" },
  { key: "issueDate", label: "Issue date", kind: "date" },
  { key: "dueDate", label: "Due date", kind: "date" },
  { key: "currency", label: "Currency", kind: "text" },
];

const TOTALS: { key: ScalarKey; label: string }[] = [
  { key: "subtotal", label: "Subtotal" },
  { key: "taxRate", label: "Tax rate %" },
  { key: "taxAmount", label: "Tax" },
  { key: "total", label: "Total" },
];

const STATUS_LABEL: Record<ExtractedDocument["status"], string> = {
  needs_review: "Needs review",
  ready: "Ready to approve",
  approved: "Approved",
  failed: "Extraction failed",
};

const toNum = (s: string): number | null => {
  if (s.trim() === "") return null;
  const n = Number(s.replace(",", "."));
  return Number.isFinite(n) ? n : null;
};

interface Props {
  initial: ExtractedDocument;
  pdfUrl: string;
  onNew: () => void;
}

export function Review({ initial, pdfUrl, onNew }: Props) {
  const [doc, setDoc] = useState(initial);
  const [draft, setDraft] = useState<Invoice | null>(initial.data);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const timer = useRef<number | undefined>(undefined);
  const locked = doc.status === "approved";

  // Re-validate on the server shortly after each edit, so issues update live.
  const update = (next: Invoice) => {
    setDraft(next);
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(async () => {
      setSaving(true);
      try {
        setDoc(await api.save(doc.id, next));
        setError(null);
      } catch (e) {
        setError((e as Error).message);
      } finally {
        setSaving(false);
      }
    }, 450);
  };
  useEffect(() => () => window.clearTimeout(timer.current), []);

  const issuesFor = (field: string) => doc.issues.filter((i) => i.field === field);
  const errorCount = doc.issues.filter((i) => i.severity === "error").length;
  const warnCount = doc.issues.length - errorCount;

  const approve = async () => {
    try {
      setDoc(await api.approve(doc.id));
    } catch (e) {
      setError((e as Error).message);
    }
  };

  return (
    <main className="review">
      <section className="pane pdf-pane" aria-label="Original document">
        <div className="pane-head">
          <strong title={doc.fileName}>{doc.fileName}</strong>
          <span className="muted">
            {doc.pageCount} page{doc.pageCount === 1 ? "" : "s"}
          </span>
        </div>
        <PdfView url={pdfUrl} />
      </section>

      <section className="pane data-pane" aria-label="Extracted data">
        <div className="pane-head">
          <span className={`status status-${doc.status}`}>{STATUS_LABEL[doc.status]}</span>
          <span className="muted small">
            {doc.model} · {doc.durationMs} ms{saving ? " · checking…" : ""}
          </span>
        </div>

        {error && <div className="banner banner-error">{error}</div>}

        {!draft ? (
          <IssueList issues={doc.issues} />
        ) : (
          <div className="data-scroll">
            <Summary errors={errorCount} warnings={warnCount} />

            <h3>Document</h3>
            <div className="grid">
              {FIELDS.map((f) => (
                <Field
                  key={f.key}
                  label={f.label}
                  issues={issuesFor(f.key)}
                  value={(draft[f.key] as string | null) ?? ""}
                  placeholder={f.kind === "date" ? "YYYY-MM-DD" : "—"}
                  disabled={locked}
                  onChange={(v) => update({ ...draft, [f.key]: v.trim() === "" ? null : v })}
                />
              ))}
            </div>

            <h3>Line items</h3>
            <LineItems
              items={draft.lineItems}
              issuesFor={issuesFor}
              disabled={locked}
              onChange={(lineItems) => update({ ...draft, lineItems })}
            />

            <h3>Totals</h3>
            <div className="grid grid-4">
              {TOTALS.map((f) => (
                <Field
                  key={f.key}
                  label={f.label}
                  numeric
                  issues={issuesFor(f.key)}
                  value={draft[f.key] == null ? "" : String(draft[f.key])}
                  disabled={locked}
                  onChange={(v) => update({ ...draft, [f.key]: toNum(v) })}
                />
              ))}
            </div>

            <details className="raw">
              <summary>Structured output (JSON)</summary>
              <pre>{JSON.stringify(draft, null, 2)}</pre>
            </details>
          </div>
        )}

        <footer className="actions">
          <button className="btn ghost" onClick={onNew}>
            New document
          </button>
          <div className="spacer" />
          {draft && (
            <>
              <a className="btn ghost" href={api.exportUrl(doc.id, "csv")}>
                CSV
              </a>
              <a className="btn ghost" href={api.exportUrl(doc.id, "json")}>
                JSON
              </a>
            </>
          )}
          <button
            className={`btn primary ${locked ? "approved" : ""}`}
            disabled={!draft || locked || saving || errorCount > 0}
            title={errorCount > 0 ? "Fix the errors first" : undefined}
            onClick={approve}
          >
            {locked ? "Approved ✓" : "Approve"}
          </button>
        </footer>
      </section>
    </main>
  );
}

function Summary({ errors, warnings }: { errors: number; warnings: number }) {
  if (!errors && !warnings) return <div className="banner banner-ok">All checks passed: totals, dates and line items are consistent.</div>;
  return (
    <div className={`banner ${errors ? "banner-error" : "banner-warn"}`}>
      {errors > 0 && `${errors} error${errors > 1 ? "s" : ""}`}
      {errors > 0 && warnings > 0 && " · "}
      {warnings > 0 && `${warnings} warning${warnings > 1 ? "s" : ""}`} found. Highlighted fields need a human look.
    </div>
  );
}

function IssueList({ issues }: { issues: Issue[] }) {
  return (
    <ul className="issue-list">
      {issues.map((i, n) => (
        <li key={n} className={i.severity}>
          {i.message}
        </li>
      ))}
    </ul>
  );
}

interface FieldProps {
  label: string;
  value: string;
  issues: Issue[];
  onChange: (v: string) => void;
  disabled?: boolean;
  numeric?: boolean;
  placeholder?: string;
}

function Field({ label, value, issues, onChange, disabled, numeric, placeholder }: FieldProps) {
  const sev = issues.some((i) => i.severity === "error") ? "error" : issues.length ? "warning" : "";
  return (
    <label className={`field ${sev}`}>
      <span className="field-label">{label}</span>
      {numeric ? (
        <NumInput value={toNum(value)} disabled={disabled} onChange={(n) => onChange(n == null ? "" : String(n))} />
      ) : (
        <input value={value} placeholder={placeholder ?? "—"} disabled={disabled} onChange={(e) => onChange(e.target.value)} />
      )}
      {issues.map((i, n) => (
        <span key={n} className={`hint ${i.severity}`}>
          {i.message}
        </span>
      ))}
    </label>
  );
}

interface LineItemsProps {
  items: LineItem[];
  issuesFor: (field: string) => Issue[];
  disabled: boolean;
  onChange: (items: LineItem[]) => void;
}

function LineItems({ items, issuesFor, disabled, onChange }: LineItemsProps) {
  const set = (i: number, patch: Partial<LineItem>) => onChange(items.map((li, n) => (n === i ? { ...li, ...patch } : li)));

  if (items.length === 0) return <p className="muted">No line items detected.</p>;
  return (
    <div className="table-wrap">
      <table className="items">
        <thead>
          <tr>
            <th>Description</th>
            <th className="num">Qty</th>
            <th className="num">Unit price</th>
            <th className="num">Amount</th>
          </tr>
        </thead>
        <tbody>
          {items.map((li, i) => {
            const issues = issuesFor(`lineItems[${i}].amount`);
            return (
              <tr key={i} className={issues.length ? "row-error" : ""}>
                <td>
                  <input value={li.description} disabled={disabled} onChange={(e) => set(i, { description: e.target.value })} />
                </td>
                {(["quantity", "unitPrice", "amount"] as const).map((k) => (
                  <td key={k} className="num">
                    <NumInput value={li[k]} disabled={disabled} onChange={(n) => set(i, { [k]: n ?? 0 })} />
                  </td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>
      {items.flatMap((_, i) =>
        issuesFor(`lineItems[${i}].amount`).map((iss, n) => (
          <p key={`${i}-${n}`} className={`hint ${iss.severity}`}>
            Line {i + 1}: {iss.message}
          </p>
        )),
      )}
    </div>
  );
}

/**
 * Numeric input that keeps the raw text while typing ("12." or "0,5"),
 * and only reports a parsed number upwards.
 */
function NumInput({ value, onChange, disabled }: { value: number | null; onChange: (n: number | null) => void; disabled?: boolean }) {
  const [text, setText] = useState(value == null ? "" : String(value));
  const focused = useRef(false);
  useEffect(() => {
    if (!focused.current) setText(value == null ? "" : String(value));
  }, [value]);
  return (
    <input
      className="num"
      inputMode="decimal"
      value={text}
      placeholder="—"
      disabled={disabled}
      onFocus={() => (focused.current = true)}
      onBlur={() => {
        focused.current = false;
        setText(value == null ? "" : String(value));
      }}
      onChange={(e) => {
        setText(e.target.value);
        onChange(toNum(e.target.value));
      }}
    />
  );
}
