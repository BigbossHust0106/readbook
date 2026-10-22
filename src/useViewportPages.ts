import { useEffect, useMemo, useRef, useState, type RefObject } from 'react';
import type { Book, Lang } from './model';
import { translatedFragment, type ReadingPage, type Fragment } from './reading';
import { measurePages, readingAnchor, type Direction } from './viewportPagination';
type Result = { key: string; chapters: Book['chapters']; pages: ReadingPage[]; beforeComplete: boolean; afterComplete: boolean; error?: string };
type Work = { extend: (direction: Direction) => Promise<ReadingPage | null> };
export function useViewportPages({ book, position, frame, enabled, layout, target, font, fontFamily, lineHeight, budget, widthLimit }: {
  book: Book; position: Book['position']; frame: RefObject<HTMLDivElement | null>; enabled: boolean; layout: string; target: Lang; font: number; fontFamily: string; lineHeight: number; budget: number; widthLimit: number;
}) {
  const content = useRef(book.chapters);
  const chapters = useMemo(() => {
    const previous = content.current, next = book.chapters;
    if (previous === next) return previous;
    // Cloud synchronization returns fresh objects even for unchanged text.
    // Preserve measured pages for progress, notes and bookmark-only updates.
    const same = previous.length === next.length && previous.every((chapter, ci) =>
      chapter.paragraphs.length === next[ci].paragraphs.length && chapter.paragraphs.every((p, pi) => {
        const other = next[ci].paragraphs[pi];
        return p.id === other.id && p.text === other.text && (layout === 'original' || (p.translations[target]?.text || '') === (other.translations[target]?.text || ''));
      }));
    if (!same) content.current = next;
    return content.current;
  }, [book.chapters, layout, target]);
  const [size, setSize] = useState({ width: 0, height: 0 }), [revision, setRevision] = useState(0);
  const [result, setResult] = useState<Result | null>(null);
  const anchor = useRef(position); anchor.current = position;
  const work = useRef<Work | null>(null), cache = useRef(new Map<string, Result>());
  // Do not stringify or character-paginate the entire book on every progress
  // update. Text changes invalidate content; this key is small.
  const layoutKey = JSON.stringify([size.width, size.height, widthLimit, layout, target, font, fontFamily, lineHeight, budget]);
  const key = `${layoutKey}:${revision}`;
  const active = result?.key === key && result.chapters === chapters;
  useEffect(() => {
    if (!enabled || !frame.current) return;
    const node = frame.current, observe = () => {
      const rect = node.getBoundingClientRect(), next = { width: Math.min(rect.width, widthLimit), height: rect.height };
      setSize(old => Math.abs(old.width - next.width) < .5 && Math.abs(old.height - next.height) < .5 ? old : next);
    };
    const observer = new ResizeObserver(observe); observer.observe(node); observe();
    return () => observer.disconnect();
  }, [enabled, widthLimit]);
  useEffect(() => {
    work.current = null;
    if (!enabled || !size.width || !size.height) return;
    const cached = cache.current.get(layoutKey);
    if (cached?.chapters === chapters) {
      cache.current.delete(layoutKey); cache.current.set(layoutKey, cached);
      setResult({ ...cached, key }); return;
    }
    let cancelled = false, timer: ReturnType<typeof setTimeout> | undefined, idle: number | undefined;
    let first = true, lastPublished = 0, currentDirection: Direction = 'forward', lead = 0;
    const before: ReadingPage[] = [], after: ReadingPage[] = [];
    const start = readingAnchor(book, anchor.current);
    const done = { backward: start.chapter === 0 && start.paragraph === 0 && !start.offset, forward: false };
    const waiting: Record<Direction, ((page: ReadingPage | null) => void)[]> = { backward: [], forward: [] };
    const roots: HTMLElement[] = [];
    function create(fragment: Fragment) {
      const p = chapters[fragment.chapter].paragraphs[fragment.paragraph];
      const article = document.createElement('article'), row = document.createElement('div');
      article.className = 'paragraph'; row.className = 'paragraph-text'; article.append(row);
      if (layout !== 'translation') {
        const source = document.createElement('p'); source.textContent = p.text.slice(fragment.start, fragment.end);
        if (fragment.start) source.style.textIndent = '0'; row.append(source);
      }
      if (layout !== 'original') {
        const box = document.createElement('div'), translated = document.createElement('p'); box.className = 'translated';
        if (p.translations[target]?.text) translated.textContent = translatedFragment(p.translations[target]!.text, p.text.length, fragment.start, fragment.end);
        else { translated.className = 'untranslated'; translated.textContent = 'Chưa có bản dịch ·'; }
        box.append(translated); row.append(box);
      }
      return article;
    }
    function iterator(direction: Direction) {
      const root = document.createElement('div'); roots.push(root);
      root.className = `reading-paper paragraphs layout-${layout} viewport-measure`; root.setAttribute('aria-hidden', 'true');
      Object.assign(root.style, { position: 'fixed', left: '-20000px', top: '0', width: `${size.width}px`, maxWidth: 'none', height: 'auto', minHeight: '0', overflow: 'visible', visibility: 'hidden', pointerEvents: 'none', fontSize: `${font}px` });
      root.style.setProperty('--reader-font', fontFamily); root.style.setProperty('--reader-leading', String(lineHeight));
      frame.current?.closest('.reader')?.append(root);
      const append = (node: HTMLElement) => direction === 'forward' ? root.append(node) : root.prepend(node);
      return measurePages({ ...book, chapters }, start, direction, budget, {
        fits(fragment) { const node = create(fragment); append(node); const fits = root.getBoundingClientRect().height <= size.height - 3; node.remove(); return fits; },
        add(fragment) { append(create(fragment)); }, clear() { root.replaceChildren(); },
      });
    }
    const iterators = { forward: iterator('forward'), backward: iterator('backward') };
    function publish() {
      if (cancelled) return;
      const next: Result = { key, chapters, pages: [...before, ...after], beforeComplete: done.backward, afterComplete: done.forward };
      setResult(next); lastPublished = performance.now();
      if (done.backward && done.forward) {
        cache.current.set(layoutKey, next);
        while (cache.current.size > 3) cache.current.delete(cache.current.keys().next().value!);
        roots.forEach(root => root.remove());
      }
    }
    function clearSchedule() {
      if (timer !== undefined) clearTimeout(timer);
      if (idle !== undefined) cancelIdleCallback(idle);
      timer = undefined; idle = undefined;
    }
    function schedule(urgent = false) {
      clearSchedule(); if (cancelled || done.backward && done.forward) return;
      if (urgent) timer = setTimeout(() => run(8), 0);
      else if (typeof window.requestIdleCallback === 'function') idle = requestIdleCallback(deadline => run(Math.min(4, Math.max(1, deadline.timeRemaining()))), { timeout: 100 });
      else timer = setTimeout(() => run(4), 16);
    }
    function run(milliseconds: number) {
      if (cancelled) return;
      timer = undefined; idle = undefined;
      const end = performance.now() + milliseconds;
      try {
        while (performance.now() < end && !(done.backward && done.forward)) {
          if (waiting.forward.length && !done.forward) currentDirection = 'forward';
          else if (waiting.backward.length && !done.backward) currentDirection = 'backward';
          else if (lead < 3 && !done.forward) currentDirection = 'forward';
          if (done[currentDirection]) currentDirection = currentDirection === 'forward' ? 'backward' : 'forward';
          const direction = currentDirection, next = iterators[direction].next();
          if (next.done) {
            done[direction] = true; waiting[direction].splice(0).forEach(resolve => resolve(null)); publish();
          } else if (next.value) {
            const page = next.value;
            if (direction === 'forward') { after.push(page); lead++; } else before.unshift(page);
            waiting[direction].splice(0).forEach(resolve => resolve(page));
            currentDirection = direction === 'forward' ? 'backward' : 'forward';
            if (first) {
              first = false; publish();
              // Give the visible page a paint before doing any background work.
              timer = setTimeout(() => schedule(), 16); return;
            }
            if (before.length + after.length <= 4 || performance.now() - lastPublished >= 80) publish();
          }
        }
        if (done.backward && done.forward) publish();
        else schedule(first || waiting.forward.length > 0 || waiting.backward.length > 0);
      } catch {
        if (!cancelled) setResult({ key, chapters, pages: [...before, ...after], beforeComplete: done.backward, afterComplete: done.forward, error: 'Không thể chia trang. Hãy thử đổi cỡ chữ hoặc chuyển sang đọc liên tục.' });
        waiting.forward.splice(0).forEach(resolve => resolve(null)); waiting.backward.splice(0).forEach(resolve => resolve(null)); roots.forEach(root => root.remove());
      }
    }
    work.current = { extend: direction => {
      if (cancelled || done[direction]) return Promise.resolve(null);
      return new Promise(resolve => { waiting[direction].push(page => { publish(); resolve(page); }); schedule(true); });
    } };
    void document.fonts.ready.then(() => { if (!cancelled) schedule(true); });
    return () => {
      cancelled = true; clearSchedule(); roots.forEach(root => root.remove()); work.current = null;
      waiting.forward.splice(0).forEach(resolve => resolve(null)); waiting.backward.splice(0).forEach(resolve => resolve(null));
    };
  }, [enabled, size.width, size.height, chapters, layoutKey, key]);
  return {
    pages: active ? result.pages : [], busy: enabled && (!active || !result.pages.length) && !(active && result.error),
    beforeComplete: active && result.beforeComplete, afterComplete: active && result.afterComplete,
    complete: active && result.beforeComplete && result.afterComplete, error: active ? result.error : undefined,
    extend: (direction: Direction) => work.current?.extend(direction) || Promise.resolve(null),
    seek: (position: Book['position']) => {
      anchor.current = position;
      if (!active || !result.pages.some(page => page.fragments.some(f => f.chapter === position.chapter && f.paragraph === position.paragraph && (position.offset || 0) >= f.start && (position.offset || 0) < f.end))) setRevision(value => value + 1);
    },
  };
}
