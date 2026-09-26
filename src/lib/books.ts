export type Availability = "readable" | "preview" | "metadata";
export type ReaderMode = "gutenberg-text" | "internet-archive" | null;

export type Book = {
  id: string;
  title: string;
  authors: string[];
  coverUrl: string | null;
  description: string;
  publishedDate: string;
  categories: string[];
  isbn: string;
  pageCount: number | null;
  publisher: string;
  language: string;
  previewUrl: string | null;
  sourceUrl: string;
  readableUrl: string | null;
  readerMode: ReaderMode;
  availability: Availability;
  source: "Project Gutenberg" | "Google Books" | "Open Library";
  downloads: number;
};

type GutendexBook = {
  id: number;
  title: string;
  authors?: { name: string }[];
  subjects?: string[];
  bookshelves?: string[];
  languages?: string[];
  formats?: Record<string, string>;
  download_count?: number;
};

type GoogleVolume = {
  id: string;
  volumeInfo?: {
    title?: string;
    authors?: string[];
    imageLinks?: { thumbnail?: string; smallThumbnail?: string };
    description?: string;
    publishedDate?: string;
    categories?: string[];
    industryIdentifiers?: { identifier: string; type: string }[];
    pageCount?: number;
    publisher?: string;
    language?: string;
    previewLink?: string;
  };
  accessInfo?: { viewability?: string };
};

type OpenLibraryWork = {
  key: string;
  title?: string;
  author_name?: string[];
  cover_i?: number;
  first_publish_year?: number;
  subject?: string[];
  language?: string[];
  ebook_access?: string;
  ia?: string[];
  isbn?: string[];
  publisher?: string[];
  number_of_pages_median?: number;
};

type SearchResponse<T> = { results?: T[]; items?: T[] };

const GUTENBERG_HOSTS = new Set(["www.gutenberg.org", "gutenberg.org"]);

function isGutenbergTextUrl(value: string | undefined): value is string {
  if (!value) return false;
  try {
    const url = new URL(value);
    return url.protocol === "https:" && GUTENBERG_HOSTS.has(url.hostname) && isGutenbergTextPath(url.pathname);
  } catch {
    return false;
  }
}

function isGutenbergTextPath(path: string) {
  return /^\/(?:cache\/epub\/\d+\/pg\d+\.txt(?:\.utf-8)?|ebooks\/\d+\.txt(?:\.utf-8)?|files\/\d+\/[\w.-]+\.txt)$/i.test(path);
}

function readableFormat(formats: Record<string, string> = {}) {
  const plain = Object.entries(formats).find(([type, url]) => type.startsWith("text/plain") && isGutenbergTextUrl(url));
  return plain?.[1] ?? null;
}

function coverFromGutenberg(id: number) {
  return `https://www.gutenberg.org/cache/epub/${id}/pg${id}.cover.medium.jpg`;
}

function fromGutenberg(book: GutendexBook): Book {
  const readableUrl = readableFormat(book.formats);
  const sourceUrl = `https://www.gutenberg.org/ebooks/${book.id}`;
  return {
    id: `pg-${book.id}`,
    title: book.title,
    authors: book.authors?.map((author) => author.name) ?? [],
    coverUrl: coverFromGutenberg(book.id),
    description: [...(book.subjects ?? []), ...(book.bookshelves ?? [])].slice(0, 4).join(" · "),
    publishedDate: "",
    categories: [...new Set([...(book.subjects ?? []), ...(book.bookshelves ?? [])])].slice(0, 8),
    isbn: "",
    pageCount: null,
    publisher: "Project Gutenberg",
    language: book.languages?.[0] ?? "",
    previewUrl: null,
    sourceUrl,
    readableUrl,
    readerMode: readableUrl ? "gutenberg-text" : null,
    availability: readableUrl ? "readable" : "metadata",
    source: "Project Gutenberg",
    downloads: book.download_count ?? 0,
  };
}

