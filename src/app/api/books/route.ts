import { discoverBooks, searchBooks } from "@/lib/books";

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const query = params.get("q")?.trim() ?? "";
  const topic = params.get("topic")?.trim() ?? "fiction";
  const limit = Math.min(Math.max(Number(params.get("limit")) || 18, 1), 30);
  try {
    const books = query ? await searchBooks(query, limit) : await discoverBooks(topic, limit);
    return Response.json({ books });
  } catch {
    return Response.json({ books: [], error: "Book sources are temporarily unavailable. Please try again shortly." }, { status: 503 });
  }
}