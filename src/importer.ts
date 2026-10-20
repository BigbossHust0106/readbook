import JSZip from "jszip";
import type { PdfTextPage } from "./pdf";
import { id, textChapters, type Book, type Lang, type Chapter } from "./model";
export const MAX_FILE = 50 * 1024 * 1024;
const MAX_EXTRACTED = 30 * 1024 * 1024;
const MAX_ARCHIVE = 150 * 1024 * 1024;
export function extractHtml(html: string): string {
  const doc = new DOMParser().parseFromString(html, "text/html");
  doc
    .querySelectorAll(
      "script,style,nav,footer,header,iframe,object,svg,form,noscript",
    )
    .forEach((n) => n.remove());
  doc.querySelectorAll("br").forEach((n) => n.replaceWith("\n"));
  doc
    .querySelectorAll("p,div,h1,h2,h3,li,section,article")
    .forEach((n) => n.append("\n\n"));
  return (
    (doc.querySelector("main,article") || doc.body).textContent
      ?.replace(/[ \t]+/g, " ")
      .replace(/\n[ \t]+/g, "\n")
      .replace(/\n{3,}/g, "\n\n")
      .trim() || ""
  );
}
async function hash(bytes: ArrayBuffer) {
  return [...new Uint8Array(await crypto.subtle.digest("SHA-256", bytes))]
    .map((n) => n.toString(16).padStart(2, "0"))
    .join("");
}
async function safeZip(bytes: ArrayBuffer) {
  const zip = await JSZip.loadAsync(bytes);
  let total = 0;
  // Central-directory uncompressed sizes let us reject zip bombs before extraction.
  for (const f of Object.values(zip.files)) {
    const size =
      (f as unknown as { _data?: { uncompressedSize?: number } })._data
        ?.uncompressedSize || 0;
    total += size;
    if (total > MAX_ARCHIVE)
      throw new Error("Tệp nén giải nén quá lớn (tối đa 150 MB).");
  }
  if (Object.keys(zip.files).length > 5000)
    throw new Error("Tệp có quá nhiều thành phần.");
  return zip;
}
export async function importDocument(
  file: File | null,
  text: string,
  meta: { title: string; author: string; language: Lang; genre: string },
  options?: { pdfPages: PdfTextPage[] },
): Promise<Book> {
  if (file && file.size > MAX_FILE) throw new Error("Tệp tối đa 50 MB.");
  const bytes = file
    ? await file.arrayBuffer()
    : new TextEncoder().encode(text).buffer;
  const ext = file?.name.split(".").pop()?.toLowerCase();
  let chapters: Chapter[] = [];
  if (ext === "pdf") {
    if (!options?.pdfPages?.length) throw new Error("Hãy trích xuất và kiểm tra PDF trước khi lưu.");
    chapters = options.pdfPages.filter(p => p.text.trim()).map(p => ({
      id: id(), title: `Trang ${p.page}`, sourcePage: p.page, ocr: p.ocr,
      paragraphs: textChapters(p.text).flatMap(c => c.paragraphs),
    }));
  } else if (ext === "epub") {
    const zip = await safeZip(bytes);
    if (zip.file("META-INF/encryption.xml"))
      throw new Error("EPUB có khai báo mã hóa; ứng dụng không mở tệp có DRM.");
    const container = zip.file("META-INF/container.xml");
    if (!container) throw new Error("EPUB thiếu container.xml.");
    const parse = (s: string) =>
      new DOMParser().parseFromString(s, "application/xml");
    const path = parse(await container.async("string"))
      .getElementsByTagName("rootfile")[0]
      ?.getAttribute("full-path");
    if (!path || !zip.file(path))
      throw new Error("EPUB thiếu mục lục nội dung.");
    const opf = parse(await zip.file(path)!.async("string"));
    const base = path.includes("/")
      ? path.slice(0, path.lastIndexOf("/") + 1)
      : "";
    const manifest = new Map(
      Array.from(opf.getElementsByTagName("item")).map((n) => [
        n.getAttribute("id"),
        n.getAttribute("href"),
      ]),
    );
    for (const ref of Array.from(opf.getElementsByTagName("itemref"))) {
      if (ref.getAttribute("linear") === "no") continue;
      const href = manifest.get(ref.getAttribute("idref"));
      if (!href) continue;
      const normalized = new URL(
        base + href,
        "https://epub.invalid/",
      ).pathname.slice(1);
      const entry = zip.file(decodeURIComponent(normalized.split("#")[0]));
      if (!entry) throw new Error("EPUB thiếu một chương trong spine.");
      const html = await entry.async("string");
      const content = extractHtml(html);
      if (!content) continue;
      const doc = new DOMParser().parseFromString(html, "text/html");
      const ps = textChapters(content).flatMap((c) => c.paragraphs);
      chapters.push({
        id: id(),
        title:
          doc.querySelector("h1,h2,title")?.textContent?.trim() ||
          `Chương ${chapters.length + 1}`,
        paragraphs: ps,
      });
    }
  } else if (ext === "docx") {
    const zip = await safeZip(bytes);
    const document = zip.file("word/document.xml");
    if (!document) throw new Error("DOCX thiếu word/document.xml.");
    const doc = new DOMParser().parseFromString(
      await document.async("string"),
      "application/xml",
    );
    if (doc.querySelector("parsererror"))
      throw new Error("XML của DOCX không hợp lệ.");
    const ns = "http://schemas.openxmlformats.org/wordprocessingml/2006/main";
    const paragraphs = Array.from(doc.getElementsByTagNameNS(ns, "p")).map(
      (p) => {
        const parts: string[] = [];
        const walk = (n: Node) => {
          if (n instanceof Element && n.namespaceURI === ns) {
            if (n.localName === "t") {
              parts.push(n.textContent || "");
              return;
            }
            if (n.localName === "tab") {
              parts.push("\t");
              return;
            }
            if (n.localName === "br" || n.localName === "cr") {
              parts.push("\n");
              return;
            }
          }
          n.childNodes.forEach(walk);
        };
        walk(p);
        return parts.join("");
      },
    );
    chapters = textChapters(paragraphs.join("\n\n"));
  } else if (ext === "html" || ext === "htm")
    chapters = textChapters(extractHtml(new TextDecoder().decode(bytes)));
  else if (!file || ext === "txt")
    chapters = textChapters(
      new TextDecoder("utf-8", { fatal: true }).decode(bytes),
    );
  else
    throw new Error(
      "Hỗ trợ PDF, EPUB, TXT UTF-8, DOCX và HTML.",
    );
  if (!chapters.length || !chapters.some((c) => c.paragraphs.length))
    throw new Error("Không trích xuất được văn bản.");
  if (
    chapters.reduce(
      (n, c) => n + c.paragraphs.reduce((m, p) => m + p.text.length, 0),
      0,
    ) > MAX_EXTRACTED
  )
    throw new Error("Văn bản quá lớn.");
  return {
    id: id(),
    ...meta,
    title:
      meta.title.trim() || file?.name.replace(/\.[^.]+$/, "") || "Sách mới",
    author: meta.author.trim() || "Chưa rõ tác giả",
    hash: await hash(bytes),
    createdAt: new Date().toISOString(),
    chapters,
    position: { chapter: 0, paragraph: 0 },
    shelf: "reading",
    originalName: file?.name,
    originalType: file?.type,
    approvedChildren: [],
  };
}
