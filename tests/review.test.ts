import { describe, expect, it } from "vitest";
import { dueWords, reviewWord } from "../src/review";
import { assertWord, assertChild, type Word } from "../src/model";
const now = Date.parse("2026-10-20T00:00:00Z");
const word: Word = { id: "w", term: "sách", meaning: "book", language: "vi", contexts: [], status: "new", createdAt: new Date(now).toISOString() };
describe("review scheduling", () => {
  it("excludes ignored and unscheduled known words, keeps future reviews out", () => {
    expect(dueWords([word, { ...word, id: "ignored", status: "ignored" }, { ...word, id: "known", status: "known" }, reviewWord({ ...word, id: "later" }, "good", now)], now).map(w => w.id)).toEqual(["w"]);
  });
  it("repeats forgotten words after ten minutes and grows successful intervals", () => {
    const again = reviewWord(word, "again", now);
    expect(dueWords([again], now + 599999)).toHaveLength(0);
    expect(dueWords([again], now + 600000)).toHaveLength(1);
    const good = reviewWord(again, "good", now);
    expect(good.review?.intervalDays).toBe(1);
    const second = reviewWord(good, "good", now + 86400000);
    expect(second.review?.intervalDays).toBe(2);
    expect(reviewWord(second, "hard", now).review?.intervalDays).toBe(2);
    expect(word.review).toBeUndefined();
  });
  it("rejects malformed backup schedules and practice history", () => {
    expect(() => assertWord({ ...word, review: { dueAt: "invalid", intervalDays: -1, repetitions: 0 } })).toThrow();
    expect(() => assertChild({ id: "c", nickname: "An", age: 6, level: "Đọc câu", languages: ["vi"], practice: [{ id: "s", bookTitle: "Sách", completedAt: "bad", seconds: 2, sentences: 1 }] })).toThrow();
  });
});
