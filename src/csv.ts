import Papa from "papaparse";
import type { Word } from "./model";
export function vocabularyCsv(words: Word[]) {
  return (
    "\uFEFF" +
    Papa.unparse(
      words.map((w) => ({
        term: w.term,
        meaning: w.meaning,
        language: w.language,
        status: w.status,
        note: w.contexts.map((c) => `${c.bookTitle}: ${c.sentence}`).join("\n"),
      })),
      { escapeFormulae: true },
    )
  );
}
