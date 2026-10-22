import { useEffect, useRef, useState } from 'react';
import type { Lang } from './model';
import { speechChunks } from './speech';
export type SpeechProvider = 'google' | 'device';
type Phase = 'idle' | 'loading' | 'playing' | 'paused' | 'error';
type Session = { chunks: string[]; index: number; language: Lang; provider: SpeechProvider; abort: AbortController; urls: Set<string>; cache: Map<number, Promise<string>> };
export function useSpeechReader(provider: SpeechProvider, rate: number, voiceURI: string) {
  const audio = useRef<HTMLAudioElement>(null), session = useRef<Session | null>(null), utterance = useRef<SpeechSynthesisUtterance | null>(null);
  const settings = useRef({ provider, rate, voiceURI }); settings.current = { provider, rate, voiceURI };
  const [phase, setPhase] = useState<Phase>('idle'), [error, setError] = useState(''), [label, setLabel] = useState(''), [part, setPart] = useState('');
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const phaseRef = useRef<Phase>('idle'), watchdog = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const pumpRef = useRef<(current: Session, index: number) => Promise<void>>(async () => {});
  function state(next: Phase) { phaseRef.current = next; setPhase(next); }
  function stop(update = true) {
    const old = session.current; session.current = null; old?.abort.abort();
    clearTimeout(watchdog.current);
    if (audio.current) { audio.current.pause(); audio.current.removeAttribute('src'); audio.current.load(); }
    if (utterance.current && 'speechSynthesis' in window) window.speechSynthesis.cancel();
    utterance.current = null; old?.urls.forEach(url => URL.revokeObjectURL(url));
    if (update) { state('idle'); setError(''); }
  }
  function fail(current: Session, message: string) {
    if (session.current !== current) return;
    clearTimeout(watchdog.current);
    if(current.provider==='device'){utterance.current=null;window.speechSynthesis?.cancel();}
    state('error'); setError(message);
  }
  async function load(current: Session, index: number) {
    let cached = current.cache.get(index);
    if (!cached) {
      cached = (async () => {
        const response = await fetch('/api/speech', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text: current.chunks[index], language: current.language }), signal: AbortSignal.any([current.abort.signal, AbortSignal.timeout(25000)]) });
        if (!response.ok) { const value = await response.json(); throw new Error(value.error || 'Không tải được giọng đọc.'); }
        const blob = await response.blob();
        if (!blob.size || blob.size > 1024 * 1024 || !/audio\/mpeg/.test(blob.type)) throw new Error('Nguồn đọc chưa trả về âm thanh MP3 hợp lệ.');
        if (session.current !== current) throw new DOMException('Stopped', 'AbortError');
        const url = URL.createObjectURL(blob); current.urls.add(url); return url;
      })().catch(error => { current.cache.delete(index); throw error; });
      current.cache.set(index, cached);
    }
    return cached;
  }
  async function pump(current: Session, index: number) {
    if (session.current !== current) return;
    if (index >= current.chunks.length) { stop(); return; }
    current.index = index; state('loading'); setError(''); setPart(`${index + 1}/${current.chunks.length}`);
    if (current.provider === 'google') {
      try {
        const url = await load(current, index); if (session.current !== current || !audio.current) return;
        audio.current.src = url; audio.current.playbackRate = settings.current.rate;
        await audio.current.play();
        if (session.current !== current) return;
        if (index + 1 < current.chunks.length) void load(current, index + 1).catch(() => {});
        // Keep only current/next/recent audio rather than an entire spoken book.
        const previous = current.cache.get(index - 2);
        current.cache.delete(index - 2);
        if (previous) void previous.then(url => { current.urls.delete(url); URL.revokeObjectURL(url); }).catch(() => {});
      } catch (e) {
        if (session.current !== current) return;
        if ((e as Error).name === 'NotAllowedError') { state('paused'); setError('Bấm Phát trên trình phát bên dưới để bắt đầu nghe.'); }
        else fail(current, (e as Error).name==='NotSupportedError'?'Trình duyệt không phát được âm thanh này. Bấm thử đọc lại hoặc chọn giọng thiết bị.':(e as Error).name === 'AbortError' || (e as Error).name === 'TimeoutError' ? 'Tải giọng đọc quá thời gian chờ. Bấm thử đọc lại.' : (e as Error).message);
      }
      return;
    }
    if (!('speechSynthesis' in window) || typeof SpeechSynthesisUtterance === 'undefined') { fail(current, 'Thiết bị chưa hỗ trợ giọng đọc. Chọn Google trực tuyến trong công cụ đọc.'); return; }
    let available = window.speechSynthesis.getVoices();
    if (!available.length) {
      await new Promise<void>(resolve => {
        const finish = () => { clearTimeout(timer); window.speechSynthesis.removeEventListener('voiceschanged', finish);current.abort.signal.removeEventListener('abort',finish); resolve(); };
        const timer = setTimeout(finish, 1500); window.speechSynthesis.addEventListener('voiceschanged', finish, { once: true });current.abort.signal.addEventListener('abort',finish,{once:true});
      });
      if (session.current !== current) return; available = window.speechSynthesis.getVoices();
    }
    const matches = available.filter(v => v.lang.toLowerCase().startsWith(current.language));
    const voice = matches.find(v => v.voiceURI === settings.current.voiceURI) || matches.find(v => v.default) || matches[0];
    if (!voice) { fail(current, 'Thiết bị chưa có giọng cho ngôn ngữ sách. Chọn Google trực tuyến hoặc cài thêm giọng đọc trên thiết bị.'); return; }
    const next = new SpeechSynthesisUtterance(current.chunks[index]); utterance.current = next;
    next.lang = { vi: 'vi-VN', zh: 'zh-CN', en: 'en-US' }[current.language]; next.voice = voice; next.rate = settings.current.rate;
    next.onstart = () => { if (session.current === current && utterance.current===next) { clearTimeout(watchdog.current); state('playing'); } };
    next.onend = () => { if (session.current === current && utterance.current===next) { clearTimeout(watchdog.current); utterance.current = null; void pumpRef.current(current, index + 1); } };
    next.onerror = () => {if(utterance.current===next)fail(current, 'Giọng thiết bị không phát được. Hãy chọn Google trực tuyến hoặc kiểm tra giọng đã cài.');};
    watchdog.current = setTimeout(() => fail(current, 'Giọng thiết bị không bắt đầu phát. Hãy chọn Google trực tuyến.'), 5000);
    window.speechSynthesis.resume(); window.speechSynthesis.speak(next);
  }
  pumpRef.current = pump;
  useEffect(() => {
    if (!('speechSynthesis' in window)) return;
    const update = () => setVoices(window.speechSynthesis.getVoices()); update();
    window.speechSynthesis.addEventListener('voiceschanged', update); return () => window.speechSynthesis.removeEventListener('voiceschanged', update);
  }, []);
  useEffect(() => {
    const node = audio.current; if (!node) return;
    const play = () => { if (session.current?.provider === 'google') { setError(''); state('playing'); } };
    const pause = () => { if (session.current?.provider === 'google' && phaseRef.current === 'playing' && !node.ended) state('paused'); };
    const ended = () => { const current = session.current; if (current?.provider === 'google') void pumpRef.current(current, current.index + 1); };
    const error = () => { const current = session.current; if (current?.provider === 'google' && node.getAttribute('src')) fail(current, 'Không phát được MP3. Bấm thử đọc lại hoặc kiểm tra âm lượng của thiết bị.'); };
    node.addEventListener('play', play); node.addEventListener('pause', pause); node.addEventListener('ended', ended); node.addEventListener('error', error);
    return () => { node.removeEventListener('play', play); node.removeEventListener('pause', pause); node.removeEventListener('ended', ended); node.removeEventListener('error', error); stop(false); };
  }, []);
  useEffect(() => { if (audio.current) audio.current.playbackRate = rate; }, [rate]);
  useEffect(() => { stop(); }, [provider]);
  return { audio, phase, error, label, part, voices,
    start(text: string, language: Lang, label: string) {
      stop(); const chunks = speechChunks(text); if (!chunks.length) return;
      const next: Session = { chunks, index: 0, language, provider: settings.current.provider, abort: new AbortController(), urls: new Set(), cache: new Map() };
      session.current = next; setLabel(label); void pump(next, 0);
    },
    stop: () => stop(),
    retry() { const current = session.current; if (current) { if (utterance.current) { utterance.current = null;window.speechSynthesis.cancel(); } void pump(current, current.index); } },
    pause() { if (session.current?.provider === 'google') audio.current?.pause(); else if ('speechSynthesis' in window) { window.speechSynthesis.pause(); state('paused'); } },
    async resume() {
      const current = session.current; if (!current) return;
      if (current.provider === 'google') { try { await audio.current?.play(); } catch { fail(current, 'Bấm Phát trên trình phát để nghe tiếp.'); } }
      else { window.speechSynthesis.resume(); state('playing'); }
    },
  };
}
