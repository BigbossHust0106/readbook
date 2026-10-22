// Keep Google TTS requests short and do not split a UTF-16 surrogate pair.
export function speechChunks(text: string, limit = 180): string[] {
  const points = Array.from(text.trim()), chunks: string[] = [];
  for (let start = 0; start < points.length;) {
    let end = Math.min(points.length, start + limit);
    if (end < points.length) {
      for (let at = end - 1; at > start + limit * .5; at--) {
        if (/[\s。！？.!?;；]/u.test(points[at])) { end = at + 1; break; }
      }
    }
    chunks.push(points.slice(start, end).join('')); start = end;
  }
  return chunks;
}
