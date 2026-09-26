"use client";

import {
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  BookmarkSimple as Bookmark,
  BookOpenText as BookOpen,
  Books as Library,
  CaretLeft as ChevronLeft,
  CaretRight as ChevronRight,
  Check,
  Compass,
  DownloadSimple as Download,
  GearSix as Settings,
  House as Home,
  List,
  MagnifyingGlass as Search,
  Minus,
  Plus,
  Question as CircleHelp,
  Sparkle as Sparkles,
  SlidersHorizontal,
  X,
  IconContext,
} from "@phosphor-icons/react";
import Image from "next/image";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Book } from "@/lib/books";

type View = "home" | "discover" | "search" | "library" | "reading" | "bookmarks" | "settings";
type LibraryShelf = "reading" | "finished" | "want";
type LibraryTab = LibraryShelf | "bookmarks" | "history";
type BookmarkEntry = { book: Book; position: number; createdAt: number };
type ReaderPreferences = {
  fontSize: number;
  lineHeight: number;
  theme: "paper" | "light" | "dark";
  readingWidth: "comfortable" | "wide";
};
type AppPreferences = {
  reader: ReaderPreferences;
  readableOnlyByDefault: boolean;
  language: string;
  reduceMotion: boolean;
};
type LibraryData = {
  shelves: Record<LibraryShelf, Book[]>;
  bookmarks: BookmarkEntry[];
  history: Book[];
  positions: Record<string, number>;
};
type ApiResponse = { books?: Book[]; error?: string };

const EMPTY_LIBRARY: LibraryData = {
  shelves: { reading: [], finished: [], want: [] },
  bookmarks: [],
  history: [],
  positions: {},
};

const DEFAULT_PREFERENCES: AppPreferences = {
  reader: { fontSize: 20, lineHeight: 1.8, theme: "paper", readingWidth: "comfortable" },
  readableOnlyByDefault: false,
  language: "",
  reduceMotion: false,
};

const NAV_ITEMS: { id: View; label: string; icon: typeof Home }[] = [
  { id: "home", label: "Home", icon: Home },
  { id: "discover", label: "Discover", icon: Compass },
  { id: "search", label: "Search", icon: Search },
  { id: "library", label: "My library", icon: Library },
];

const GENRES = [
  { label: "Classics", topic: "classics" },
  { label: "Fiction", topic: "fiction" },
  { label: "Mystery & crime", topic: "mystery" },
  { label: "Philosophy", topic: "philosophy" },
  { label: "Science", topic: "science" },
  { label: "History", topic: "history" },
  { label: "Biography", topic: "biography" },
  { label: "Poetry", topic: "poetry" },
  { label: "Essays", topic: "essays" },
  { label: "Children", topic: "children" },
  { label: "Indian literature", topic: "India" },
  { label: "Assamese literature", topic: "Assamese" },
  { label: "Short reads", topic: "short stories" },
  { label: "Hidden gems", topic: "literature" },
];

const HOME_SHELVES = [
  { title: "Popular free books", topic: "classics", subtitle: "The stories readers return to" },
  { title: "Trending in fiction", topic: "fiction", subtitle: "A little more plot, please" },
  { title: "Short reads for a small window", topic: "short stories", subtitle: "Good things come in brief chapters" },
  { title: "For curious minds", topic: "philosophy", subtitle: "Questions worth carrying around" },
  { title: "Worlds of wonder", topic: "science", subtitle: "Big ideas, open pages" },
  { title: "Stories from India", topic: "India", subtitle: "Across languages, places and time" },
];

function uniqueBooks(books: Book[]) {
  return [...new Map(books.map((book) => [book.id, book])).values()];
}

async function getBooks(params: URLSearchParams, onUnavailable: (message: string) => void) {
  try {
    const response = await fetch(`/api/books?${params.toString()}`);
    const payload = await response.json() as ApiResponse;
    if (!response.ok) {
      onUnavailable(payload.error ?? "Book sources are temporarily unavailable.");
      return [];
    }
    return payload.books ?? [];
  } catch {
    onUnavailable("Book sources are temporarily unavailable. Check your connection and try again.");
    return [];
  }
}

function authorLine(book: Book) {
  return book.authors.length ? book.authors.join(", ") : "Author unknown";
}

function availabilityLabel(book: Book) {
  if (book.availability === "readable") return book.readerMode === "internet-archive" ? "Read at source" : "Read now";
  if (book.availability === "preview") return "Preview";
  return "Metadata only";
}

function BookCover({ book, className = "", priority = false }: { book: Book; className?: string; priority?: boolean }) {
  const [failed, setFailed] = useState(false);
  return (
    <div className={`book-cover ${className}`}>
      {book.coverUrl && !failed ? (
        <Image src={book.coverUrl} alt={`Cover of ${book.title}`} fill sizes="(max-width: 760px) 30vw, 16vw" unoptimized preload={priority} onError={() => setFailed(true)} />
      ) : (
        <div className="cover-fallback" aria-label={`No cover available for ${book.title}`}>
          <BookOpen size={27} strokeWidth={1.4} />
          <span>{book.title}</span>
        </div>
      )}
    </div>
  );
}

function Availability({ book }: { book: Book }) {
  return (
    <span className={`availability availability-${book.availability}`}>
      <span className="availability-dot" />{availabilityLabel(book)}
    </span>
  );
}

function BookCard({ book, onSelect, compact = false, progress }: { book: Book; onSelect: (book: Book) => void; compact?: boolean; progress?: number }) {
  return (
    <button className={`book-card${compact ? " book-card-compact" : ""}`} onClick={() => onSelect(book)}>
      <BookCover book={book} />
      {typeof progress === "number" && <span className="card-progress" aria-label={`${Math.round(progress * 100)}% read`}><span style={{ width: `${Math.max(0, Math.min(1, progress)) * 100}%` }} /></span>}
      <span className="book-card-title">{book.title}</span>
      <span className="book-card-author">{authorLine(book)}</span>
      <Availability book={book} />
    </button>
  );
}

function Shelf({ title, subtitle, books, onSelect, onExplore, progressByBook }: {
  title: string;
  subtitle?: string;
  books: Book[];
  onSelect: (book: Book) => void;
  onExplore?: () => void;
  progressByBook?: Record<string, number>;
}) {
  const trackRef = useRef<HTMLDivElement>(null);
  if (!books.length) return null;
  return (
    <section className="shelf-section">
      <div className="shelf-heading">
        <div>
          <h2>{title}</h2>
          {subtitle && <p>{subtitle}</p>}
        </div>
        <div className="shelf-actions">
          {onExplore && <button className="text-action" onClick={onExplore}>See all <ArrowRight size={15} /></button>}
          <button className="icon-button shelf-arrow" aria-label={`Scroll ${title} left`} onClick={() => trackRef.current?.scrollBy({ left: -430, behavior: "smooth" })}><ChevronLeft size={18} /></button>
          <button className="icon-button shelf-arrow" aria-label={`Scroll ${title} right`} onClick={() => trackRef.current?.scrollBy({ left: 430, behavior: "smooth" })}><ChevronRight size={18} /></button>
        </div>
      </div>
      <div className="shelf-track" ref={trackRef}>
        {books.map((book) => <BookCard key={book.id} book={book} onSelect={onSelect} progress={progressByBook?.[book.id]} />)}
      </div>
    </section>
  );
}

