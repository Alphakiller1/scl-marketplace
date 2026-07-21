# Sportsbook marks

Self-hosted attribution tiles for `BookMark` (`/marks/books/{OddsApiKey}.svg`).

- Filenames must match `SUPPORTED_BOOKS` keys in `src/lib/books.ts`.
- Nominative source attribution only — not sponsorship.
- Brand-colored tiles with distinctive marks; replace with rights-cleared
  official artwork when available (keep the same filenames).
- Bump `BOOK_MARK_ASSET_VERSION` in `src/components/scl/book-mark.tsx` after replacing files.