function fromGoogle(volume: GoogleVolume): Book | null {
  const info = volume.volumeInfo;
  if (!info?.title) return null;
  const previewUrl = info.previewLink ?? null;
  const hasPreview = Boolean(previewUrl && volume.accessInfo?.viewability !== "NO_PAGES");
  const thumbnail = info.imageLinks?.thumbnail ?? info.imageLinks?.smallThumbnail;
  const isbn = info.industryIdentifiers?.find((item) => item.type === "ISBN_13")?.identifier
    ?? info.industryIdentifiers?.[0]?.identifier
    ?? "";
  return {
    id: `gb-${volume.id}`,
    title: info.title,
    authors: info.authors ?? [],
    coverUrl: thumbnail?.replace(/^http:/, "https:") ?? null,
    description: info.description ?? "",
    publishedDate: info.publishedDate ?? "",
    categories: info.categories ?? [],
    isbn,
    pageCount: info.pageCount ?? null,
    publisher: info.publisher ?? "",
    language: info.language ?? "",
    previewUrl,
    sourceUrl: `https://books.google.com/books?id=${encodeURIComponent(volume.id)}`,
    readableUrl: null,
    readerMode: null,
    availability: hasPreview ? "preview" : "metadata",
    source: "Google Books",
    downloads: 0,
  };
}

function fromOpenLibrary(work: OpenLibraryWork): Book | null {
  if (!work.title || !work.key) return null;
  const publicArchiveId = work.ebook_access === "public" ? work.ia?.[0] : undefined;
  const readerUrl = publicArchiveId ? `https://archive.org/details/${encodeURIComponent(publicArchiveId)}` : null;
  return {
    id: `ol-${work.key.replace(/^\//, "").replaceAll("/", "-")}`,
    title: work.title,
    authors: work.author_name ?? [],
    coverUrl: work.cover_i ? `https://covers.openlibrary.org/b/id/${work.cover_i}-L.jpg` : null,
    description: (work.subject ?? []).slice(0, 4).join(" · "),
    publishedDate: work.first_publish_year ? String(work.first_publish_year) : "",
    categories: work.subject ?? [],
    isbn: work.isbn?.[0] ?? "",
    pageCount: work.number_of_pages_median ?? null,
    publisher: work.publisher?.[0] ?? "",
    language: normalizeLanguage(work.language?.[0] ?? ""),
    previewUrl: null,
    sourceUrl: `https://openlibrary.org${work.key}`,
    readableUrl: readerUrl,
    readerMode: readerUrl ? "internet-archive" : null,
    availability: readerUrl ? "readable" : "metadata",
    source: "Open Library",
    downloads: 0,
  };
}

function workKey(book: Book) {
  const author = book.authors[0] ?? "";
  const [surname, givenName] = author.split(",");
  const normalizedAuthor = givenName ? `${givenName} ${surname}` : author;
  const normalizedTitle = book.title.toLocaleLowerCase().replace(/[^a-z0-9]/g, "");
  return `${normalizedTitle}:${normalizedAuthor.toLocaleLowerCase().replace(/[^a-z0-9]/g, "")}`;
}

function normalizeLanguage(language: string) {
  const codes: Record<string, string> = { eng: "en", fre: "fr", fra: "fr", ger: "de", deu: "de", spa: "es", ita: "it", ben: "bn", asm: "as" };
  return codes[language.toLowerCase()] ?? language.toLowerCase();
}

function sourceRank(book: Book) {
  if (book.availability === "readable") return book.readerMode === "gutenberg-text" ? 4 : 3;
  return book.availability === "preview" ? 2 : 1;
}

export function mergeEditions(books: Book[]) {
  const merged = new Map<string, Book>();
  for (const book of books) {
    const key = workKey(book);
    const existing = merged.get(key);
    if (!existing) {
      merged.set(key, book);
      continue;
    }
    const preferred = sourceRank(book) > sourceRank(existing) ? book : existing;
    const other = preferred === book ? existing : book;
    merged.set(key, {
      ...other,
      ...preferred,
      coverUrl: preferred.coverUrl ?? other.coverUrl,
      description: preferred.description || other.description,
      categories: preferred.categories.length ? preferred.categories : other.categories,
      pageCount: preferred.pageCount ?? other.pageCount,
      publishedDate: preferred.publishedDate || other.publishedDate,
      isbn: preferred.isbn || other.isbn,
      publisher: preferred.publisher || other.publisher,
      language: preferred.language || other.language,
      previewUrl: preferred.previewUrl ?? other.previewUrl,
    });
  }
  return [...merged.values()];
}