function BookDetails({ book, onClose, onRead, onSave, isSaved }: {
  book: Book;
  onClose: () => void;
  onRead: (book: Book) => void;
  onSave: (book: Book) => void;
  isSaved: boolean;
}) {
  const categories = book.categories.slice(0, 5);
  return (
    <div className="modal-backdrop" role="presentation">
      <section className="book-detail" role="dialog" aria-modal="true" aria-labelledby="detail-title">
        <button className="icon-button modal-close" aria-label="Close book details" onClick={onClose}><X size={19} /></button>
        <div className="detail-cover-wrap"><BookCover book={book} className="detail-cover" /></div>
        <div className="detail-copy">
          <span className="eyebrow">A book for your next quiet moment</span>
          <h2 id="detail-title">{book.title}</h2>
          <p className="detail-author">by {authorLine(book)}</p>
          <Availability book={book} />
          <p className="detail-description">{book.description || "A classic, preserved in the catalog of a trusted reading source. Open the source record for more details."}</p>
          {categories.length > 0 && <div className="tag-list">{categories.map((category) => <span key={category}>{category}</span>)}</div>}
          <dl className="book-facts">
            {book.publishedDate && <div><dt>Published</dt><dd>{book.publishedDate}</dd></div>}
            {book.pageCount && <div><dt>Pages</dt><dd>{book.pageCount}</dd></div>}
            {book.publisher && <div><dt>Publisher</dt><dd>{book.publisher}</dd></div>}
            {book.language && <div><dt>Language</dt><dd>{book.language.toUpperCase()}</dd></div>}
            {book.isbn && <div><dt>ISBN</dt><dd>{book.isbn}</dd></div>}
            <div><dt>Source</dt><dd>{book.source}</dd></div>
          </dl>
          <div className="detail-actions">
            {book.availability === "readable" ? (
              book.readerMode === "internet-archive" && book.readableUrl
                ? <a className="primary-button" href={book.readableUrl} target="_blank" rel="noreferrer"><BookOpen size={17} /> Read at Internet Archive</a>
                : <button className="primary-button" onClick={() => onRead(book)}><BookOpen size={17} /> Read now</button>
            ) : book.availability === "preview" && book.previewUrl ? (
              <a className="primary-button" href={book.previewUrl} target="_blank" rel="noreferrer"><BookOpen size={17} /> Start preview</a>
            ) : (
              <a className="primary-button" href={book.sourceUrl} target="_blank" rel="noreferrer"><ArrowRight size={17} /> View source</a>
            )}
            <button className={`secondary-button${isSaved ? " is-saved" : ""}`} onClick={() => onSave(book)}>
              {isSaved ? <Check size={17} /> : <Bookmark size={17} />}{isSaved ? "In your library" : "Add to library"}
            </button>
          </div>
          <a className="source-attribution" href={book.sourceUrl} target="_blank" rel="noreferrer">Open at {book.source} <ArrowRight size={13} /></a>
        </div>
      </section>
    </div>
  );
}

type ReadingBlock = {
  id: string;
  kind: "heading" | "paragraph" | "verse" | "contents-item";
  text: string;
  lines: string[];
  frontMatter: boolean;
};

function isChapterHeading(value: string) {
  return /^(?:chapter|book|part|section|letter|canto)\s+(?:[ivxlcdm]+|\d+|one|two|three|four|five|six|seven|eight|nine|ten)\b.*$/i.test(value);
}

