# Frame by Frame · Letterboxd Profile Analyzer 2.0

A private screening room for your film journal. Import a Letterboxd export and explore your viewing rhythm, rating fingerprint and personal collection. **Core analysis is free of API-key requirements and runs in your browser.**

Created and maintained by **[Melvin Varghese](https://melvinvarghese.in)**. Independent of Letterboxd; no official Letterboxd API or profile scraping is used.

## Upload this project to your existing GitHub repository

Use **Letterboxd-Profile-Analyzer-2.0.zip** for the existing repository.

1. Download the ZIP and **extract it** on your computer. Open the extracted contents: `README.md`, `package.json`, `app`, `lib`, and `.github` should all be at the top level.
2. Open [your existing repository](https://github.com/melvinvarghese/letterboxd-profile-analyzer). Choose **Add file → Upload files**.
3. Drag **all the extracted files and folders** into the upload area, including `.github`. Upload the contents, not the ZIP and not an enclosing folder. The upload replaces matching files. Do not upload `node_modules`, your personal exports, or API credentials.
4. Commit the files to **main**. In **Settings → Pages → Build and deployment**, select **GitHub Actions**.
5. Open the **Actions** tab. The **Deploy Letterboxd Profile Analyzer to GitHub Pages** workflow installs, tests, type-checks, builds and verifies the site before deployment.
6. When deployment succeeds, open [the analyzer](https://melvinvarghese.github.io/letterboxd-profile-analyzer/). No source editing or TMDB configuration is needed for core features.

The archive root is the repository root. Old palette/source-contract test filenames are intentionally absent. The new `npm test` script lists its actual test files explicitly, so obsolete tests left behind by GitHub's upload interface do not break the new workflow. Files no longer used by the application can be removed later; they are not imported or executed.

**Alternative:** `Letterboxd-Profile-Analyzer-2.0-GitHub-Pages.zip` contains the already-built static site. It needs no Node.js installation. See [GITHUB_PAGES.md](GITHUB_PAGES.md) before choosing this option; do not mix deployment methods.

## Use the analyzer

1. Request your account ZIP on [Letterboxd's export page](https://letterboxd.com/user/exportdata/).
2. Choose **Import data**, then select one ZIP or several extracted CSV files from **one** export. You can also drop them in the import dialog.
3. Review the file counts, validation notices and missing datasets. Choose **Analyze my data** to replace the current analysis.
4. Explore Overview, Film explorer, Diary & activity, Ratings, Taste & places, Directors & actors and Watchlist & next picks. Charts and category rows open the records behind their numbers.
5. Use the dashboard's year/date/rating/genre/decade filters. Reset clears them together. Date filters select **diary events and the films behind those events**, not every film ever marked watched.
6. **Compare years** uses the full diary. **Compare profiles** accepts two independent exports and can be used without a main import; it can also compare two exports of the same account taken at different times.
7. In **Data & privacy**, download a restorable analysis backup, filtered film CSV, import diagnostic report, or shareable movie report SVG. SVG is an image you can open in a browser or image editor.
8. Optionally enable **Save analysis on this browser and device**. Saved data is restored on the same browser and origin. **Clear all imported and saved data** removes it, the current analysis, comparison pair and session credential. Downloaded files remain on your computer.

There is no fabricated demo dataset or hidden sample-statistics mode. Tests use synthetic fixtures that the production app never loads.

## What is included

- Import preview with source/accepted/excluded counts, line-level notices and downloadable diagnostics.
- Unicode-safe identity, canonical Letterboxd links, correct half-star validation and deterministic rating precedence.
- Distinct unique films, diary events, dated/undated entries, explicit rewatch flags, mean, median, all tied modes and rating distribution.
- Diary years, 12-month calendars, weekdays, month-group seasons, longest consecutive-day streak and repeat viewing highlights.
- Highest/lowest ratings, personal-mean outliers and TMDB-versus-personal differences where sufficient external votes exist.
- Search, sorting, table/poster views, pagination, film details, source review text behind a spoiler disclosure, and film/category exports.
- Optional metadata for genre pairs, production countries, original languages, directors, first-ten-billed cast, collections, runtimes and lower-TMDB-vote-count selections in exports/film details.
- Explainable watchlist ranking: supported above-baseline genre preferences, then release-decade evidence; unknowns stay unranked. Already watched identities are excluded from prioritized picks.
- Calendar-year comparison, separate two-profile comparison, current-versus-event rating disclosures, snapshot backup/restore and optional local saving.
- Dark/light themes, remembered preference, visible focus, native dialog keyboard behavior, reduced motion, mobile navigation and exact textual chart values.

## Supported data & counting rules

Recognized canonical files: `watched.csv`, `ratings.csv`, `diary.csv`, `watchlist.csv`, `reviews.csv`. `profile.csv` supplies **Username only**; email, real name, bio, location and other profile fields are discarded. ZIPs may have their canonical files at the root or inside one unambiguous export wrapper folder. Nested deleted, orphaned, likes, lists and unrelated files are reported and excluded. Password-protected, ZIP64 and multi-disk archives are unsupported; select extracted CSVs instead.

No one CSV is mandatory. At least one valid film or watchlist record is required. Missing datasets disable only the analyses they support. Limits: 80 MB per selected file, 120 MB total selection, 40 MB per decompressed entry, 150 MB expanded archive, 10,000 ZIP entries and 250,000 source rows. CSV text must be UTF-8. Oversized or malformed imports leave the existing analysis intact.

**Identity:** a canonical Letterboxd film link is preferred. Without one, normalized Unicode title and exact release year are used. If exactly one stable link exists for a title/year, unlinked rows can join it. Different stable links remain distinct. Alternate short and long links cannot be resolved offline; missing-link same-title/year collisions remain a limitation.

**Unique films:** union of watched, rating, diary and review film identities. Watchlist remains separate. A count of unique films is not a count of lifetime viewing events.

**Diary:** every accepted diary row is an event, including identical rows (with a notice). Only valid `Watched Date` values create activity. Blank/invalid dates remain undated. `Date` is an activity/addition timestamp, and `Year` is a release year; neither substitutes for a viewing date. Year-first dates and the upstream legacy US M/D/YYYY forms are supported; day/month ambiguity is not guessed. ISO date-times preserve their source calendar day. Dates outside 1800–2200 are treated as invalid.

**Ratings:** only 0.5–5 in half-star increments. Latest valid `Date` in ratings.csv, then source order, wins. Those current ratings override diary/review values; otherwise the latest rated diary event wins. Missing values are excluded, not zero. Rating trends by diary year use event ratings and can differ from current-film means.

**Rewatches:** explicit diary Rewatch flags are counted. Two or more logs of one film are shown separately as repeat-recorded titles. No flag does not prove a first-time viewing.

**Metadata:** only matched films enter metadata category analysis. Multi-genre films/co-productions count once per category. Means use rated films only. Mean-based category rankings need three ratings. Runtime sums exclude unknowns and state film/event coverage; they are not a measurement of actual time spent watching.

**Watchlist:** “also watched” is overlap in one snapshot, not historical completion progress. Recommendations are limited to your watchlist and need sufficient above-baseline preferences; this is not a prediction of your next rating.

**Comparison:** title and exact release-year matching, including Unicode; no fuzzy identity guesses. Rating difference is A minus B. Pearson correlation requires at least three shared rated films and nonzero variance in both profiles. It is not a personality/compatibility score.

## Optional TMDB metadata

In **Data & privacy**, enter **your own** TMDB v3 API key or API Read Access Token, review the disclosure and enable the consent checkbox. Choose **Enrich next batch**. Batches can check 25, 100 or 250 not-yet-checked titles, including watchlist titles; completed checks are retained if stopped or interrupted. The next batch resumes with unchecked films. Metadata is cached in the analysis and saved only if you save/backup that analysis. There is no shared server cache or bundled key.

Provided TMDB/IMDb IDs are preferred when a source contains them. Otherwise movie search uses title, original title and release year, with an unconstrained retry. Only one exact title/year result is automatically accepted. Unknown years, ambiguous candidates and near-year alternatives require manual review. Open a film to confirm a candidate, enter a numeric TMDB movie ID, or remove metadata to retry. Correcting metadata never alters your original film title or personal rating. A standard Letterboxd export usually has no TMDB/IMDb ID.

Credentials stay in memory and are cleared on reload/clear. They are never in browser storage or backups. **A static frontend cannot conceal a secret:** browser users can inspect a credential and its requests. V3 keys go in TMDB request URLs; read tokens use a bearer header. Use a credential you knowingly choose to use in the browser. Film names/years/identifiers go directly to TMDB; poster requests go to its image service. Personal ratings, diary dates, review text and export files are not sent. External poster loading is separately switchable and off after restoring a saved analysis.

This product uses the TMDB API but is not endorsed or certified by TMDB. The approved TMDB logo and attribution appear in Data & privacy. See [TMDB terms](https://www.themoviedb.org/api-terms-of-use), [authentication](https://developer.themoviedb.org/docs/authentication-application), and [rate limiting](https://developer.themoviedb.org/docs/rate-limiting). This package does not grant commercial TMDB rights.

## Development & verification

Node.js **22 LTS** and npm are recommended. No environment file is required.

```bash
npm ci
npm test
npm run lint
npm run build:pages
npm run preview
```

Open `http://127.0.0.1:4173/letterboxd-profile-analyzer/`. Production files are in `out/`. `npm run dev` serves the development version at `http://localhost:3000`. `npm run build` builds a root-hosted export; **build:pages** sets the repository subpath automatically.

Browser checks use Playwright and axe-core:

```bash
npx playwright install --with-deps chromium
npm run test:e2e
```

Run these after `npm run build:pages`. `PLAYWRIGHT_CHROMIUM_EXECUTABLE` may point to an existing Chromium binary when a managed environment supplies one. It is optional and never required in production. Tests run at 360, 768 and 1440 pixel widths; synthetic data only. See [docs/QA.md](docs/QA.md) for the checks actually run and [docs/AUDIT.md](docs/AUDIT.md) for findings/research.

## Boundaries

No account sync, scraping, paid backend, generative “personality” analysis, external watch candidates, streaming availability, complete external filmographies or franchise-completion claims. Unmatched metadata and missing diary periods stay unknown. Backups must be this app's version 2 format; original MVP JSON downloads lacked diary/source data and cannot be restored. Native browser dialogs/workers/IndexedDB require a current Chrome, Edge, Firefox or Safari; Chrome-family execution is covered by the supplied automated suite. Browser storage can be unavailable or evicted. No real private Letterboxd export or live TMDB credential was used for testing.

See [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md) for included dependency/asset notices. Original project ownership and creator credit are preserved.
