import { useRef, useState } from "react";
import type { Sample } from "../types";

interface Props {
  samples: Sample[];
  busy: string | null;
  onSample: (s: Sample) => void;
  onFile: (f: File) => void;
}

const LABELS: Record<string, string> = {
  "01-clean-invoice.pdf": "Clean EU invoice",
  "02-totals-mismatch.pdf": "Invoice with bad totals",
  "03-us-consulting.pdf": "US consulting invoice",
};

const pretty = (name: string) =>
  LABELS[name] ?? name.replace(/^\d+-/, "").replace(/\.pdf$/, "").replace(/-/g, " ");

export function Upload({ samples, busy, onSample, onFile }: Props) {
  const input = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);

  const pick = (files: FileList | null) => {
    const f = files?.[0];
    if (f) onFile(f);
  };

  return (
    <main className="upload">
      <section className="hero">
        <h1>Stop retyping invoices.</h1>
        <p>
          Drop a PDF and get structured, validated data back in seconds. Every total, date and line item is checked, and
          anything suspicious goes to a person for review before it reaches your system.
        </p>
      </section>

      <div
        className={`dropzone ${over ? "over" : ""} ${busy ? "busy" : ""}`}
        onDragOver={(e) => {
          e.preventDefault();
          setOver(true);
        }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setOver(false);
          pick(e.dataTransfer.files);
        }}
        onClick={() => !busy && input.current?.click()}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => e.key === "Enter" && input.current?.click()}
      >
        <input ref={input} type="file" accept="application/pdf" hidden onChange={(e) => pick(e.target.files)} />
        {busy ? (
          <>
            <div className="spinner" aria-hidden />
            <strong>Extracting {busy}…</strong>
          </>
        ) : (
          <>
            <div className="drop-icon" aria-hidden>
              PDF
            </div>
            <strong>Drop an invoice here, or click to choose a file</strong>
            <span className="muted">PDF up to 10 MB</span>
          </>
        )}
      </div>

      {samples.length > 0 && (
        <section className="samples">
          <h2>No invoice at hand? Try a sample</h2>
          <div className="sample-grid">
            {samples.map((s) => (
              <button key={s.name} className="sample" disabled={!!busy} onClick={() => onSample(s)}>
                <span className="sample-name">{pretty(s.name)}</span>
                <span className="muted">{s.name}</span>
              </button>
            ))}
          </div>
          <p className="muted small">All sample companies and figures are fictional.</p>
        </section>
      )}
    </main>
  );
}