function isSectionHeading(value: string) {
  return isChapterHeading(value)
    || /^(?:prologue|epilogue|preface|introduction|conclusion|contents|dramatis personae|appendix(?:\s+[a-z0-9ivx]+)?|dedication|foreword|afterword|notes|glossary)\.?$/i.test(value)
    || (value.length <= 72 && /^[A-Z0-9][A-Z0-9 '’.,:;!?()\-—]+$/.test(value) && /[A-Z]/.test(value));
}

function parseGutenbergText(source: string, title: string, authors: string[]): ReadingBlock[] {
  let body = source.replace(/\r\n?/g, "\n");
  const startMarker = /^\s*\*{3}\s*START OF (?:THE|THIS) PROJECT GUTENBERG EBOOK[^\n]*\*{3}\s*$/im;
  const endMarker = /^\s*\*{3}\s*END OF (?:THE|THIS) PROJECT GUTENBERG EBOOK[^\n]*\*{3}.*$/im;
  const start = startMarker.exec(body);
  if (start) body = body.slice(start.index + start[0].length);
  const end = endMarker.exec(body);
  if (end) body = body.slice(0, end.index);

  const titleKey = title.toLocaleLowerCase().replace(/[^a-z0-9]/g, "");
  const authorKeys = authors.flatMap((author) => {
    const [lastName, firstName] = author.split(",");
    return [author, firstName ? `${firstName} ${lastName}` : author]
      .map((name) => name.toLocaleLowerCase().replace(/[^a-z0-9]/g, ""));
  });
  const paragraphs = body.split(/\n\s*\n+/).map((paragraph) => {
    const lines = paragraph.split("\n").map((line) => line.trim()).filter(Boolean);
    return { lines, text: lines.join(" ").replace(/\s+/g, " ").trim() };
  }).filter((paragraph) => paragraph.text.length > 0);

  while (paragraphs.length > 0) {
    const first = paragraphs[0].text.toLocaleLowerCase().replace(/[^a-z0-9]/g, "");
    const authorKey = first.replace(/^by/, "");
    const repeatsTitle = first.length >= 6 && (titleKey.startsWith(first) || titleKey.includes(first));
    if (repeatsTitle || authorKeys.includes(authorKey)) paragraphs.shift();
    else break;
  }

  const chapterIndexes = paragraphs.flatMap((paragraph, index) => isChapterHeading(paragraph.text) ? [index] : []);
  const chapterOccurrences = new Map<string, number[]>();
  for (const index of chapterIndexes) {
    const key = paragraphs[index].text.toLocaleLowerCase().replace(/[^a-z0-9]/g, "");
    chapterOccurrences.set(key, [...(chapterOccurrences.get(key) ?? []), index]);
  }
  const firstChapterKey = chapterIndexes.length > 0
    ? paragraphs[chapterIndexes[0]].text.toLocaleLowerCase().replace(/[^a-z0-9]/g, "")
    : "";
  const repeatedChapterIndex = chapterOccurrences.get(firstChapterKey)?.[1];
  const contentsItems = new Set(
    repeatedChapterIndex !== undefined && chapterIndexes.filter((index) => index < repeatedChapterIndex).length >= 3
      ? chapterIndexes.filter((index) => index < repeatedChapterIndex)
      : [],
  );
  const firstChapter = paragraphs.findIndex((paragraph, index) => isChapterHeading(paragraph.text) && !contentsItems.has(index));
  return paragraphs.map(({ lines, text }, index) => {
    const kind = contentsItems.has(index)
      ? "contents-item"
      : isSectionHeading(text)
      ? "heading"
      : lines.length > 2 && lines.reduce((total, line) => total + line.length, 0) / lines.length < 55
        ? "verse"
        : "paragraph";
    return {
      id: `reader-section-${index}`,
      kind,
      text,
      lines,
      frontMatter: firstChapter >= 0 && index < firstChapter,
    };
  });
}

function Reader({ book, startPosition, preferences, onPreferencesChange, onClose, onProgress, onBookmark, onFinish, isBookmarked }: {
  book: Book;
  startPosition: number;
  preferences: ReaderPreferences;
  onPreferencesChange: (preferences: ReaderPreferences) => void;
  onClose: () => void;
  onProgress: (book: Book, position: number) => void;
  onBookmark: () => void;
  onFinish: () => void;
  isBookmarked: boolean;
}) {
  const [text, setText] = useState("");
  const [error, setError] = useState("");
  const [fontSize, setFontSize] = useState(preferences.fontSize);
  const [lineHeight, setLineHeight] = useState(preferences.lineHeight);
  const [theme, setTheme] = useState<"paper" | "light" | "dark">(preferences.theme);
  const [showContents, setShowContents] = useState(false);
  const [progress, setProgress] = useState(startPosition);
  const readerRef = useRef<HTMLDivElement>(null);
  const progressSaveTimer = useRef<number | null>(null);

  const changeFontSize = useCallback((nextSize: number) => {
    const bounded = Math.max(15, Math.min(30, nextSize));
    setFontSize(bounded);
    onPreferencesChange({ ...preferences, fontSize: bounded });
  }, [onPreferencesChange, preferences]);

  function changeLineHeight(nextHeight: number) {
    setLineHeight(nextHeight);
    onPreferencesChange({ ...preferences, lineHeight: nextHeight });
  }

  function changeTheme(nextTheme: "paper" | "light" | "dark") {
    setTheme(nextTheme);
    onPreferencesChange({ ...preferences, theme: nextTheme });
  }

  const closeReader = useCallback(() => {
    const element = readerRef.current;
    if (element) {
      const amount = element.scrollHeight - element.clientHeight;
      onProgress(book, amount > 0 ? Math.min(1, Math.max(0, element.scrollTop / amount)) : 0);
    }
    if (progressSaveTimer.current) window.clearTimeout(progressSaveTimer.current);
    onClose();
  }, [book, onClose, onProgress]);

  useEffect(() => {
    let current = true;
    if (!book.readableUrl) return;
    fetch(`/api/reader?url=${encodeURIComponent(book.readableUrl)}`)
      .then(async (response) => {
        if (!response.ok) {
          const payload = await response.json() as { error?: string };
          throw new Error(payload.error ?? "The text could not be opened.");
        }
        return response.text();
      })
      .then((content) => { if (current) setText(content); })
      .catch((reason: unknown) => { if (current) setError(reason instanceof Error ? reason.message : "The source is temporarily unavailable."); });
    return () => { current = false; };
  }, [book.readableUrl]);

  useEffect(() => {
    if (!text || !readerRef.current || startPosition <= 0) return;
    readerRef.current.scrollTop = (readerRef.current.scrollHeight - readerRef.current.clientHeight) * startPosition;
  }, [text, startPosition]);

  useEffect(() => () => {
    if (progressSaveTimer.current) window.clearTimeout(progressSaveTimer.current);
  }, []);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") closeReader();
      if (event.key === "+" || event.key === "=") changeFontSize(fontSize + 1);
      if (event.key === "-") changeFontSize(fontSize - 1);
      if (event.key === "ArrowDown") readerRef.current?.scrollBy({ top: 360, behavior: "smooth" });
      if (event.key === "ArrowUp") readerRef.current?.scrollBy({ top: -360, behavior: "smooth" });
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [changeFontSize, closeReader, fontSize]);

  const readingBlocks = useMemo(() => parseGutenbergText(text, book.title, book.authors), [book.authors, book.title, text]);
  const contents = useMemo(() => readingBlocks.filter((block) => block.kind === "heading" && !/^contents\.?$/i.test(block.text)), [readingBlocks]);

  function updateProgress() {
    const element = readerRef.current;
    if (!element) return;
    const amount = element.scrollHeight - element.clientHeight;
    const next = amount > 0 ? Math.min(1, Math.max(0, element.scrollTop / amount)) : 0;
    setProgress(next);
    if (progressSaveTimer.current) window.clearTimeout(progressSaveTimer.current);
    progressSaveTimer.current = window.setTimeout(() => onProgress(book, next), 350);
  }

  function jumpToSection(id: string) {
    const container = readerRef.current;
    const heading = document.getElementById(id);
    if (!container || !heading) return;
    const offset = heading.getBoundingClientRect().top - container.getBoundingClientRect().top;
    container.scrollBy({ top: offset - 24, behavior: "smooth" });
    setShowContents(false);
  }

  return (
    <div className={`reader reader-${theme} reader-width-${preferences.readingWidth}`}>
      <header className="reader-toolbar">
        <button className="reader-back" onClick={closeReader}><ArrowLeft size={18} /><span>Back to browsing</span></button>
        <div className="reader-book-label"><strong>{book.title}</strong><span>{authorLine(book)}</span></div>
        <div className="reader-tools">
          <button className="icon-button" aria-label="Table of contents" title="Table of contents" onClick={() => setShowContents((shown) => !shown)}><List size={18} /></button>
          <button className={`icon-button${isBookmarked ? " active-icon" : ""}`} aria-label={isBookmarked ? "Remove bookmark" : "Bookmark this place"} title="Bookmark this place" onClick={onBookmark}><Bookmark size={18} /></button>
          <button className="icon-button" aria-label="Decrease font size" title="Decrease font size" onClick={() => changeFontSize(fontSize - 1)}><Minus size={17} /></button>
          <span className="font-size-value">{fontSize}</span>
          <button className="icon-button" aria-label="Increase font size" title="Increase font size" onClick={() => changeFontSize(fontSize + 1)}><Plus size={17} /></button>
          <button className="icon-button reader-spacing" aria-label="Adjust line spacing" title="Adjust line spacing" onClick={() => changeLineHeight(lineHeight >= 2 ? 1.55 : Math.round((lineHeight + 0.15) * 100) / 100)}><SlidersHorizontal size={17} /></button>
          <div className="theme-switcher" aria-label="Reading theme">
            {(["light", "paper", "dark"] as const).map((option) => <button key={option} className={`theme-swatch swatch-${option}${theme === option ? " selected" : ""}`} aria-label={`${option} reading mode`} onClick={() => changeTheme(option)} />)}
          </div>
        </div>
      </header>
      <div className="reader-progress-track" role="progressbar" aria-label="Reading progress" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(progress * 100)}><span style={{ width: `${progress * 100}%` }} /></div>
      <div className="reader-layout">
        {showContents && <aside className="reader-toc"><div className="toc-heading"><strong>In this book</strong><button className="icon-button" aria-label="Close table of contents" onClick={() => setShowContents(false)}><X size={16} /></button></div>{contents.length ? contents.map((item) => <button key={item.id} onClick={() => jumpToSection(item.id)}>{item.text}</button>) : <p>No section headings were found in this edition.</p>}</aside>}
        <div className="reader-scroll" ref={readerRef} onScroll={updateProgress}>
          {error ? (
            <div className="reader-message"><CircleHelp size={28} /><h2>That text is unavailable right now</h2><p>{error}</p><a href={book.sourceUrl} target="_blank" rel="noreferrer">Continue at Project Gutenberg <ArrowRight size={14} /></a></div>
          ) : !text ? (
            <div className="reader-message"><div className="loading-mark" /><p>Opening this book from Project Gutenberg…</p></div>
          ) : (
            <article className="reader-page" style={{ fontSize: `${fontSize}px`, lineHeight }}>
              <div className="reader-source"><span>PROJECT GUTENBERG EDITION</span><a href={book.sourceUrl} target="_blank" rel="noreferrer">Source and license <ArrowRight size={13} /></a></div>
              <header className="reader-title-page"><span className="reader-title-ornament" aria-hidden="true" /><h1>{book.title}</h1><p className="reader-byline">{authorLine(book)}</p><span className="reader-title-rule" /></header>
              <div className="reader-prose">
                {readingBlocks.map((block) => block.kind === "heading" ? (
                  <h2 key={block.id} id={block.id} className={`reader-section-heading${block.frontMatter ? " reader-front-heading" : ""}`}>{block.text}</h2>
                ) : block.kind === "contents-item" ? (
                  <p key={block.id} className="reader-contents-item">{block.text}</p>
                ) : block.kind === "verse" ? (
                  <p key={block.id} className={`reader-verse${block.frontMatter ? " reader-frontmatter" : ""}`}>{block.lines.map((line, index) => <span key={`${block.id}-${index}`}>{line}<br /></span>)}</p>
                ) : (
                  <p key={block.id} className={`reader-paragraph${block.frontMatter ? " reader-frontmatter" : ""}`}>{block.text}</p>
                ))}
              </div>
              <footer className="reader-endnote">Text provided by Project Gutenberg. Please review the source page for the applicable terms and license.</footer>
            </article>
          )}
        </div>
      </div>
      <footer className="reader-footer">
        <span>{Math.round(progress * 100)}% through</span>
        <div className="page-controls"><button className="icon-button" aria-label="Previous page" onClick={() => readerRef.current?.scrollBy({ top: -readerRef.current.clientHeight * 0.85, behavior: "smooth" })}><ChevronLeft size={19} /></button><span>Reading progress</span><button className="icon-button" aria-label="Next page" onClick={() => readerRef.current?.scrollBy({ top: readerRef.current.clientHeight * 0.85, behavior: "smooth" })}><ChevronRight size={19} /></button></div>
        <div className="reader-footer-actions"><button className="reader-finish" onClick={closeReader}>Save and close <Check size={15} /></button><button className="reader-mark-finished" onClick={onFinish}>Mark finished</button></div>
      </footer>
    </div>
  );
}

