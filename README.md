# Letterboxd Profile Analyzer

A privacy-first, local-processing Next.js static site for GitHub Pages, exploring Letterboxd exports. The first working slice focuses on robust CSV/ZIP ingestion, transparent data coverage, core statistics, charts, film search, watchlist separation, and rules-based observations. It deliberately does **not** use the official Letterboxd API, collect passwords/cookies, or pretend unsupported data exists.

> **Status:** functional MVP source; the Node.js core test suite passes. The Next.js production build has not been verified in this environment because outbound network access is unavailable and npm dependencies are not installed. Basic optional TMDB movie-search enrichment is implemented in the browser; public-profile ingestion and detailed credits enrichment remain unimplemented.

## API discovery and evaluation

Research was initiated from the required [public-apis/public-apis repository](https://github.com/public-apis/public-apis/tree/master), especially its current Entertainment category. The current upstream README's Entertainment section does not list a suitable film metadata API, so the directory is not itself an API provider and was not treated as one. The official Letterboxd FAQ explicitly recommends applying directly to TMDB for non-Letterboxd movie/TV data and describes the account export and RSS options. Candidate APIs were then verified against their own documentation.

See [API_EVALUATION.md](./API_EVALUATION.md) for the detailed candidate table and limitations.

### Decision

No third-party API is required for core analytics. **TMDB is the preferred optional metadata candidate** because it provides movie search, details, genres, credits, release dates, runtime, original language, popularity, vote averages, and poster paths through a coherent API. It requires an API credential and attribution; its free developer access is for non-commercial use, while commercial use requires contacting TMDB for licensing. TMDB's published rate-limit page says the old fixed limit was disabled but asks clients to respect 429 responses and avoid bulk scraping. The current code does not call TMDB yet; no API key is required for local analytics.

OMDb is not selected: its official key page advertises 1,000 requests/day on its free tier, and its data is licensed CC BY-NC 4.0, a significant constraint for commercial use. Wikidata is a possible later fallback for selected facts, but the query service is not a good bulk fuzzy film-matching engine and documents query/time limits. No external recommendation service is needed for the MVP; explainable recommendations should be computed locally from taste features and an available candidate catalogue.

## Features

### Implemented in this MVP

- Dark editorial interface with responsive navigation and charts.
- ZIP and individual CSV selection in the browser.
- Recognizes files whose names include `diary`, `ratings`, `watched`, `watchlist`, `reviews`, and `list`.
- CSV parsing for quoted commas, escaped quotes, BOM, CRLF, and multiline cells.
- Basic title/year normalization, rating validation, date parsing, diary-entry and rewatch counts.
- Keeps watchlist entries out of watched-film totals.
- Core unique-film count, diary-entry count, rated-film count, mean, median, rating distribution, dated-year activity, release-decade distribution, and rule-based observations.
- Search/filter/sort film explorer; watchlist view; privacy/session clear; JSON export.
- Fictional sample dataset loaded only by an explicit action.
- Unit tests for CSV, classification, dates, normalization, merges, watchlist separation, stats, and comparison sample-size guard.

### Partial or not yet implemented

- **Public username/profile URL:** UI explains the limitation, but does not fetch public profiles or RSS yet. This is deliberate rather than scraping protected pages. Public RSS ingestion can be added later with strict allowlisting, timeouts, pagination, conservative rates, and terms review.
- **TMDB metadata enrichment:** Optional browser-side movie search is wired into the import dialog. Users can paste their own TMDB v3 API key into the dedicated password field. For each import, the app searches up to 100 films sequentially and attaches metadata only when normalized title and available release year match; it does not silently use a fuzzy first result. Search results can add poster URL, TMDB ID, genre names, release date, popularity and TMDB vote average. Credits/directors/cast, runtime, countries and original-language details are not yet fetched.
- **API-key privacy:** The key is held only in React in-memory state for the current page session, is not written to local storage or sent to an application server, and is sent directly to `api.themoviedb.org` as a query parameter. This means the key is visible to the browser and its network tools; users should supply a key they are comfortable using this way. Reloading or clearing the session removes it. This is a user-supplied credential, not a server-side secret.
- **Attribution:** When TMDB data is displayed, the app shows: “This product uses the TMDB API but is not endorsed or certified by TMDB.” Review TMDB's current terms, attribution rules, and commercial licensing before public or commercial use.
- **Metadata limitations:** Genre, poster, release date, popularity and external rating can be populated for matched results. Credits/directors/cast, country and original-language analytics remain unavailable until further endpoints are implemented.
- **Comparison UI:** core calculation function exists, but selecting and comparing a second dataset is not connected to the interface.
- **Recommendations:** currently only shows explainable watchlist-first placeholders; a real candidate retrieval/ranking engine is not yet connected.
- **Advanced statistics:** standard deviation, rating-vs-external normalization, streaks, weekday patterns, year-over-year genre trends, confidence-aware genre/director analysis and configurable mainstream definition remain future work.
- **Production-grade ZIP bomb protection, exhaustive malformed-export recovery and full import correction UI:** not complete. The MVP has per-file/size checks and path filtering, but should not be deployed as a public multi-user service without additional archive validation and security review.
- **Persistence/database:** none. Data remains in browser memory; reload clears it.

## Technology and architecture

- Next.js App Router, React, TypeScript
- Tailwind CSS, Recharts, lucide-react
- `fflate` for in-browser ZIP extraction
- Pure JavaScript analysis core (`lib/analytics.mjs`) with Node's built-in test runner
- No backend database and no user-upload endpoint in this MVP

### Folder structure

```text
app/
  globals.css         Editorial dark theme
  layout.tsx          App metadata and root layout
  page.tsx            Import workflow and dashboard sections
lib/
  analytics.mjs       CSV parsing, normalization, merging, statistics, comparison
sample-data/
  diary.csv           Clearly fictional sample records
  ratings.csv         Clearly fictional sample ratings
  watchlist.csv       Clearly fictional watchlist records
tests/
  analytics.test.mjs  Node built-in unit tests
API_EVALUATION.md     Candidate research and decisions
.env.example          Optional API configuration placeholders
```

## Requirements

- Node.js 20.9+ (Node 22 recommended)
- npm
- Network access for first-time dependency installation

## Deploy on GitHub Pages

This project is configured for **static export** (`output: export`) and includes a GitHub Actions workflow at `.github/workflows/deploy-pages.yml`. GitHub Pages hosts the interface; all CSV/ZIP parsing and core analytics run in the visitor's browser. No Next.js server, API routes, database, or secrets are needed for core analytics.

1. Create a GitHub repository (for example, `letterboxd-profile-analyzer`) and upload/push the contents of this project to its `main` branch.
2. In the repository, open **Settings → Pages**.
3. Under **Build and deployment**, choose **GitHub Actions** as the source.
4. Push to `main` or run the workflow manually from **Actions → Deploy Letterboxd Profile Analyzer to GitHub Pages → Run workflow**.
5. When the workflow succeeds, open the Pages URL shown in the deployment job. For a project repository, it will normally be `https://YOUR-USERNAME.github.io/REPOSITORY-NAME/`.

The workflow sets the Next.js base path to the repository name automatically, so project-site asset URLs work under the repository subpath. If using a custom domain or a `YOUR-USERNAME.github.io` user-site repository, review `.github/workflows/deploy-pages.yml` and the `NEXT_PUBLIC_BASE_PATH` setting before deploying.

**Deployment caveat:** GitHub Pages only serves static files. Public-profile/RSS fetching, secret API keys, server-side caching, and backend routes cannot be added to this Pages deployment as server features. The current app does not implement public profile ingestion. Optional TMDB movie-search calls run directly from the browser only after the user enters their own key. For optional metadata lookups, either use a provider-supported browser-safe flow with no secret key (only if permitted by that provider), or add a separately hosted backend/proxy and review its privacy, security, rate-limit, and licensing requirements. Never put a secret API key in a `NEXT_PUBLIC_*` variable or shipped frontend bundle.

## Run locally

```bash
npm install
npm test
npm run dev
```

Open `http://localhost:3000`. Select **Import your data** and choose the Letterboxd export ZIP, or select one or more CSV files. Inspect the file/row preview, then choose **Analyze files**. Alternatively choose **Explore sample analysis**; the UI labels this data as fictional.

Build the static site locally:

```bash
npm run build
```

The exported website is written to `out/`. Preview it with any static file server, or deploy it through the included GitHub Actions workflow.

## Getting a Letterboxd export

1. Sign in directly on Letterboxd in a browser.
2. Open account settings/data export and request/download the account export ZIP.
3. Import that ZIP here. Never give this application a Letterboxd password or session cookie.
4. Include the diary, ratings, watched, and watchlist CSVs where available. Each dataset has a different meaning: watched is not the same as diary, a rating is not inferred from a review, and a watchlist film is not counted as watched.

Letterboxd states that its export is a ZIP of CSV documents and that member profiles have RSS feeds for new diary entries, reviews and lists. RSS feeds may be partial and do not replace an export for full historical analysis.

## Environment variables

Copy `.env.example` to `.env.local` only when developing a future server-side metadata adapter. Never expose a developer-owned provider credential through `NEXT_PUBLIC_` variables. This static Pages build instead lets each user intentionally enter their own TMDB v3 key in the import dialog; that key is used directly by their browser and is not persisted.

## Privacy and retention

- The current MVP parses the selected file in the user's browser. It does not POST files to a server, store them in a database, or use analytics tracking.
- App state is memory-only and is cleared on reload; the Settings page can clear the active dataset.
- JSON export is initiated by the user and saved to their device.
- If server-side metadata enrichment is added, only film title/year or a verified external ID should be sent; never send private review text unless explicitly opted in.
- Public deployment should add strict file validation, decompression limits, CSP/security headers, abuse/rate controls, dependency scanning, and a privacy review.

## Deployment

The app is structured for a standard Node-compatible Next.js deployment (for example, a self-hosted Node server or a compatible Next hosting platform). Install dependencies, run `npm test`, run `npm run build`, and deploy the resulting Next.js app. No database or secrets are required for local analytics. If enabling TMDB beyond the current browser-side user-key flow, review its latest terms, consider a server-side adapter with caching and 429 handling, and display the required attribution notice: “This product uses the TMDB API but is not endorsed or certified by TMDB.” Do not deploy a commercial product using the free developer tier without a commercial licensing decision.

## Verification record

- `npm test`: **6 tests passed** in the available Node 22 runtime.
- Production build: **not run successfully / not verified**. The environment cannot resolve GitHub or download dependencies, and `node_modules` is not present. Run `npm install` and `npm run build` in a network-enabled environment before treating this as production-ready.
- No external API calls were made by the application; no provider responses or deployment results are claimed.
