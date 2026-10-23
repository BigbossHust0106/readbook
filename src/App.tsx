import {previewPage} from "./pageSnapshot";
import {readerFonts,readerThemes,readerFontFamilies} from "./readerAppearance";
import {usePageTurn} from "./usePageTurn";
import {Modal} from "./Modal";
import {InstallAppContent,useAppInstall} from "./InstallApp";
import {FileDropZone} from "./FileDropZone";
import {bookFileMetadata,splitBookName} from "./bookMetadata";
import {TranslationImport} from "./TranslationImport";
import {applyImportedTranslations} from "./translationImport";
import {putBookmark,removeBookmark} from "./bookmarks";
import {useSpeechReader,type SpeechProvider} from "./useSpeechReader";
import {useViewportPages} from "./useViewportPages";
import {SyncPanel} from "./SyncPanel";
import {flushEdits,syncEdits} from "./cloudSync";
import { ReaderDock,BookmarksPanel,BookSearchPanel } from "./ReaderDock";
import { WordPopover } from "./WordPopover";
import {type SelectedText} from "./wordLookup";
import { useReadingProgress } from "./useReadingProgress";
import { GroupsPanel } from "./GroupsPanel";
import { importGroupBook } from "./groups";
import { SourceImport } from "./SourceImport";
import { pageForPosition, translatedFragment, type Fragment } from "./reading";
import { ReviewPanel } from "./ReviewPanel";
import { ParentPinSettings, ParentUnlock, enterChildLock } from "./ParentLock";
import { lazy, Suspense, useEffect, useMemo, useRef, useState } from "react";
import {
  BookOpen,
  Library,
  Languages,
  Headphones,
  GraduationCap,
  Settings,
  Plus,
  Search,
  ArrowUpRight,
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  Upload,
  FileText,
  X,
  Bookmark,
  BookmarkPlus,
  Volume2,
  Pause,
  Check,
  Trash2,
  Download,
  Leaf,
  Cloud,
  WifiOff,
  Highlighter,
  LogOut,
  Menu,
  Lock,
  Unlock,
  Play,
  RefreshCw,
  ExternalLink,
} from "lucide-react";
import Papa from "papaparse";
import { vocabularyCsv } from "./csv";
import {
  id,
  languages,
  mergeWord,
  pendingParagraphs,
  applyTranslation,
  assertBook,
  assertWord,
  assertChild,
  type Lang,
  type Book,
  type Word,
  type Child,
  type Paragraph,
} from "./model";
import { importDocument, MAX_FILE } from "./importer";
import type { PdfTextPage, PdfProgress } from "./pdf";
const PdfPageView = lazy(() => import("./PdfPageView"));
import * as store from "./store";

type Page = "library" | "vocabulary" | "children" | "settings" | "groups";
type Capability = {
  configured: boolean;
  pairs: { source: string; targets: string[] }[];
  provider: string;
  reason?: string;
};
const labels = {
  reading: "Đang đọc",
  later: "Đọc sau",
  favorite: "Yêu thích",
  done: "Hoàn thành",
};
function errorText(e: unknown) {
  return e instanceof Error
    ? e.message
    : typeof e === "object" && e && "message" in e
      ? String(e.message)
      : "Thao tác thất bại. Dữ liệu đã lưu vẫn được giữ.";
}
function download(name: string, blob: Blob) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
function LanguageSelect({
  value,
  onChange,
  label,
}: {
  value: Lang;
  onChange: (v: Lang) => void;
  label: string;
}) {
  return (
    <label>
      {label}
      <select value={value} onChange={(e) => onChange(e.target.value as Lang)}>
        {Object.entries(languages).map(([v, n]) => (
          <option key={v} value={v}>
            {n}
          </option>
        ))}
      </select>
    </label>
  );
}