export default function BookifyApp() {
  const [view, setView] = useState<View>("home");
  const [libraryTab, setLibraryTab] = useState<LibraryTab>("reading");
  const [library, setLibrary] = useState<LibraryData>(EMPTY_LIBRARY);
  const [preferences, setPreferences] = useState<AppPreferences>(DEFAULT_PREFERENCES);
  const [hydrated, setHydrated] = useState(false);
  const [shelves, setShelves] = useState<Record<string, Book[]>>({});
  const [activeTopic, setActiveTopic] = useState("classics");
  const [discoveryBooks, setDiscoveryBooks] = useState<Book[]>([]);
  const [discoveryLoading, setDiscoveryLoading] = useState(false);
  const discoveryRequestId = useRef(0);
  const [query, setQuery] = useState("");
  const [searchResults, setSearchResults] = useState<Book[]>([]);
  const [completedSearch, setCompletedSearch] = useState("");
  const [searchRetry, setSearchRetry] = useState(0);
  const [searchFailed, setSearchFailed] = useState(false);
  const [genreFilter, setGenreFilter] = useState("");
  const [languageFilter, setLanguageFilter] = useState("");
  const [periodFilter, setPeriodFilter] = useState("");
  const [sourceFilter, setSourceFilter] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [readableOnly, setReadableOnly] = useState(false);
  const [selectedBook, setSelectedBook] = useState<Book | null>(null);
  const [readerBook, setReaderBook] = useState<Book | null>(null);
  const [loadMessage, setLoadMessage] = useState("");
  const [shelfRequest, setShelfRequest] = useState(0);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      try {
        const stored = localStorage.getItem("fable-library-v1");
        if (stored) setLibrary({ ...EMPTY_LIBRARY, ...JSON.parse(stored) as Partial<LibraryData> });
        const savedPreferences = localStorage.getItem("fable-preferences-v1");
        if (savedPreferences) {
          const parsed = JSON.parse(savedPreferences) as Partial<AppPreferences>;
          setPreferences({ ...DEFAULT_PREFERENCES, ...parsed, reader: { ...DEFAULT_PREFERENCES.reader, ...parsed.reader } });
          setReadableOnly(Boolean(parsed.readableOnlyByDefault));
          if (parsed.language) setLanguageFilter(parsed.language);
        }
      } catch {
        localStorage.removeItem("fable-library-v1");
        localStorage.removeItem("fable-preferences-v1");
      }
      setHydrated(true);
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (hydrated) localStorage.setItem("fable-library-v1", JSON.stringify(library));
  }, [hydrated, library]);

  useEffect(() => {
    if (hydrated) localStorage.setItem("fable-preferences-v1", JSON.stringify(preferences));
  }, [hydrated, preferences]);

  useEffect(() => {
    let active = true;
    Promise.all(HOME_SHELVES.map(async (shelf) => [shelf.topic, await getBooks(new URLSearchParams({ topic: shelf.topic, limit: "18" }), (message) => { if (active) setLoadMessage(message); })] as const))
      .then((results) => {
        if (active) setShelves(Object.fromEntries(results));
      })
      .catch(() => { if (active) setLoadMessage("Some shelves could not connect to their reading sources."); });
    return () => { active = false; };
  }, [shelfRequest]);

  useEffect(() => {
    if (view !== "search") return;
    const term = query.trim();
    if (!term) return;
    let active = true;
    const timer = window.setTimeout(() => {
      getBooks(new URLSearchParams({ q: term, limit: "30" }), (message) => {
        if (active) {
          setSearchFailed(true);
          setLoadMessage(message);
        }
      }).then((books) => {
        if (active) {
          setSearchResults(books);
          setCompletedSearch(term);
        }
      });
    }, 240);
    return () => { active = false; window.clearTimeout(timer); };
  }, [query, searchRetry, view]);

  useEffect(() => {
    function onGlobalKeyDown(event: KeyboardEvent) {
      const target = event.target;
      const isEditing = target instanceof HTMLElement && (target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName));
      if (readerBook || isEditing) return;
      if (event.key === "/") {
        event.preventDefault();
        setView("search");
      }
      if (event.key === "Escape" && view === "search") {
        if (query) changeSearchTerm("");
        else setView("home");
      }
    }
    window.addEventListener("keydown", onGlobalKeyDown);
    return () => window.removeEventListener("keydown", onGlobalKeyDown);
  }, [query, readerBook, view]);

  function openDiscovery(topic: string) {
    const requestId = ++discoveryRequestId.current;
    setActiveTopic(topic);
    setView("discover");
    setLoadMessage("");
    setDiscoveryBooks([]);
    setDiscoveryLoading(true);
    getBooks(new URLSearchParams({ topic, limit: "30" }), setLoadMessage).then((books) => {
      if (discoveryRequestId.current === requestId) {
        setDiscoveryBooks(books);
        setDiscoveryLoading(false);
      }
    });
  }

  function navigateToView(nextView: View) {
    if (nextView === "discover") openDiscovery(activeTopic);
    else setView(nextView);
  }

  function changeSearchTerm(nextQuery: string) {
    setQuery(nextQuery);
    setSearchFailed(false);
    setLoadMessage("");
  }

  function retrySearch() {
    setSearchFailed(false);
    setLoadMessage("");
    setCompletedSearch("");
    setSearchRetry((current) => current + 1);
  }

  function retryHomeShelves() {
    setLoadMessage("");
    setShelves({});
    setShelfRequest((current) => current + 1);
  }

  function exportLibrary() {
    const file = new Blob([JSON.stringify({ library, preferences }, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(file);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "fable-reading-data.json";
    anchor.click();
    URL.revokeObjectURL(url);
  }

  function clearReadingData() {
    if (!window.confirm("Clear saved books, bookmarks, reading history and preferences from this browser?")) return;
    setLibrary(EMPTY_LIBRARY);
    setPreferences(DEFAULT_PREFERENCES);
    localStorage.removeItem("fable-library-v1");
    localStorage.removeItem("fable-preferences-v1");
  }

  function saveToWant(book: Book) {
    setLibrary((current) => {
      const exists = current.shelves.want.some((item) => item.id === book.id);
      return {
        ...current,
        shelves: { ...current.shelves, want: exists ? current.shelves.want.filter((item) => item.id !== book.id) : [book, ...current.shelves.want] },
      };
    });
  }

  function startReading(book: Book) {
    if (book.availability !== "readable" || !book.readableUrl || book.readerMode !== "gutenberg-text") return;
    setLibrary((current) => ({
      ...current,
      shelves: { ...current.shelves, reading: [book, ...current.shelves.reading.filter((item) => item.id !== book.id)] },
      history: [book, ...current.history.filter((item) => item.id !== book.id)].slice(0, 30),
    }));
    setSelectedBook(null);
    setReaderBook(book);
  }

  const saveProgress = useCallback((book: Book, position: number) => {
    setLibrary((current) => ({ ...current, positions: { ...current.positions, [book.id]: position } }));
  }, []);

  const updateReaderPreferences = useCallback((reader: ReaderPreferences) => {
    setPreferences((current) => ({ ...current, reader }));
  }, []);

  const closeReaderView = useCallback(() => setReaderBook(null), []);

  function finishReading(book: Book) {
    setLibrary((current) => ({
      ...current,
      shelves: {
        ...current.shelves,
        reading: current.shelves.reading.filter((item) => item.id !== book.id),
        finished: [book, ...current.shelves.finished.filter((item) => item.id !== book.id)],
      },
      positions: { ...current.positions, [book.id]: 1 },
    }));
    setReaderBook(null);
  }

  function addBookmark(book: Book) {
    const position = library.positions[book.id] ?? 0;
    setLibrary((current) => {
      const exists = current.bookmarks.some((item) => item.book.id === book.id && Math.abs(item.position - position) < 0.02);
      return {
        ...current,
        bookmarks: exists
          ? current.bookmarks.filter((item) => !(item.book.id === book.id && Math.abs(item.position - position) < 0.02))
          : [{ book, position, createdAt: Date.now() }, ...current.bookmarks],
      };
    });
  }

  const allHomeBooks = useMemo(() => uniqueBooks(Object.values(shelves).flat()), [shelves]);
  const featureBook = allHomeBooks.find((book) => book.availability === "readable") ?? allHomeBooks[0];
  const recommendationSeed = library.history[0] ?? library.shelves.want[0] ?? featureBook;
  const recommendedBooks = recommendationSeed
    ? allHomeBooks.filter((book) => book.id !== recommendationSeed.id && book.categories.some((category) => recommendationSeed.categories.includes(category))).slice(0, 12)
    : [];
  const savedIds = new Set(library.shelves.want.map((book) => book.id));
  const searchLoading = Boolean(query.trim() && completedSearch !== query.trim());
  const displaySearchResults = searchResults.filter((book) => {
    if (readableOnly && book.availability !== "readable") return false;
    if (genreFilter && !book.categories.some((category) => category.toLowerCase().includes(genreFilter.toLowerCase()))) return false;
    if (languageFilter && book.language.toLowerCase() !== languageFilter.toLowerCase()) return false;
    if (sourceFilter && book.source !== sourceFilter) return false;
    if (typeFilter) {
      const subjects = book.categories.join(" ").toLowerCase();
      if (typeFilter === "fiction" && (!subjects.includes("fiction") || subjects.includes("non-fiction") || subjects.includes("nonfiction"))) return false;
      if (typeFilter === "nonfiction" && !subjects.includes("non-fiction") && !subjects.includes("nonfiction") && !subjects.includes("non fiction")) return false;
    }
    if (periodFilter) {
      const year = Number(book.publishedDate.slice(0, 4));
      if (!year) return false;
      if (periodFilter === "before-1900" && year >= 1900) return false;
      if (periodFilter === "1900-1950" && (year < 1900 || year > 1950)) return false;
      if (periodFilter === "after-1950" && year <= 1950) return false;
    }
    return true;
  });

  function pageTitle() {
    if (view === "discover") return "Find a different kind of story";
    if (view === "search") return "Search the shelves";
    if (view === "library") return "Your reading life";
    if (view === "reading") return "Currently reading";
    if (view === "bookmarks") return "Saved passages";
    if (view === "settings") return "Make this space yours.";
    return "A good story, just around the corner.";
  }

  function renderLibrary() {
    const tabBooks: Book[] = libraryTab === "bookmarks"
      ? uniqueBooks(library.bookmarks.map((entry) => entry.book))
      : libraryTab === "history"
        ? library.history
        : library.shelves[libraryTab];
    return (
      <>
        <div className="library-tabs" role="tablist" aria-label="Your library">
          {(["reading", "want", "finished", "bookmarks", "history"] as LibraryTab[]).map((tab) => <button key={tab} role="tab" aria-selected={libraryTab === tab} className={libraryTab === tab ? "selected" : ""} onClick={() => setLibraryTab(tab)}>{tab === "reading" ? "Currently reading" : tab === "want" ? "Want to read" : tab === "finished" ? "Finished" : tab === "bookmarks" ? "Bookmarks" : "History"}<span>{tab === "bookmarks" ? library.bookmarks.length : tab === "history" ? library.history.length : library.shelves[tab].length}</span></button>)}
        </div>
        {tabBooks.length ? (
          <div className="book-grid">{tabBooks.map((book) => <BookCard key={book.id} book={book} onSelect={setSelectedBook} progress={libraryTab === "reading" ? library.positions[book.id] ?? 0 : undefined} />)}</div>
        ) : <div className="empty-state"><BookOpen size={31} strokeWidth={1.35} /><h2>This shelf is waiting for a story.</h2><p>Save a book while browsing and it will find its way here.</p><button className="secondary-button" onClick={() => setView("discover")}>Explore books <ArrowRight size={15} /></button></div>}
      </>
    );
  }

  function renderSettings() {
    return (
      <div className="settings-layout">
        <section className="settings-section">
          <div className="settings-section-heading"><span className="settings-index">01</span><div><h2>Reading</h2><p>Your comfortable defaults follow you from book to book.</p></div></div>
          <div className="setting-row"><div><strong>Text size</strong><span>{preferences.reader.fontSize}px</span></div><div className="setting-control setting-stepper"><button className="icon-button" aria-label="Decrease default text size" onClick={() => updateReaderPreferences({ ...preferences.reader, fontSize: Math.max(15, preferences.reader.fontSize - 1) })}><Minus size={16} /></button><input aria-label="Default reader text size" type="range" min="15" max="30" value={preferences.reader.fontSize} onChange={(event) => updateReaderPreferences({ ...preferences.reader, fontSize: Number(event.target.value) })} /><button className="icon-button" aria-label="Increase default text size" onClick={() => updateReaderPreferences({ ...preferences.reader, fontSize: Math.min(30, preferences.reader.fontSize + 1) })}><Plus size={16} /></button></div></div>
          <div className="setting-row"><div><strong>Line spacing</strong><span>{preferences.reader.lineHeight.toFixed(2)}×</span></div><div className="setting-control segmented-control" role="group" aria-label="Default line spacing">{[{ label: "Compact", value: 1.55 }, { label: "Relaxed", value: 1.8 }, { label: "Airy", value: 2 }].map((option) => <button key={option.value} className={preferences.reader.lineHeight === option.value ? "selected" : ""} onClick={() => updateReaderPreferences({ ...preferences.reader, lineHeight: option.value })}>{option.label}</button>)}</div></div>
          <div className="setting-row"><div><strong>Reading theme</strong><span>{preferences.reader.theme === "dark" ? "Low glare for reading in dim rooms." : preferences.reader.theme === "light" ? "Bright, high contrast for daytime." : "A warm paper tone for longer reads."}</span></div><div className="setting-control theme-options" role="group" aria-label="Default reading theme">{(["light", "paper", "dark"] as const).map((theme) => <button key={theme} className={`theme-choice theme-${theme}${preferences.reader.theme === theme ? " selected" : ""}`} onClick={() => updateReaderPreferences({ ...preferences.reader, theme })}><span className={`theme-swatch swatch-${theme}`} />{theme[0].toUpperCase() + theme.slice(1)}</button>)}</div></div>
          <div className="setting-row"><div><strong>Reading width</strong><span>Choose a column that feels right.</span></div><div className="setting-control segmented-control" role="group" aria-label="Default reading width"><button className={preferences.reader.readingWidth === "comfortable" ? "selected" : ""} onClick={() => updateReaderPreferences({ ...preferences.reader, readingWidth: "comfortable" })}>Comfortable</button><button className={preferences.reader.readingWidth === "wide" ? "selected" : ""} onClick={() => updateReaderPreferences({ ...preferences.reader, readingWidth: "wide" })}>Wide</button></div></div>
        </section>
        <section className="settings-section">
          <div className="settings-section-heading"><span className="settings-index">02</span><div><h2>Discovery</h2><p>Shape the books that surface first.</p></div></div>
          <label className="setting-row setting-toggle-row"><span><strong>Readable now first</strong><span>Start search with books that open from a legal full-text source.</span></span><input type="checkbox" checked={preferences.readableOnlyByDefault} onChange={(event) => { const checked = event.target.checked; setPreferences((current) => ({ ...current, readableOnlyByDefault: checked })); setReadableOnly(checked); }} /><span className="toggle-track" /></label>
          <div className="setting-row"><div><strong>Preferred language</strong><span>Used as the default search filter.</span></div><select value={preferences.language} onChange={(event) => { const language = event.target.value; setPreferences((current) => ({ ...current, language })); setLanguageFilter(language); }} aria-label="Preferred language"><option value="">Any language</option><option value="en">English</option><option value="fr">French</option><option value="de">German</option><option value="es">Spanish</option><option value="it">Italian</option><option value="bn">Bengali</option><option value="as">Assamese</option></select></div>
          <label className="setting-row setting-toggle-row"><span><strong>Reduce motion</strong><span>Use quieter transitions throughout the app.</span></span><input type="checkbox" checked={preferences.reduceMotion} onChange={(event) => setPreferences((current) => ({ ...current, reduceMotion: event.target.checked }))} /><span className="toggle-track" /></label>
        </section>
        <section className="settings-section data-section">
          <div className="settings-section-heading"><span className="settings-index">03</span><div><h2>Your data</h2><p>Everything stays in this browser unless you export it.</p></div></div>
          <div className="data-actions"><button className="secondary-button" onClick={exportLibrary}><Download size={15} /> Export reading data</button><button className="danger-button" onClick={clearReadingData}>Clear local data</button></div>
          <p className="data-footnote">Saved books, positions, history, bookmarks and preferences use local storage. Fable does not create an account or sync data between devices.</p>
        </section>
      </div>
    );
  }

  return (
    <IconContext.Provider value={{ weight: "duotone" }}>
    <div className={`app-shell${preferences.reduceMotion ? " reduce-motion" : ""}`}>
      <aside className="sidebar">
        <a className="brand" href="#home" onClick={(event) => { event.preventDefault(); setView("home"); }}><span className="brand-mark"><BookOpen size={19} /></span><span>fable<span className="brand-period">.</span></span></a>
        <div className="side-label">YOUR SPACE</div>
        <nav className="primary-nav" aria-label="Main navigation">
          {NAV_ITEMS.map(({ id, label, icon: Icon }) => <button key={id} className={view === id ? "active" : ""} onClick={() => navigateToView(id)}><Icon size={19} strokeWidth={1.8} /><span>{label}</span></button>)}
        </nav>
        <div className="sidebar-divider" />
        <div className="side-label shelf-label">YOUR SHELVES</div>
        <nav className="shelf-nav" aria-label="Personal shelves">
          <button className={view === "reading" ? "active" : ""} onClick={() => setView("reading")}><BookOpen size={17} /><span>Currently reading</span><span className="side-count">{library.shelves.reading.length}</span></button>
          <button className={view === "bookmarks" ? "active" : ""} onClick={() => setView("bookmarks")}><Bookmark size={17} /><span>Bookmarks</span></button>
        </nav>
        <button className={`sidebar-settings${view === "settings" ? " active" : ""}`} onClick={() => setView("settings")}><Settings size={17} /><span>Settings</span></button>
        <div className="sidebar-bottom"><div className="sidebar-note"><span className="note-glyph">“</span><p>Reading is a way of travelling without moving.</p></div><span className="legal-note">Public-domain reading, clearly sourced.</span></div>
      </aside>

      <main className="main-area" id="home">
        <header className="topbar">
          <div className="history-controls"><button className="icon-button" aria-label="Back" onClick={() => setView("home")}><ChevronLeft size={19} /></button><button className="icon-button" aria-label="Forward" onClick={() => setView("discover")}><ChevronRight size={19} /></button></div>
          {view === "search" ? (
            <label className="global-search"><Search size={19} /><input autoFocus placeholder="Books, writers, subjects…" value={query} onChange={(event) => changeSearchTerm(event.target.value)} /><kbd>ESC</kbd><button className="clear-search" aria-label="Clear search" onClick={() => changeSearchTerm("")}><X size={16} /></button></label>
          ) : <button className="search-launch" onClick={() => setView("search")}><Search size={17} /><span>What would you like to read?</span><kbd>/</kbd></button>}
          <button className={`icon-button settings-launch${view === "settings" ? " active-icon" : ""}`} aria-label="Settings" title="Settings" onClick={() => setView("settings")}><Settings size={18} /></button>
          <button className="profile-button" aria-label="Open your library" onClick={() => setView("library")}><Library size={16} /></button>
        </header>

        <div className="content-scroll">
          <div className="page-intro"><div><div className="eyebrow">{view === "home" ? "YOUR DAILY READING ROOM" : view === "discover" ? "FOLLOW A THREAD" : view === "search" ? "LOOKING FOR SOMETHING?" : view === "settings" ? "PREFERENCES" : "A SHELF THAT'S YOURS"}</div><h1>{pageTitle()}</h1></div>{view !== "search" && view !== "settings" && <button className="quiet-button" onClick={() => setView("search")}><Search size={16} /> Search all books</button>}</div>

          {view === "home" && (
            <>
              {!allHomeBooks.length && !loadMessage && <div className="source-pending"><div className="loading-mark" /><span>Opening the public-domain shelves…</span></div>}
              {!allHomeBooks.length && loadMessage && <section className="source-notice"><div><span className="eyebrow">THE OPEN SHELVES</span><h2>Reading sources are taking a pause.</h2><p>{loadMessage}</p></div><button className="secondary-button" onClick={retryHomeShelves}>Try again <ArrowRight size={15} /></button></section>}
              {featureBook && <section className="feature-banner">
                <div className="feature-art"><BookCover book={featureBook} className="feature-cover" priority /><span className="art-stamp">OPEN<br />BOOK</span></div>
                <div className="feature-copy"><span className="feature-kicker"><Sparkles size={14} /> TODAY&apos;S FIND</span><h2>{featureBook.title}</h2><p className="feature-author">{authorLine(featureBook)}</p><p className="feature-description">{featureBook.description || "A reader-favorite from the public-domain shelves, ready when you are."}</p><div className="feature-actions"><button className="feature-button" onClick={() => featureBook.availability === "readable" ? startReading(featureBook) : setSelectedBook(featureBook)}>{featureBook.availability === "readable" ? <BookOpen size={17} /> : <ArrowRight size={17} />}{featureBook.availability === "readable" ? "Read now" : "Explore this book"}</button><button className="feature-save" aria-label="Save featured book" onClick={() => saveToWant(featureBook)}><Bookmark size={18} /></button><Availability book={featureBook} /></div><a className="feature-source" href={featureBook.sourceUrl} target="_blank" rel="noreferrer">From {featureBook.source}</a></div>
                <div className="feature-side-note"><span>01 / A NEW CHAPTER</span><ArrowDown size={18} /></div>
              </section>}

              {library.shelves.reading.length > 0 && <Shelf title="Pick up where you left off" subtitle="Your story is right where you left it" books={library.shelves.reading} onSelect={setSelectedBook} progressByBook={library.positions} />}
              {library.history.length > 0 && <Shelf title="Recently opened" books={library.history.slice(0, 12)} onSelect={setSelectedBook} />}
              {recommendedBooks.length > 0 && <Shelf title="Recommended for you" subtitle={`Based on themes in ${recommendationSeed?.title}`} books={recommendedBooks} onSelect={setSelectedBook} onExplore={() => openDiscovery(recommendationSeed?.categories[0] ?? "literature")} />}
              {HOME_SHELVES.map((shelf) => <Shelf key={shelf.topic} title={shelf.title} subtitle={shelf.subtitle} books={shelves[shelf.topic] ?? []} onSelect={setSelectedBook} onExplore={() => openDiscovery(shelf.topic)} />)}
              {allHomeBooks.length > 4 && <Shelf title="A few hidden gems" subtitle="Less-read titles from the same trusted shelves" books={[...allHomeBooks].filter((book) => book.downloads > 0).sort((a, b) => a.downloads - b.downloads).slice(0, 12)} onSelect={setSelectedBook} onExplore={() => openDiscovery("literature")} />}

              <section className="genre-section"><div className="shelf-heading"><div><h2>What are you in the mood for?</h2><p>Browse by subject, place or feeling</p></div><Compass size={19} /></div><div className="genre-grid">{GENRES.map((genre, index) => <button key={genre.topic} className={`genre-tile genre-tile-${index % 6}`} onClick={() => openDiscovery(genre.topic)}><span>{genre.label}</span><ArrowRight size={16} /></button>)}</div></section>
            </>
          )}

          {view === "discover" && (
            <>
              <div className="genre-chips">{GENRES.map((genre) => <button key={genre.topic} className={activeTopic === genre.topic ? "selected" : ""} onClick={() => openDiscovery(genre.topic)}>{genre.label}</button>)}</div>
              <div className="discover-heading"><div><span className="eyebrow">A SHELF TO WANDER</span><h2>{GENRES.find((genre) => genre.topic === activeTopic)?.label ?? "The open shelves"}</h2><p>Books drawn from the catalogues of public-domain reading sources.</p></div><SlidersHorizontal size={19} /></div>
              {discoveryLoading ? <div className="empty-search"><div className="loading-mark" /><p>Looking through the open shelves…</p></div> : discoveryBooks.length ? <div className="book-grid">{discoveryBooks.map((book) => <BookCard key={book.id} book={book} onSelect={setSelectedBook} />)}</div> : loadMessage ? <div className="empty-state"><CircleHelp size={31} /><h2>That shelf could not be reached.</h2><p>{loadMessage}</p><button className="secondary-button" onClick={() => openDiscovery(activeTopic)}>Try again <ArrowRight size={15} /></button></div> : <div className="empty-state"><Compass size={31} /><h2>No books surfaced for this subject.</h2><p>Try another shelf to keep wandering.</p></div>}
            </>
          )}

          {view === "search" && (
            <>
              {query.trim() && <div className="filter-bar">
                <span className="filter-caption"><SlidersHorizontal size={15} /> FILTER</span>
                <select value={genreFilter} onChange={(event) => setGenreFilter(event.target.value)} aria-label="Filter by genre"><option value="">All subjects</option>{GENRES.map((genre) => <option value={genre.topic} key={genre.topic}>{genre.label}</option>)}</select>
                <select value={languageFilter} onChange={(event) => setLanguageFilter(event.target.value)} aria-label="Filter by language"><option value="">Any language</option><option value="en">English</option><option value="fr">French</option><option value="de">German</option><option value="es">Spanish</option><option value="it">Italian</option><option value="bn">Bengali</option><option value="as">Assamese</option></select>
                <select value={periodFilter} onChange={(event) => setPeriodFilter(event.target.value)} aria-label="Filter by publication period"><option value="">Any period</option><option value="before-1900">Before 1900</option><option value="1900-1950">1900–1950</option><option value="after-1950">After 1950</option></select>
                <select value={sourceFilter} onChange={(event) => setSourceFilter(event.target.value)} aria-label="Filter by source"><option value="">Any source</option><option value="Project Gutenberg">Project Gutenberg</option><option value="Google Books">Google Books</option><option value="Open Library">Open Library</option></select>
                <select value={typeFilter} onChange={(event) => setTypeFilter(event.target.value)} aria-label="Filter by book type"><option value="">Fiction or non-fiction</option><option value="fiction">Fiction</option><option value="nonfiction">Non-fiction</option></select>
                <label className="readable-toggle"><input type="checkbox" checked={readableOnly} onChange={(event) => setReadableOnly(event.target.checked)} /><span className="toggle-track" />Readable now</label>
              </div>}
              {query.trim() && searchFailed && <section className="source-notice search-source-notice"><div><span className="eyebrow">SEARCH SOURCES</span><h2>We couldn&apos;t reach the book catalogues.</h2><p>{loadMessage}</p></div><button className="secondary-button" onClick={retrySearch}>Try again <ArrowRight size={15} /></button></section>}
              {!query.trim() ? <div className="search-empty"><Search size={24} /><h2>Follow a thought.</h2><p>Search titles, authors, subjects and ideas.</p><div className="suggested-searches">{["strange stories", "philosophy", "Sherlock Holmes", "Indian literature"].map((suggestion) => <button key={suggestion} onClick={() => setQuery(suggestion)}>{suggestion}<ArrowRight size={13} /></button>)}</div></div> : searchLoading ? <div className="empty-search"><div className="loading-mark" /><p>Looking across book sources…</p></div> : displaySearchResults.length ? <><div className="results-caption"><span>{displaySearchResults.length} results for <strong>“{query}”</strong></span><span>Readability shown for every title</span></div><div className="book-grid search-grid">{displaySearchResults.map((book) => <BookCard key={book.id} book={book} onSelect={setSelectedBook} />)}</div></> : <div className="empty-state"><Search size={31} strokeWidth={1.35} /><h2>No books found for that combination.</h2><p>Try another phrase or loosen one of the filters.</p></div>}
            </>
          )}

          {(view === "library" || view === "reading" || view === "bookmarks") && (
            <div className="library-view">
              {view === "reading" ? <><div className="library-title-row"><div><h2>Currently reading</h2><p>Pick up where your last page ended.</p></div></div>{library.shelves.reading.length ? <div className="book-grid">{library.shelves.reading.map((book) => <BookCard key={book.id} book={book} onSelect={setSelectedBook} />)}</div> : <div className="empty-state"><BookOpen size={31} /><h2>No open books yet.</h2><p>Start with a public-domain book and your place will be saved here.</p><button className="secondary-button" onClick={() => setView("discover")}>Find a book <ArrowRight size={15} /></button></div>}</> : view === "bookmarks" ? <><div className="library-title-row"><div><h2>Saved passages</h2><p>Return to the lines you marked while reading.</p></div></div>{library.bookmarks.length ? <div className="bookmark-list">{library.bookmarks.map((entry) => <article key={`${entry.book.id}-${entry.createdAt}`} className="bookmark-row"><button className="bookmark-copy" onClick={() => { setSelectedBook(entry.book); }}><span className="bookmark-quote">A place worth returning to</span><strong>{entry.book.title}</strong><span>{authorLine(entry.book)} · {Math.round(entry.position * 100)}% through</span></button><button className="icon-button" aria-label="Remove bookmark" onClick={() => setLibrary((current) => ({ ...current, bookmarks: current.bookmarks.filter((item) => item.createdAt !== entry.createdAt) }))}><X size={17} /></button></article>)}</div> : <div className="empty-state"><Bookmark size={31} /><h2>Keep a place for a good line.</h2><p>Bookmark a moment while reading to find it here again.</p><button className="secondary-button" onClick={() => setView("discover")}>Discover a book <ArrowRight size={15} /></button></div>}</> : renderLibrary()}
            </div>
          )}

          {view === "settings" && renderSettings()}

          {loadMessage && view === "home" && allHomeBooks.length > 0 && <p className="connection-note"><CircleHelp size={15} />{loadMessage}</p>}
          <footer className="app-footer"><span>FABLE</span><p>Metadata from Google Books and Open Library. Public-domain text from Project Gutenberg; public scans open at Internet Archive. Every source is named and every access status is explicit.</p><a href="https://www.gutenberg.org/" target="_blank" rel="noreferrer">About Project Gutenberg <ArrowRight size={13} /></a></footer>
        </div>
      </main>

      <nav className="mobile-nav" aria-label="Mobile navigation">{NAV_ITEMS.map(({ id, label, icon: Icon }) => <button key={id} className={view === id ? "active" : ""} onClick={() => navigateToView(id)}><Icon size={20} /><span>{label === "My library" ? "Library" : label}</span></button>)}</nav>

      {selectedBook && <BookDetails book={selectedBook} onClose={() => setSelectedBook(null)} onRead={startReading} onSave={saveToWant} isSaved={savedIds.has(selectedBook.id)} />}
      {readerBook && <Reader book={readerBook} startPosition={library.positions[readerBook.id] ?? 0} preferences={preferences.reader} onPreferencesChange={updateReaderPreferences} onClose={closeReaderView} onProgress={saveProgress} onBookmark={() => addBookmark(readerBook)} onFinish={() => finishReading(readerBook)} isBookmarked={library.bookmarks.some((item) => item.book.id === readerBook.id && Math.abs(item.position - (library.positions[readerBook.id] ?? 0)) < 0.02)} />}
    </div>
    </IconContext.Provider>
  );
}