async function fetchJson<T>(url: string): Promise<T | null> {
  try {
  const response = await fetch(url, { headers: { Accept: "application/json" }, signal: AbortSignal.timeout(6500), next: { revalidate: 3600 } });
    if (!response.ok) return null;
    return await response.json() as T;
  } catch {
    return null;
  }
}

export async function searchGutenberg(query = "", topic = "", limit = 24) {
  const params = new URLSearchParams({ page: "1" });
  if (query.trim()) params.set("search", query.trim());
  if (topic.trim()) params.set("topic", topic.trim());
  const response = await fetchJson<SearchResponse<GutendexBook>>(`https://gutendex.com/books/?${params}`);
  if (!response) throw new Error("Project Gutenberg is temporarily unreachable.");
  return (response?.results ?? []).slice(0, limit).map(fromGutenberg);
}

export async function searchGoogleBooks(query: string, limit = 16) {
  if (!query.trim()) return [];
  const params = new URLSearchParams({ q: query.trim(), maxResults: String(limit), printType: "books" });
  const response = await fetchJson<SearchResponse<GoogleVolume>>(`https://www.googleapis.com/books/v1/volumes?${params}`);
  if (!response) throw new Error("Google Books is temporarily unreachable.");
  return (response?.items ?? []).map(fromGoogle).filter((book): book is Book => book !== null);
}

export async function searchOpenLibrary(query: string, limit = 16) {
  if (!query.trim()) return [];
  const params = new URLSearchParams({
    q: query.trim(),
    limit: String(limit),
    fields: "key,title,author_name,cover_i,first_publish_year,subject,language,ebook_access,ia,isbn,publisher,number_of_pages_median",
  });
  const response = await fetchJson<{ docs?: OpenLibraryWork[] }>(`https://openlibrary.org/search.json?${params}`);
  if (!response) throw new Error("Open Library is temporarily unreachable.");
  return (response.docs ?? []).map(fromOpenLibrary).filter((book): book is Book => book !== null);
}

export async function discoverBooks(topic: string, limit = 24) {
  const [publicDomain, openLibrary] = await Promise.allSettled([
    searchGutenberg("", topic, limit),
    searchOpenLibrary(topic, limit),
  ]);
  if (publicDomain.status === "rejected" && openLibrary.status === "rejected") {
    throw new Error("Book sources are temporarily unavailable. Please try again shortly.");
  }
  const merged = mergeEditions([
    ...(publicDomain.status === "fulfilled" ? publicDomain.value : []),
    ...(openLibrary.status === "fulfilled" ? openLibrary.value : []),
  ]);
  const gutenberg = merged.filter((book) => book.source === "Project Gutenberg").sort((left, right) => sourceRank(right) - sourceRank(left) || right.downloads - left.downloads);
  const openLibraryBooks = merged.filter((book) => book.source !== "Project Gutenberg").sort((left, right) => sourceRank(right) - sourceRank(left));
  const gutenbergShare = Math.ceil(limit * 0.65);
  return [...gutenberg.slice(0, gutenbergShare), ...openLibraryBooks, ...gutenberg.slice(gutenbergShare)].slice(0, limit);
}

export async function searchBooks(query: string, limit = 24) {
  const [publicDomain, metadata, openLibrary] = await Promise.allSettled([
    searchGutenberg(query, "", limit),
    searchGoogleBooks(query, limit),
    searchOpenLibrary(query, limit),
  ]);
  if (publicDomain.status === "rejected" && metadata.status === "rejected" && openLibrary.status === "rejected") {
    throw new Error("Book sources are temporarily unavailable. Please try again shortly.");
  }
  return mergeEditions([
    ...(publicDomain.status === "fulfilled" ? publicDomain.value : []),
    ...(metadata.status === "fulfilled" ? metadata.value : []),
    ...(openLibrary.status === "fulfilled" ? openLibrary.value : []),
  ]).sort((left, right) => sourceRank(right) - sourceRank(left) || right.downloads - left.downloads).slice(0, limit);
}