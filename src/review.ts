import type { Word } from "./model";

export function dueWords(words: Word[], now = Date.now()) {
  return words.filter(w => w.status !== "ignored" &&
    (w.review ? Date.parse(w.review.dueAt) <= now : w.status !== "known"))
    .sort((a, b) => (a.review ? Date.parse(a.review.dueAt) : 0) -
      (b.review ? Date.parse(b.review.dueAt) : 0));
}

export function reviewWord(word: Word, grade: "again" | "hard" | "good", now = Date.now()): Word {
  const previous = word.review?.intervalDays || 0;
  const intervalDays = grade === "again" ? 0 : grade === "hard" ? Math.max(1, previous) :
    Math.min(365, previous ? previous * 2 : 1);
  return { ...word, status: "learning", review: {
    intervalDays,
    repetitions: (word.review?.repetitions || 0) + 1,
    dueAt: new Date(now + (grade === "again" ? 600000 : intervalDays * 86400000)).toISOString(),
  }};
}
