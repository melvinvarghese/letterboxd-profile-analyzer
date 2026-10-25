# Letterboxd Upload-Only Analysis

**Status:** Draft for owner review; not an implementation plan

## Goal

Make the uploaded Letterboxd export the sole source of personal analysis. Preserve every valid watched, rated, and diary film record, while keeping films without a genuine diary `Watched Date` undated. Do not infer a viewing year from a generic `Date` field or from the film’s release year.

The app remains a static, browser-only tool: archive contents are read locally and are not sent to an analytics server.
Optional TMDB enrichment remains unchanged; when explicitly enabled, the browser sends selected film titles/years and the user-provided key directly to TMDB. It does not replace the upload as the personal-data source or supply viewing dates.

## Current behavior and problem

The existing upload flow reads ZIP/CSV files, shows a preview, then imports them only after the user presses the final **Analyze N files** button (`app/page.tsx:33–36`). The analysis functions are connected to imported state, but the preview step does not replace the active dataset.

For ZIPs, the importer scans every CSV member, classifies files by basename, and removes the directory path in the preview (`app/page.tsx:33`; `lib/analytics.mjs:7`). This makes nested `deleted/`, `orphaned/`, and `likes/` files look like primary account files. Letterboxd’s [export page](https://letterboxd.com/user/exportdata/) notes that its archive includes deleted content.

Date handling is not diary-specific: the normalizer selects `Date` before `Watched Date` (`lib/analytics.mjs:8`), merging carries dates from non-diary records into diary-date fields (`:9`), and year counts use the merged film’s single date (`:13`; the timeline UI also groups merged films by `date`). As a result, a generic export date can be presented as a viewing year, and multiple diary views of one film are collapsed. Letterboxd’s [import guide](https://letterboxd.com/about/importing-data/) defines `WatchedDate` as the field that creates a diary entry.

The username/profile input is a nonfunctional placeholder: its Check button only displays a message and does not retrieve or analyze a profile (`app/page.tsx:77`). The fictional demo uses the same analysis screens and is reachable through sample buttons (`:8, :58, :65`), so it can be mistaken for user data.

## Proposed user flow

1. A new session starts with no personal analysis. The only way to populate the dashboard is to select a Letterboxd ZIP or one or more supported CSVs.
2. The browser validates the selected files using the existing ZIP size, path, and compression safeguards. It previews recognized root-level files and row counts; skipped nested paths are identified rather than silently presented as duplicate primary files.
3. The user confirms the import. Only then does the app replace the active dataset and calculate the dashboard. The interface makes the preview-versus-analysis step explicit.
4. Opening **Open Letterboxd Settings** launches `https://letterboxd.com/user/exportdata` in a new tab. This link does not replace or alter the local **Analyze my Letterboxd data** upload action.

## Import and analysis rules

- For ZIP uploads, analyze only recognized canonical files at the archive root: `watched.csv`, `ratings.csv`, `diary.csv`, `watchlist.csv`, and `reviews.csv`. Do not merge nested `deleted/`, `orphaned/`, or `likes/` entries into the active account dataset. Preserve archive-relative paths in preview/diagnostics so duplicate basenames are distinguishable. Individual CSV selection remains supported.
- Keep records from `watched.csv`, `ratings.csv`, and `diary.csv` in film/rating analysis even when no real diary watch date exists. Keep release `Year` as a film attribute, not a viewing year. A generic `Date` field is not evidence of an actual viewing date and must not create a diary event.
- For `diary.csv`, use `Watched Date` as the viewing date. If it is missing or invalid, preserve the diary row and film record but leave the event undated; do not fall back to generic `Date`.
- Compute diary entry counts from diary rows. Compute viewing-year totals and first/last diary dates only from diary rows with a valid `Watched Date`, counting each actual diary entry in its year. Repeated views of one film remain separate diary events. Film-level watch-date fields contain only actual diary dates.
- Keep watchlist records separate from watched films and ratings. An empty watchlist produces an empty watchlist/recommendation state; this MVP does not discover external film candidates.
- Remove the profile/username state, input, and Check button. Remove the production sample dataset and sample-analysis entry points to meet the strict upload-required decision. Test fixtures may use synthetic data but are never exposed as user analysis.
- Update the README to explain the upload-only flow and the distinction between film release year, generic export date, and actual diary `Watched Date`.

## Acceptance criteria

- No personal dashboard or sample analysis is available before a successful user-file import.
- After import confirmation, all supported root-level watched/rated/diary records are represented; films without `Watched Date` remain available to film and rating views but have no viewing-year assignment.
- Only actual dated diary rows contribute to diary timelines and year-based viewing insights.
- Nested export folders do not add active diary or film records, and the preview makes ignored paths understandable.
- No username/profile entry point or profile-fetch behavior remains.
- The export link uses the requested URL and opens in a new tab.
- Core processing remains local; no private archive contents are committed or included in tests.

## Regression tests

Use synthetic, privacy-safe Letterboxd-shaped CSV/ZIP fixtures:

1. A `watched.csv` or `ratings.csv` film with a generic 2020 `Date` but no `Watched Date` remains in the film/rating totals and contributes no diary year.
2. A diary row whose `Date` and `Watched Date` differ uses only `Watched Date`; a diary row with a blank `Watched Date` stays undated even when `Date` is populated.
3. Multiple diary rows for the same film with actual dates in different years count once per diary event in the appropriate years, without inflating unique-film count.
4. Root canonical CSVs are included while nested `deleted/`, `orphaned/`, and `likes/` files are excluded from active analysis and remain distinguishable in preview diagnostics.
5. Selecting files shows a pending preview; confirming imports those records and updates the analysis. No profile Check or sample-analysis route is present.
6. The export link points to the specified URL and retains new-tab behavior.

Run the existing Node test suite, type-check, and static build after implementation. Also run a local aggregate-only check against the supplied archive; do not add that archive or its film/profile data to the repository.

## Alternatives and scope

A separate fictional preview could be retained as a clearly isolated, non-personal demo, but it weakens the strict “upload to get analysis” requirement and is not the recommended choice. Server-side upload processing is out of scope: it would require a backend, storage/privacy controls, and a deployment change from the current static GitHub Pages design. Public-profile/RSS ingestion and external recommendation discovery are also out of scope.
