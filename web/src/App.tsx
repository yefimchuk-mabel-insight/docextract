import { useEffect, useState } from "react";
import { api } from "./api";
import { Review } from "./components/Review";
import { Upload } from "./components/Upload";
import type { ExtractedDocument, Sample } from "./types";

interface Loaded {
  doc: ExtractedDocument;
  pdfUrl: string;
}

export function App() {
  const [provider, setProvider] = useState<string>("");
  const [samples, setSamples] = useState<Sample[]>([]);
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.health().then((h) => setProvider(h.provider)).catch(() => setProvider("offline"));
    api.samples().then(setSamples).catch(() => setSamples([]));
  }, []);

  const run = async (label: string, pdfUrl: string, task: () => Promise<ExtractedDocument>) => {
    setError(null);
    setBusy(label);
    try {
      const doc = await task();
      setLoaded({ doc, pdfUrl });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="app">
      <header className="topbar">
        <button className="brand" onClick={() => setLoaded(null)} aria-label="Start over">
          <span className="logo" aria-hidden>
            ⬚
          </span>
          docextract
        </button>
        <span className="tagline">PDF → AI extraction → validated JSON → human review</span>
        {provider && (
          <span className={`pill ${provider === "demo" ? "pill-muted" : "pill-ok"}`} title="Extraction engine">
            {provider === "demo" ? "Demo mode · rule-based" : `LLM · ${provider}`}
          </span>
        )}
      </header>

      {error && (
        <div className="banner banner-error" role="alert">
          {error}
        </div>
      )}

      {loaded ? (
        <Review
          key={loaded.doc.id}
          initial={loaded.doc}
          pdfUrl={loaded.pdfUrl}
          onNew={() => setLoaded(null)}
        />
      ) : (
        <Upload
          samples={samples}
          busy={busy}
          onSample={(s) => run(s.name, s.url, () => api.extractSample(s.name))}
          onFile={(f) => run(f.name, URL.createObjectURL(f), () => api.extractFile(f))}
        />
      )}
    </div>
  );
}