export default function App() {
  const appInstall=useAppInstall();
  const [installOpen,setInstallOpen]=useState(false);
  const [page, setPage] = useState<Page>("library");
  const [books, setBooks] = useState<Book[]>([]);
  const [words, setWords] = useState<Word[]>([]);
  const [children, setChildren] = useState<Child[]>([]);
  const [cloud, setCloud] = useState(false);
  const [syncStatus, setSyncStatus] = useState("Đã đồng bộ");
  const [pendingCount,setPendingCount]=useState(0);
  const [importGroup, setImportGroup] = useState<string | null>(null);
  const [groupsVersion,setGroupsVersion]=useState(0);
  const loadingSequence = useRef(0);
  const sessionId = useRef("");
  const [email, setEmail] = useState("");
  const [sessionEmail, setSessionEmail] = useState("");
  const [password, setPassword] = useState("");
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("all");
  const [languageFilter, setLanguageFilter] = useState("all");
  const [importOpen, setImportOpen] = useState(false);
  const [droppedFile,setDroppedFile]=useState<File|null>(null),[dropError,setDropError]=useState('');
  const [selected, setSelected] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [ready, setReady] = useState(false);
  const [mobileNav, setMobileNav] = useState(false);
  const [online, setOnline] = useState(navigator.onLine);
  const [cap, setCap] = useState<Capability | null>(null);
  const [csv, setCsv] = useState<{
    rows: Record<string, string>[];
    fields: string[];
  } | null>(null);
  const [mapping, setMapping] = useState({
    term: "term",
    meaning: "meaning",
    language: "language",
    note: "note",
  });
  const [csvDuplicate, setCsvDuplicate] = useState<"merge" | "separate">(
    "merge",
  );
  useEffect(()=>{
    if(!mobileNav)return;
    const prior=document.activeElement as HTMLElement|null,drawer=document.querySelector<HTMLElement>('.sidebar');drawer?.querySelector<HTMLElement>('button')?.focus();
    const key=(e:KeyboardEvent)=>{if(e.key==='Escape'){setMobileNav(false);return;}if(e.key==='Tab'&&drawer){const elements=Array.from(drawer.querySelectorAll<HTMLElement>('button,input,select,a[href]')).filter(el=>el.offsetParent!==null&&!el.hasAttribute('disabled'));const first=elements[0],last=elements.at(-1);if(e.shiftKey&&document.activeElement===first){e.preventDefault();last?.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first?.focus();}}};document.addEventListener('keydown',key);return()=>{document.removeEventListener('keydown',key);prior?.focus();};
  },[mobileNav]);
  const active = books.find((b) => b.id === selected);
  const notify = (s: string) => setMessage(s);
  async function load(useCloud: boolean, quiet = false, resume = false) {
    const sequence=++loadingSequence.current;
    if(!quiet)setReady(false);
    try {
      const [b,w,c]=await Promise.all([store.listBooks(useCloud),store.getCollection<Word>("vocabulary",useCloud),store.getCollection<Child>("children",useCloud)]);
      if(sequence!==loadingSequence.current)return;
      setBooks(b);setWords(w);setChildren(c);
      if(resume) {
        const last=await store.lastReadBook(useCloud);
        if(sequence!==loadingSequence.current)return;
        const next=b.find(book=>book.id===last) || (!last ? b.find(book=>book.position.chapter||book.position.paragraph||book.position.offset) : undefined);
        if(next)setSelected(next.id);
      } else setSelected(id=>id&&b.some(book=>book.id===id)?id:null);
    } catch(e){if(sequence===loadingSequence.current)notify(errorText(e));}
    finally{if(sequence===loadingSequence.current)setReady(true);}
  }
  useEffect(()=>{
    if(!store.supabase){void load(false,false,true);return;}
    const {data}=store.supabase.auth.onAuthStateChange((event,session)=>{
      setSessionEmail(session?.user.email||"");
      if(event!=="INITIAL_SESSION"&&event!=="SIGNED_IN"&&event!=="SIGNED_OUT")return;
      const uid=session?.user.id||"";if(event!=="INITIAL_SESSION"&&uid===sessionId.current)return;sessionId.current=uid;
      setTimeout(()=>{setCloud(!!session);void load(!!session,false,true);},0);
    });
    return()=>data.subscription.unsubscribe();
  },[]);
  useEffect(()=>{
    if(!cloud){setPendingCount(0);return;}
    const refresh=()=>void syncEdits().then(edits=>setPendingCount(edits.length)).catch(()=>{});
    refresh();window.addEventListener('lasach-sync',refresh);return()=>window.removeEventListener('lasach-sync',refresh);
  },[cloud,sessionEmail]);
  useEffect(()=>{
    if(!cloud)return;
    let running=false;
    const sync=async()=>{
      if(running||!navigator.onLine||document.visibilityState==="hidden")return;running=true;
      try {await store.flushProgress().catch(()=>{});await flushEdits();await load(true,true);setSyncStatus(await store.hasPendingProgress()?"Chờ đồng bộ":"Đã đồng bộ");}
      catch {setSyncStatus("Đã giữ trên thiết bị · chờ đồng bộ");}
      finally{running=false;}
    };
    const timer=setInterval(()=>void sync(),10000);const focus=()=>void sync();
    window.addEventListener("online",focus);window.addEventListener("focus",focus);document.addEventListener("visibilitychange",focus);
    return()=>{clearInterval(timer);window.removeEventListener("online",focus);window.removeEventListener("focus",focus);document.removeEventListener("visibilitychange",focus);};
  },[cloud]);
  function openBook(id:string) {
    const book=books.find(b=>b.id===id);if(!book)return;
    setSelected(id);void store.saveProgress(book,book.position,cloud).then(()=>setSyncStatus("Đã đồng bộ")).catch(()=>setSyncStatus("Chờ đồng bộ"));
  }
  async function saveReadingPosition(position:Book['position']) {
    const book=books.find(b=>b.id===selected);if(!book)return;
    setBooks(current=>current.map(b=>b.id===book.id?{...b,position}:b));
    setSyncStatus(cloud?"Đang đồng bộ…":"Đã lưu trên thiết bị");
    try {await store.saveProgress(book,position,cloud);setSyncStatus(cloud ? await store.hasPendingProgress()?"Chờ đồng bộ":"Đã đồng bộ" : "Đã lưu trên thiết bị");}
    catch{setSyncStatus("Đã giữ trên thiết bị · chờ đồng bộ");}
  }
  useEffect(() => {
    const yes = () => setOnline(true),
      no = () => setOnline(false);
    window.addEventListener("online", yes);
    window.addEventListener("offline", no);
    return () => {
      window.removeEventListener("online", yes);
      window.removeEventListener("offline", no);
    };
  }, []);
  useEffect(() => {
    void fetch("/api/capabilities")
      .then(async (r) => {
        if (!r.ok) throw new Error();
        return r.json();
      })
      .then(setCap)
      .catch(() =>
        setCap({
          configured: false,
          pairs: [],
          provider: "LibreTranslate",
          reason: "API chưa chạy hoặc chưa được cấu hình.",
        }),
      );
  }, []);
  useEffect(() => {
    if (!message) return;
    const t = setTimeout(() => setMessage(""), 7000);
    return () => clearTimeout(t);
  }, [message]);
  async function updateBook(book: Book) {
    await store.saveBook(book, cloud);
    setBooks((prev) => prev.map((b) => (b.id === book.id ? {...book,position:b.position} : b)));
  }
  async function saveWords(values: Word[]) {
    await store.saveCollection("vocabulary", values, cloud);
    setWords(values);
  }
  async function removeBook(book: Book) {
    if (!confirm(`Xóa “${book.title}” và tệp gốc?`)) return;
    try {
      await store.deleteBook(book, cloud);
      setBooks((prev) => prev.filter((b) => b.id !== book.id));
      setSelected(null);
    } catch (e) {
      notify(errorText(e));
    }
  }
  async function backup() {
    try {
      const originals: Record<string, { type: string; data: string }> = {};
      for (const b of books) {
        const file = await store.getOriginal(b, cloud);
        if (file) {
          const bytes = new Uint8Array(await file.arrayBuffer());
          let binary = "";
          for (let i = 0; i < bytes.length; i++)
            binary += String.fromCharCode(bytes[i]);
          originals[b.id] = { type: file.type, data: btoa(binary) };
        }
      }
      download(
        "lasach-backup.json",
        new Blob(
          [JSON.stringify({ version: 1, books, words, children, originals })],
          { type: "application/json" },
        ),
      );
      notify("Đã xuất bản sao lưu gồm tệp gốc. Hãy giữ tệp ở nơi riêng tư.");
    } catch (e) {
      notify(errorText(e));
    }
  }
  async function restore(file: File) {
    try {
      if (file.size > 100 * 1024 * 1024)
        throw new Error("Bản sao lưu tối đa 100 MB.");
      const data = JSON.parse(await file.text());
      if (
        data.version !== 1 ||
        !Array.isArray(data.books) ||
        !Array.isArray(data.words) ||
        !Array.isArray(data.children)
      )
        throw new Error("Bản sao lưu không đúng định dạng.");
      data.books.forEach(assertBook);
      data.words.forEach(assertWord);
      data.children.forEach(assertChild);
      const currentIds = new Set(books.map((b) => b.id));
      for (const b of data.books as Book[]) {
        if (currentIds.has(b.id)) continue;
        await store.saveBook(b, cloud);
        if(cloud)await store.saveProgress(b,b.position,true);
        const original = data.originals?.[b.id];
        if (original)
          await store.saveOriginal(
            b,
            new Blob(
              [
                Uint8Array.from(atob(original.data), (c: string) =>
                  c.charCodeAt(0),
                ),
              ],
              { type: original.type },
            ),
            cloud,
          );
      }
      const byId = <T extends { id: string }>(old: T[], incoming: T[]) => [
        ...old,
        ...incoming.filter((v) => !old.some((x) => x.id === v.id)),
      ];
      await store.saveCollection("vocabulary", byId(words, data.words), cloud);
      await store.saveCollection(
        "children",
        byId(children, data.children),
        cloud,
      );
      await load(cloud);
      notify(
        "Đã khôi phục dữ liệu mới. Dữ liệu cùng ID được giữ nguyên để bảo vệ các chỉnh sửa.",
      );
    } catch (e) {
      notify(errorText(e));
    }
  }
  async function auth(action: "login" | "signup" | "logout") {
    if (!store.supabase) return;
    setBusy(true);
    try {
      if (action === "logout") {
        const { error } = await store.supabase.auth.signOut();
        if (error) throw error;
        setCloud(false);
        await load(false);
      } else {
        const result =
          action === "login"
            ? await store.supabase.auth.signInWithPassword({ email, password })
            : await store.supabase.auth.signUp({ email, password });
        if (result.error) throw result.error;
        setPassword("");
        if (result.data.session) {
          setCloud(true);
          await load(true);
          notify("Đã mở thư viện riêng của tài khoản.");
        } else notify("Kiểm tra email để xác nhận tài khoản.");
      }
    } catch (e) {
      notify(errorText(e));
    } finally {
      setBusy(false);
    }
  }
  function exportCsv() {
    download(
      "lasach-vocabulary.csv",
      new Blob([vocabularyCsv(words)], { type: "text/csv;charset=utf-8" }),
    );
  }
  async function previewCsv(file: File) {
    if (file.size > 5 * 1024 * 1024) {
      notify("CSV tối đa 5 MB.");
      return;
    }
    const result = Papa.parse<Record<string, string>>(await file.text(), {
      header: true,
      skipEmptyLines: true,
    });
    if (result.errors.length) {
      notify("CSV không hợp lệ: " + result.errors[0].message);
      return;
    }
    setCsv({ rows: result.data, fields: result.meta.fields || [] });
  }
  async function importCsv() {
    if (!csv) return;
    try {
      let next = words;
      let count = 0;
      for (const r of csv.rows) {
        const term = r[mapping.term]?.trim();
        if (!term) continue;
        const lang = r[mapping.language] || "zh";
        if (!["vi", "zh", "en"].includes(lang))
          throw new Error(
            `Ngôn ngữ không hợp lệ ở dòng ${count + 2}. Chỉ dùng vi, zh, en.`,
          );
        const word: Word = {
          id: id(),
          term,
          meaning: r[mapping.meaning] || "",
          language: lang as Lang,
          status: "new",
          createdAt: new Date().toISOString(),
          contexts: r[mapping.note]
            ? [
                {
                  bookId: "csv",
                  bookTitle: "Nhập CSV",
                  paragraphId: id(),
                  sentence: r[mapping.note],
                },
              ]
            : [],
        };
        next =
          csvDuplicate === "merge" ? mergeWord(next, word) : [...next, word];
        count++;
      }
      await saveWords(next);
      await store.setSetting("lastCsvImport", {
        at: new Date().toISOString(),
        rows: count,
        added: next.length - words.length,
      });
      notify(
        `Đã xử lý ${count} dòng; thêm ${next.length - words.length} từ, gộp ${count - (next.length - words.length)} dòng trùng.`,
      );
      setCsv(null);
    } catch (e) {
      notify(errorText(e));
    }
  }
  const nav = [
    { id: "library" as Page, label: "Thư viện của tôi", icon: Library },
    { id: "vocabulary" as Page, label: "Sổ từ vựng", icon: GraduationCap },
    { id: "children" as Page, label: "Góc trẻ em", icon: BookOpen },
    { id: "groups" as Page, label: "Nhóm đọc & cloud", icon: Cloud },
    { id: "settings" as Page, label: "Cài đặt & kết nối", icon: Settings },
  ];
  const filtered = books.filter(
    (b) =>
      (filter === "all" || b.shelf === filter) &&
      (languageFilter === "all" || b.language === languageFilter) &&
      `${b.title} ${b.author} ${b.genre}`
        .toLowerCase()
        .includes(query.toLowerCase()),
  );
  const lastBook = books.find((b) => b.shelf === "reading");
  return (
    <div className="app">
      {mobileNav&&<button className="drawer-backdrop" aria-label="Đóng nền menu" onClick={()=>setMobileNav(false)}/>}
      <aside className={`sidebar ${mobileNav ? "open" : ""}`} aria-label="Menu ứng dụng" inert={!mobileNav}>
        <button className="drawer-close" aria-label="Đóng menu" onClick={()=>setMobileNav(false)}><X size={20}/></button>
        <a
          className="brand"
          href="#"
          onClick={(e) => {
            e.preventDefault();
            setSelected(null);setMobileNav(false);
            setPage("library");
          }}
        >
          <span className="brand-icon">
            <BookOpen />
          </span>
          <span>
            lá sách<small>ĐỌC ĐỂ MỞ THẾ GIỚI</small>
          </span>
        </a>
        <div className="workspace-label">KHÔNG GIAN CỦA BẠN</div>
        <nav>
          {nav.map((n) => (
            <button
              key={n.id}
              className={page === n.id && !selected ? "active" : ""}
              onClick={() => {
                setPage(n.id);
                setSelected(null);
                setMobileNav(false);
              }}
            >
              <n.icon size={19} />
              {n.label}
              {n.id === "vocabulary" && words.length > 0 && (
                <span className="nav-count">{words.length}</span>
              )}
            </button>
          ))}
          <button onClick={()=>{setMobileNav(false);setInstallOpen(true);}}><Download size={19}/>Cài đặt ứng dụng</button>
        </nav>
        <div id="reader-sidebar-content"/>
        <div className="storage">
          <span className="status-dot" />
          <div>
            {cloud ? "Thư viện đám mây" : "Không gian cục bộ"}
            <small>
              {cloud ? sessionEmail : "Dữ liệu lưu trên trình duyệt này"}
            </small>
          </div>
        </div>
      </aside>
      <main>
        <header className="topbar">
          <button
            className="mobile-menu"
            aria-label="Mở menu"
            onClick={() => setMobileNav(!mobileNav)}
          >
            <Menu />
          </button>
          <div className="breadcrumb">
            Không gian đọc <span>/</span>{" "}
            {active ? "Trình đọc" : nav.find((n) => n.id === page)?.label}
          </div>
          <div className="top-actions">
            <span className="connection">
              {online ? <span className="status-dot" /> : <WifiOff size={14} />}{" "}
              {cloud
                ? pendingCount?`${pendingCount} thay đổi chờ đồng bộ`:syncStatus
                : online
                  ? "Lưu trên thiết bị"
                  : "Ngoại tuyến"}
            </span>
            <button
              className="avatar"
              aria-label="Mở cài đặt tài khoản"
              onClick={() => {
                setPage("settings");
                setSelected(null);
              }}
            >
              {sessionEmail ? sessionEmail[0].toUpperCase() : "B"}
            </button>
          </div>
        </header>
        {!ready ? (
          <div className="loading">Đang mở thư viện…</div>
        ) : active ? (
          <Reader
            key={`${active.id}-${cloud}`}
            book={active}
            cloud={cloud}
            cap={cap}
            onUpdate={updateBook}
            onBack={() => setSelected(null)}
            books={books} words={words} onOpenBook={openBook} onProgress={saveReadingPosition} onMenu={()=>setMobileNav(v=>!v)} onCloseMenu={()=>setMobileNav(false)}
            onGroups={() => {setSelected(null);setPage("groups");}}
            onWord={async (word) => {
              await saveWords(mergeWord(words, word));
              notify("Đã lưu từ vào sổ từ vựng.");
            }}
            notify={notify}
            onDelete={() => void removeBook(active)}
          />
        ) : (
          <div className="content">
            {page === "library" && (
              <>
                <div className="page-heading">
                  <div>
                    <p className="eyebrow">MỘT KHOẢNG LẶNG CHO TÂM TRÍ</p>
                    <h1>
                      Thư viện của bạn<span className="heading-dot">.</span>
                    </h1>
                    <p>Những cuốn sách hay, những thế giới đang chờ.</p>
                  </div>
                  <button
                    className="primary"
                    onClick={() => setImportOpen(true)}
                  >
                    <Plus size={18} /> Thêm sách
                  </button>
                </div>
                <FileDropZone compact label="Kéo thả sách vào thư viện hoặc bấm chọn tệp" inputLabel="Chọn tệp từ thiết bị" onError={setDropError} onFile={file=>{
                  if(file.size>MAX_FILE){setDropError('Tệp tối đa 50 MB.');return;}
                  setDropError('');setImportGroup(null);setDroppedFile(file);setImportOpen(true);
                }}/>
                {dropError&&<p className="error" role="alert">{dropError}</p>}
                <section className="hero">
                  <div className="hero-copy">
                    <span className="pill">
                      <span className="status-dot" /> ĐỌC THEO CÁCH CỦA BẠN
                    </span>
                    <h2>
                      Một cuốn sách.
                      <br />
                      Nhiều cách khám phá.
                    </h2>
                    <p>
                      Đọc, lắng nghe và học thêm một ngôn ngữ.
                      <br />
                      Mọi câu chuyện bắt đầu từ một trang sách.
                    </p>
                    <button
                      onClick={() =>
                        lastBook
                          ? openBook(lastBook.id)
                          : setImportOpen(true)
                      }
                    >
                      {lastBook ? "Tiếp tục đọc" : "Bắt đầu cuốn sách đầu tiên"}{" "}
                      <ArrowUpRight size={18} />
                    </button>
                  </div>
                  <div className="hero-art" aria-hidden="true">
                    <div className="orbit orbit-one" />
                    <div className="orbit orbit-two" />
                    <span className="art-star">✧</span>
                    <div className="art-book book-back">
                      <span>
                        阅<br />读
                      </span>
                    </div>
                    <div className="art-book book-front">
                      <span className="book-art-line">
                        THE WORLD
                        <br />
                        BETWEEN
                        <br />
                        PAGES
                      </span>
                      <div className="art-leaf">❧</div>
                      <small>A LITTLE EVERY DAY</small>
                    </div>
                    <span className="floating-tag tag-zh">
                      你好 <small>Xin chào</small>
                    </span>
                    <span className="floating-tag tag-en">
                      Discover <small>Khám phá</small>
                    </span>
                  </div>
                </section>
                <div className="stats">
                  <div>
                    <span className="stat-icon">
                      <Library size={21} />
                    </span>
                    <span>
                      <strong>{books.length}</strong>
                      <small>Cuốn sách trong thư viện</small>
                    </span>
                  </div>
                  <div>
                    <span className="stat-icon warm">
                      <BookOpen size={21} />
                    </span>
                    <span>
                      <strong>
                        {books.filter((b) => b.shelf === "reading").length}
                      </strong>
                      <small>Cuốn sách đang đọc</small>
                    </span>
                  </div>
                  <div>
                    <span className="stat-icon lavender">
                      <Languages size={21} />
                    </span>
                    <span>
                      <strong>{words.length}</strong>
                      <small>Từ vựng đã lưu</small>
                    </span>
                  </div>
                  <div>
                    <span className="stat-icon blue">
                      <Check size={21} />
                    </span>
                    <span>
                      <strong>
                        {books.filter((b) => b.shelf === "done").length}
                      </strong>
                      <small>Cuốn sách hoàn thành</small>
                    </span>
                  </div>
                </div>
                <section className="library-section">
                  <div className="section-title">
                    <h2>
                      Kệ sách <span>{books.length}</span>
                    </h2>
                    <div className="library-tools">
                      <label className="search">
                        <Search size={17} />
                        <input
                          aria-label="Tìm sách"
                          placeholder="Tìm tên sách, tác giả, thể loại…"
                          value={query}
                          onChange={(e) => setQuery(e.target.value)}
                        />
                      </label>
                      <select
                        aria-label="Lọc ngôn ngữ"
                        value={languageFilter}
                        onChange={(e) => setLanguageFilter(e.target.value)}
                      >
                        <option value="all">Mọi ngôn ngữ</option>
                        {Object.entries(languages).map(([k, v]) => (
                          <option key={k} value={k}>
                            {v}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <div className="tabs">
                    {[["all", "Tất cả"], ...Object.entries(labels)].map(
                      ([k, v]) => (
                        <button
                          key={k}
                          className={filter === k ? "selected" : ""}
                          onClick={() => setFilter(k)}
                        >
                          {v}
                        </button>
                      ),
                    )}
                  </div>
                  {filtered.length ? (
                    <div className="book-grid">
                      {filtered.map((b, i) => {
                        const count = b.chapters.reduce(
                          (n, c) => n + c.paragraphs.length,
                          0,
                        );
                        const before =
                          b.chapters
                            .slice(0, b.position.chapter)
                            .reduce((n, c) => n + c.paragraphs.length, 0) +
                          b.position.paragraph;
                        const progress =
                          b.shelf === "done"
                            ? 100
                            : Math.round((before / Math.max(1, count)) * 100);
                        return (
                          <button
                            className="book-card"
                            key={b.id}
                            onClick={() => openBook(b.id)}
                          >
                            <div className={`book-cover cover-${i % 5}`}>
                              <div className="cover-top">
                                LÁ SÁCH · THƯ VIỆN CÁ NHÂN
                              </div>
                              <h3>{b.title}</h3>
                              <span className="cover-decoration">❧</span>
                              <p>{b.author}</p>
                              <span className="language-badge">
                                {b.language.toUpperCase()}
                              </span>
                            </div>
                            <div className="book-info">
                              <span className="book-genre">
                                {b.genre || "SÁCH CỦA BẠN"}
                              </span>
                              <h3>{b.title}</h3>
                              <p>{b.author}</p>
                              <div className="progress-line">
                                <i style={{ width: `${progress}%` }} />
                              </div>
                              <div className="book-meta">
                                <span>{labels[b.shelf]}</span>
                                <span>{progress}%</span>
                              </div>
                            </div>
                          </button>
                        );
                      })}
                      <button
                        className="add-book-card"
                        onClick={() => setImportOpen(true)}
                      >
                        <span>
                          <Plus size={25} />
                        </span>
                        <strong>Thêm một thế giới mới</strong>
                        <small>Nhập tệp hoặc dán văn bản</small>
                      </button>
                    </div>
                  ) : (
                    <div className="empty">
                      <div className="empty-icon">
                        <BookOpen size={32} />
                      </div>
                      <h3>
                        {books.length
                          ? "Chưa tìm thấy cuốn sách phù hợp"
                          : "Kệ sách đang chờ câu chuyện đầu tiên"}
                      </h3>
                      <p>
                        Đưa sách của bạn vào đây và đọc theo nhịp riêng.
                        <br />
                        Hỗ trợ EPUB, TXT, DOCX, HTML và văn bản dán.
                      </p>
                      <button
                        className="primary"
                        onClick={() => setImportOpen(true)}
                      >
                        <Upload size={17} /> Nhập sách của bạn
                      </button>
                      <button
                        className="text-button"
                        onClick={async () => {
                          try {
                            const b = await importDocument(
                              null,
                              "Chương 1 — Hạt mầm nhỏ\n\nMột buổi sáng, An tìm thấy một hạt mầm bên cửa sổ. Em đặt hạt vào chiếc chậu nhỏ và tưới một ít nước.\n\nNgày nào An cũng nhìn ngắm chiếc chậu. Em học được rằng một chút kiên nhẫn, một chút chăm sóc có thể làm nên điều kỳ diệu.\n\nChương 2 — Chiếc lá đầu tiên\n\nRồi một ngày, chiếc lá xanh đầu tiên xuất hiện. An mỉm cười. Câu chuyện của hạt mầm chỉ vừa mới bắt đầu.",
                              {
                                title: "Hạt mầm bên cửa sổ",
                                author: "Lá sách · Bài đọc mẫu do AI tạo",
                                language: "vi",
                                genre: "Truyện ngắn",
                              },
                            );
                            if (books.some((x) => x.hash === b.hash)) {
                              notify("Bài đọc đã có trong thư viện.");
                              return;
                            }
                            await store.saveBook(b, cloud);
                            await store.saveOriginal(
                              b,
                              new Blob(
                                [
                                  b.chapters
                                    .map((c) =>
                                      c.paragraphs
                                        .map((p) => p.text)
                                        .join("\n\n"),
                                    )
                                    .join("\n\n"),
                                ],
                                { type: "text/plain" },
                              ),
                              cloud,
                            );
                            setBooks((prev) => [b, ...prev]);
                          } catch (e) {
                            notify(errorText(e));
                          }
                        }}
                      >
                        Hoặc thử một bài đọc ngắn <ArrowUpRight size={14} />
                      </button>
                    </div>
                  )}
                </section>
                <footer className="page-footer">
                  <Leaf size={15} /> Đọc một chút. Hiểu thêm nhiều.
                  <span>Việt · 中文 · English</span>
                </footer>
              </>
            )}
            {page === "vocabulary" && (
              <>
                <div className="page-heading">
                  <div>
                    <p className="eyebrow">TỪ TRANG SÁCH ĐẾN TRÍ NHỚ</p>
                    <h1>Sổ từ vựng.</h1>
                    <p>Lưu từ cùng ngữ cảnh, mang theo điều bạn vừa học.</p>
                  </div>
                  <button className="primary" onClick={exportCsv}>
                    <Download size={17} /> Xuất CSV
                  </button>
                </div>
                <ReviewPanel words={words} onSave={saveWords} />
                <div className="panel">
                  <div className="row">
                    <label className="search">
                      <Search size={17} />
                      <input
                        aria-label="Tìm từ"
                        placeholder="Tìm từ hoặc nghĩa…"
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                      />
                    </label>
                    <label className="button">
                      <Upload size={17} /> Nhập CSV
                      <input
                        type="file"
                        accept=".csv"
                        hidden
                        onChange={(e) => {
                          const f = e.target.files?.[0];
                          if (f) void previewCsv(f);
                          e.target.value = "";
                        }}
                      />
                    </label>
                  </div>
                  <p className="muted">
                    CSV chung có ánh xạ cột. Chưa xác minh định dạng nhập của
                    Hanzii; đây không phải đồng bộ tài khoản.
                  </p>
                  {words
                    .filter((w) =>
                      `${w.term} ${w.meaning}`
                        .toLowerCase()
                        .includes(query.toLowerCase()),
                    )
                    .map((w) => (
                      <div className="word-row" key={w.id}>
                        <div>
                          <strong lang={w.language}>{w.term}</strong>
                          <p>{w.meaning || "Chưa ghi nghĩa"}</p>
                          {w.contexts.map((c, i) => (
                            <small key={i}>
                              “{c.sentence}” — {c.bookTitle}
                            </small>
                          ))}
                        </div>
                        <select
                          aria-label={`Trạng thái ${w.term}`}
                          value={w.status}
                          onChange={(e) =>
                            void saveWords(
                              words.map((x) =>
                                x.id === w.id
                                  ? {
                                      ...x,
                                      status: e.target.value as Word["status"],
                                    }
                                  : x,
                              ),
                            ).catch((e) => notify(errorText(e)))
                          }
                        >
                          {[
                            ["new", "Chưa biết"],
                            ["learning", "Đang học"],
                            ["known", "Đã biết"],
                            ["ignored", "Bỏ qua"],
                          ].map(([k, v]) => (
                            <option key={k} value={k}>
                              {v}
                            </option>
                          ))}
                        </select>
                        <button
                          aria-label={`Xóa từ ${w.term}`}
                          onClick={async () => {
                            try {
                              await store.deleteItem("vocabulary", w.id, cloud);
                              setWords((prev) =>
                                prev.filter((x) => x.id !== w.id),
                              );
                            } catch (e) {
                              notify(errorText(e));
                            }
                          }}
                        >
                          <Trash2 size={17} />
                        </button>
                      </div>
                    ))}
                  {!words.length && (
                    <div className="empty">
                      <GraduationCap size={35} />
                      <h3>Những từ mới sẽ ở đây</h3>
                      <p>Chọn từ hoặc cụm từ trong sách rồi bấm “Lưu từ”.</p>
                    </div>
                  )}
                </div>
              </>
            )}
            {page === "children" && (
              <ChildrenPanel
                books={books}
                children={children}
                onSave={async (c) => {
                  await store.saveCollection("children", c, cloud);
                  setChildren(c);
                }}
                onDelete={async (child) => {
                  for (const book of books.filter((b) =>
                    b.approvedChildren.includes(child.id),
                  ))
                    await updateBook({
                      ...book,
                      approvedChildren: book.approvedChildren.filter(
                        (x) => x !== child.id,
                      ),
                    });
                  await store.deleteItem("children", child.id, cloud);
                  setChildren((prev) => prev.filter((c) => c.id !== child.id));
                }}
                onBook={updateBook}
                notify={notify}
              />
            )}
            {page === "groups" && <GroupsPanel refreshVersion={groupsVersion} cloud={cloud} books={books} notify={notify} onLogin={()=>setPage("settings")} onRead={openBook} onUpload={gid=>{setImportGroup(gid);setImportOpen(true);}} onRefresh={()=>load(true,true)} />}
            {page === "settings" && (
              <>
                <div className="page-heading">
                  <div>
                    <p className="eyebrow">RIÊNG TƯ THEO CÁCH CỦA BẠN</p>
                    <h1>Cài đặt & kết nối.</h1>
                    <p>
                      Chủ động chọn nơi lưu dữ liệu và dịch vụ được phép sử
                      dụng.
                    </p>
                  </div>
                </div>
                <div className="settings-grid">
                  <section className="panel"><h2><Download size={21}/> Cài đặt ứng dụng</h2><InstallAppContent state={appInstall}/></section>
                  <section className="panel">
                    <h2>
                      <Cloud size={21} /> Tài khoản & Supabase
                    </h2>
                    <p>
                      Thư viện cục bộ và thư viện tài khoản tách riêng. Không tự
                      tải tài liệu cá nhân lên cloud.
                    </p>
                    {!store.supabase ? (
                      <div className="notice">
                        Chưa kết nối Supabase. Chế độ cục bộ hoạt động độc lập.
                        Quản trị viên cần cấu hình URL và publishable key;
                        migration nằm trong mã nguồn.
                      </div>
                    ) : sessionEmail ? (
                      <>
                        <p>
                          Đã đăng nhập: <strong>{sessionEmail}</strong>
                        </p>
                        <button
                          className="primary"
                          onClick={async () => {
                            setSelected(null);
                            setCloud(!cloud);
                            await load(!cloud);
                          }}
                        >
                          {cloud
                            ? "Mở thư viện cục bộ"
                            : "Mở thư viện tài khoản"}
                        </button>
                        <button onClick={() => void auth("logout")}>
                          <LogOut size={17} /> Đăng xuất
                        </button>
                      </>
                    ) : (
                      <form
                        onSubmit={(e) => {
                          e.preventDefault();
                          void auth("login");
                        }}
                      >
                        <label>
                          Email
                          <input
                            required
                            type="email"
                            autoComplete="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                          />
                        </label>
                        <label>
                          Mật khẩu
                          <input
                            required
                            type="password"
                            minLength={8}
                            autoComplete="current-password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                          />
                        </label>
                        <div className="row">
                          <button className="primary" disabled={busy}>
                            Đăng nhập
                          </button>
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() => void auth("signup")}
                          >
                            Tạo tài khoản
                          </button>
                        </div>
                      </form>
                    )}
                  </section>
                  {sessionEmail&&<SyncPanel onRefresh={()=>load(true,true)} notify={notify}/>}
                  {sessionEmail && <section className="panel"><h2>Đồng bộ dữ liệu thiết bị</h2><p>Đưa sách, tệp gốc, từ vựng và hồ sơ đang lưu trên trình duyệt này vào tài khoản. Không xóa bản trên thiết bị; sách trùng trong tài khoản được dùng lại.</p><p role="status">{syncStatus}</p><div className="row"><button disabled={busy} className="primary" onClick={async()=>{setBusy(true);try{setCloud(true);const last=await store.migrateDeviceData((done,total)=>setSyncStatus(`Đang đưa sách lên cloud ${done}/${total}…`));await load(true);if(last)setSelected(last);const pending=await syncEdits();setSyncStatus(pending.length?`${pending.length} thay đổi chờ đồng bộ`:"Đã đồng bộ");notify(pending.length?`Đã chuyển sách và tệp gốc; ${pending.length} thay đổi cá nhân tiếp tục chờ đồng bộ. Xem mục Thay đổi chờ đồng bộ.`:"Đã đưa dữ liệu thiết bị lên cloud.");}catch(e){notify(errorText(e));}finally{setBusy(false);}}}>Đưa dữ liệu thiết bị lên cloud</button><button onClick={()=>{setSelected(null);setPage("groups");}}>Mở nhóm đọc</button></div></section>}
                  <section className="panel">
                    <h2>
                      <Languages size={21} /> Dịch tài liệu
                    </h2>
                    <span
                      className={`state-badge ${cap?.configured ? "enabled" : ""}`}
                    >
                      {cap?.configured ? "Đã kết nối" : "Chưa khả dụng"}
                    </span>
                    <h3>{cap?.provider || "Dịch vụ dịch"} · dịch trong trình đọc</h3>
                    <p>
                      {cap?.reason ||
                        "Khả năng dịch được lấy từ mô hình ngôn ngữ thực sự có trên máy chủ."}
                    </p>
                    <p>
                      Bật đồng ý gửi văn bản trong trình đọc, rồi chọn dịch trang, chương hoặc toàn sách. Các đoạn đã sửa hoặc khóa được giữ nguyên.
                    </p>
                    {cap?.provider === "MyMemory" && <p className="muted">
                      MyMemory có hạn mức miễn phí theo IP dịch vụ, có thể dùng chung giữa người dùng. Khi hết hạn mức, ứng dụng dừng và giữ các bản dịch đã lưu để tiếp tục lần sau.
                    </p>}
                    {cap?.configured && (
                      <p>
                        {cap.pairs
                          .map((p) => `${p.source} → ${p.targets.join(", ")}`)
                          .join(" · ")}
                      </p>
                    )}
                  </section>
                  <section className="panel">
                    <h2>
                      <Download size={21} /> Sao lưu & khôi phục
                    </h2>
                    <p>
                      Bản sao lưu chứa sách, bản dịch, từ vựng, hồ sơ trẻ và tệp
                      gốc. Không chứa API key.
                    </p>
                    <div className="row">
                      <button onClick={() => void backup()}>
                        <Download size={17} /> Sao lưu dữ liệu
                      </button>
                      <label className="button">
                        <Upload size={17} /> Khôi phục JSON
                        <input
                          type="file"
                          accept=".json"
                          hidden
                          onChange={(e) => {
                            const f = e.target.files?.[0];
                            if (f) void restore(f);
                            e.target.value = "";
                          }}
                        />
                      </label>
                    </div>
                    <p className="muted">
                      Không dùng chung hồ sơ trình duyệt trên thiết bị công
                      cộng. Chế độ cục bộ chưa mã hóa dữ liệu trên thiết bị. Hãy
                      sao lưu trước khi xóa dữ liệu trình duyệt.
                    </p>
                  </section>
                  <section className="panel">
                    <h2>
                      <ExternalLink size={21} /> Hanzii
                    </h2>
                    <p>
                      Chọn cụm tiếng Trung trong trình đọc → sao chép → mở
                      website Hanzii. Chưa xác minh API, deep link hay quyền lợi
                      Pro cho ứng dụng ngoài.
                    </p>
                    <p className="muted">
                      Không yêu cầu mật khẩu Hanzii. Không dùng endpoint nội bộ.
                      Trong góc trẻ em không có liên kết ngoài.
                    </p>
                  </section>
                </div>
              </>
            )}
          </div>
        )}
      </main>
      {installOpen&&<Modal title="Cài đặt ứng dụng" onClose={()=>setInstallOpen(false)}><InstallAppContent state={appInstall}/></Modal>}
      {message && (
        <div role="status" className="toast">
          <span>{message}</span>
          <button aria-label="Đóng thông báo" onClick={() => setMessage("")}>
            <X size={17} />
          </button>
        </div>
      )}
      {importOpen && (
        <ImportModal
          initialFile={droppedFile}
          onClose={() => {setImportOpen(false);setImportGroup(null);setDroppedFile(null);}}
          onImport={async (book, file) => {
            if(importGroup) {
              await importGroupBook(importGroup,book,file);await load(true,true);setGroupsVersion(v=>v+1);setImportOpen(false);setImportGroup(null);setDroppedFile(null);notify("Đã thêm sách vào nhóm; tệp trùng được dùng lại.");return;
            }
            if (
              books.some(
                (b) => b.hash === book.hash && b.language === book.language &&
                  b.chapters.map(c => c.sourcePage || 0).join(",") === book.chapters.map(c => c.sourcePage || 0).join(","),
              )
            )
              throw new Error("Tài liệu này đã có trong thư viện.");
            await store.saveBook(book, cloud);
            try {
              await store.saveOriginal(book, file, cloud);
            } catch (e) {
              await store.deleteBook(book, cloud);
              throw e;
            }
            setBooks((prev) => [book, ...prev]);
            setImportOpen(false);
            setDroppedFile(null);
            notify("Đã nhập sách và lưu riêng tệp gốc.");
          }}
        />
      )}
      {csv && (
        <Modal title="Xem trước & ánh xạ CSV" onClose={() => setCsv(null)}>
          <p>
            {csv.rows.length} dòng. Chọn các cột nguồn; ngôn ngữ dùng mã vi, zh,
            en (mặc định zh).
          </p>
          <div className="form-grid">
            {Object.entries({
              term: "Từ / chữ Hán",
              meaning: "Nghĩa tiếng Việt",
              language: "Ngôn ngữ",
              note: "Ví dụ / ghi chú",
            }).map(([key, label]) => (
              <label key={key}>
                {label}
                <select
                  aria-label={label}
                  value={mapping[key as keyof typeof mapping]}
                  onChange={(e) =>
                    setMapping({ ...mapping, [key]: e.target.value })
                  }
                >
                  <option value="">Không ánh xạ</option>
                  {csv.fields.map((f) => (
                    <option key={f} value={f}>
                      {f}
                    </option>
                  ))}
                </select>
              </label>
            ))}
          </div>
          <div className="csv-preview">
            <table>
              <thead>
                <tr>
                  {csv.fields.map((f) => (
                    <th key={f}>{f}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {csv.rows.slice(0, 5).map((r, i) => (
                  <tr key={i}>
                    {csv.fields.map((f) => (
                      <td key={f}>{r[f]}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <label>
            Từ trùng
            <select
              value={csvDuplicate}
              onChange={(e) =>
                setCsvDuplicate(e.target.value as "merge" | "separate")
              }
            >
              <option value="merge">Gộp khi trùng từ, ngôn ngữ và nghĩa</option>
              <option value="separate">Giữ riêng từng dòng</option>
            </select>
          </label>
          <button
            className="primary"
            disabled={!mapping.term}
            onClick={() => void importCsv()}
          >
            Nhập dữ liệu đã ánh xạ
          </button>
        </Modal>
      )}
    </div>
  );
}

function ImportModal({
  onClose,
  onImport,
  initialFile=null,
}: {
  initialFile?:File|null;
  onClose: () => void;
  onImport: (b: Book, file: Blob) => Promise<void>;
}) {
  const [file, setFile] = useState<File | null>(initialFile),
    [text, setText] = useState(""),
    [title, setTitle] = useState(initialFile?bookFileMetadata(initialFile.name).title:''),
    [author, setAuthor] = useState(initialFile?bookFileMetadata(initialFile.name).author:''),
    [language, setLanguage] = useState<Lang>("vi"),
    [genre, setGenre] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const isPdf = file?.name.toLowerCase().endsWith(".pdf") || false;
  const [pdfPages, setPdfPages] = useState<PdfTextPage[] | null>(null);
  const [pdfIndex, setPdfIndex] = useState(0);
  const [pdfDraftId, setPdfDraftId] = useState("");
  const [ocrMode, setOcrMode] = useState<"auto" | "always" | "off">("auto");
  const [firstPage, setFirstPage] = useState(1), [lastPage, setLastPage] = useState("");
  const [progress, setProgress] = useState<PdfProgress | null>(null);
  const [extracting, setExtracting] = useState(false);
  const controller = useRef<AbortController | null>(null);
  const suggested=useRef(initialFile?bookFileMetadata(initialFile.name):{title:'',author:''});
  function chooseFile(next:File,sourceTitle='',sourceAuthor=''){
    const fromFile=bookFileMetadata(next.name),guess=sourceTitle?sourceAuthor?{title:sourceTitle.trim(),author:sourceAuthor.trim()}:splitBookName(sourceTitle):{...fromFile,author:sourceAuthor.trim()||fromFile.author};
    resetPdf();setFirstPage(1);setLastPage('');setFile(next);
    if(next.size>MAX_FILE)setError('Tệp tối đa 50 MB.');
    const selected={title:!title.trim()||title===suggested.current.title?guess.title:title,author:!author.trim()||author===suggested.current.author?guess.author:author};
    setTitle(selected.title);setAuthor(selected.author);
    suggested.current=guess;
    return selected;
  }
  function splitEnteredTitle(){
    if(author.trim()&&author!==suggested.current.author)return;
    const guess=splitBookName(title);
    if(guess.author){setTitle(guess.title);setAuthor(guess.author);suggested.current=guess;}
  }
  useEffect(() => () => controller.current?.abort(), []);
  function resetPdf() { setPdfPages(null); setPdfDraftId(''); setPdfIndex(0); setProgress(null); setError(""); }
  async function processPdf() {
    if (!file || busy) return;
    if (file.size > MAX_FILE) { setError("Tệp tối đa 50 MB."); return; }
    setBusy(true); setExtracting(true); setError(""); setPdfPages(null); setPdfIndex(0);
    controller.current = new AbortController();
    try {
      const { extractPdf } = await import("./pdf");
      const result = await extractPdf(file, { language, mode: ocrMode, start: firstPage,
        end: lastPage.trim() ? Number(lastPage) : undefined,
        signal: controller.current.signal, onProgress: setProgress,
        resume: store.pdfDraftPages, onPage: store.savePdfDraftPage });
      setPdfPages(result.pages); setPdfDraftId(result.draftId);
      setProgress(null);
    } catch (e) { setError((e as Error).name === "AbortError" ? "Đã hủy. Các trang đã xử lý được giữ trên thiết bị. Bấm Đọc PDF / OCR để tiếp tục." : errorText(e)); }
    finally { setBusy(false); setExtracting(false); controller.current = null; }
  }
  async function submit() {
    setBusy(true);
    setError("");
    try {
      const book = await importDocument(file, text, {
        title:!author.trim()?splitBookName(title).title:title,
        author:author.trim()||splitBookName(title).author,
        language,
        genre,
      }, isPdf && pdfPages ? { pdfPages } : undefined);
      await onImport(
        book,
        file || new Blob([text], { type: "text/plain;charset=utf-8" }),
      );
      if (pdfDraftId) void store.clearPdfDraft(pdfDraftId).catch(() => {});
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal
      title="Thêm sách vào thư viện"
      onClose={() => {
        if (!busy) onClose();
      }}
    >
      <p className="muted">
        Tệp gốc được giữ riêng. PDF/OCR xử lý trên thiết bị; khi dùng chế độ cloud, tệp gốc và văn bản sẽ được lưu vào tài khoản của bạn.
      </p>
      <SourceImport onBusy={setBusy} disabled={busy} onFile={async (next, sourceTitle, sourceAuthor, autoImport) => {
        const metadata=chooseFile(next,sourceTitle,sourceAuthor);
        if(autoImport&&!/\.pdf$/i.test(next.name)){
          const book=await importDocument(next,'',{...metadata,language,genre});
          await onImport(book,next);
        }
      }} />
      <FileDropZone file={file} disabled={busy} onError={setError} onFile={chooseFile}/>
      {file ? (
        <button className="text-button" disabled={busy} onClick={() => { setFile(null); resetPdf(); }}>
          Dùng văn bản dán thay thế
        </button>
      ) : (
        <label>
          Hoặc dán nội dung
          <textarea
            rows={5}
            aria-label="Nội dung sách"
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Dán nội dung sách hoặc bài đọc…"
          />
        </label>
      )}
      <div className="form-grid">
        <label>
          Tên sách
          <input
            aria-label="Tên sách"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onBlur={splitEnteredTitle}
          />
        </label>
        <label>
          Tác giả
          <input value={author} onChange={(e) => setAuthor(e.target.value)} />
        </label>
        <LanguageSelect
          label="Ngôn ngữ nguyên bản"
          value={language}
          onChange={v => { if (!busy) { setLanguage(v); resetPdf(); } }}
        />
        <label>
          Thể loại
          <input
            value={genre}
            onChange={(e) => setGenre(e.target.value)}
            placeholder="Ví dụ: Truyện ngắn"
          />
        </label>
      </div>
      {isPdf && <section className="pdf-import" aria-label="Nhập PDF và OCR">
        <h3>PDF & nhận dạng chữ</h3>
        <p>Chọn ngôn ngữ nguyên bản bên trên. OCR hỗ trợ Việt, Anh và Trung giản thể; lần đầu cần tải bộ nhận dạng từ website.</p>
        <label>Cách đọc PDF<select value={ocrMode} disabled={busy} onChange={e => { setOcrMode(e.target.value as typeof ocrMode); resetPdf(); }}>
          <option value="auto">Tự động: OCR trang có ít hoặc không có chữ</option>
          <option value="off">Chỉ lấy lớp chữ có sẵn (không OCR)</option>
          <option value="always">OCR tất cả trang đã chọn</option>
        </select></label>
        <details><summary>Tùy chọn khoảng trang (mặc định toàn bộ tệp)</summary><div className="form-grid">
          <label>Từ trang<input type="number" min={1} value={firstPage} disabled={busy} onChange={e => { setFirstPage(Number(e.target.value)); resetPdf(); }} /></label>
          <label>Đến trang<input type="number" min={firstPage} placeholder="Để trống: hết tài liệu" value={lastPage} disabled={busy} onChange={e => { setLastPage(e.target.value); resetPdf(); }} /></label>
        </div>
        </details><p className="muted">Quét toàn bộ tệp, không giới hạn số trang. Tiến độ từng trang tự lưu trên thiết bị để tiếp tục nếu bị gián đoạn. Hãy giữ tab mở khi xử lý.</p>
        <button disabled={busy || !file || file.size > MAX_FILE} onClick={() => void processPdf()}>{pdfPages ? "Trích xuất lại PDF" : "Đọc PDF / OCR"}</button>
        {extracting && <button onClick={() => controller.current?.abort()}>Hủy xử lý</button>}
        {extracting && <div role="status"><p>{progress ? `${progress.stage} · trang ${progress.page}/${progress.total}` : "Đang mở PDF…"}</p><progress aria-label="Tiến độ PDF" max={1} value={progress?.fraction || 0} /></div>}
        {pdfPages && pdfPages.length > 0 && <>
          <label>Trang để kiểm tra<select value={pdfIndex} onChange={e => setPdfIndex(Number(e.target.value))} disabled={busy}>
            {pdfPages.map((p, i) => <option value={i} key={p.page}>Trang {p.page}{p.ocr ? " · OCR" : " · có chữ"}{!p.text.trim() ? " · trống" : ""}</option>)}
          </select></label>
          <p>{pdfPages.length} trang đã xử lý. Trang trống không được thêm vào phần đọc. Hãy kiểm tra dấu, thứ tự cột và ngắt dòng; OCR có thể nhận sai.</p>
          {pdfPages[pdfIndex].ocr && <p>Kết quả OCR{pdfPages[pdfIndex].confidence !== undefined ? ` · độ tin cậy ước tính ${Math.round(pdfPages[pdfIndex].confidence!)}%` : ""} — không phải điểm độ chính xác.</p>}
          <Suspense fallback={<p>Đang mở trang gốc…</p>}><PdfPageView file={file!} page={pdfPages[pdfIndex].page} /></Suspense>
          <label>Văn bản trang {pdfPages[pdfIndex].page}<textarea aria-label="Văn bản PDF đã trích xuất" rows={8} value={pdfPages[pdfIndex].text} disabled={busy} onChange={e => setPdfPages(pdfPages.map((p, i) => i === pdfIndex ? { ...p, text: e.target.value } : p))} /></label>
        </>}
      </section>}
      <p className="muted">
        Chỉ nhập tài liệu bạn có quyền sử dụng. Ngôn ngữ gốc giữ nguyên; không
        tự chuyển sang tiếng Việt.
      </p>
      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}
      <button
        className="primary wide"
        disabled={busy || (!file && !text.trim()) || !!file && file.size > MAX_FILE || isPdf && !pdfPages?.some(p => p.text.trim())}
        onClick={() => void submit()}
      >
        {busy ? "Đang trích xuất và lưu…" : "Nhập & lưu sách"}{" "}
        <ArrowUpRight size={17} />
      </button>
    </Modal>
  );
}

function Reader({
  book,
  cloud,
  cap,
  onUpdate,
  onBack,
  onWord,
  notify,
  onDelete,books,words,onOpenBook,onProgress,onGroups,onMenu,onCloseMenu,
}: {
  book: Book;
  books: Book[]; words: Word[]; onOpenBook:(id:string)=>void;
  onProgress:(position:Book['position'])=>Promise<void>;onGroups:()=>void;onMenu:()=>void;onCloseMenu:()=>void;
  cloud: boolean;
  cap: Capability | null;
  onUpdate: (b: Book) => Promise<void>;
  onBack: () => void;
  onWord: (w: Word) => Promise<void>;
  notify: (s: string) => void;
  onDelete: () => void;
}) {
  const [chapter, setChapter] = useState(
      Math.min(book.position.chapter, book.chapters.length - 1),
    ),
    [target, setTarget] = useState<Lang>(book.language === "vi" ? "en" : "vi"),
    [layout, setLayout] = useState("original"),
    [font, setFont] = useState(20),
    [theme, setTheme] = useState("light"),
    [search, setSearch] = useState(""),
    [editing, setEditing] = useState<Paragraph | null>(null),
    [editedText, setEditedText] = useState(""),
    [note, setNote] = useState(""),
    [translating, setTranslating] = useState(false),
    [jobStatus, setJobStatus] = useState(""),
    [consent, setConsent] = useState(false),
    [speechRate, setSpeechRate] = useState(1),
    [sourcePdf, setSourcePdf] = useState<Blob | null>(null),
    [sourceLoading, setSourceLoading] = useState(false),
    [metadata, setMetadata] = useState(false),
    [newTitle, setNewTitle] = useState(book.title),
    [newAuthor, setNewAuthor] = useState(book.author);
  const [readMode, setReadMode] = useState<"paged" | "continuous">("paged");
  const [speechProvider,setSpeechProvider]=useState<SpeechProvider>("google"),[speechVoice,setSpeechVoice]=useState("");
  const [speechVolume,setSpeechVolume]=useState(1),[speechPitch,setSpeechPitch]=useState(1),[sleepMinutes,setSleepMinutes]=useState(0),[sleepRemaining,setSleepRemaining]=useState(0);
  const sleepDeadline=useRef(0),autoReading=useRef(false),readingEpoch=useRef(0);
  const [advancePending,setAdvancePending]=useState(false),[showBookmarks,setShowBookmarks]=useState(false),[showBookSearch,setShowBookSearch]=useState(false),[fontDraft,setFontDraft]=useState('20');
  const speech=useSpeechReader(speechProvider,speechRate,speechVoice,speechVolume,speechPitch,()=>{if(sleepDeadline.current&&Date.now()>=sleepDeadline.current){stopReading();notify('Đã hết giờ hẹn. Giọng đọc đã tắt.');}else if(autoReading.current)setAdvancePending(true);else{sleepDeadline.current=0;setSleepRemaining(0);}});
  const speaking=speech.phase!=="idle"||advancePending||autoReading.current;
  function stopReading(){autoReading.current=false;readingEpoch.current++;setAdvancePending(false);sleepDeadline.current=0;setSleepRemaining(0);speech.stop();}
  function setSleep(value:number){const minutes=Math.max(0,Math.min(1440,value));setSleepMinutes(minutes);sleepDeadline.current=minutes&&speaking?Date.now()+minutes*60000:0;setSleepRemaining(sleepDeadline.current?minutes*60:0);}
  useEffect(()=>{const tick=()=>{if(!sleepDeadline.current)return;const seconds=Math.max(0,Math.ceil((sleepDeadline.current-Date.now())/1000));setSleepRemaining(seconds);if(!seconds){stopReading();notify('Đã hết giờ hẹn. Giọng đọc đã tắt.');}};const timer=setInterval(tick,1000);document.addEventListener('visibilitychange',tick);return()=>{clearInterval(timer);document.removeEventListener('visibilitychange',tick);autoReading.current=false;readingEpoch.current++;};},[]);
  const [translationImport,setTranslationImport]=useState(false);
  const [showPageButtons,setShowPageButtons]=useState(true);
  const [fontFamily,setFontFamily]=useState('noto'),[lineHeight,setLineHeight]=useState(1.85);
  const fonts=readerFontFamilies;
  const [readerReady, setReaderReady] = useState(false);
  const [pagePosition, setPagePosition] = useState(book.position);
  const [turning, setTurning] = useState(false);
  const [rangeStart, setRangeStart] = useState(book.position.chapter);
  const [rangeEnd, setRangeEnd] = useState(Math.min(book.chapters.length, book.position.chapter + 2));
  const [activeParagraph, setActiveParagraph] = useState("");
  const paper = useRef<HTMLDivElement | null>(null),pageFrame=useRef<HTMLDivElement|null>(null);
  const pageTurn=usePageTurn(paper,pageFrame,readMode==='paged',JSON.stringify([font,fontFamily,lineHeight,layout,target,theme]),direction=>{
    if(!paper.current||paginationBusy||turning||translating)return null;
    const next=pages[pageIndex+(direction==='forward'?1:-1)];return next?previewPage(paper.current,next,book,layout,target,search):null;
  });
  const viewport=useViewportPages({book,position:pagePosition,frame:pageFrame,enabled:readMode==='paged'&&readerReady,layout,target,font,fontFamily:fonts[fontFamily],lineHeight,budget:Number.MAX_SAFE_INTEGER,widthLimit:Number.POSITIVE_INFINITY});
  const paginationBusy=readMode==='paged'&&(!readerReady||viewport.busy);
  const pages=viewport.pages;
  const pageIndex=pageForPosition(pages,pagePosition);
  const sentinel = useRef<HTMLDivElement | null>(null);
  const translationPanel = useRef<HTMLDetailsElement | null>(null);
  const [wordHit,setWordHit]=useState<SelectedText|null>(null);
  const selecting=useRef(false),selectionTimer=useRef<ReturnType<typeof setTimeout>|null>(null);
  const dragStart=useRef<{x:number;y:number;pointerId:number;mouseCorner:boolean}|null>(null);
  const touch=useRef<{x:number;y:number;at:number}|null>(null),skipClick=useRef(0);
  const [floatingTools,setFloatingTools]=useState(false),[toolsOffscreen,setToolsOffscreen]=useState(false),[controlsHeight,setControlsHeight]=useState(0);
  const controls=useRef<HTMLDivElement|null>(null),controlSlot=useRef<HTMLDivElement|null>(null);
  function closeLookup(){setWordHit(null);window.getSelection()?.removeAllRanges();}
  useEffect(()=>{document.body.classList.add('reading-mode');return()=>{document.body.classList.remove('reading-mode','reading-paged');if(selectionTimer.current)clearTimeout(selectionTimer.current);};},[]);
  useEffect(()=>{document.body.classList.toggle('reading-paged',readMode==='paged');return()=>document.body.classList.remove('reading-paged');},[readMode]);
  useEffect(()=>{
    const capture=()=>{
      if(selecting.current||document.querySelector('.overlay'))return;
      const selection=window.getSelection();if(!selection||selection.isCollapsed||!selection.rangeCount)return;
      const range=selection.getRangeAt(0),element=(node:Node)=>node.nodeType===Node.ELEMENT_NODE?node as HTMLElement:node.parentElement;
      const start=element(range.startContainer)?.closest<HTMLElement>('[data-lookup-lang]'),end=element(range.endContainer)?.closest<HTMLElement>('[data-lookup-lang]');
      if(!start||!end||!paper.current?.contains(start)||!paper.current.contains(end)||start!==end)return;
      const term=selection.toString().trim();if(!term)return;if(term.length>1000){notify('Chọn tối đa 1.000 ký tự để dịch và lưu từ. Dịch trang hoặc chương nằm trong công cụ đọc.');return;}
      const paragraph=start.closest<HTMLElement>('[data-paragraph-id]');if(!paragraph)return;
      const prefix=range.cloneRange();prefix.selectNodeContents(start);prefix.setEnd(range.startContainer,range.startOffset);
      const base=Number(paragraph.dataset.fragmentStart||0),length=Number(paragraph.dataset.fragmentEnd)-base;
      const offset=base+Math.floor(prefix.toString().length*(start.hasAttribute('data-reading-source')?1:length/Math.max(1,start.textContent?.length||1)));
      const rect=range.getBoundingClientRect();setWordHit({term,paragraphId:paragraph.dataset.paragraphId!,offset,source:start.dataset.lookupLang as Lang,x:rect.left+rect.width/2,y:rect.top});
    };
    const update=()=>{if(selectionTimer.current)clearTimeout(selectionTimer.current);selectionTimer.current=setTimeout(capture,450);};
    const finish=()=>{selecting.current=false;update();};
    document.addEventListener('selectionchange',update);document.addEventListener('pointerup',finish);return()=>{document.removeEventListener('selectionchange',update);document.removeEventListener('pointerup',finish);if(selectionTimer.current)clearTimeout(selectionTimer.current);};
  },[]);
  useEffect(()=>{
    if(!controlSlot.current)return;
    const observer=new IntersectionObserver(entries=>setToolsOffscreen(!entries[0].isIntersecting),{threshold:0});observer.observe(controlSlot.current);return()=>observer.disconnect();
  },[]);
  useEffect(()=>{
    if(!controls.current||floatingTools)return;
    const resize=new ResizeObserver(()=>setControlsHeight(controls.current?.offsetHeight||0));resize.observe(controls.current);return()=>resize.disconnect();
  },[floatingTools]);
  const fragments: Fragment[] = readMode === "paged" ? (pages[pageIndex]?.fragments || []) :
    book.chapters.slice(rangeStart, rangeEnd).flatMap((c, ci) => c.paragraphs.map((p, pi) => ({ chapter: rangeStart + ci, paragraph: pi, start: 0, end: p.text.length })));
  const latest = useRef(book),
    stopped = useRef(false),
    abort = useRef<AbortController | null>(null),
    readingStart = useRef(Date.now());
  useEffect(() => {
    latest.current = book;
  }, [book]);
  useEffect(() => {
    void store
      .getSetting("reader", {
        font: 20,
        theme: "light",
        layout: "original",
        readMode: "paged",
                showPageButtons:true,speechProvider:"google",speechVoice:"",speechRate:1,
        fontFamily:'noto',lineHeight:1.85,speechVolume:1,speechPitch:1,sleepMinutes:0,
        target: book.language === "vi" ? "en" : "vi",
      })
      .then((s) => {
        setFont(Math.max(8,Math.min(72,Number(s.font)||20)));setFontDraft(String(Math.max(8,Math.min(72,Number(s.font)||20))));
        setSpeechVolume(Math.max(0,Math.min(1,Number(s.speechVolume) || (s.speechVolume===0?0:1))));setSpeechPitch(Math.max(.5,Math.min(2,Number(s.speechPitch)||1)));setSleepMinutes(Math.max(0,Math.min(1440,Number(s.sleepMinutes)||0)));
        setShowPageButtons(s.showPageButtons!==false);
        setSpeechProvider(s.speechProvider==="device"?"device":"google");setSpeechVoice(s.speechVoice||"");setSpeechRate(Math.max(.6,Math.min(1.5,Number(s.speechRate)||1)));
        setTheme(readerThemes.some(theme=>theme.id===s.theme)?s.theme:'light');
        setLayout(s.layout);
        setReadMode(s.readMode === "continuous" ? "continuous" : "paged");
        setFontFamily(fonts[s.fontFamily]?s.fontFamily:'noto');setLineHeight(Math.max(1.3,Math.min(2.5,Number(s.lineHeight)||1.85)));
        setReaderReady(true);
        if (s.target !== book.language) setTarget(s.target as Lang);
      });
    return () => {
      stopped.current = true;
      abort.current?.abort();
      if ("speechSynthesis" in window) speechSynthesis.cancel();
    };
  }, []);
  useEffect(() => {
    if (readerReady) void store.setSetting("reader", { font, theme, layout, target, readMode,fontFamily,lineHeight,showPageButtons,speechProvider,speechVoice,speechRate,speechVolume,speechPitch,sleepMinutes });
  }, [readerReady, font, theme, layout, target, readMode,fontFamily,lineHeight,showPageButtons,speechProvider,speechVoice,speechRate,speechVolume,speechPitch,sleepMinutes]);
  useEffect(() => {
    if (readMode !== "continuous" || !sentinel.current || !("IntersectionObserver" in window)) return;
    const observer = new IntersectionObserver(entries => {
      if (entries.some(e => e.isIntersecting)) setRangeEnd(end => Math.min(book.chapters.length, end + 2));
    }, { rootMargin: "600px" });
    observer.observe(sentinel.current); return () => observer.disconnect();
  }, [readMode, rangeEnd, book.chapters.length]);
  const readingProgress=useReadingProgress({book,paper,ready:readerReady&&!paginationBusy,onProgress:async position=>{setPagePosition(position);latest.current={...latest.current,position};await onProgress(position);},onRemote:position=>{
    viewport.seek(position);setPagePosition(position);setChapter(position.chapter);setRangeStart(position.chapter);setRangeEnd(Math.min(book.chapters.length,position.chapter+2));
  }});
  useEffect(()=>{
    const key=(e:KeyboardEvent)=>{
      if(readMode!=="paged"||paginationBusy||turning||e.shiftKey||e.altKey||e.ctrlKey||e.metaKey||document.querySelector('.overlay,.sidebar.open')||e.target instanceof HTMLElement&&e.target.closest('input,textarea,select,[contenteditable=true],.word-popover,.reader-flyout,.speech-player'))return;
      if(e.key==="ArrowRight"){e.preventDefault();void goPage(pageIndex+1);}if(e.key==="ArrowLeft"){e.preventDefault();void goPage(pageIndex-1);}
      if(e.key==="Escape"){closeLookup();setFloatingTools(false);}
    };window.addEventListener('keydown',key);return()=>window.removeEventListener('keydown',key);
  },[readMode,pageIndex,translating,pages,paginationBusy,turning]);
  async function goPage(index: number, automatic=false, animate=true) {
    if(!automatic)stopReading();
    const epoch=readingEpoch.current;
    if (translating || paginationBusy || turning) return;
    let page=pages[index];
    if (!page) {
      if(index<0&&viewport.beforeComplete||index>=pages.length&&viewport.afterComplete)return;
      setTurning(true);
      try { const next=await viewport.extend(index<0?'backward':'forward');if(!next)return;page=next; }
      finally { setTurning(false); }
    }
    if(!page||automatic&&(epoch!==readingEpoch.current||!autoReading.current||sleepDeadline.current>0&&Date.now()>=sleepDeadline.current))return;
    const first=page.fragments[0],position={chapter:first.chapter,paragraph:first.paragraph,offset:first.start};
    if(readMode==='paged'&&animate)pageTurn.turn(index<pageIndex?'backward':'forward');
    setPagePosition(position); setChapter(first.chapter); setActiveParagraph("");
    closeLookup();
    void readingProgress.record(position).catch(e=>notify(errorText(e)));
    if(readMode!=="paged")paper.current?.scrollIntoView({ block: "start", behavior: "instant" });
    return page;
  }
  function jumpTo(position:Book['position']) {
    pageTurn.cancel();stopReading();closeLookup();setSearch('');viewport.seek(position);setPagePosition(position);setChapter(position.chapter);setRangeStart(position.chapter);setRangeEnd(Math.min(book.chapters.length,position.chapter+2));
    setActiveParagraph(book.chapters[position.chapter].paragraphs[position.paragraph].id);
    void readingProgress.record(position).catch(e=>notify(errorText(e)));setTimeout(()=>readingProgress.reveal(position),60);
  }
  async function goChapter(ci: number) {
    if (readMode === "paged") { jumpTo({chapter:ci,paragraph:0,offset:0}); return; }
    setChapter(ci); setRangeStart(ci); setRangeEnd(Math.min(book.chapters.length, ci + 2));
    closeLookup();
    try { await readingProgress.record({ chapter:ci,paragraph:0,offset:0 }); }
    catch (e) { notify(errorText(e)); }
    requestAnimationFrame(() => paper.current?.scrollIntoView({ block: "start", behavior: "instant" }));
  }
  async function update(next: Book) {
    await onUpdate(next);
    latest.current = next;
  }
  async function patchParagraph(pid: string, fn: (p: Paragraph) => Paragraph) {
    const b = latest.current;
    await update({
      ...b,
      chapters: b.chapters.map((c) => ({
        ...c,
        paragraphs: c.paragraphs.map((p) => (p.id === pid ? fn(p) : p)),
      })),
    });
  }
  async function markPosition(i: number, ci = chapter, offset = 0) {
    try {
      await readingProgress.record({chapter:ci,paragraph:i,offset});
    } catch (e) {
      notify(errorText(e));
    }
  }
  const supported =
    cap?.configured &&
    cap.pairs.some(
      (p) => p.source === book.language && p.targets.includes(target),
    );
  async function translate(scope: "sample" | "chapter" | "page" | "book") {
    if (translating) return;
    const pending = pendingParagraphs(latest.current, target, (scope === "book" || scope === "page") ? undefined : chapter);
    const visibleIds = new Set(fragments.map(f => book.chapters[f.chapter].paragraphs[f.paragraph].id));
    const work = scope === "sample" ? pending.slice(0, 1) : scope === "page" ? pending.filter(p => visibleIds.has(p.id)) : pending;
    if (!work.length) {
      notify("Các đoạn trong phạm vi đã có bản dịch. Không dịch lại.");
      return;
    }
    if (!consent) {
      notify("Vui lòng đồng ý gửi nội dung tới máy chủ dịch đã cấu hình.");
      return;
    }
    setLayout(current => current === "original" || current === "translation" ? (window.matchMedia("(max-width: 600px)").matches ? "interleaved" : "parallel") : current);
    stopped.current = false;
    setTranslating(true);
    let done = 0;
    await store.setSetting(`job:${book.id}:${target}`, {
      status: "running",
      chapter,
      target,
      total: work.length,
      done: 0,
    });
    try {
      for (const p of work) {
        if (stopped.current) break;
        const existing = latest.current.chapters
          .flatMap((c) => c.paragraphs)
          .find((x) => x.id === p.id)?.translations[target];
        if (existing?.text) continue;
        setJobStatus(`Đang dịch ${done + 1}/${work.length}…`);
        abort.current = new AbortController();
        const session = store.supabase ? await store.supabase.auth.getSession() : null;
        const headers: Record<string, string> = {
          "Content-Type": "application/json",
        };
        if (session?.data.session)
          headers.Authorization = `Bearer ${session.data.session.access_token}`;
        const response = await fetch("/api/translate", {
          method: "POST",
          headers,
          body: JSON.stringify({ text: p.text, source: book.language, target }),
          signal: abort.current.signal,
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "Dịch thất bại.");
        await patchParagraph(p.id, (x) =>
          x.translations[target]?.text
            ? x
            : applyTranslation(x, target, data.text, data.provider),
        );
        done++;
        await store.setSetting(`job:${book.id}:${target}`, {
          status: "running",
          chapter,
          target,
          total: work.length,
          done,
        });
      }
      setJobStatus(
        stopped.current
          ? "Đã tạm dừng. Bấm dịch để tiếp tục phần còn thiếu."
          : `Đã lưu ${done} đoạn dịch.`,
      );
    } catch (e) {
      setJobStatus("Đã dừng, các đoạn dịch đã lưu được giữ nguyên.");
      if (!stopped.current) notify(errorText(e));
    } finally {
      setTranslating(false);
      await store.setSetting(`job:${book.id}:${target}`, {
        status: stopped.current ? "paused" : "stopped",
        chapter,
        target,
        total: work.length,
        done,
      });
    }
  }
  function speak(text: string, lang: Lang, label = 'Trang đang đọc', follow=false) {
    stopReading();autoReading.current=follow;
    if(sleepMinutes){sleepDeadline.current=Date.now()+sleepMinutes*60000;setSleepRemaining(sleepMinutes*60);}
    speech.start(text,lang,label);
  }
  function textOf(fragments:Fragment[]){return fragments.map(f=>book.chapters[f.chapter].paragraphs[f.paragraph].text.slice(f.start,f.end)).join('\n');}
  function speakPage(){speak(textOf(fragments),book.language,'Trang đang đọc',true);}
  useEffect(()=>{
    if(!advancePending||paginationBusy||turning||translating)return;
    setAdvancePending(false);const epoch=readingEpoch.current;
    if(!autoReading.current||sleepDeadline.current&&Date.now()>=sleepDeadline.current){stopReading();return;}
    void(async()=>{
      if(readMode==='paged'){
        const next=await goPage(pageIndex+1,true);
        if(epoch!==readingEpoch.current||!autoReading.current)return;
        if(sleepDeadline.current&&Date.now()>=sleepDeadline.current){stopReading();notify('Đã hết giờ hẹn. Giọng đọc đã tắt.');return;}
        if(!next){stopReading();notify('Đã đọc hết sách.');return;}
        speech.start(textOf(next.fragments),book.language,'Trang đang đọc');
      }else{
        const next=rangeEnd;
        if(next>=book.chapters.length){stopReading();notify('Đã đọc hết sách.');return;}
        const position={chapter:next,paragraph:0,offset:0};setChapter(next);setRangeStart(next);setRangeEnd(next+1);setPagePosition(position);void readingProgress.record(position);
        speech.start(book.chapters[next].paragraphs.map(p=>p.text).join('\n'),book.language,book.chapters[next].title);
      }
    })();
  },[advancePending,paginationBusy,turning,translating,pages]);
  function selectedPosition(){const ci=book.chapters.findIndex(c=>c.paragraphs.some(p=>p.id===wordHit?.paragraphId));const pi=book.chapters[ci]?.paragraphs.findIndex(p=>p.id===wordHit?.paragraphId)??0;return {chapter:Math.max(0,ci),paragraph:pi,offset:wordHit?.offset||0};}
  return (
    <div className={`reader ${theme==='midnight'?'theme-dark ':''}theme-${theme} ${readMode==='paged'?'is-paged':''} ${paginationBusy?'pagination-pending':''}`}>
      <button className="reader-mobile-menu" aria-label="Mở menu" onClick={()=>{closeLookup();onMenu();}}><Menu/></button>
      {readMode==='paged'&&<div className="paged-title"><strong>{book.title}</strong><small>{book.chapters[chapter].title}</small></div>}
      {sourcePdf && <Modal title={`PDF gốc · trang ${book.chapters[chapter].sourcePage}`} onClose={() => setSourcePdf(null)}>
        <Suspense fallback={<p>Đang mở PDF…</p>}><PdfPageView file={sourcePdf} page={book.chapters[chapter].sourcePage!} /></Suspense>
      </Modal>}
      <ReaderDock book={book} chapter={chapter} onChapter={i=>void goChapter(i)} onClose={onCloseMenu}/>
      {showBookmarks&&<Modal title="Dấu trang" onClose={()=>setShowBookmarks(false)}><BookmarksPanel book={book} onPosition={position=>{jumpTo(position);setShowBookmarks(false);setFloatingTools(false);}} onBookmark={async(position,label)=>{await update(putBookmark(latest.current,position,label));}} onRemoveBookmark={async(pid,offset)=>{await update(removeBookmark(latest.current,pid,offset));}}/></Modal>}
      {showBookSearch&&<Modal title="Tìm trong sách" onClose={()=>setShowBookSearch(false)}><BookSearchPanel book={book} onPosition={position=>{jumpTo(position);setShowBookSearch(false);setFloatingTools(false);}}/></Modal>}
      {translationImport&&<TranslationImport book={book} chapter={chapter} target={target} onClose={()=>setTranslationImport(false)} onSave={async(language,plan,replace,locked)=>{
        const result=applyImportedTranslations(latest.current,language,plan,replace,locked);
        if(!result.saved)throw new Error('Không có đoạn mới để lưu. Những đoạn đã có bản dịch hoặc đã khóa vẫn được giữ.');
        await update(result.book);setTarget(language);setLayout('interleaved');setFloatingTools(false);notify(`Đã nhập ${result.saved} đoạn dịch; giữ ${result.skipped} đoạn đã có hoặc đã khóa.`);
      }}/>}
      {wordHit&&<WordPopover key={`${wordHit.source}:${wordHit.term}`} word={wordHit} target={wordHit.source===book.language?target:book.language} actions={<>
        <button onClick={()=>void update(putBookmark(latest.current,selectedPosition())).then(()=>notify('Đã lưu dấu trang.')).catch(e=>notify(errorText(e)))}>Lưu dấu trang</button>
        <button onClick={()=>{const position=selectedPosition();void readingProgress.record(position).catch(e=>notify(errorText(e)));notify('Đã lưu vị trí đọc.');}}>Lưu vị trí đọc</button>
        <button onClick={()=>void patchParagraph(wordHit.paragraphId,p=>({...p,highlight:!p.highlight})).catch(e=>notify(errorText(e)))}>Tô sáng</button>
        <button onClick={()=>{const p=book.chapters[selectedPosition().chapter].paragraphs[selectedPosition().paragraph];setEditing(p);setEditedText(p.translations[target]?.text||'');setNote(p.note||'');closeLookup();}}>Ghi chú / bản dịch</button>
        <button onClick={()=>{speak(wordHit.term,wordHit.source,'Phần đã chọn');closeLookup();}}>Nghe phần chọn</button>
        <button onClick={()=>{closeLookup();setShowBookmarks(true);}}>Dấu trang đã lưu</button>
      </>} onClose={closeLookup} onSave={async(term,meaning)=>{
        const paragraph=book.chapters.flatMap(c=>c.paragraphs).find(p=>p.id===wordHit.paragraphId)!;
        await onWord({id:id(),term,meaning,language:wordHit.source,status:'new',createdAt:new Date().toISOString(),contexts:[{bookId:book.id,bookTitle:book.title,paragraphId:paragraph.id,sentence:wordHit.source===book.language?paragraph.text:paragraph.translations[wordHit.source]?.text||paragraph.text}]});
      }}/>}
      <button className="reader-listen-button" title={speaking?'Dừng nghe':`Nghe trang · ${speechProvider==='google'?'Google trực tuyến':'giọng thiết bị'}`} aria-label={speaking?'Dừng đọc thành tiếng':'Nghe trang đang đọc'} disabled={paginationBusy} onClick={()=>speaking?stopReading():speakPage()}><Volume2 size={18}/></button>
      <section className="speech-player" aria-label="Trình phát đọc sách" hidden={!speaking}>
        <div className="row"><strong>{speech.label}</strong><span>{speech.part}</span><button onClick={stopReading} aria-label="Dừng nghe">×</button></div>
        <p role="status">{speech.error || (advancePending||turning&&autoReading.current?'Đang chuyển sang trang tiếp theo…':speech.phase==='loading'?'Đang chuẩn bị giọng đọc…':speech.phase==='paused'?'Đã tạm dừng.':speech.phase==='playing'?'Đang phát giọng đọc.':'')}</p>
        <small>{speechProvider==='google'?'Google trực tuyến · chỉ gửi phần đang nghe':'Giọng thiết bị'}</small>
        <audio ref={speech.audio} controls preload="none" aria-label="Âm thanh đọc sách" hidden={speechProvider!=='google'}/>
        <div className="row">{speech.phase==='playing'&&<button onClick={speech.pause}>Tạm dừng nghe</button>}{speech.phase==='paused'&&<button onClick={()=>void speech.resume()}>Tiếp tục nghe</button>}{speech.phase==='error'&&<button onClick={speech.retry}>Thử đọc lại</button>}</div>
        <details><summary>Âm lượng, tốc độ & hẹn giờ</summary>
        <label>Tốc độ đọc<select aria-label="Tốc độ đang nghe" value={speechRate} onChange={e=>setSpeechRate(Number(e.target.value))}>{[.6,.8,1,1.2,1.5].map(v=><option key={v} value={v}>{v}×</option>)}</select></label>
        <label>Âm lượng · {Math.round(speechVolume*100)}%<input aria-label="Âm lượng đọc" type="range" min={0} max={100} value={Math.round(speechVolume*100)} onChange={e=>setSpeechVolume(Number(e.target.value)/100)}/></label>
        <label>Hẹn giờ tắt (phút, 0 = tắt)<input aria-label="Hẹn giờ tắt" type="number" min={0} max={1440} value={sleepMinutes} onChange={e=>setSleep(Number(e.target.value))}/></label>
        {sleepRemaining>0&&<small role="status">Tắt sau {Math.floor(sleepRemaining/60)}:{String(sleepRemaining%60).padStart(2,'0')}</small>}

        </details>
      </section>
      {(readMode==='paged'||toolsOffscreen||floatingTools)&&<button className="show-reader-tools" aria-expanded={floatingTools} onClick={()=>setFloatingTools(v=>!v)}>{floatingTools?"Ẩn công cụ":"Hiện công cụ"}</button>}
      <div ref={controlSlot} className="reader-control-slot" style={floatingTools?{height:controlsHeight}:undefined}>
      <div ref={controls} className={`reader-controls ${floatingTools?"tools-floating":""}`}>
      <div className="reader-header">
        <button
          onClick={() => {
            stopped.current = true;
            abort.current?.abort();
            onBack();
          }}
        >
          <ArrowLeft size={18} /> Thư viện
        </button>
        <div>
          <h1>{book.title}</h1>
          <p>
            {book.author} · {languages[book.language]}
          </p>
        </div>
        {book.chapters[chapter].sourcePage && <button disabled={sourceLoading} onClick={async () => {
          setSourceLoading(true);
          try { const original = await store.getOriginal(book, cloud); if (!original) throw new Error("Không tìm thấy tệp PDF gốc."); setSourcePdf(original); }
          catch (e) { notify(errorText(e)); }
          finally { setSourceLoading(false); }
        }}>Đối chiếu PDF gốc</button>}
        <button className="primary" onClick={() => { if (translationPanel.current) { translationPanel.current.open = true; translationPanel.current.scrollIntoView({ block: "center" }); } }}>Dịch song ngữ</button>
        <button
          aria-label="Chỉnh thông tin sách"
          onClick={() => setMetadata(true)}
        >
          <Settings size={20} />
        </button>
      </div>
      <div className="reader-tools">
        <label>
          Chương
          <select
            aria-label="Chương"
            value={chapter}
            disabled={translating}
            onChange={e => void goChapter(Number(e.target.value))}
          >
            {book.chapters.map((c, i) => (
              <option key={c.id} value={i}>
                {c.title}
              </option>
            ))}
          </select>
        </label>
        <LanguageSelect
          label="Dịch sang"
          value={target}
          onChange={(v) => {
            if (v !== book.language && !translating) setTarget(v);
          }}
        />
        <label>
          Hiển thị
          <select
            aria-label="Kiểu đọc"
            value={layout}
            onChange={(e) => setLayout(e.target.value)}
          >
            <option value="parallel">Hai cột</option>
            <option value="interleaved">Xen kẽ</option>
            <option value="original">Nguyên văn</option>
            <option value="translation">Bản dịch</option>
          </select>
        </label>
        <label>Chế độ đọc<select aria-label="Chế độ đọc" value={readMode} onChange={e => {
          const mode = e.target.value as "paged" | "continuous"; setReadMode(mode);
          setRangeStart(chapter); setRangeEnd(Math.min(book.chapters.length, chapter + 2));
        }}><option value="paged">Lật trang</option><option value="continuous">Cuộn liên tục</option></select></label>
        <label className="checkbox"><input type="checkbox" checked={showPageButtons} onChange={e=>setShowPageButtons(e.target.checked)}/>Hiện nút chuyển trang</label>
        <label>Cỡ chữ<input aria-label="Cỡ chữ" type="number" min={8} max={72} step={1} value={fontDraft} onChange={e=>{setFontDraft(e.target.value);const next=Number(e.target.value);if(next>=8&&next<=72)setFont(next);}} onBlur={()=>{const next=Math.max(8,Math.min(72,Number(fontDraft)||font));setFont(next);setFontDraft(String(next));}}/></label>
        <button onClick={()=>setShowBookmarks(true)}>Dấu trang</button><button onClick={()=>setShowBookSearch(true)}>Tìm trong sách</button>
        <label>Phông chữ<select aria-label="Phông chữ đọc" value={fontFamily} onChange={e=>setFontFamily(e.target.value)}>{readerFonts.map(font=><option value={font.id} key={font.id}>{font.label}</option>)}</select></label>
        <label>Tốc độ đọc<select aria-label="Tốc độ đọc" value={speechRate} onChange={e=>setSpeechRate(Number(e.target.value))}>{[.6,.8,1,1.2,1.5].map(v=><option key={v} value={v}>{v}×</option>)}</select></label>
        <label>Nguồn giọng đọc<select aria-label="Nguồn giọng đọc" value={speechProvider} onChange={e=>{stopReading();setSpeechProvider(e.target.value as SpeechProvider);}}><option value="google">Google trực tuyến (gửi văn bản tới Google)</option><option value="device">Giọng thiết bị</option></select></label>
        {speechProvider==='device'&&<label>Giọng thiết bị<select aria-label="Giọng thiết bị" value={speechVoice} onChange={e=>{stopReading();setSpeechVoice(e.target.value);}}><option value="">Tự chọn đúng ngôn ngữ sách</option>{speech.voices.filter(v=>v.lang.toLowerCase().startsWith(book.language)).map(v=><option value={v.voiceURI} key={v.voiceURI}>{v.name} · {v.lang}</option>)}</select></label>}
        <label>Khoảng dòng<input aria-label="Khoảng dòng" type="range" min={1.3} max={2.5} step={0.05} value={lineHeight} onChange={e=>setLineHeight(Number(e.target.value))}/></label>
        <label>Âm lượng · {Math.round(speechVolume*100)}%<input aria-label="Âm lượng" type="range" min={0} max={100} value={Math.round(speechVolume*100)} onChange={e=>setSpeechVolume(Number(e.target.value)/100)}/></label>
        <label>Cao độ giọng (thiết bị)<input aria-label="Cao độ giọng" type="range" min={.5} max={2} step={.1} disabled={speechProvider!=='device'} value={speechPitch} onChange={e=>setSpeechPitch(Number(e.target.value))}/></label>
        <label>Hẹn giờ tắt (phút, 0 = tắt)<input aria-label="Hẹn giờ tắt trước khi nghe" type="number" min={0} max={1440} value={sleepMinutes} onChange={e=>setSleep(Number(e.target.value))}/></label>
        <label>
          Nền đọc
          <select
            aria-label="Nền đọc"
            value={theme}
            onChange={(e) => setTheme(e.target.value)}
          >
            {readerThemes.map(theme=><option value={theme.id} key={theme.id}>{theme.label}</option>)}
          </select>
        </label>
        <label>
          Kệ
          <select
            value={book.shelf}
            aria-label="Kệ sách"
            onChange={(e) =>
              void update({
                ...latest.current,
                shelf: e.target.value as Book["shelf"],
              }).catch((e) => notify(errorText(e)))
            }
          >
            {Object.entries(labels).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
        </label>
      </div>
      <section className="reader-appearance" aria-label="Mẫu phông chữ và màu giấy">
        <div className="paper-swatches" role="group" aria-label="Chọn nhanh màu giấy">{readerThemes.map(choice=><button type="button" key={choice.id} aria-label={`Màu giấy ${choice.label}`} aria-pressed={theme===choice.id} title={choice.label} style={{background:choice.paper,color:choice.ink}} onClick={()=>setTheme(choice.id)}><span aria-hidden="true">Aa</span>{theme===choice.id&&<Check size={13}/>}</button>)}</div>
        <p className="reader-font-preview" style={{fontFamily:fonts[fontFamily],background:readerThemes.find(choice=>choice.id===theme)?.paper,color:readerThemes.find(choice=>choice.id===theme)?.ink}}>Những trang sách mở ra một thế giới. <span>Tiếng Việt · ă â ê ô ơ ư đ</span></p>
      </section>
      <details ref={translationPanel} className="translation-panel">
        <summary>
          <Languages size={17} /> Dịch & nghe{" "}
          <span>
            {supported
              ? "Có thể dịch cặp đã chọn"
              : "Chưa có dịch vụ cho cặp đã chọn"}
          </span>
        </summary>
        <p>
          Chỉ gửi các đoạn chưa có bản dịch. Bản đã sửa hoặc khóa được giữ
          nguyên. Tạm dừng khi mất mạng hoặc máy chủ báo hết hạn mức.
        </p>
        {!supported && (
          <p className="notice">
            {cap?.reason || "Máy chủ chưa cài mô hình hỗ trợ cặp ngôn ngữ này."}{" "}
            Bạn vẫn có thể đọc và nhập bản dịch thủ công.
          </p>
        )}
        <label className="checkbox">
          <input
            type="checkbox"
            checked={consent}
            onChange={(e) => setConsent(e.target.checked)}
          />{" "}
          Tôi đồng ý gửi văn bản cần dịch tới {cap?.provider || "dịch vụ đã chọn"}.
        </label>
        <p className="muted">{cap?.reason || `Nhà cung cấp: ${cap?.provider || "chưa cấu hình"}`}</p>
        <div className="row">
          <button disabled={translating} onClick={()=>{closeLookup();setTranslationImport(true);}}>Nhập bản dịch có sẵn</button>
          <button className="primary" disabled={!supported || translating || !consent} onClick={() => void translate("page")}>{readMode === "paged" ? "Dịch trang này" : "Dịch phần đang đọc"}</button>
          <button disabled={!supported || translating || !consent} onClick={() => void translate("book")}>Dịch toàn sách / tiếp tục</button>
          <button
            disabled={!supported || translating}
            onClick={() => void translate("sample")}
          >
            Dịch mẫu 1 đoạn
          </button>
          <button
            className="primary"
            disabled={!supported || translating}
            onClick={() => void translate("chapter")}
          >
            <Languages size={16} /> Dịch chương
          </button>
          {translating && (
            <button
              onClick={() => {
                stopped.current = true;
                abort.current?.abort();
              }}
            >
              <Pause size={16} /> Tạm dừng
            </button>
          )}
          <button
            onClick={() =>
              speaking
                ? stopReading()
                : speakPage()
            }
          >
            {speaking ? <Pause size={16} /> : <Volume2 size={16} />}{" "}
            {speaking ? "Dừng nghe" : "Nghe nguyên văn"}
          </button>

        </div>
        <p role="status">{jobStatus}</p>
        <small>
          {speechProvider==='google'?'Google trực tuyến: chỉ gửi phần đang nghe; cần Internet. Có thể chọn giọng thiết bị trong công cụ đọc.':'Giọng thiết bị cần có giọng đúng ngôn ngữ sách. Nếu không phát được, chọn Google trực tuyến.'}
        </small>
      </details>
      </div></div>
      <div className="reader-subhead">
        <h2>{book.chapters[chapter].title}</h2>
        <label className="search">
          <Search size={16} />
          <input
            aria-label="Tìm trong chương"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Tìm trong chương…"
          />
        </label>
      </div>
      <div ref={pageFrame} className="page-frame" data-pagination-complete={viewport.complete}>
      {viewport.error&&readMode==='paged'&&<p role="alert">{viewport.error}</p>}
      {paginationBusy&&readMode==='paged'&&<p className="pagination-loading" role="status">Đang chia trang theo màn hình…</p>}
      <div ref={paper} className={`reading-paper paragraphs layout-${layout} mode-${readMode}`} style={{ fontSize: font,maxWidth:"none","--reader-font":fonts[fontFamily],"--reader-leading":lineHeight } as React.CSSProperties} tabIndex={0} aria-label="Trang sách" aria-busy={paginationBusy||turning}
        onPointerDown={e=>{
          selecting.current=true;const rect=e.currentTarget.getBoundingClientRect(),x=e.clientX-rect.left,y=e.clientY-rect.top;
          const mouseCorner=(x<20||x>rect.width-20)&&(y<64||y>rect.height-64);
          if(!(e.target as HTMLElement).closest('button,a,input,textarea,select')){dragStart.current={x:e.clientX,y:e.clientY,pointerId:e.pointerId,mouseCorner};if(readMode==='paged'&&e.pointerType==='mouse'&&mouseCorner&&getSelection()?.isCollapsed){e.preventDefault();e.currentTarget.focus({preventScroll:true});}};
          if(e.pointerType==='touch'){touch.current={x:e.clientX,y:e.clientY,at:Date.now()};skipClick.current=Date.now()+500;}
        }}
        onPointerMove={e=>{
          const start=dragStart.current;if(!start||start.pointerId!==e.pointerId||readMode!=='paged'||paginationBusy||turning)return;
          const rect=e.currentTarget.getBoundingClientRect(),x=e.clientX-rect.left,y=e.clientY-rect.top;
          if(pageTurn.isDragging()){pageTurn.move(x,y);e.preventDefault();return;}
          const dx=e.clientX-start.x,dy=e.clientY-start.y;
          if(e.pointerType==='mouse'&&!start.mouseCorner||Math.abs(dx)<12||e.pointerType!=='mouse'&&Math.abs(dx)<Math.abs(dy)*1.25||!getSelection()?.isCollapsed)return;
          if(pageTurn.begin(dx<0?'forward':'backward',start.x-rect.left,start.y-rect.top)){
            e.currentTarget.setPointerCapture(e.pointerId);closeLookup();skipClick.current=Date.now()+800;pageTurn.move(x,y);e.preventDefault();
          }
        }}
        onPointerCancel={()=>{selecting.current=false;touch.current=null;dragStart.current=null;pageTurn.cancel();}}
        onPointerUp={e=>{
          selecting.current=false;dragStart.current=null;
          if(pageTurn.isDragging()){
            const rect=e.currentTarget.getBoundingClientRect();pageTurn.move(e.clientX-rect.left,e.clientY-rect.top);const direction=pageTurn.release();
            touch.current=null;skipClick.current=Date.now()+800;e.preventDefault();if(direction)void goPage(pageIndex+(direction==='forward'?1:-1),false,false);return;
          }
          if(e.pointerType!=='touch'||!touch.current)return;const start=touch.current;touch.current=null;const dx=e.clientX-start.x,dy=e.clientY-start.y;
          if(readMode==='paged'&&Math.abs(dx)>55&&Math.abs(dx)>Math.abs(dy)*1.4&&Date.now()-start.at<1500&&window.getSelection()?.isCollapsed){skipClick.current=Date.now()+500;e.preventDefault();void goPage(pageIndex+(dx<0?1:-1));}
        }}
        onClick={e=>{if(Date.now()<skipClick.current||!getSelection()?.isCollapsed||(e.target as HTMLElement).closest('button,a,input,textarea,select,.paragraph-actions'))return;
          if(readMode!=='paged')return;const box=e.currentTarget.getBoundingClientRect();void goPage(pageIndex+(e.clientX<box.left+box.width/2?-1:1));
        }}>
        {readMode === "continuous" && rangeStart > 0 && <button onClick={() => setRangeStart(start => Math.max(0, start - 2))}>Nạp chương trước</button>}
        {fragments.map((fragment, fi) => {
          const ci = fragment.chapter, i = fragment.paragraph;
          const p = book.chapters[ci].paragraphs[i];
          const displayText = p.text.slice(fragment.start, fragment.end);
          const translatedText = p.translations[target]?.text ? translatedFragment(p.translations[target]!.text, p.text.length, fragment.start, fragment.end) : "";
          if (
            search &&
            !p.text.toLowerCase().includes(search.toLowerCase()) &&
            !p.translations[target]?.text
              .toLowerCase()
              .includes(search.toLowerCase())
          )
            return null;
          return (
            <article
              data-chapter={ci} data-paragraph={i} data-paragraph-id={p.id} data-fragment-start={fragment.start} data-fragment-end={fragment.end}
              onClick={() => setActiveParagraph(p.id)}
              tabIndex={0}
              id={`p-${p.id}`}
              key={p.id}
              className={`paragraph ${activeParagraph === p.id ? "active-paragraph" : ""} ${p.highlight ? "highlighted" : ""} ${book.position.chapter === ci && book.position.paragraph === i ? "current" : ""}`}
            >
              {readMode === "continuous" && (fi === 0 || fragments[fi - 1].chapter !== ci) && <h3 className="continuous-chapter-title">{book.chapters[ci].title}</h3>}
              <div
                className="paragraph-text"
              >
                {layout !== "translation" && (
                  <p lang={book.language} data-reading-source data-lookup-lang={book.language} style={fragment.start ? { textIndent: 0 } : undefined}>{displayText}</p>
                )}
                {layout !== "original" && (
                  <div className="translated" lang={target}>
                    {p.translations[target]?.text ? (
                      <>
                        <p data-lookup-lang={target}>{translatedText}</p>
                        <span className="translation-label">
                          {p.translations[target]!.provider === "manual"
                            ? "Đã sửa thủ công"
                            : p.translations[target]!.provider === 'import' ? 'Bản dịch nhập sẵn' : "Dịch máy · " + p.translations[target]!.provider}
                          {p.translations[target]!.locked ? " · Đã khóa" : ""}
                        </span>
                      </>
                    ) : (
                      <p className="untranslated">
                        Chưa có bản dịch ·{" "}
                        <button
                          onClick={() => {
                            setEditing(p);
                            setEditedText("");
                            setNote(p.note || "");
                          }}
                        >
                          Thêm bản dịch
                        </button>
                      </p>
                    )}
                  </div>
                )}
              </div>
              {p.note && (
                <div className="paragraph-note">Ghi chú: {p.note}</div>
              )}
            </article>
          );
        })}
      </div>
      </div>
      {readMode === "continuous" && <div ref={sentinel} className="reading-sentinel" role="status">{rangeEnd < book.chapters.length ? "Đang nối phần tiếp theo…" : "Đã đến cuối sách."}</div>}
      {readMode==='paged'&&showPageButtons&&<nav className="desktop-page-buttons" aria-label="Lật trang"><button aria-label="Trang trước" disabled={paginationBusy||turning||pageIndex===0&&viewport.beforeComplete} onClick={()=>void goPage(pageIndex-1)}><ChevronLeft/></button><button aria-label="Trang sau" disabled={paginationBusy||turning||pageIndex>=pages.length-1&&viewport.afterComplete} onClick={()=>void goPage(pageIndex+1)}><ChevronRight/></button></nav>}
      <div className="reader-page-status" aria-live="polite">{readMode==='paged'?`Trang ${pageIndex+1}/${viewport.complete?pages.length:'…'} · ${turning?'đang mở trang':viewport.complete?'kéo góc trang · vuốt hoặc dùng phím trái/phải':'đang chia tiếp trong nền'}`:'Đọc liên tục · tự lưu vị trí'}</div>
      {editing && (
        <Modal
          title="Bản dịch & ghi chú"
          onClose={() => {
            setEditing(null);
          }}
        >
          <p className="source-preview">{editing.text}</p>
          <label>
            Bản dịch {languages[target]}
            <textarea
              aria-label="Bản dịch thủ công"
              rows={6}
              value={editedText}
              onChange={(e) => setEditedText(e.target.value)}
              disabled={editing.translations[target]?.locked}
            />
          </label>
          <label>
            Ghi chú
            <textarea
              aria-label="Ghi chú"
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
          </label>
          <div className="row">
            <button
              className="primary"
              onClick={async () => {
                try {
                  await patchParagraph(editing.id, (p) => ({
                    ...(editedText!==(editing.translations[target]?.text||'')?applyTranslation(p, target, editedText, "manual"):p),
                    note,
                  }));
                  setEditing(null);
                  if (editedText.trim() && layout === "original") setLayout("parallel");
                  notify("Đã lưu bản dịch và ghi chú.");
                } catch (e) {
                  notify(errorText(e));
                }
              }}
            >
              Lưu thay đổi
            </button>
            <button
              disabled={!editing.translations[target]}
              onClick={async () => {
                try {
                  const locked = !editing.translations[target]?.locked;
                  await patchParagraph(editing.id, (p) => ({
                    ...p,
                    translations: {
                      ...p.translations,
                      [target]: { ...p.translations[target]!, locked },
                    },
                  }));
                  setEditing({
                    ...editing,
                    translations: {
                      ...editing.translations,
                      [target]: { ...editing.translations[target]!, locked },
                    },
                  });
                } catch (e) {
                  notify(errorText(e));
                }
              }}
            >
              {editing.translations[target]?.locked ? (
                <Unlock size={16} />
              ) : (
                <Lock size={16} />
              )}{" "}
              {editing.translations[target]?.locked
                ? "Mở khóa"
                : "Khóa bản dịch"}
            </button>
          </div>
          {!!editing.translations[target]?.history.length && (
            <label>
              Khôi phục phiên bản cũ
              <select
                defaultValue=""
                disabled={editing.translations[target]?.locked}
                onChange={(e) => {
                  if (e.target.value !== "")
                    setEditedText(
                      editing.translations[target]!.history[
                        Number(e.target.value)
                      ],
                    );
                }}
              >
                <option value="">Chọn bản trước để xem và lưu lại</option>
                {editing.translations[target]!.history.map((h, i) => (
                  <option key={i} value={i}>
                    {i + 1}. {h.slice(0, 60)}
                  </option>
                ))}
              </select>
            </label>
          )}
        </Modal>
      )}
      {metadata && (
        <Modal title="Quản lý sách" onClose={() => setMetadata(false)}>
          <label>
            Tên sách
            <input
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
            />
          </label>
          <label>
            Tác giả
            <input
              value={newAuthor}
              onChange={(e) => setNewAuthor(e.target.value)}
            />
          </label>
          <div className="row">
            <button
              className="primary"
              onClick={async () => {
                try {
                  await update({
                    ...latest.current,
                    title: newTitle,
                    author: newAuthor,
                  });
                  setMetadata(false);
                } catch (e) {
                  notify(errorText(e));
                }
              }}
            >
              Lưu thông tin
            </button>
            <button
              onClick={async () => {
                try {
                  const f = await store.getOriginal(book, cloud);
                  if (f) download(book.originalName || `${book.title}.txt`, f);
                  else notify("Không tìm thấy tệp gốc.");
                } catch (e) {
                  notify(errorText(e));
                }
              }}
            >
              <Download size={16} /> Tải tệp gốc
            </button>
            <button className="danger" onClick={onDelete}>
              <Trash2 size={16} /> Xóa sách
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}

function ChildrenPanel({
  books,
  children,
  onSave,
  onDelete,
  onBook,
  notify,
}: {
  books: Book[];
  children: Child[];
  onSave: (c: Child[]) => Promise<void>;
  onDelete: (c: Child) => Promise<void>;
  onBook: (b: Book) => Promise<void>;
  notify: (s: string) => void;
}) {
  const [nickname, setNickname] = useState(""),
    [age, setAge] = useState(6),
    [childId, setChildId] = useState(""),
    [childMode, setChildMode] = useState(false),
    [chosen, setChosen] = useState<Book | null>(null),
    [sentence, setSentence] = useState(0),
    [audio, setAudio] = useState<string | null>(null),
    [recording, setRecording] = useState(false);
  const [savingPractice, setSavingPractice] = useState(false);
  const practice = useRef({ id: id(), started: Date.now() });
  async function finishPractice() {
    if (!child || !chosen || savingPractice) return;
    setSavingPractice(true);
    try {
      const entry = { id: practice.current.id, bookTitle: chosen.title,
        completedAt: new Date().toISOString(), sentences: sentence + 1,
        seconds: Math.max(0, Math.round((Date.now() - practice.current.started) / 1000)) };
      await onSave(children.map(c => c.id === child.id ? { ...c,
        practice: [...(c.practice || []).filter(p => p.id !== entry.id), entry].slice(-100) } : c));
      if ("speechSynthesis" in window) speechSynthesis.cancel();
      setChosen(null); setAudio(null);
      notify("Đã lưu buổi luyện đọc.");
    } catch (e) { notify(errorText(e)); }
    finally { setSavingPractice(false); }
  }
  const mounted = useRef(true);
  const recorder = useRef<MediaRecorder | null>(null),
    stream = useRef<MediaStream | null>(null),
    chunks = useRef<Blob[]>([]),
    audioRef = useRef<string | null>(null);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      recorder.current?.state === "recording" && recorder.current.stop();
      stream.current?.getTracks().forEach((t) => t.stop());
      if ("speechSynthesis" in window) speechSynthesis.cancel();
      if (audioRef.current) URL.revokeObjectURL(audioRef.current);
    };
  }, []);
  useEffect(() => {
    document.body.classList.toggle("child-mode", childMode);
    return () => document.body.classList.remove("child-mode");
  }, [childMode]);
  const child = children.find((c) => c.id === childId);
  const approved = books.filter(
    (b) =>
      b.approvedChildren.includes(childId) &&
      child?.languages.includes(b.language),
  );
  const sentences =
    chosen?.chapters.flatMap((c) =>
      c.paragraphs.flatMap(
        (p) => p.text.match(/[^.!?。！？]+[.!?。！？]*/gu) || [p.text],
      ),
    ) || [];
  async function record() {
    try {
      if (recording) {
        recorder.current?.stop();
        setRecording(false);
        return;
      }
      if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder)
        throw new Error(
          "Trình duyệt chưa hỗ trợ thu âm; cần HTTPS và quyền micro.",
        );
      stream.current = await navigator.mediaDevices.getUserMedia({
        audio: true,
      });
      if (!mounted.current) {
        stream.current.getTracks().forEach((t) => t.stop());
        return;
      }
      chunks.current = [];
      const r = new MediaRecorder(stream.current);
      recorder.current = r;
      r.ondataavailable = (e) => {
        if (e.data.size) chunks.current.push(e.data);
      };
      r.onstop = () => {
        const blob = new Blob(chunks.current, { type: r.mimeType });
        if (audioRef.current) URL.revokeObjectURL(audioRef.current);
        const url = URL.createObjectURL(blob);
        audioRef.current = url;
        setAudio(url);
        stream.current?.getTracks().forEach((t) => t.stop());
      };
      r.start();
      setRecording(true);
    } catch (e) {
      stream.current?.getTracks().forEach((t) => t.stop());
      notify(errorText(e));
    }
  }
  if (childMode)
    return (
      <div className="child-room">
        <span className="pill">
          GÓC ĐỌC CỦA {child?.nickname.toUpperCase()}
        </span>
        <h1>{chosen ? chosen.title : "Hôm nay mình đọc gì nhỉ?"}</h1>
        {chosen ? (
          <>
            <p>Câu {sentence + 1} / {sentences.length}</p>
            <p className="practice-sentence" lang={chosen.language}>
              {sentences[sentence]}
            </p>
            <div className="row centered">
              <button
                className="primary"
                disabled={recording}
                onClick={() => {
                  speechSynthesis.cancel();
                  const u = new SpeechSynthesisUtterance(sentences[sentence]);
                  u.lang = { vi: "vi-VN", zh: "zh-CN", en: "en-US" }[
                    chosen.language
                  ];
                  u.rate = 0.8;
                  speechSynthesis.speak(u);
                }}
              >
                <Volume2 /> Nghe mẫu
              </button>
              <button onClick={() => void record()}>
                {recording ? <Pause /> : <Headphones />}
                {recording ? "Kết thúc lượt đọc" : "Thu âm đọc lại"}
              </button>
              <button
                disabled={recording || sentence >= sentences.length - 1}
                onClick={() => {
                  setSentence(sentence + 1);
                  setAudio(null);
                }}
              >
                Câu tiếp theo <ChevronRight />
              </button>
            </div>
            {audio && (
              <div className="recording">
                <p>
                  Mình cùng nghe lại nhé. Bản thu chỉ ở trong phiên này, không
                  tải lên cloud.
                </p>
                <audio controls src={audio} />
                <button
                  onClick={() => {
                    if (audioRef.current) URL.revokeObjectURL(audioRef.current);
                    audioRef.current = null;
                    setAudio(null);
                  }}
                >
                  Xóa bản thu
                </button>
              </div>
            )}
            <p className="muted">
              Không chấm điểm phát âm. Phụ huynh có thể nghe và cùng con luyện
              lại.
            </p>
            <button className="primary" disabled={recording || savingPractice} onClick={() => void finishPractice()}>
              Hoàn thành buổi luyện
            </button>
            <button
              disabled={recording || savingPractice}
              onClick={() => {
                speechSynthesis.cancel();
                setChosen(null);
                setAudio(null);
              }}
            >
              Chọn sách khác
            </button>
          </>
        ) : (
          <div className="child-books">
            {approved.map((b) => (
              <button
                key={b.id}
                onClick={() => {
                  practice.current = { id: id(), started: Date.now() };
                  setChosen(b);
                  setSentence(0);
                }}
              >
                <BookOpen size={32} />
                <strong>{b.title}</strong>
                <span>{languages[b.language]}</span>
              </button>
            ))}
            {!approved.length && (
              <p>Chưa có sách được phụ huynh duyệt cho hồ sơ này.</p>
            )}
          </div>
        )}
        <details className="parent-return">
          <summary>Khu vực phụ huynh</summary>
          {!recording && !savingPractice && <ParentUnlock onUnlock={() => {
            if ("speechSynthesis" in window) speechSynthesis.cancel();
            setChildMode(false); setChosen(null); setAudio(null);
          }} />}
        </details>
      </div>
    );
  return (
    <>
      <div className="page-heading">
        <div>
          <p className="eyebrow">CÙNG CON LỚN LÊN QUA TỪNG TRANG SÁCH</p>
          <h1>Góc trẻ em.</h1>
          <p>Hồ sơ do phụ huynh quản lý. Chỉ sách đã duyệt mới xuất hiện.</p>
        </div>
      </div>
      <div className="settings-grid">
        <section className="panel">
          <h2>Hồ sơ đọc</h2>
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              try {
                const c: Child = {
                  id: id(),
                  nickname: nickname.trim(),
                  age,
                  level: "Đọc câu",
                  languages: ["vi"],
                };
                if (!c.nickname) return;
                await onSave([...children, c]);
                setChildId(c.id);
                setNickname("");
              } catch (e) {
                notify(errorText(e));
              }
            }}
          >
            <label>
              Biệt danh
              <input
                required
                value={nickname}
                onChange={(e) => setNickname(e.target.value)}
                placeholder="Không cần email của trẻ"
              />
            </label>
            <label>
              Tuổi
              <input
                type="number"
                min={3}
                max={17}
                value={age}
                onChange={(e) => setAge(Number(e.target.value))}
              />
            </label>
            <button className="primary">
              <Plus size={16} /> Thêm hồ sơ
            </button>
          </form>
          {children.map((c) => (
            <div className="child-profile" key={c.id}>
              <button
                className={childId === c.id ? "selected" : ""}
                onClick={() => setChildId(c.id)}
              >
                {c.nickname} · {c.age} tuổi
              </button>
              <button
                aria-label={`Xóa hồ sơ ${c.nickname}`}
                onClick={() => {
                  if (confirm("Xóa hồ sơ này?"))
                    void onDelete(c).catch((e) => notify(errorText(e)));
                }}
              >
                <Trash2 size={15} />
              </button>
            </div>
          ))}
        </section>
        <section className="panel">
          <h2>Phụ huynh duyệt sách</h2>
          {!child ? (
            <p>Chọn hoặc tạo hồ sơ trước.</p>
          ) : (
            <>
              <p>
                Đang quản lý hồ sơ <strong>{child.nickname}</strong>.
              </p>
              <label>
                Mức luyện đọc
                <select
                  value={child.level}
                  onChange={(e) =>
                    void onSave(
                      children.map((c) =>
                        c.id === child.id ? { ...c, level: e.target.value } : c,
                      ),
                    ).catch((e) => notify(errorText(e)))
                  }
                >
                  {[
                    "Nhận diện chữ và âm",
                    "Đọc từ",
                    "Đọc cụm từ",
                    "Đọc câu",
                    "Đọc đoạn",
                    "Đọc hiểu và kể lại",
                  ].map((v) => (
                    <option key={v}>{v}</option>
                  ))}
                </select>
              </label>
              <p className="muted">
                Hiện có luyện đọc câu với nội dung sách đã duyệt; bài biên soạn
                cho các mức khác nằm trong backlog.
              </p>
              <div className="row">
                {Object.entries(languages).map(([key, label]) => (
                  <label className="checkbox" key={key}>
                    <input
                      type="checkbox"
                      disabled={key === "vi"}
                      checked={child.languages.includes(key as Lang)}
                      onChange={(e) =>
                        void onSave(
                          children.map((c) =>
                            c.id === child.id
                              ? {
                                  ...c,
                                  languages: e.target.checked
                                    ? [...c.languages, key as Lang]
                                    : c.languages.filter((l) => l !== key),
                                }
                              : c,
                          ),
                        ).catch((e) => notify(errorText(e)))
                      }
                    />
                    {label}
                  </label>
                ))}
              </div>
              {books.map((b) => (
                <label className="approval" key={b.id}>
                  <input
                    type="checkbox"
                    checked={b.approvedChildren.includes(child.id)}
                    onChange={(e) =>
                      void onBook({
                        ...b,
                        approvedChildren: e.target.checked
                          ? [...b.approvedChildren, child.id]
                          : b.approvedChildren.filter((x) => x !== child.id),
                      }).catch((e) => notify(errorText(e)))
                    }
                  />
                  <span>
                    {b.title}
                    <small>{languages[b.language]}</small>
                  </span>
                </label>
              ))}
              <button className="primary" onClick={() => { enterChildLock(); setChildMode(true); }}>
                <Play size={17} /> Mở góc đọc của {child.nickname}
              </button>
            </>
          )}
        </section>
      </div>
      <ParentPinSettings />
      <section className="panel">
        <h2>Lịch sử luyện đọc{child ? ` · ${child.nickname}` : ""}</h2>
        <p>Ghi nhận khi bấm hoàn thành; số câu là tiến độ tự xác nhận, không phải điểm phát âm. Giữ tối đa 100 buổi gần nhất mỗi hồ sơ.</p>
        {child?.practice?.length ? <ul>{[...child.practice].reverse().map(p => <li key={p.id}>
          <strong>{p.bookTitle}</strong> · {p.sentences} câu · {Math.max(1, Math.round(p.seconds / 60))} phút · {new Date(p.completedAt).toLocaleString("vi-VN")}
        </li>)}</ul> : <p>Chưa có buổi luyện đã hoàn thành.</p>}
      </section>
    </>
  );
}
