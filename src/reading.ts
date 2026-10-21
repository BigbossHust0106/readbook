import type { Book } from './model';
export type Fragment = { chapter: number; paragraph: number; start: number; end: number };
export type ReadingPage = { chapter: number; fragments: Fragment[]; characters: number };
function cut(text: string, start: number, budget: number) {
  let end = Math.min(text.length, start + budget);
  if (end === text.length) return end;
  if (end > start && /[\uD800-\uDBFF]/.test(text[end - 1])) end--;
  const part = text.slice(start, end);
  const matches = [...part.matchAll(/[\s。！？.!?;；]/gu)];
  const boundary = matches.at(-1);
  if (boundary && boundary.index! > part.length * 0.55) end = start + boundary.index! + boundary[0].length;
  return Math.max(start + 1, end);
}
export function paginateBook(book: Book, budget: number): ReadingPage[] {
  budget = Math.max(100, Math.floor(budget));
  const pages: ReadingPage[] = [];
  book.chapters.forEach((chapter, ci) => {
    let page: ReadingPage = { chapter: ci, fragments: [], characters: 0 };
    chapter.paragraphs.forEach((p, pi) => {
      let start = 0;
      while (start < p.text.length) {
        if (page.characters >= budget) { pages.push(page); page = { chapter: ci, fragments: [], characters: 0 }; }
        const remaining = budget - page.characters;
        if (page.fragments.length && p.text.length - start > remaining && remaining < budget / 3) {
          pages.push(page); page = { chapter: ci, fragments: [], characters: 0 }; continue;
        }
        const end = cut(p.text, start, remaining);
        page.fragments.push({ chapter: ci, paragraph: pi, start, end }); page.characters += end - start; start = end;
      }
    });
    if (page.fragments.length) pages.push(page);
  });
  return pages;
}
export function pageForPosition(pages: ReadingPage[], position: Book['position']) {
  const found = pages.findIndex(p => p.fragments.some(f => f.chapter === position.chapter && f.paragraph === position.paragraph && (position.offset || 0) >= f.start && (position.offset || 0) < f.end));
  return Math.max(0, found);
}
function translationBoundary(text: string, ratio: number) {
  if (ratio <= 0) return 0; if (ratio >= 1) return text.length;
  let at = Math.round(text.length * ratio);
  if (/[\uD800-\uDBFF]/.test(text[at - 1])) at++;
  for (let distance = 0; distance < 50; distance++) {
    for (const point of [at + distance, at - distance]) {
      if (point > 0 && point < text.length && /[\s。！？.!?]/u.test(text[point - 1])) return point;
    }
  }
  return at;
}
export function translatedFragment(text: string, length: number, start: number, end: number) {
  return text.slice(translationBoundary(text, start / length), translationBoundary(text, end / length));
}
