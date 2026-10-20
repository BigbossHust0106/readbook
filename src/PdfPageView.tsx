import { useEffect, useRef, useState } from 'react';
import { openPdf, renderPdfPage } from './pdf';

export default function PdfPageView({ file, page }: { file: Blob; page: number }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let cancelled = false;
    let task: ReturnType<typeof openPdf> | undefined;
    setLoading(true); setError('');
    void (async () => {
      try {
        const bytes = await file.arrayBuffer();
        if (cancelled) return;
        task = openPdf(new Uint8Array(bytes));
        const doc = await task.promise;
        if (cancelled || !canvas.current) return;
        const p = await doc.getPage(page);
        await renderPdfPage(p, canvas.current);
        p.cleanup();
        if (!cancelled) setLoading(false);
      } catch { if (!cancelled) { setError('Không hiển thị được trang PDF gốc. Bạn vẫn có thể tải tệp gốc.'); setLoading(false); } }
    })();
    return () => { cancelled = true; void task?.destroy(); };
  }, [file, page]);
  return <div className="pdf-page-view">
    {loading && <p role="status">Đang mở trang gốc…</p>}
    {error && <p role="alert">{error}</p>}
    <canvas key={page} ref={canvas} aria-label={`Trang PDF gốc ${page}`} role="img" />
  </div>;
}
