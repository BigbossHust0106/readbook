import { useEffect, useRef, useState, type ReactNode } from "react";
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
import { importDocument } from "./importer";
import * as store from "./store";

type Page = "library" | "vocabulary" | "children" | "settings";
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
function Modal({
  title,
  children,
  onClose,
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
}) {
  const ref = useRef<HTMLElement>(null);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    ref.current
      ?.querySelector<HTMLElement>("button,input,textarea,select")
      ?.focus();
    return () => previous?.focus();
  }, []);
  return (
    <div className="overlay" onClick={onClose}>
      <section
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="modal"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => {
          if (e.key === "Escape") onClose();
          if (e.key === "Tab") {
            const nodes = Array.from(
              ref.current?.querySelectorAll<HTMLElement>(
                "button:not(:disabled),input:not(:disabled):not([hidden]),textarea:not(:disabled),select:not(:disabled),a[href]",
              ) || [],
            ).filter((n) => n.offsetParent !== null);
            const first = nodes[0],
              last = nodes[nodes.length - 1];
            if (e.shiftKey && document.activeElement === first) {
              e.preventDefault();
              last?.focus();
            } else if (!e.shiftKey && document.activeElement === last) {
              e.preventDefault();
              first?.focus();
            }
          }
        }}
      >
        <header>
          <h2>{title}</h2>
          <button aria-label="Đóng" onClick={onClose}>
            <X size={20} />
          </button>
        </header>
        {children}
      </section>
    </div>
  );
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
  const [page, setPage] = useState<Page>("library");
  const [books, setBooks] = useState<Book[]>([]);
  const [words, setWords] = useState<Word[]>([]);
  const [children, setChildren] = useState<Child[]>([]);
  const [cloud, setCloud] = useState(false);
  const [email, setEmail] = useState("");
  const [sessionEmail, setSessionEmail] = useState("");
  const [password, setPassword] = useState("");
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("all");
  const [languageFilter, setLanguageFilter] = useState("all");
  const [importOpen, setImportOpen] = useState(false);
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
  const active = books.find((b) => b.id === selected);
  const notify = (s: string) => setMessage(s);
  async function load(useCloud: boolean) {
    setReady(false);
    try {
      const [b, w, c] = await Promise.all([
        store.listBooks(useCloud),
        store.getCollection<Word>("vocabulary", useCloud),
        store.getCollection<Child>("children", useCloud),
      ]);
      setBooks(b);
      setWords(w);
      setChildren(c);
    } catch (e) {
      notify(errorText(e));
    } finally {
      setReady(true);
    }
  }
  useEffect(() => {
    void load(false);
    if (store.supabase) {
      const { data } = store.supabase.auth.onAuthStateChange(
        (_event, session) => {
          setSessionEmail(session?.user.email || "");
          if (!session) {
            setCloud(false);
          }
        },
      );
      return () => data.subscription.unsubscribe();
    }
  }, []);
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
    setBooks((prev) => prev.map((b) => (b.id === book.id ? book : b)));
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
      <aside className={`sidebar ${mobileNav ? "open" : ""}`}>
        <a
          className="brand"
          href="#"
          onClick={(e) => {
            e.preventDefault();
            setSelected(null);
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
        </nav>
        <div className="sidebar-note">
          <Leaf size={25} />
          <h3>
            Mỗi trang sách,
            <br />
            một điều mới.
          </h3>
          <p>
            Một chút đọc mỗi ngày.
            <br />
            Một thế giới rộng mở hơn.
          </p>
          <span>Chậm lại và đọc nhé ↗</span>
        </div>
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
                ? "Đã kết nối tài khoản"
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
                          ? setSelected(lastBook.id)
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
                            onClick={() => setSelected(b.id)}
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
                  <section className="panel">
                    <h2>
                      <Languages size={21} /> Dịch tài liệu
                    </h2>
                    <span
                      className={`state-badge ${cap?.configured ? "enabled" : ""}`}
                    >
                      {cap?.configured ? "Đã kết nối" : "Chưa khả dụng"}
                    </span>
                    <h3>LibreTranslate · API chính thức</h3>
                    <p>
                      {cap?.reason ||
                        "Khả năng dịch được lấy từ mô hình ngôn ngữ thực sự có trên máy chủ."}
                    </p>
                    <p>
                      Không có khóa dùng chung trong trình duyệt. Không tự
                      chuyển nhà cung cấp. Mỗi lần dịch đều cần xác nhận gửi văn
                      bản.
                    </p>
                    <p className="muted">
                      Giới hạn mỗi đoạn: 4.000 ký tự. Không hiển thị “miễn phí
                      không giới hạn”. Chỉ triển khai kết nối tới máy chủ do bạn
                      quản lý.
                    </p>
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
          onClose={() => setImportOpen(false)}
          onImport={async (book, file) => {
            if (
              books.some(
                (b) => b.hash === book.hash && b.language === book.language,
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
}: {
  onClose: () => void;
  onImport: (b: Book, file: Blob) => Promise<void>;
}) {
  const [file, setFile] = useState<File | null>(null),
    [text, setText] = useState(""),
    [title, setTitle] = useState(""),
    [author, setAuthor] = useState(""),
    [language, setLanguage] = useState<Lang>("vi"),
    [genre, setGenre] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  async function submit() {
    setBusy(true);
    setError("");
    try {
      const book = await importDocument(file, text, {
        title,
        author,
        language,
        genre,
      });
      await onImport(
        book,
        file || new Blob([text], { type: "text/plain;charset=utf-8" }),
      );
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
        Tệp gốc được giữ riêng. Nội dung chỉ gửi ra ngoài khi bạn chủ động dịch.
      </p>
      <label className="dropzone">
        <Upload size={30} />
        <strong>{file ? file.name : "Chọn tệp sách của bạn"}</strong>
        <span>EPUB, TXT UTF-8, DOCX, HTML · Tối đa 20 MB</span>
        <input
          type="file"
          aria-label="Tệp sách"
          accept=".epub,.txt,.docx,.html,.htm"
          onChange={(e) => {
            const f = e.target.files?.[0] || null;
            setFile(f);
            if (f && !title) setTitle(f.name.replace(/\.[^.]+$/, ""));
          }}
        />
      </label>
      {file ? (
        <button className="text-button" onClick={() => setFile(null)}>
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
          />
        </label>
        <label>
          Tác giả
          <input value={author} onChange={(e) => setAuthor(e.target.value)} />
        </label>
        <LanguageSelect
          label="Ngôn ngữ nguyên bản"
          value={language}
          onChange={setLanguage}
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
        disabled={busy || (!file && !text.trim())}
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
  onDelete,
}: {
  book: Book;
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
    [layout, setLayout] = useState("parallel"),
    [font, setFont] = useState(20),
    [theme, setTheme] = useState("light"),
    [search, setSearch] = useState(""),
    [selection, setSelection] = useState<{
      text: string;
      paragraph: Paragraph;
    } | null>(null),
    [meaning, setMeaning] = useState(""),
    [editing, setEditing] = useState<Paragraph | null>(null),
    [editedText, setEditedText] = useState(""),
    [note, setNote] = useState(""),
    [translating, setTranslating] = useState(false),
    [jobStatus, setJobStatus] = useState(""),
    [consent, setConsent] = useState(false),
    [speaking, setSpeaking] = useState(false),
    [speechRate, setSpeechRate] = useState(1),
    [metadata, setMetadata] = useState(false),
    [newTitle, setNewTitle] = useState(book.title),
    [newAuthor, setNewAuthor] = useState(book.author);
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
        layout: "parallel",
        target: book.language === "vi" ? "en" : "vi",
      })
      .then((s) => {
        setFont(s.font);
        setTheme(s.theme);
        setLayout(s.layout);
        if (s.target !== book.language) setTarget(s.target as Lang);
      });
    return () => {
      stopped.current = true;
      abort.current?.abort();
      if ("speechSynthesis" in window) speechSynthesis.cancel();
    };
  }, []);
  useEffect(() => {
    void store.setSetting("reader", { font, theme, layout, target });
  }, [font, theme, layout, target]);
  useEffect(() => {
    const el = document.getElementById(
      `p-${book.chapters[chapter]?.paragraphs[book.position.chapter === chapter ? book.position.paragraph : 0]?.id}`,
    );
    el?.scrollIntoView({ block: "center", behavior: "instant" });
  }, [chapter]);
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
  async function markPosition(i: number) {
    try {
      await update({ ...latest.current, position: { chapter, paragraph: i } });
    } catch (e) {
      notify(errorText(e));
    }
  }
  const paragraphs = book.chapters[chapter].paragraphs;
  const supported =
    cap?.configured &&
    cap.pairs.some(
      (p) => p.source === book.language && p.targets.includes(target),
    );
  async function translate(scope: "sample" | "chapter") {
    const pending = pendingParagraphs(latest.current, target, chapter);
    const work = scope === "sample" ? pending.slice(0, 1) : pending;
    if (!work.length) {
      notify("Các đoạn trong phạm vi đã có bản dịch. Không dịch lại.");
      return;
    }
    if (!consent) {
      notify("Vui lòng đồng ý gửi nội dung tới máy chủ dịch đã cấu hình.");
      return;
    }
    const count = work.reduce((n, p) => n + p.text.length, 0);
    if (
      !confirm(
        `Gửi ${work.length} đoạn (${count.toLocaleString("vi-VN")} ký tự) đến LibreTranslate? Không tự chuyển nhà cung cấp; máy chủ tự triển khai phải do bạn quản lý.`,
      )
    )
      return;
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
        const session = cloud ? await store.supabase!.auth.getSession() : null;
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
  function speak(text: string, lang: Lang) {
    if (!("speechSynthesis" in window)) {
      notify("Trình duyệt không hỗ trợ đọc thành tiếng.");
      return;
    }
    speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = { vi: "vi-VN", zh: "zh-CN", en: "en-US" }[lang];
    u.rate = speechRate;
    u.onend = () => setSpeaking(false);
    u.onerror = () => {
      setSpeaking(false);
      notify("Không phát được giọng đọc. Kiểm tra giọng đã cài trên thiết bị.");
    };
    setSpeaking(true);
    speechSynthesis.speak(u);
  }
  function capture(p: Paragraph) {
    const text = window.getSelection()?.toString().trim();
    if (text) {
      setSelection({ text: text.slice(0, 1000), paragraph: p });
      setMeaning("");
    }
  }
  return (
    <div className={`reader theme-${theme}`}>
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
            onChange={(e) => {
              const c = Number(e.target.value);
              setChapter(c);
              void update({
                ...latest.current,
                position: { chapter: c, paragraph: 0 },
              }).catch((e) => notify(errorText(e)));
            }}
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
        <label>
          Cỡ chữ
          <input
            aria-label="Cỡ chữ"
            type="range"
            min={16}
            max={30}
            value={font}
            onChange={(e) => setFont(Number(e.target.value))}
          />
        </label>
        <label>
          Nền đọc
          <select
            aria-label="Nền đọc"
            value={theme}
            onChange={(e) => setTheme(e.target.value)}
          >
            <option value="light">Sáng</option>
            <option value="sepia">Sepia</option>
            <option value="dark">Tối</option>
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
      <details className="translation-panel">
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
          Tôi đồng ý gửi văn bản được chọn tới máy chủ LibreTranslate đã cấu
          hình.
        </label>
        <div className="row">
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
                ? (speechSynthesis.cancel(), setSpeaking(false))
                : speak(paragraphs.map((p) => p.text).join("\n"), book.language)
            }
          >
            {speaking ? <Pause size={16} /> : <Volume2 size={16} />}{" "}
            {speaking ? "Dừng nghe" : "Nghe nguyên văn"}
          </button>
          <label>
            Tốc độ
            <select
              aria-label="Tốc độ đọc"
              value={speechRate}
              onChange={(e) => setSpeechRate(Number(e.target.value))}
            >
              {[0.6, 0.8, 1, 1.2, 1.5].map((v) => (
                <option key={v} value={v}>
                  {v}×
                </option>
              ))}
            </select>
          </label>
        </div>
        <p role="status">{jobStatus}</p>
        <small>
          Giọng đọc hệ thống tùy thiết bị; không cam kết hoạt động offline nếu
          giọng chưa tải sẵn.
        </small>
      </details>
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
      <div className={`paragraphs layout-${layout}`} style={{ fontSize: font }}>
        {paragraphs.map((p, i) => {
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
              id={`p-${p.id}`}
              key={p.id}
              className={`paragraph ${p.highlight ? "highlighted" : ""} ${book.position.chapter === chapter && book.position.paragraph === i ? "current" : ""}`}
            >
              <div
                className="paragraph-text"
                onMouseUp={() => capture(p)}
                onTouchEnd={() => capture(p)}
              >
                {layout !== "translation" && (
                  <p lang={book.language}>{p.text}</p>
                )}
                {layout !== "original" && (
                  <div className="translated" lang={target}>
                    {p.translations[target]?.text ? (
                      <>
                        <p>{p.translations[target]!.text}</p>
                        <span className="translation-label">
                          {p.translations[target]!.provider === "manual"
                            ? "Đã sửa thủ công"
                            : "Dịch máy · " + p.translations[target]!.provider}
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
              <div className="paragraph-actions">
                <span>{String(i + 1).padStart(2, "0")}</span>
                <button
                  aria-label={`Lưu vị trí đoạn ${i + 1}`}
                  title="Lưu vị trí để đọc tiếp"
                  onClick={() => void markPosition(i)}
                >
                  <Bookmark
                    size={15}
                    fill={
                      book.position.chapter === chapter &&
                      book.position.paragraph === i
                        ? "currentColor"
                        : "none"
                    }
                  />
                </button>
                <button
                  aria-label={`Tô sáng đoạn ${i + 1}`}
                  onClick={() =>
                    void patchParagraph(p.id, (x) => ({
                      ...x,
                      highlight: !x.highlight,
                    })).catch((e) => notify(errorText(e)))
                  }
                >
                  <Highlighter size={15} />
                </button>
                <button
                  aria-label={`Sửa bản dịch và ghi chú đoạn ${i + 1}`}
                  onClick={() => {
                    setEditing(p);
                    setEditedText(p.translations[target]?.text || "");
                    setNote(p.note || "");
                  }}
                >
                  <FileText size={15} />
                </button>
                <button
                  aria-label={`Nghe đoạn ${i + 1}`}
                  onClick={() => speak(p.text, book.language)}
                >
                  <Volume2 size={15} />
                </button>
                <button
                  aria-label={`Lưu từ từ đoạn ${i + 1}`}
                  onClick={() => {
                    setSelection({ text: p.text, paragraph: p });
                    setMeaning("");
                  }}
                >
                  <GraduationCap size={15} />
                </button>
              </div>
              {p.note && (
                <div className="paragraph-note">Ghi chú: {p.note}</div>
              )}
            </article>
          );
        })}
      </div>
      <div className="reader-bottom">
        <button
          disabled={chapter === 0 || translating}
          onClick={() => setChapter(chapter - 1)}
        >
          <ChevronLeft size={17} /> Chương trước
        </button>
        <span>
          {chapter + 1}/{book.chapters.length} chương ·{" "}
          {Math.floor((Date.now() - readingStart.current) / 60000)} phút trong
          phiên
        </span>
        <button
          disabled={chapter === book.chapters.length - 1 || translating}
          onClick={() => setChapter(chapter + 1)}
        >
          Chương sau <ChevronRight size={17} />
        </button>
      </div>
      {selection && (
        <Modal
          title="Từ & cụm từ trong ngữ cảnh"
          onClose={() => setSelection(null)}
        >
          <label>
            Từ hoặc cụm muốn lưu
            <textarea
              aria-label="Từ muốn lưu"
              value={selection.text}
              onChange={(e) =>
                setSelection({ ...selection, text: e.target.value })
              }
            />
          </label>
          <label>
            Nghĩa / ghi chú
            <textarea
              aria-label="Nghĩa của từ"
              value={meaning}
              onChange={(e) => setMeaning(e.target.value)}
            />
          </label>
          <blockquote>{selection.paragraph.text}</blockquote>
          <div className="row">
            <button
              className="primary"
              disabled={!selection.text.trim()}
              onClick={async () => {
                try {
                  await onWord({
                    id: id(),
                    term: selection.text.trim(),
                    meaning,
                    language: book.language,
                    contexts: [
                      {
                        bookId: book.id,
                        bookTitle: book.title,
                        paragraphId: selection.paragraph.id,
                        sentence: selection.paragraph.text,
                      },
                    ],
                    status: "new",
                    createdAt: new Date().toISOString(),
                  });
                  setSelection(null);
                } catch (e) {
                  notify(errorText(e));
                }
              }}
            >
              <Plus size={16} /> Lưu từ
            </button>
            <button onClick={() => speak(selection.text, book.language)}>
              <Volume2 size={16} /> Nghe
            </button>
            {book.language === "zh" && (
              <button
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(selection.text);
                    window.open(
                      "https://hanzii.net",
                      "_blank",
                      "noopener,noreferrer",
                    );
                    notify(
                      "Đã sao chép. Dán từ vào Hanzii để tra; chưa hỗ trợ truyền từ tự động.",
                    );
                  } catch {
                    notify(
                      "Không sao chép được. Hãy sao chép từ thủ công và mở hanzii.net.",
                    );
                  }
                }}
              >
                <ExternalLink size={16} /> Sao chép & mở Hanzii
              </button>
            )}
          </div>
          <p className="muted">
            Giai đoạn 1 chưa có từ điển tự động hoặc đánh giá phát âm.
          </p>
        </Modal>
      )}
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
                    ...applyTranslation(p, target, editedText, "manual"),
                    note,
                  }));
                  setEditing(null);
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
            <button
              disabled={recording}
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
          <p>
            Chế độ trẻ là bộ lọc nội dung trong phiên, chưa phải khóa phụ huynh
            bằng PIN.
          </p>
          <button
            disabled={recording}
            onClick={() => {
              speechSynthesis.cancel();
              setChildMode(false);
              setChosen(null);
              setAudio(null);
            }}
          >
            Về quản lý hồ sơ
          </button>
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
              <button className="primary" onClick={() => setChildMode(true)}>
                <Play size={17} /> Mở góc đọc của {child.nickname}
              </button>
            </>
          )}
        </section>
      </div>
    </>
  );
}
