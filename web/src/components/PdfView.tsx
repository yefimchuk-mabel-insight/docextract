import { GlobalWorkerOptions, getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";
import workerUrl from "pdfjs-dist/legacy/build/pdf.worker.min.mjs?url";
import { useEffect, useRef, useState } from "react";

GlobalWorkerOptions.workerSrc = workerUrl;

/**
 * Renders every page to a canvas with pdf.js. Unlike an <iframe>, this looks
 * the same in every browser, including mobile Safari and headless Chrome.
 */
export function PdfView({ url }: { url: string }) {
  const host = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const task = getDocument({ url });
    const el = host.current;

    (async () => {
      try {
        const pdf = await task.promise;
        if (!el) return;
        el.replaceChildren();
        const width = el.clientWidth;
        for (let n = 1; n <= pdf.numPages && !cancelled; n++) {
          const page = await pdf.getPage(n);
          const base = page.getViewport({ scale: 1 });
          const viewport = page.getViewport({ scale: (width / base.width) * window.devicePixelRatio });
          const canvas = document.createElement("canvas");
          canvas.width = viewport.width;
          canvas.height = viewport.height;
          canvas.style.width = `${width}px`;
          canvas.className = "pdf-page";
          el.appendChild(canvas);
          await page.render({ canvas, viewport }).promise;
        }
      } catch (e) {
        if (!cancelled) setError((e as Error).message);
      }
    })();

    return () => {
      cancelled = true;
      void task.destroy();
    };
  }, [url]);

  return (
    <div className="pdf">
      {error && <p className="banner banner-error">Could not render the PDF: {error}</p>}
      <div className="pdf-pages" ref={host} />
    </div>
  );
}
