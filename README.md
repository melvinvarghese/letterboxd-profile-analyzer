# Letterboxd Profile Analyzer

A privacy-first, local-processing Next.js static site for analyzing Letterboxd export files. Personal analysis comes only from files you select; profile URLs are not used. The app does not use the official Letterboxd API or ask for your Letterboxd password or session cookie.

Created and maintained by **Melvin Varghese**.

## API discovery and evaluation

Research was initiated from the required [public-apis/public-apis repository](https://github.com/public-apis/public-apis/tree/master), especially its Entertainment category. The current upstream README's Entertainment section does not list a suitable film metadata API, so the directory is not itself an API provider and was not treated as one. The official Letterboxd FAQ recommends applying directly to TMDB for non-Letterboxd movie/TV data and describes account exports and RSS options. Candidate APIs were verified against their own documentation.

See [API_EVALUATION.md](./API_EVALUATION.md) for the detailed candidate table and limitations.

### Decision

No third-party API is required for core analytics. **TMDB is the optional metadata provider** for movie search, details, genres, credits, release dates, runtime, original language, popularity, vote averages, and poster paths. The app's current browser-side enrichment lets a user enter their own TMDB v3 API key in the import dialog. When enabled, the browser sends searches and that key directly to TMDB; this does not change the uploaded files as the source of personal analysis. TMDB requires attribution; its free developer access is for non-commercial use, while commercial use requires contacting TMDB for licensing. Follow TMDB's published rate-limit guidance and respect 429 responses.

OMDb is not selected: its official key page advertises 1,000 requests/day on its free tier, and its data is licensed CC BY-NC 4.0, a significant constraint for commercial use. Wikidata is a possible later fallback, but its query service is not a good bulk fuzzy film-matching engine and documents query/time limits. No external recommendation service is used by the MVP.

## Features

### Implemented in this MVP

- Dark editorial interface with responsive navigation and charts.
- ZIP and individual supported CSV selection in the browser, with a review step before import.
- ZIP analysis limited to the canonical root files `watched.csv`, `ratings.csv`, `diary.csv`, `watchlist.csv`, and `reviews.csv`.
- CSV parsing for quoted commas, escaped quotes, BOM, CRLF, and multiline cells.
- Title and release-year normalization, rating validation, and diary dates read from `Watched Date` only.
- Unique-film, diary-entry, rated-film, rating-distribution, diary-year, release-decade, and rewatch statistics, plus rule-based observations.
- Film search, watchlist view, session clear, and JSON export.

### Partial or not yet implemented

- **Profile comparison:** the navigation retains a Compare profiles placeholder, but there is no functioning comparison flow. Profile URLs are not read or fetched; uploaded files remain the only source of personal data.
- **TMDB metadata enrichment:** optional browser-side movie search runs only when the user provides their own key in the import dialog. For each import, the app searches up to 100 films sequentially and attaches metadata only when the normalized title and available release year match; it does not silently use a fuzzy first result. Search results can add poster URL, TMDB ID, genre names, release date, popularity, and TMDB vote average. Credits/directors/cast, runtime, countries, and original-language details are not fetched.
- **API-key privacy:** the key is held only in React in-memory state for the current page session, is not written to local storage or sent to an application server, and is sent directly to `api.themoviedb.org` as a query parameter. The key is visible to the browser and its network tools, so supply one you are comfortable using this way. Reloading or clearing the session removes it. This is a user-supplied credential, not a server-side secret.
- **Attribution:** when TMDB data is displayed, the app shows: “This product uses the TMDB API but is not endorsed or certified by TMDB.” Review TMDB's current terms, attribution rules, and commercial licensing before public or commercial use.
- **Recommendations:** the interface has watchlist-first placeholders; candidate retrieval and ranking are not connected.
- **Advanced statistics:** standard deviation, rating-vs-external normalization, streaks, weekday patterns, year-over-year genre trends, confidence-aware genre/director analysis, and configurable mainstream definition remain future work.
- **Archive hardening:** the app has ZIP entry, size, expansion, compression-ratio, encryption, and path checks, but it is not intended as a public multi-user service without further security review.
- **Persistence/database:** none. Data remains in browser memory; reload clears it.

## Technology and architecture

- Next.js App Router, React, TypeScript
- Tailwind CSS, Recharts, lucide-react
- `fflate` for in-browser ZIP extraction
- Pure JavaScript analysis core in `lib/analytics.mjs` and `lib/import.mjs`, tested with Node's built-in test runner
- No backend database or user-upload endpoint

### Folder structure

```text
app/
  globals.css             Editorial dark theme
  layout.tsx              App metadata and root layout
  page.tsx                Import workflow and dashboard sections
lib/
  analytics.mjs           CSV parsing, normalization, merging, and statistics
  import.mjs              Canonical root CSV selection from ZIP archives
tests/
  analytics.test.mjs      Analysis unit tests
  import.test.mjs         Archive parser tests
  ui-contract.test.mjs    Upload-only UI contract tests
API_EVALUATION.md         Candidate research and decisions
.env.example              Optional API configuration placeholders
```

## Requirements

- Node.js 20.9+ (Node 22 recommended)
- npm
- Network access for first-time dependency installation

## Deploy on GitHub Pages

This project is configured for **static export** (`output: export`) and includes a GitHub Actions workflow at `.github/workflows/deploy-pages.yml`. GitHub Pages hosts the interface; CSV/ZIP parsing and core analytics run in the visitor's browser. Core analytics needs no Next.js server, API routes, database, or secret.

1. Create a GitHub repository (for example, `letterboxd-profile-analyzer`) and upload/push the contents of this project to its `main` branch.
2. In the repository, open **Settings → Pages**.
3. Under **Build and deployment**, choose **GitHub Actions** as the source.
4. Push to `main` or run the workflow manually from **Actions → Deploy Letterboxd Profile Analyzer to GitHub Pages → Run workflow**.
5. When the workflow succeeds, open the Pages URL shown in the deployment job. For a project repository, it will normally be `https://YOUR-USERNAME.github.io/REPOSITORY-NAME/`.

The workflow sets the Next.js base path to the repository name automatically, so project-site asset URLs work under the repository subpath. If using a custom domain or a `YOUR-USERNAME.github.io` user-site repository, review `.github/workflows/deploy-pages.yml` and the `NEXT_PUBLIC_BASE_PATH` setting before deploying.

GitHub Pages only serves static files, so it cannot provide server-side features such as backend routes or secret API keys. Optional TMDB movie searches run directly from the browser only after the user enters their own key. Never put a secret API key in a `NEXT_PUBLIC_*` variable or shipped frontend bundle.

## Run locally

```bash
npm install
npm test
npm run dev
```

Open `http://localhost:3000`. Choose **Import your data** and select a Letterboxd export ZIP or individual supported CSV files. Review the detected files and row counts, then confirm with the **Analyze N files** button.

Build the static site locally:

```bash
npm run build
```

The exported website is written to `out/`. Preview it with any static file server, or deploy it through the included GitHub Actions workflow.

## Getting and importing a Letterboxd export

1. Sign in directly on Letterboxd and [open the data-export page](https://letterboxd.com/user/exportdata).
2. Request and download your account export ZIP.
3. Select the ZIP in this app, or choose individual supported CSV files. Inspect the preview and confirm the import. The app does not use a profile URL; your selected files are the only source of personal analysis.
4. Never give this application your Letterboxd password or session cookie.

For ZIP uploads, only canonical CSVs at the archive root are analyzed: `watched.csv`, `ratings.csv`, `diary.csv`, `watchlist.csv`, and `reviews.csv`. Nested or unsupported CSVs are ignored, and their paths appear in the import diagnostics. Individual supported CSV files can also be selected directly.

### How dates and records are interpreted

- A film's `Year` is its release year, not a viewing date. A generic `Date` field is not proof that you watched a film.
- Only a valid `Watched Date` in a `diary.csv` row creates a diary date and viewing year. Watched or rated films without a real `Watched Date` remain in film and rating analysis, but receive no viewing year.
- Diary timelines count diary rows/events by their valid `Watched Date`; rewatches can therefore count as separate diary entries, even for the same film. Rows with a missing or invalid `Watched Date` remain undated and do not appear in a viewing-year total.
- Watchlist entries remain separate from watched films. A review does not imply a rating; only imported rating data contributes to personal-rating analysis.

## Environment variables

Core analytics require no API key. The optional TMDB flow instead lets each user intentionally enter their own TMDB v3 key in the import dialog; the browser uses it directly and does not persist it. `.env.example` is a placeholder for optional future API configuration and is not needed for this flow.

## Privacy and retention

- The selected files are parsed in the user's browser. They are not POSTed to an analytics server or stored in an application database, and the app does not use analytics tracking.
- App state is memory-only and is cleared on reload; the Settings page can clear the active dataset.
- JSON export is initiated by the user and saved to their device.
- Optional TMDB enrichment sends searches and the user-provided key directly from the browser to TMDB; no Letterboxd file is sent to an application server.
- Public deployment should include appropriate file validation, decompression limits, CSP/security headers, abuse/rate controls, dependency scanning, and a privacy review.

## Deployment

The app is structured for a standard Node-compatible Next.js deployment, including static export to GitHub Pages. No database or secret is required for local analytics. If enabling TMDB, review its latest terms, attribution rules, and commercial licensing; the app displays the required attribution notice when TMDB data is shown. Do not use the free developer tier for a commercial product without a licensing decision.
