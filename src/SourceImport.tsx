import { useEffect, useRef, useState } from 'react';
type Source = { title: string; author: string; links: { url: string; label: string }[]; external: { url: string; label: string }[] };
export function SourceImport({ onFile, disabled, onBusy }: { onBusy: (busy: boolean) => void; onFile: (file: File, title: string, author: string) => void; disabled: boolean }) {
  const [url, setUrl] = useState(''), [data, setData] = useState<Source | null>(null), [error, setError] = useState(''), [busy, setBusy] = useState(false), [rights, setRights] = useState(false);
  const [search, setSearch] = useState("");
  const [catalog, setCatalog] = useState<{title: string; url: string}[]>([]);
  const [catalogError, setCatalogError] = useState("");
  const abort = useRef<AbortController | null>(null);
  async function loadCatalog() {
    setBusy(true); onBusy(true); setCatalogError(""); abort.current = new AbortController();
    try {
      const r = await fetch("/api/source/catalog", { signal: abort.current.signal }); const data = await r.json();
      if (!r.ok) throw new Error(data.error || "Chưa tải được danh mục DTV.");
      setCatalog(data.books);
      if (!data.books.length) setCatalogError("Chưa tìm thấy đầu sách trên trang nguồn; hãy dùng ô tìm kiếm.");
    } catch (e) { setCatalogError((e as Error).name === "AbortError" ? "Đã hủy tải danh mục." : (e as Error).message); }
    finally { setBusy(false); onBusy(false); }
  }
  useEffect(() => () => abort.current?.abort(), []);
  async function run(download?: string) {
    setBusy(true); onBusy(true); setError(''); abort.current = new AbortController();
    try {
      const response = await fetch(`/api/source/${download ? 'download' : 'inspect'}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ url: download || url }), signal: abort.current.signal });
      if (!response.ok) { const value = await response.json(); throw new Error(value.error || 'Không tải được nguồn sách.'); }
      if (!download) setData(await response.json());
      else {
        const blob = await response.blob();
        if (blob.size > 50 * 1024 * 1024) throw new Error('Tệp tối đa 50 MB.');
        const filename = decodeURIComponent(response.headers.get('X-Book-Filename') || 'sach.epub');
        onFile(new File([blob], filename, { type: blob.type }), data?.title || '', data?.author || '');
      }
    } catch (e) { setError((e as Error).name === 'AbortError' ? 'Đã hủy tải nguồn sách.' : (e as Error).message); }
    finally { setBusy(false); onBusy(false); }
  }
  return <details className="source-import"><summary>Tìm sách trên DTV-Ebook</summary>
    <p>Tìm đầu sách, mở trang DTV để tải tệp, rồi dùng Chọn tệp sách ở bên dưới.</p>
    <label>Tìm đầu sách DTV<input type="search" value={search} onChange={e => setSearch(e.target.value)} placeholder="Tên sách, tác giả hoặc chủ đề…" /></label>
    <div className="row">
      <a className="button primary" href={`https://dtv-ebook.com.vn/#gsc.tab=0&gsc.q=${encodeURIComponent(search.trim())}&gsc.sort=`} target="_blank" rel="noopener noreferrer">Tìm trên DTV</a>
      <a className="button" href={`https://www.google.com/search?q=${encodeURIComponent("site:dtv-ebook.com.vn " + search.trim())}`} target="_blank" rel="noopener noreferrer">Tìm bằng Google trong DTV</a>
      <button disabled={disabled || busy} onClick={() => void loadCatalog()}>Tải danh mục mới</button>
    </div>
    {catalogError && <p role="status">{catalogError}</p>}
    {catalog.length > 0 && <ul className="source-catalog">{catalog.filter(b => !search.trim() || b.title.toLocaleLowerCase("vi").includes(search.trim().toLocaleLowerCase("vi"))).map(b => <li key={b.url}><a href={b.url} target="_blank" rel="noopener noreferrer">{b.title}</a></li>)}</ul>}
    <details><summary>Hoặc nhập từ liên kết tệp/trang sách</summary>
    <p>Dán trang giới thiệu hoặc liên kết tệp trực tiếp. Chỉ nhập tài liệu bạn được phép sử dụng.</p>
    <label>Liên kết trang sách<input type="url" placeholder="https://dtv-ebook.com.vn/..." value={url} disabled={disabled || busy} onChange={e => { setUrl(e.target.value); setData(null); setError(''); }} /></label>
    <button disabled={disabled || busy || !url.trim()} onClick={() => void run()}>Tìm tệp sách</button>
    {busy && <><span role="status"> Đang đọc nguồn sách… </span><button onClick={() => abort.current?.abort()}>Hủy tải nguồn</button></>}
    {error && <p role="alert">{error}</p>}
    {data && <><p><strong>{data.title || 'Trang sách'}</strong>{data.author ? ` · ${data.author}` : ''}</p>
      <label className="checkbox"><input type="checkbox" checked={rights} onChange={e => setRights(e.target.checked)} />Tôi có quyền tải và sử dụng tệp này.</label>
      {data.links.map(link => <button key={link.url} disabled={!rights || busy || disabled} onClick={() => void run(link.url)}>Nhập {link.label}</button>)}
      {!data.links.length && <p>Chưa tìm thấy tệp tải trực tiếp cùng tên miền. Bạn có thể tải tệp trên trang nguồn rồi dùng Chọn tệp sách.</p>}
      {data.external.length > 0 && <p>Trang có liên kết tải trên dịch vụ bên ngoài. Mở trang nguồn để tải theo hướng dẫn, sau đó nhập tệp vào thư viện.</p>}
      <a href={url} target="_blank" rel="noopener noreferrer">Mở trang nguồn</a>
    </>}
    </details>
  </details>;
}
