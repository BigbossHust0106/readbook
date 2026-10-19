import { describe, it, expect } from "vitest";
import {
  textChapters,
  applyTranslation,
  pendingParagraphs,
  mergeWord,
  type Book,
  type Word,
} from "../src/model";
describe("Book model", () => {
  it("preserves source text, paragraph alignment and chapter order", () => {
    const c = textChapters(
      "Chương 1\n\n你好，世界！\n\nHello 42.\n\nChương 2\n\nXin chào.",
    );
    expect(c).toHaveLength(2);
    expect(c[0].paragraphs.map((p) => p.text)).toEqual([
      "你好，世界！",
      "Hello 42.",
    ]);
    expect(c[1].title).toBe("Chương 2");
    expect(new Set(c.flatMap((x) => x.paragraphs.map((p) => p.id))).size).toBe(
      3,
    );
  });
  it("keeps manual locked translations and skips saved paragraphs after interruption", () => {
    const chapters = textChapters("Một đoạn.\n\nĐoạn khác.");
    const p = chapters[0].paragraphs[0];
    const first = applyTranslation(p, "en", "A paragraph.", "manual");
    first.translations.en!.locked = true;
    expect(applyTranslation(first, "en", "replacement", "LibreTranslate")).toBe(
      first,
    );
    chapters[0].paragraphs[0] = first;
    expect(
      pendingParagraphs({ chapters } as Book, "en").map((p) => p.text),
    ).toEqual(["Đoạn khác."]);
  });
  it("records restorable versions without changing source", () => {
    const p = textChapters("Nội dung gốc.")[0].paragraphs[0];
    const edited = applyTranslation(
      applyTranslation(p, "en", "Old", "LibreTranslate"),
      "en",
      "New",
      "manual",
    );
    expect(edited.text).toBe("Nội dung gốc.");
    expect(edited.translations.en!.history).toEqual(["Old"]);
  });
  it("merges exact meanings while keeping distinct meanings and book contexts", () => {
    const w: Word = {
      id: "a",
      term: "Book",
      meaning: "sách",
      language: "en",
      contexts: [],
      status: "new",
      createdAt: "",
    };
    const next = mergeWord([w], {
      ...w,
      id: "b",
      term: "book",
      contexts: [
        { bookId: "b", bookTitle: "B", paragraphId: "p", sentence: "A book." },
      ],
    });
    expect(next).toHaveLength(1);
    expect(next[0].contexts).toHaveLength(1);
    expect(mergeWord(next, { ...w, id: "c", meaning: "đặt chỗ" })).toHaveLength(
      2,
    );
  });
  it("rejects empty imports", () =>
    expect(() => textChapters(" \n\n ")).toThrow());
});

import { vocabularyCsv } from "../src/csv";
import Papa from "papaparse";
it("escapes spreadsheet formulas on CSV export while quoting commas and newlines", () => {
  const csv = vocabularyCsv([
    {
      id: "1",
      term: '=WEBSERVICE("https://invalid")',
      meaning: "nghĩa, với dấu phẩy\nvà dòng mới",
      language: "en",
      contexts: [],
      status: "new",
      createdAt: "",
    },
  ]);
  const data = Papa.parse<Record<string, string>>(csv, { header: true })
    .data[0];
  expect(data.term.startsWith("'=")).toBe(true);
  expect(data.meaning).toBe("nghĩa, với dấu phẩy\nvà dòng mới");
});
