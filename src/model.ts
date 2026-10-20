export type Lang = "vi" | "zh" | "en";
export const languages: Record<Lang, string> = {
  vi: "Tiếng Việt",
  zh: "Tiếng Trung",
  en: "Tiếng Anh",
};
export type Translation = {
  text: string;
  provider: string;
  updatedAt: string;
  locked: boolean;
  history: string[];
};
export type Paragraph = {
  id: string;
  text: string;
  translations: Partial<Record<Lang, Translation>>;
  note?: string;
  highlight?: boolean;
};
export type Chapter = { sourcePage?: number; ocr?: boolean; id: string; title: string; paragraphs: Paragraph[] };
export type Book = {
  id: string;
  title: string;
  author: string;
  language: Lang;
  genre: string;
  createdAt: string;
  hash: string;
  chapters: Chapter[];
  position: { chapter: number; paragraph: number };
  shelf: "reading" | "later" | "favorite" | "done";
  originalName?: string;
  originalType?: string;
  approvedChildren: string[];
};
export type Review = { dueAt: string; intervalDays: number; repetitions: number };
export type Practice = { id: string; bookTitle: string; completedAt: string; sentences: number; seconds: number };
export type Word = {
  review?: Review;
  id: string;
  term: string;
  meaning: string;
  language: Lang;
  contexts: {
    bookId: string;
    bookTitle: string;
    paragraphId: string;
    sentence: string;
  }[];
  status: "new" | "learning" | "known" | "ignored";
  createdAt: string;
};
export type Child = {
  practice?: Practice[];
  id: string;
  nickname: string;
  age: number;
  level: string;
  languages: Lang[];
};
export const id = () => crypto.randomUUID();
export function textChapters(text: string): Chapter[] {
  const lines = text
    .replace(/\r\n?/g, "\n")
    .split(/\n\s*\n/)
    .map((s) => s.trim())
    .filter(Boolean);
  if (!lines.length) throw new Error("Tài liệu không có văn bản để đọc.");
  const chapters: Chapter[] = [];
  let chapter: Chapter = { id: id(), title: "Nội dung", paragraphs: [] };
  for (const line of lines) {
    if (
      /^(chương\s+\S+|chapter\s+\S+|第.{1,12}[章回节節])[^\n]{0,100}$/iu.test(
        line,
      )
    ) {
      if (chapter.paragraphs.length) chapters.push(chapter);
      chapter = { id: id(), title: line, paragraphs: [] };
    } else {
      // Bound paragraph size for providers and keep stable IDs after import.
      for (let n = 0; n < line.length; n += 4000)
        chapter.paragraphs.push({
          id: id(),
          text: line.slice(n, n + 4000),
          translations: {},
        });
    }
  }
  if (chapter.paragraphs.length) chapters.push(chapter);
  if (!chapters.length) throw new Error("Không tìm thấy đoạn văn.");
  return chapters;
}
export function pendingParagraphs(book: Book, target: Lang, chapter?: number) {
  return book.chapters
    .flatMap((c, i) =>
      chapter === undefined || i === chapter ? c.paragraphs : [],
    )
    .filter((p) => !p.translations[target]?.text);
}
export function applyTranslation(
  p: Paragraph,
  target: Lang,
  text: string,
  provider: string,
): Paragraph {
  const prev = p.translations[target];
  if (prev?.locked) return p;
  return {
    ...p,
    translations: {
      ...p.translations,
      [target]: {
        text,
        provider,
        updatedAt: new Date().toISOString(),
        locked: false,
        history: prev ? [...prev.history, prev.text].slice(-20) : [],
      },
    },
  };
}
export function mergeWord(words: Word[], word: Word): Word[] {
  const existing = words.find(
    (w) =>
      w.term.normalize("NFKC").toLocaleLowerCase() ===
        word.term.normalize("NFKC").toLocaleLowerCase() &&
      w.language === word.language &&
      w.meaning === word.meaning,
  );
  if (!existing) return [...words, word];
  return words.map((w) =>
    w.id === existing.id
      ? {
          ...w,
          contexts: [
            ...w.contexts,
            ...word.contexts.filter(
              (c) =>
                !w.contexts.some(
                  (x) =>
                    x.paragraphId === c.paragraphId && x.bookId === c.bookId,
                ),
            ),
          ],
        }
      : w,
  );
}
export function assertBook(value: unknown): asserts value is Book {
  const b = value as Book;
  const string = (v: unknown) => typeof v === "string";
  if (
    !b ||
    !string(b.id) ||
    !string(b.title) ||
    !b.title.trim() ||
    !string(b.author) ||
    !string(b.genre) ||
    !string(b.createdAt) ||
    !string(b.hash) ||
    !["vi", "zh", "en"].includes(b.language) ||
    !["reading", "later", "favorite", "done"].includes(b.shelf) ||
    !Array.isArray(b.chapters) ||
    !b.chapters.length ||
    !b.position ||
    !Array.isArray(b.approvedChildren) ||
    !b.approvedChildren.every(string)
  )
    throw new Error("Dữ liệu sách không hợp lệ.");
  const ids = new Set<string>();
  for (const c of b.chapters) {
    if (
      (c.sourcePage !== undefined && (!Number.isInteger(c.sourcePage) || c.sourcePage < 1)) ||
      (c.ocr !== undefined && typeof c.ocr !== "boolean") ||
      !string(c.id) ||
      ids.has(c.id) ||
      !string(c.title) ||
      !Array.isArray(c.paragraphs) ||
      !c.paragraphs.length
    )
      throw new Error("Chương không hợp lệ.");
    ids.add(c.id);
    for (const p of c.paragraphs) {
      if (
        !string(p.id) ||
        ids.has(p.id) ||
        !string(p.text) ||
        !p.translations ||
        typeof p.translations !== "object" ||
        Array.isArray(p.translations) ||
        (p.note !== undefined && !string(p.note)) ||
        (p.highlight !== undefined && typeof p.highlight !== "boolean")
      )
        throw new Error("Đoạn văn không hợp lệ.");
      ids.add(p.id);
      for (const [key, t] of Object.entries(p.translations))
        if (
          !["vi", "zh", "en"].includes(key) ||
          !t ||
          !string(t.text) ||
          !string(t.provider) ||
          !string(t.updatedAt) ||
          typeof t.locked !== "boolean" ||
          !Array.isArray(t.history) ||
          !t.history.every(string)
        )
          throw new Error("Bản dịch không hợp lệ.");
    }
  }
  if (
    !Number.isInteger(b.position.chapter) ||
    b.position.chapter < 0 ||
    b.position.chapter >= b.chapters.length ||
    !Number.isInteger(b.position.paragraph) ||
    b.position.paragraph < 0 ||
    b.position.paragraph >= b.chapters[b.position.chapter].paragraphs.length
  )
    throw new Error("Vị trí đọc không hợp lệ.");
}
export function assertWord(w: Word) {
  if (w?.review && (!Number.isFinite(Date.parse(w.review.dueAt)) || !Number.isInteger(w.review.intervalDays) || w.review.intervalDays < 0 || w.review.intervalDays > 365 || !Number.isInteger(w.review.repetitions) || w.review.repetitions < 0)) throw new Error("Lịch ôn không hợp lệ.");
  if (
    !w ||
    typeof w.id !== "string" ||
    typeof w.term !== "string" ||
    typeof w.meaning !== "string" ||
    typeof w.createdAt !== "string" ||
    !["vi", "zh", "en"].includes(w.language) ||
    !["new", "learning", "known", "ignored"].includes(w.status) ||
    !Array.isArray(w.contexts) ||
    w.contexts.some(
      (c) =>
        !c ||
        [c.bookId, c.bookTitle, c.paragraphId, c.sentence].some(
          (v) => typeof v !== "string",
        ),
    )
  )
    throw new Error("Từ vựng không hợp lệ.");
}
export function assertChild(c: Child) {
  if (c?.practice !== undefined && (!Array.isArray(c.practice) || c.practice.length > 100 || c.practice.some(p => !p || typeof p.id !== "string" || typeof p.bookTitle !== "string" || !Number.isFinite(Date.parse(p.completedAt)) || !Number.isInteger(p.sentences) || p.sentences < 1 || !Number.isInteger(p.seconds) || p.seconds < 0))) throw new Error("Lịch sử luyện đọc không hợp lệ.");
  if (
    !c ||
    typeof c.id !== "string" ||
    typeof c.nickname !== "string" ||
    typeof c.level !== "string" ||
    !Number.isInteger(c.age) ||
    c.age < 3 ||
    c.age > 17 ||
    !Array.isArray(c.languages) ||
    !c.languages.every((l) => ["vi", "zh", "en"].includes(l))
  )
    throw new Error("Hồ sơ trẻ không hợp lệ.");
}
