# Letterboxd Profile Analyzer

Explore Letterboxd stats, film diary history, and personal movie ratings from a Letterboxd data export. This browser-based analyzer turns ZIP or CSV exports into searchable film lists, charts, and a two-profile comparison.

[Open the live analyzer](https://melvinvarghese.github.io/letterboxd-profile-analyzer/)

Created and maintained by **Melvin Varghese**. This project is not affiliated with Letterboxd and does not use an official Letterboxd API.

## What the analyzer does

- Summarizes watched films, ratings, diary entries, rewatches, release decades, and rating patterns.
- Shows a searchable film library and keeps watchlist titles separate from watched films.
- Compares two Letterboxd exports, including shared films, films unique to each profile, rating differences, and rating correlation when at least three shared films have ratings from both profiles.
- Uses optional TMDB metadata to show matched posters, genres, release dates, and TMDB ratings. Taste analysis can group those genres using the ratings from the imported Letterboxd data.
- Imports a ZIP export or supported CSV files directly in the browser.

## How it works

The usual flow is a Letterboxd account export, an import preview, and the analysis dashboard:

1. Letterboxd provides account exports from its [data export page](https://letterboxd.com/user/exportdata).
2. The analyzer accepts the ZIP archive or supported CSV files. An import preview lists the files and row counts before analysis begins.
3. The dashboard presents the imported film diary, ratings, watchlist, and analysis views. **Compare profiles** opens a separate flow for two exports.

The app analyzes only the selected files. It does not fetch data from a username or profile URL, and it never needs a Letterboxd password or session cookie.

### Supported export files

ZIP archives are read from their root-level `watched.csv`, `ratings.csv`, `diary.csv`, `watchlist.csv`, and `reviews.csv` files. Nested folders such as deleted or orphaned exports are ignored. The same supported CSV files can also be selected individually.

### How dates and ratings are interpreted

- A diary viewing date comes only from a valid `Watched Date` in `diary.csv`. A film’s release `Year` is never treated as a viewing date.
- Watched and rated films without a valid diary date remain in the film and rating analysis, but are not assigned a viewing year.
- Diary rows represent viewing events, so rewatches can appear as separate dated entries.
- Personal rating summaries use ratings from the imported Letterboxd data. TMDB ratings are shown separately.
- Watchlist items are not counted as watched films or personal ratings.

## Optional TMDB metadata

A TMDB v3 API key is optional. When one is entered in the import dialog, the browser searches TMDB for up to **100 films per import** and adds metadata only when the title matches and the available release year is compatible. The remaining films are still analyzed from the Letterboxd export; they simply are not searched on TMDB.

Matched metadata can include poster images, genre labels, release dates, TMDB vote averages, and popularity. TMDB genre labels appear separately from imported Letterboxd ratings in Taste analysis, and TMDB ratings never replace personal ratings. Because movie titles can be ambiguous, metadata matches should be reviewed when needed.

The API key stays in browser memory for the current page session and is sent directly from the browser to TMDB. It is not stored by this app or sent to an application server. Reloading the page clears it.

This product uses the TMDB API but is not endorsed or certified by TMDB. TMDB's developer API is for non-commercial use; commercial use requires a separate licensing decision. Review the [TMDB API terms](https://www.themoviedb.org/documentation/api/terms-of-use) and [rate-limit guidance](https://developer.themoviedb.org/docs/rate-limiting).

## Privacy and data handling

Letterboxd ZIP and CSV files are parsed in the browser and are not uploaded to an application server or stored in a database. Imported data remains in page memory and is cleared when the page reloads. A JSON export is downloaded only when requested.

With optional TMDB enrichment, movie searches and the user-supplied API key go directly from the browser to TMDB. No Letterboxd archive is sent to TMDB.

## Current limitations

- TMDB searches are capped at 100 films per import. Other imported films remain available for local analysis without TMDB metadata.
- TMDB matching is title-based with a release-year check when a year is available; it does not use a fuzzy first-result guess.
- TMDB enrichment does not currently fetch cast, crew, runtime, country, or original-language details.
- The Recommendations section is not yet connected to a recommendation engine.
- Data is not saved between page sessions.

## Run locally

**Requirements:** Node.js 20.9 or newer and npm.

```bash
npm install
npm run dev
```

The development app opens at `http://localhost:3000`. To run the tests, use `npm test`. To create the static production build, use `npm run build`; the exported site is written to `out/`.

## Technology

- Next.js App Router, React, TypeScript, and Tailwind CSS
- Recharts for charts and `fflate` for in-browser ZIP extraction
- Node.js built-in test runner
- Static GitHub Pages deployment through GitHub Actions; no backend is required for core analysis

See [API_EVALUATION.md](./API_EVALUATION.md) for the metadata-provider research and [GITHUB_PAGES.md](./GITHUB_PAGES.md) for deployment details.
