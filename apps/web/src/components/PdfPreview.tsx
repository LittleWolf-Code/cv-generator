// Preview of the compiled PDF buffer with pdf.js (ATS-15: what is shown is what will be exported).
// `onLoaded` is called when the viewer takes the new buffer (the previous pages are removed): from then
// on, it is the preview shown, the one an export must match (T-ATS-13). `onPainted` is called once
// every page is drawn: the interface measures the latency of a change (NF-04). Painting follows the
// browser's frames, which stop while the window is hidden; loading does not depend on them.
import { useEffect, useRef, useState } from 'react';
import { getDocument, GlobalWorkerOptions } from 'pdfjs-dist';
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

GlobalWorkerOptions.workerSrc = workerUrl;

export function PdfPreview({
  data,
  onLoaded,
  onPainted,
}: {
  data: Uint8Array;
  onLoaded?: () => void;
  onPainted?: () => void;
}) {
  const container = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const el = container.current;
    if (!el) return;
    // pdf.js transfers the buffer to its worker: give it a copy.
    const task = getDocument({ data: data.slice() });
    (async () => {
      try {
        const doc = await task.promise;
        if (cancelled) return;
        el.replaceChildren();
        onLoaded?.();
        for (let n = 1; n <= doc.numPages && !cancelled; n++) {
          const page = await doc.getPage(n);
          const viewport = page.getViewport({ scale: 1.5 });
          const canvas = document.createElement('canvas');
          canvas.width = viewport.width;
          canvas.height = viewport.height;
          canvas.className = 'w-full h-auto bg-white shadow ring-1 ring-slate-200';
          canvas.setAttribute('role', 'img');
          canvas.setAttribute('aria-label', `Aperçu de la page ${n}`);
          el.appendChild(canvas);
          await page.render({ canvas, viewport }).promise;
        }
        if (!cancelled) onPainted?.();
      } catch (err) {
        if (!cancelled) setError((err as Error).message);
      }
    })();
    return () => {
      cancelled = true;
      void task.destroy();
    };
    // The callbacks belong to the data they came with: a new callback alone does not repaint.
  }, [data]);

  return (
    <div>
      {error && <p className="text-sm text-red-700">Aperçu impossible : {error}</p>}
      <div ref={container} className="space-y-4" />
    </div>
  );
}
