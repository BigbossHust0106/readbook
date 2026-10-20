import { useState } from "react";
import type { Word } from "./model";
import { dueWords, reviewWord } from "./review";

export function ReviewPanel({ words, onSave }: { words: Word[]; onSave: (words: Word[]) => Promise<void> }) {
  const [shown, setShown] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [started, setStarted] = useState(false);
  const due = dueWords(words);
  const word = due[0];
  async function rate(grade: "again" | "hard" | "good") {
    if (!word || busy) return;
    setBusy(true); setError("");
    try {
      await onSave(words.map(w => w.id === word.id ? reviewWord(w, grade) : w));
      setShown(null);
    } catch { setError("Chưa lưu được lịch ôn. Hãy thử lại."); }
    finally { setBusy(false); }
  }
  return <section className="panel review-panel" aria-label="Ôn từ vựng">
    <h2>Ôn từ mỗi ngày</h2>
    <p>{due.length} từ đến lượt ôn. Từ đã bỏ qua không xuất hiện trong buổi ôn.</p>
    {!started ? <button className="primary" disabled={!word} onClick={() => setStarted(true)}>Bắt đầu ôn</button> :
      word ? <>
        <h3 lang={word.language}>{word.term}</h3>
        {shown === word.id ? <>
          <p>{word.meaning || "Chưa có nghĩa — bạn có thể bổ sung trong sổ từ."}</p>
          {word.contexts[0] && <blockquote>{word.contexts[0].sentence}</blockquote>}
          <div className="row">
            <button disabled={busy} onClick={() => void rate("again")}>Chưa nhớ · 10 phút</button>
            <button disabled={busy} onClick={() => void rate("hard")}>Còn khó · {Math.max(1, word.review?.intervalDays || 0)} ngày</button>
            <button disabled={busy} onClick={() => void rate("good")}>Đã nhớ · {Math.min(365, (word.review?.intervalDays || 0) * 2 || 1)} ngày</button>
          </div>
        </> : <button onClick={() => setShown(word.id)}>Hiện nghĩa</button>}
      </> : <p>Đã ôn hết lượt này. Hẹn bạn ở lần ôn tiếp theo!</p>}
    {error && <p role="alert">{error}</p>}
  </section>;
}
