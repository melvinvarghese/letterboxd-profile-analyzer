# Metadata integration status · 2.0

TMDB is implemented as an **optional browser-only integration**. Core import and analytics have no network dependency. The previous report's “future integration” wording was stale; this file describes the delivered version.

- Personal v3 key or API read access token, session memory only. No owner secret, .env value, proxy, or paid backend.
- Direct identifiers when provided; otherwise Unicode title/original-title plus exact release year. Uncertain matches are reviewed manually; no fuzzy first-result attachment.
- Details and credits supply runtime, directors, first ten cast, genres, production countries, original language, collection membership and vote statistics. Unknowns stay null/empty.
- Client throttling, 12-second per-request timeout, bounded transient retries, Retry-After on 429, user cancellation and completed-result retention.
- Checked titles are cached inside the analysis. Batches resume unchecked titles; clear a film's metadata to retry it.
- Core mode makes no TMDB requests. Explicit enrichment sends film search terms/identifiers, not ratings/reviews/diary data. Poster image loading is separately switchable.
- Credential-bearing calls and matching are tested with deterministic mocked responses. Live authenticated TMDB use was not tested because no personal credential was supplied.

Official references: [Getting started](https://developer.themoviedb.org/docs/getting-started), [authentication](https://developer.themoviedb.org/docs/authentication-application), [search](https://developer.themoviedb.org/reference/search-movie), [external IDs](https://developer.themoviedb.org/reference/find-by-id), [limits](https://developer.themoviedb.org/docs/rate-limiting), [attribution](https://developer.themoviedb.org/docs/faq), [terms](https://www.themoviedb.org/api-terms-of-use).

OMDb, Wikidata, Trakt and TVmaze are not integrated. Their differing coverage, credentials, operational limits and licensing add complexity without improving the core local analysis. None is represented as a transparent fallback. A missing TMDB result remains missing.
