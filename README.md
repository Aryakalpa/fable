# Fable

Fable is a discovery-first reading app for books with clearly stated access. It combines book metadata and covers with legal-source availability, then opens public-domain plain text in a focused reader.

## Run locally

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). The catalog providers require an internet connection; their API failures are bounded and shown in the app with retry actions.

## Sources and access

- Gutendex supplies Project Gutenberg catalog records. An in-app **Read now** action is offered only when a Gutenberg-hosted plain-text format is listed.
- Google Books supplies metadata and covers. Its preview links remain external previews; Google Books metadata is never treated as permission to reproduce a book.
- Open Library supplies catalog metadata. Only an edition explicitly marked `public` and linked to an Internet Archive identifier receives an external Internet Archive reader link. Borrowable or restricted scans are not presented as free in-app reading.
- The reader route only accepts HTTPS Project Gutenberg text paths, verifies the returned content type, and limits text responses to 5 MB. Scans and books without supported full text remain source links or previews.
- Book access and copyright terms can vary by country. The source record is linked from the detail and reader views; review its applicable terms.

## App behavior

- Search combines normalized Gutendex and Google Books results, filters by subject, language, publication period, source, fiction type, and in-app readability, and merges editions by title and author where possible.
- Home and Discover shelves combine Project Gutenberg records with Open Library metadata; in-app Gutenberg text is ranked ahead of external scan readers when editions merge.
- The personal library, reading history, progress, and bookmarks are stored in browser local storage under `fable-library-v1`. Reader and discovery preferences use `fable-preferences-v1`. Settings can export or clear both. There is no account sync in this MVP.
- Settings persist reader theme, font size, line spacing, reading width, readable-only search defaults, language, and reduced motion.
- The reader supports light, paper, and dark themes, adjustable font size and line spacing, a best-effort table of contents, visible and resumable progress, bookmarks, keyboard navigation, and marking books finished.

## Validation

```bash
npm run lint
npm run build
npm run preview
```

## Cloudflare Workers

OpenNext deploy configuration lives in `wrangler.jsonc`. Keep its top-level Worker `name` and the `WORKER_SELF_REFERENCE` service name in sync; both are currently `fable`. This explicit binding avoids Cloudflare generating a self-reference from the npm package name (`bookify`).

```bash
npm run deploy
```

## Stack

Next.js App Router, React, TypeScript, CSS, Phosphor icons, OpenNext for Cloudflare Workers, Gutendex, Open Library, and Google Books API. No API key is required for the current public endpoints.
