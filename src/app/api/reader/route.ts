const ALLOWED_HOSTS = new Set(["www.gutenberg.org", "gutenberg.org"]);
const MAX_BOOK_BYTES = 5_000_000;
const ALLOWED_TEXT_PATH = /^\/(?:cache\/epub\/\d+\/pg\d+\.txt(?:\.utf-8)?|ebooks\/\d+\.txt(?:\.utf-8)?|files\/\d+\/[\w.-]+\.txt)$/i;

export async function GET(request: Request) {
  const source = new URL(request.url).searchParams.get("url");
  if (!source) return Response.json({ error: "A reading source is required." }, { status: 400 });

  let sourceUrl: URL;
  try {
    sourceUrl = new URL(source);
  } catch {
    return Response.json({ error: "The reading source is invalid." }, { status: 400 });
  }

  if (
    sourceUrl.protocol !== "https:" ||
    !ALLOWED_HOSTS.has(sourceUrl.hostname) ||
    !ALLOWED_TEXT_PATH.test(sourceUrl.pathname)
  ) {
    return Response.json({ error: "Only plain-text Project Gutenberg books are supported." }, { status: 403 });
  }

  try {
    const response = await fetch(sourceUrl, { headers: { Accept: "text/plain" }, signal: AbortSignal.timeout(12000) });
    const finalUrl = new URL(response.url);
    if (!response.ok || !ALLOWED_HOSTS.has(finalUrl.hostname) || !ALLOWED_TEXT_PATH.test(finalUrl.pathname)) {
      return Response.json({ error: "The source is temporarily unavailable." }, { status: 502 });
    }
    if (!response.headers.get("content-type")?.toLowerCase().startsWith("text/plain")) {
      return Response.json({ error: "The source did not provide readable plain text." }, { status: 502 });
    }
    if (Number(response.headers.get("content-length")) > MAX_BOOK_BYTES) {
      return Response.json({ error: "This text is too large to open in the reader." }, { status: 413 });
    }
    const text = await response.text();
    if (text.length > MAX_BOOK_BYTES) {
      return Response.json({ error: "This text is too large to open in the reader." }, { status: 413 });
    }
    return new Response(text, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "public, max-age=3600",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch {
    return Response.json({ error: "The source is temporarily unavailable." }, { status: 502 });
  }
}