import { useEffect, useRef, useState } from 'react';
type BookLink = { title: string; url: string };
type Source = { title: string; author: string; links: { url: string; label: string }[]; external: { url: string; label: string }[] };
export function SourceImport({ onFile, disabled, onBusy }: { onBusy: (busy: boolean) => void; onFile: (file: File, title: string, author: string, autoImport?: boolean) => void | Promise<void>; disabled: boolean }) {
  const [url, setUrl] = useState(''), [data, setData] = useState<Source | null>(null), [error, setError] = useState(''), [busy, setBusy] = useState(false), [saving, setSaving] = useState(false), [rights, setRights] = useState(false), [status, setStatus] = useState('');
  const [search, setSearch] = useState(''), [results, setResults] = useState<BookLink[]>([]), [catalog, setCatalog] = useState<BookLink[]>([]);
  const [catalogError, setCatalogError] = useState(''), [nextStart, setNextStart] = useState<number | null>(null), [resultQuery, setResultQuery] = useState('');
  const abort = useRef<AbortController | null>(null);
  const [autoMode, setAutoMode] = useState(false);
  useEffect(() => () => abort.current?.abort(), []);
  async function operation(work: (signal: AbortSignal) => Promise<void>, catalogOperation = false) {
    setBusy(true); onBusy(true); setError(''); setStatus(''); if (catalogOperation) setCatalogError('');
    const controller = new AbortController(); abort.current = controller;
    try { await work(controller.signal); }
    catch (e) { setStatus(''); const message = controller.signal.aborted ? 'Đã hủy tải nguồn sách.' : (e as Error).message; if (catalogOperation) setCatalogError(message); else setError(message); }
    finally { setBusy(false); setSaving(false); onBusy(false); }
  }
  async function json(path: string, body: unknown, signal: AbortSignal) {
    const response = await fetch(`/api/source/${path}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), signal });
    const value = await response.json(); if (!response.ok) throw new Error(value.error || 'Không tải được nguồn sách.'); return value;
  }
  async function download(link: string, source: Source, signal: AbortSignal, autoImport = false) {
    setStatus('Đang tải tệp sách…');
    const response = await fetch('/api/source/download', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ url: link }), signal });
    if (!response.ok) { const value = await response.json(); throw new Error(value.error || 'Không tải được tệp sách.'); }
    const blob = await response.blob(); if (blob.size > 50 * 1024 * 1024) throw new Error('Tệp tối đa 50 MB.');
    const filename = decodeURIComponent(response.headers.get('X-Book-Filename') || 'sach.epub');
    signal.throwIfAborted(); setSaving(true); setStatus('Đang chuẩn bị nhập sách…');
    await onFile(new File([blob], filename, { type: blob.type }), source.title, source.author, autoImport);
    setStatus(/\.pdf$/i.test(filename) ? 'Đã tải PDF. Chọn Đọc PDF / OCR bên dưới để xử lý trước khi lưu vào thư viện.' : autoImport ? 'Đã thêm sách vào thư viện.' : 'Đã tải tệp. Kiểm tra thông tin rồi bấm Nhập & lưu sách.');
  }
  function inspect(value: string, autoImport = false) {
    setUrl(value); setData(null); setAutoMode(autoImport);
    void operation(async signal => {
      const source: Source = await json('inspect', { url: value }, signal); setData(source);
      if (autoImport && source.links.length === 1) await download(source.links[0].url, source, signal, true);
      else if (autoImport && source.links.length > 1) setStatus('Chọn định dạng sách muốn thêm bên dưới.');
    });
  }
  function find(start = 1) {
    const query = start === 1 ? search.trim() : resultQuery;
    if (!query) return;
    if (/^https:\/\//i.test(query)) { inspect(query); return; }
    if (start === 1) { setResults([]); setNextStart(null); }
    void operation(async signal => {
      const value = await json('search', { query, start }, signal);
      setResults(old => [...new Map([...(start === 1 ? [] : old), ...value.books].map((b: BookLink) => [b.url, b])).values()]);
      setResultQuery(query); setNextStart(value.nextStart);
      if (!value.books.length) setStatus('Chưa có kết quả phù hợp. Thử từ khóa khác hoặc mở tìm kiếm trên DTV.');
    });
  }
  const cards = (books: BookLink[]) => <ul className="source-catalog">{books.map(book => <li key={book.url}>
    <strong>{book.title}</strong><a href={book.url} target="_blank" rel="noopener noreferrer">{book.url}</a>
    <button disabled={disabled || busy || !rights} onClick={() => inspect(book.url, true)}>Thêm vào thư viện</button>
  </li>)}</ul>;
  return <details className="source-import"><summary>Tìm sách trên DTV-Ebook</summary>
    <p>Tìm sách hoặc dán liên kết trang DTV / tệp Google Drive công khai. EPUB, DOCX và TXT có thể thêm trực tiếp; PDF cần xử lý OCR trước khi lưu.</p>
    <label>Tìm đầu sách DTV<input type="search" value={search} disabled={disabled || busy} onChange={e => setSearch(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); find(); } }} placeholder="Tên sách, tác giả hoặc liên kết sách…" /></label>
    <div className="row">
      <button className="primary" disabled={disabled || busy || !search.trim()} onClick={() => find()}>Tìm sách</button>
      <a className="button" href={`https://dtv-ebook.com.vn/#gsc.tab=0&gsc.q=${encodeURIComponent(search.trim())}&gsc.sort=`} target="_blank" rel="noopener noreferrer">Tìm trên DTV</a>
      <a className="button" href={`https://www.google.com/search?q=${encodeURIComponent('site:dtv-ebook.com.vn ' + search.trim())}`} target="_blank" rel="noopener noreferrer">Tìm bằng Google trong DTV</a>
      <button disabled={disabled || busy} onClick={() => void operation(async signal => {
        const response = await fetch('/api/source/catalog', { signal }); const value = await response.json();
        if (!response.ok) throw new Error(value.error || 'Chưa tải được danh mục DTV.');
        setCatalog(value.books); if (!value.books.length) setCatalogError('Chưa tìm thấy đầu sách trên trang nguồn.');
      }, true)}>Tải danh mục mới</button>
    </div>
    <label className="checkbox"><input type="checkbox" checked={rights} disabled={busy} onChange={e => setRights(e.target.checked)} />Tôi có quyền tải và sử dụng tệp này.</label>
    {catalogError && <p role="status">{catalogError}</p>}
    {results.length > 0 && <><p>Kết quả tìm kiếm: {resultQuery}</p>{cards(results)}{nextStart && <button disabled={disabled || busy} onClick={() => find(nextStart)}>Xem thêm kết quả</button>}</>}
    {catalog.length > 0 && <><p>Danh mục gần đây trên trang chủ DTV (tối đa 100 đầu sách)</p>{cards(catalog.filter(b => !search.trim() || b.title.toLocaleLowerCase('vi').includes(search.trim().toLocaleLowerCase('vi'))))}</>}
    <details><summary>Hoặc nhập từ liên kết tệp/trang sách</summary>
      <p>Liên kết Google Drive cần cho phép người có liên kết tải tệp, không yêu cầu đăng nhập.</p>
      <label>Liên kết trang sách<input type="url" placeholder="https://docs.google.com/uc?id=… hoặc trang DTV" value={url} disabled={disabled || busy} onChange={e => { setUrl(e.target.value); setData(null); setError(''); }} /></label>
      <button disabled={disabled || busy || !url.trim()} onClick={() => inspect(url)}>Tìm tệp sách</button>
    </details>
    {busy && <><span role="status"> {status || 'Đang đọc nguồn sách…'} </span>{!saving && <button onClick={() => abort.current?.abort()}>Hủy tải nguồn</button>}</>}
    {!busy && status && <p role="status">{status}</p>}
    {error && <p role="alert">{error}</p>}
    {data && <><p><strong>{data.title || 'Trang sách'}</strong>{data.author ? ` · ${data.author}` : ''}</p>
      {data.links.map(link => <button key={link.url} disabled={!rights || busy || disabled} onClick={() => void operation(signal => download(link.url, data, signal, autoMode))}>Nhập {link.label}</button>)}
      {!data.links.length && <p>Chưa tìm thấy tệp tải được từ DTV hoặc Google Drive. Bạn có thể tải trên trang nguồn rồi dùng Chọn tệp sách.</p>}
      {data.external.map(link => <p key={link.url}><a href={link.url} target="_blank" rel="noopener noreferrer">{link.label} (mở nguồn tải khác)</a></p>)}
      <a href={url} target="_blank" rel="noopener noreferrer">Mở trang nguồn</a>
    </>}
  </details>;
}
