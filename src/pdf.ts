import { GlobalWorkerOptions, getDocument, type PDFDocumentProxy, type PDFPageProxy } from 'pdfjs-dist';
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import type { Worker as OcrWorker } from 'tesseract.js';
import type { Lang } from './model';

GlobalWorkerOptions.workerSrc = workerUrl;
export type PdfTextPage = { page: number; text: string; ocr: boolean; confidence?: number };
export type PdfProgress = { page: number; total: number; fraction: number; stage: string };
export function abortError() { return new DOMException('Đã hủy xử lý PDF.', 'AbortError'); }
function abortable<T>(promise: Promise<T>, signal: AbortSignal, dispose?: (value: T) => void): Promise<T> {
  return new Promise((resolve, reject) => {
    const cancel = () => reject(abortError());
    signal.addEventListener('abort', cancel, { once: true });
    promise.then(value => {
      signal.removeEventListener('abort', cancel);
      if (signal.aborted) { dispose?.(value); reject(abortError()); }
      else resolve(value);
    }, error => { signal.removeEventListener('abort', cancel); reject(error); });
    if (signal.aborted) cancel();
  });
}
export function openPdf(data: Uint8Array) {
  return getDocument({ data, cMapUrl: '/pdf/cmaps/', cMapPacked: true,
    standardFontDataUrl: '/pdf/standard_fonts/', wasmUrl: '/pdf/wasm/', useSystemFonts: true });
}
export async function renderPdfPage(page: PDFPageProxy, canvas: HTMLCanvasElement) {
  const natural = page.getViewport({ scale: 1 });
  const scale = Math.min(2.5, 2200 / Math.max(natural.width, natural.height));
  const viewport = page.getViewport({ scale });
  canvas.width = Math.ceil(viewport.width); canvas.height = Math.ceil(viewport.height);
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Trình duyệt không hỗ trợ hiển thị trang PDF.');
  return page.render({ canvas, canvasContext: context, viewport }).promise;
}
export async function extractPdf(file: File, options: {
  language: Lang; mode: 'auto' | 'always' | 'off'; start: number; end?: number;
  signal: AbortSignal; onProgress: (p: PdfProgress) => void;
  resume?: (draftId: string) => Promise<PdfTextPage[]>;
  onPage?: (draftId: string, page: PdfTextPage) => Promise<void>;
}): Promise<{ pages: PdfTextPage[]; totalPages: number; draftId: string }> {
  const { signal, onProgress } = options;
  if (signal.aborted) throw abortError();
  const bytes = await file.arrayBuffer();
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  const draftId = Array.from(new Uint8Array(digest), n => n.toString(16).padStart(2, "0")).join("") + `:${options.language}:${options.mode}:v1`;
  const restored = new Map((await options.resume?.(draftId) || []).map(p => [p.page, p]));
  if (signal.aborted) throw abortError();
  const task = openPdf(new Uint8Array(bytes));
  let doc: PDFDocumentProxy | undefined;
  let ocr: OcrWorker | undefined;
  let canvas: HTMLCanvasElement | undefined;
  let current = 0, count = 0, characters = 0, passwordRequired = false;
  // Prevent password prompts from hanging import; never execute PDF scripts.
  task.onPassword = () => { passwordRequired = true; void task.destroy(); };
  const cancel = () => { void ocr?.terminate(); void task.destroy(); };
  signal.addEventListener('abort', cancel, { once: true });
  try {
    doc = await abortable(task.promise, signal);
    if (signal.aborted) throw abortError();
    const end = options.end ?? doc.numPages;
    const start = options.start;
    if (!Number.isInteger(start) || !Number.isInteger(end) || start < 1 || end < start || end > doc.numPages)
      throw new Error(`PDF có ${doc.numPages} trang. Hãy chọn khoảng trang hợp lệ.`);
    count = end - start + 1;
    const pages: PdfTextPage[] = [];
    for (let n = start; n <= end; n++) {
      if (signal.aborted) throw abortError();
      current = n;
      onProgress({ page: n, total: end, fraction: (n - start) / count, stage: 'Đọc văn bản PDF' });
      const cached = restored.get(n);
      if (cached) {
        characters += cached.text.length;
        if (characters > 30 * 1024 * 1024) throw new Error("Văn bản trích xuất vượt 30 MB. Hãy chọn khoảng trang ngắn hơn.");
        pages.push(cached); continue;
      }
      const page = await doc.getPage(n);
      const content = await page.getTextContent();
      let text = content.items.map(item => 'str' in item ? item.str + (item.hasEOL ? '\n' : ' ') : '').join('').normalize('NFC').trim();
      const needsOcr = options.mode === 'always' || (options.mode === 'auto' && text.replace(/\s/g, '').length < 10);
      let confidence: number | undefined;
      if (needsOcr) {
        if (!ocr) {
          onProgress({ page: n, total: end, fraction: (n - start) / count, stage: 'Tải bộ nhận dạng chữ (lần đầu có thể lâu)' });
          const { createWorker } = await import('tesseract.js');
          const langs = { vi: 'vie+eng', en: 'eng', zh: 'chi_sim+eng' }[options.language];
          // Fetch with the abort signal first; the worker then uses the browser/SW cache.
          for (const lang of langs.split('+')) {
            const response = await fetch(`/ocr/${lang}.traineddata.gz`, { signal });
            if (!response.ok) throw new Error('Không tải được bộ OCR. Kiểm tra mạng rồi thử lại.');
            await response.arrayBuffer();
          }
          ocr = await abortable(createWorker(langs, 1, {
            workerPath: '/ocr/worker.min.js', corePath: '/ocr/core', langPath: '/ocr', workerBlobURL: false,
            logger: m => { if (!signal.aborted && m.status === 'recognizing text') onProgress({ page: current, total: end, fraction: (current - start + m.progress) / count, stage: 'Nhận dạng chữ OCR' }); },
          }), signal, worker => { void worker.terminate(); });
          if (signal.aborted) throw abortError();
        }
        canvas = document.createElement('canvas');
        await abortable(renderPdfPage(page, canvas), signal);
        if (signal.aborted) throw abortError();
        const result = await abortable(ocr.recognize(canvas), signal);
        text = result.data.text.normalize('NFC').trim(); confidence = result.data.confidence;
        canvas.width = canvas.height = 0; canvas = undefined;
      }
      characters += text.length;
      if (characters > 30 * 1024 * 1024) throw new Error("Văn bản trích xuất vượt 30 MB. Hãy chọn khoảng trang ngắn hơn.");
      const result = { page: n, text, ocr: needsOcr, confidence };
      await options.onPage?.(draftId, result);
      pages.push(result);
      page.cleanup();
      onProgress({ page: n, total: end, fraction: (n - start + 1) / count, stage: "Đã lưu tiến độ trang" });
    }
    return { pages, totalPages: doc.numPages, draftId };
  } catch (e) {
    if (signal.aborted) throw abortError();
    if (passwordRequired || (e as Error).name === 'PasswordException')
      throw new Error('PDF có mật khẩu hoặc bị khóa. Hãy xuất bản PDF không khóa rồi nhập lại.');
    if ((e as Error).name === 'InvalidPDFException') throw new Error('Tệp PDF không hợp lệ hoặc bị hỏng. Hãy kiểm tra tệp rồi nhập lại.');
    throw e;
  } finally {
    signal.removeEventListener('abort', cancel);
    if (canvas) canvas.width = canvas.height = 0;
    await ocr?.terminate().catch(() => {});
    await task.destroy().catch(() => {});
  }
}
