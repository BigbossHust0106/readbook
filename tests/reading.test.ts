import { expect, it } from 'vitest';
import { paginateBook, pageForPosition, translatedFragment } from '../src/reading';
import { textChapters, type Book } from '../src/model';
const original = ('Một cuốn sách 📖 mở ra thế giới. 阅读让生活更美好。 '.repeat(90));
const book = { chapters: textChapters('Chương 1\n\n' + original + '\n\nChương 2\n\nMột chương mới.'), position: { chapter: 0, paragraph: 0 } } as Book;
it('paginates without losing, repeating or breaking Unicode text; respects chapter and budget', () => {
  const pages = paginateBook(book, 500);
  for (const p of pages) {
    expect(p.characters).toBeLessThanOrEqual(500);
    expect(p.fragments.every(f => f.chapter === p.chapter)).toBe(true);
  }
  const reconstructed = pages.flatMap(p => p.fragments.map(f => book.chapters[f.chapter].paragraphs[f.paragraph].text.slice(f.start, f.end))).join('');
  expect(reconstructed).toBe(book.chapters.flatMap(c => c.paragraphs.map(p => p.text)).join(''));
  expect(reconstructed).not.toMatch(/[\uD800-\uDBFF](?![\uDC00-\uDFFF])/u);
});
it('reanchors a long paragraph when character count changes', () => {
  const pages = paginateBook(book, 500), f = pages[2].fragments[0];
  const position = { chapter: f.chapter, paragraph: f.paragraph, offset: f.start };
  const larger = paginateBook(book, 1500);
  const page = larger[pageForPosition(larger, position)];
  expect(page.fragments.some(x => x.paragraph === f.paragraph && x.start <= f.start && x.end > f.start)).toBe(true);
});
it('partitions a translation into matching slices with no dropped or repeated text', () => {
  const text = 'A book opens new worlds. '.repeat(100);
  const source = book.chapters[0].paragraphs[0].text;
  const fragments = paginateBook(book, 500).flatMap(p => p.fragments).filter(f => f.chapter === 0 && f.paragraph === 0);
  expect(fragments.map(f => translatedFragment(text, source.length, f.start, f.end)).join('')).toBe(text);
});
