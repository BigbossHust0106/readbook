import { useState, type ReactNode } from "react";

const PIN = "lasach-parent-pin-v1";
const ACTIVE = "lasach-child-active";
const RETRY = "lasach-pin-retry";
type PinRecord = { salt: number[]; hash: string };
async function hashPin(pin: string, salt: number[]) {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(pin), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits({ name: "PBKDF2", salt: new Uint8Array(salt), iterations: 150000, hash: "SHA-256" }, key, 256);
  return Array.from(new Uint8Array(bits), n => n.toString(16).padStart(2, "0")).join("");
}
export const hasParentPin = () => !!localStorage.getItem(PIN);
export function enterChildLock() {
  if (hasParentPin()) localStorage.setItem(ACTIVE, "true");
}
export async function unlockParent(pin: string) {
  const record = localStorage.getItem(PIN);
  if (!record) return;
  const retry = Number(localStorage.getItem(RETRY) || 0);
  if (Date.now() < retry) throw new Error("Vui lòng đợi 5 giây rồi thử lại.");
  const parsed = JSON.parse(record) as PinRecord;
  if (await hashPin(pin, parsed.salt) !== parsed.hash) {
    localStorage.setItem(RETRY, String(Date.now() + 5000));
    throw new Error("PIN chưa đúng. Vui lòng thử lại sau 5 giây.");
  }
  localStorage.removeItem(ACTIVE);
  localStorage.removeItem(RETRY);
}
export function ParentPinSettings() {
  const [configured, setConfigured] = useState(hasParentPin);
  const [oldPin, setOldPin] = useState("");
  const [pin, setPin] = useState("");
  const [repeat, setRepeat] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  return <section className="panel">
    <h2>PIN phụ huynh</h2>
    <p>Khóa lối về quản lý khi con đang đọc, kể cả khi tải lại trang. PIN chỉ áp dụng trên trình duyệt này; không thay thế bảo mật tài khoản.</p>
    <form onSubmit={async e => {
      e.preventDefault(); setBusy(true);
      try {
        if (!/^\d{4,8}$/.test(pin) || pin !== repeat) throw new Error("Nhập PIN gồm 4–8 số và xác nhận trùng khớp.");
        if (configured) await unlockParent(oldPin);
        const salt = Array.from(crypto.getRandomValues(new Uint8Array(16)));
        localStorage.setItem(PIN, JSON.stringify({ salt, hash: await hashPin(pin, salt) }));
        setConfigured(true); setPin(""); setRepeat(""); setOldPin(""); setMessage("Đã lưu PIN trên thiết bị này.");
      } catch (e) { setMessage((e as Error).message); }
      finally { setBusy(false); }
    }}>
      {configured && <label>PIN hiện tại<input type="password" inputMode="numeric" value={oldPin} onChange={e => setOldPin(e.target.value)} required /></label>}
      <label>PIN mới<input type="password" inputMode="numeric" autoComplete="new-password" minLength={4} maxLength={8} value={pin} onChange={e => setPin(e.target.value)} required /></label>
      <label>Xác nhận PIN<input type="password" inputMode="numeric" autoComplete="new-password" value={repeat} onChange={e => setRepeat(e.target.value)} required /></label>
      <button disabled={busy}>{configured ? "Đổi PIN" : "Lưu PIN"}</button>
    </form>
    <p role="status">{message}</p>
  </section>;
}
export function ParentUnlock({ onUnlock }: { onUnlock: () => void }) {
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  return <form onSubmit={async e => {
    e.preventDefault(); setBusy(true);
    try { await unlockParent(pin); onUnlock(); }
    catch (e) { setError((e as Error).message); }
    finally { setBusy(false); }
  }}>
    {hasParentPin() && <label>PIN phụ huynh<input type="password" inputMode="numeric" value={pin} onChange={e => setPin(e.target.value)} required /></label>}
    <button disabled={busy}>Về quản lý hồ sơ</button>
    {error && <p role="alert">{error}</p>}
  </form>;
}
export function ParentGate({ children }: { children: ReactNode }) {
  const [locked, setLocked] = useState(() => localStorage.getItem(ACTIVE) === "true" && hasParentPin());
  return locked ? <main className="child-room"><h1>Khu vực phụ huynh</h1><p>Phiên đọc của trẻ đã được khóa. Nhập PIN để mở lại ứng dụng.</p><ParentUnlock onUnlock={() => setLocked(false)} /></main> : children;
}
