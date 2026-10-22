import type { Book } from './model';
import type { Fragment, ReadingPage } from './reading';
export type Direction = 'forward' | 'backward';
export type PageMeasure = {
  fits: (fragment: Fragment, direction: Direction) => boolean;
  add: (fragment: Fragment, direction: Direction) => void;
  clear: () => void;
};
export function readingAnchor(book: Book, position: Book['position']): Book['position'] {
  const chapter = Math.max(0, Math.min(book.chapters.length - 1, position.chapter));
  const paragraph = Math.max(0, Math.min(book.chapters[chapter].paragraphs.length - 1, position.paragraph));
  const text = book.chapters[chapter].paragraphs[paragraph]?.text || '';
  let offset = Math.max(0, Math.min(Math.max(0, text.length - 1), position.offset || 0));
  if (offset && /[\uDC00-\uDFFF]/.test(text[offset])) offset--;
  return { chapter, paragraph, offset };
}
function endBoundary(text: string, start: number, end: number) {
  if (end >= text.length) return text.length;
  if (/[\uD800-\uDBFF]/.test(text[end - 1])) end--;
  const sample = text.slice(start, end), last = [...sample.matchAll(/[\s。！？.!?;；]/gu)].at(-1);
  if (last && last.index! > sample.length * .65) end = start + last.index! + last[0].length;
  end = Math.max(start + 1, end);
  return /[\uD800-\uDBFF]/.test(text[end - 1]) && end < text.length ? end + 1 : end;
}
function startBoundary(text: string, start: number, end: number) {
  if (start <= 0) return 0;
  if (/[\uDC00-\uDFFF]/.test(text[start])) start++;
  const sample = text.slice(start, Math.min(end, start + Math.ceil((end - start) * .35)));
  const match = sample.match(/[\s。！？.!?;；]/u);
  if (match) start += match.index! + match[0].length;
  start = Math.min(end - 1, start);
  return /[\uDC00-\uDFFF]/.test(text[start]) ? start - 1 : start;
}
// Yield between layout probes, including binary search, so a long paragraph or
// a chapter with many short paragraphs cannot monopolize the browser thread.
// The two directions meet at the anchor exactly, without overlapping text.
export function* measurePages(book: Book, anchor: Book['position'], direction: Direction, budget: number, measure: PageMeasure): Generator<ReadingPage | null> {
  const forward = direction === 'forward', step = forward ? 1 : -1;
  for (let ci = anchor.chapter; ci >= 0 && ci < book.chapters.length; ci += step) {
    const paragraphs = book.chapters[ci].paragraphs;
    let page: ReadingPage = { chapter: ci, fragments: [], characters: 0 };
    const finish = () => { const result = page; measure.clear(); page = { chapter: ci, fragments: [], characters: 0 }; return result; };
    for (let pi = ci === anchor.chapter ? anchor.paragraph : forward ? 0 : paragraphs.length - 1; pi >= 0 && pi < paragraphs.length; pi += step) {
      const text = paragraphs[pi].text;
      let cursor = ci === anchor.chapter && pi === anchor.paragraph ? anchor.offset || 0 : forward ? 0 : text.length;
      while (forward ? cursor < text.length : cursor > 0) {
        if (page.characters >= budget) yield finish();
        const remaining = Math.max(1, budget - page.characters);
        let fragment: Fragment = { chapter: ci, paragraph: pi,
          start: forward ? cursor : startBoundary(text, Math.max(0, cursor - remaining), cursor),
          end: forward ? endBoundary(text, cursor, Math.min(text.length, cursor + remaining)) : cursor };
        const fits = measure.fits(fragment, direction); yield null;
        if (!fits) {
          let low = forward ? cursor + 1 : fragment.start, high = forward ? fragment.end : cursor - 1, best = cursor;
          while (low <= high) {
            const mid = Math.floor((low + high) / 2);
            const fit = measure.fits(forward ? { ...fragment, end: mid } : { ...fragment, start: mid }, direction); yield null;
            if (forward) { if (fit) { best = mid; low = mid + 1; } else high = mid - 1; }
            else { if (fit) { best = mid; high = mid - 1; } else low = mid + 1; }
          }
          if (best === cursor && page.fragments.length) { yield finish(); continue; }
          fragment = forward ? { ...fragment, end: endBoundary(text, cursor, Math.max(cursor + 1, best)) }
            : { ...fragment, start: startBoundary(text, Math.min(cursor - 1, best), cursor) };
        }
        measure.add(fragment, direction);
        if (forward) page.fragments.push(fragment); else page.fragments.unshift(fragment);
        page.characters += fragment.end - fragment.start;
        cursor = forward ? fragment.end : fragment.start;
        yield null;
        if (forward ? cursor < text.length : cursor > 0) yield finish();
      }
    }
    if (page.fragments.length) yield finish();
  }
}
