import { beforeEach, expect, it, vi } from 'vitest';
const state = vi.hoisted(() => ({ count: 55, recognize: vi.fn(), terminate: vi.fn() }));
vi.mock('pdfjs-dist', () => ({ GlobalWorkerOptions: {}, getDocument: () => ({
  destroy: async () => {}, promise: Promise.resolve({ numPages: state.count,
    getPage: async () => ({ getTextContent: async () => ({ items: [] }), getViewport: () => ({ width: 600, height: 800 }), render: () => ({ promise: Promise.resolve() }), cleanup() {} }),
  }),
}) }));
vi.mock('tesseract.js', () => ({ createWorker: async () => ({ recognize: state.recognize, terminate: state.terminate }) }));
import { extractPdf, type PdfTextPage } from '../src/pdf';
beforeEach(() => {
  state.count = 55; state.recognize.mockReset().mockResolvedValue({ data: { text: 'Một trang sách.', confidence: 90 } }); state.terminate.mockReset().mockResolvedValue({});
  vi.stubGlobal('document', { createElement: () => ({ width: 0, height: 0, getContext: () => ({}) }) });
  vi.stubGlobal('fetch', vi.fn().mockImplementation(async () => new Response(new Uint8Array([0, 1]))));
});
it('OCRs an entire PDF beyond 50 scan pages and resumes completed pages after abort', async () => {
  const file = new File(['fixture PDF'], 'full.pdf');
  const cached: PdfTextPage[] = []; const controller = new AbortController();
  await expect(extractPdf(file, { language: 'vi', mode: 'always', start: 1, signal: controller.signal, onProgress() {},
    onPage: async (_id, page) => { cached.push(page); if (page.page === 20) controller.abort(); },
  })).rejects.toMatchObject({ name: 'AbortError' });
  expect(cached).toHaveLength(20);
  state.recognize.mockClear();
  const result = await extractPdf(file, { language: 'vi', mode: 'always', start: 1, signal: new AbortController().signal, onProgress() {}, resume: async () => cached });
  expect(result.pages).toHaveLength(55); expect(state.recognize).toHaveBeenCalledTimes(35);
});
it('processes more than 200 PDF pages by default', async () => {
  state.count = 241;
  const result = await extractPdf(new File(['text fixture'], 'whole.pdf'), { language: 'en', mode: 'off', start: 1, signal: new AbortController().signal, onProgress() {} });
  expect(result.pages).toHaveLength(241); expect(result.totalPages).toBe(241); expect(state.recognize).not.toHaveBeenCalled();
});
