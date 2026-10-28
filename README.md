# Frame by Frame · Letterboxd Profile Analyzer

Analyze a Letterboxd export in your browser. Explore viewing history, ratings, rewatches, watchlist picks, film details, charts, and profile comparisons.

[Open Frame by Frame](https://melvinvarghese.github.io/letterboxd-profile-analyzer/) · [Get your Letterboxd export](https://letterboxd.com/user/exportdata)

Created and maintained by [Melvin Varghese](https://melvinvarghese.in). This is an independent project and is not affiliated with or endorsed by Letterboxd. It does not use Letterboxd's API or ask for your password or session cookie.

## Import your data

1. Request and download your account export from [Letterboxd](https://letterboxd.com/user/exportdata).
2. In Frame by Frame, choose **Import data** and select one export ZIP or CSV files from that same export.
3. Review accepted and excluded rows, validation notices, and missing files. Choose **Analyze my data** to open the dashboard.

The app reads `watched.csv`, `ratings.csv`, `diary.csv`, `watchlist.csv`, and `reviews.csv`. You can import whichever of these you have; missing files limit the views that depend on them. In a ZIP, recognized files must be at the archive root or inside one export folder. Deleted, orphaned, nested, and unrelated files are excluded and shown in the import report. Do not combine exports in one import.

Each selected file can be up to 80 MB, and a selection can total up to 120 MB. Imports are limited to 250,000 source rows, 10,000 ZIP entries, 40 MB per expanded entry, and 150 MB of expanded archive data. Encrypted, ZIP64, and split or multi-disk ZIP archives are not supported; extract their CSV files and select those instead.

## What you can explore

- **Overview and diary:** unique films, diary entries, rating summaries, viewing calendars, active days, streaks, and explicit rewatch flags.
- **Film explorer:** search by title, year, director, or actor; filter by rating and rewatch status; sort results; and switch between table and poster views.
- **Dashboard filters:** narrow the analysis by diary year or date range, personal rating, TMDB genre, or release decade. Genre filters need matched TMDB metadata.
- **Ratings, taste, and people:** explore rating patterns and, when matching metadata is available, genres, countries, languages, directors, and cast.
- **Watchlist and next picks:** review your watchlist and see explainable picks based on preferences in your imported records.
- **Comparisons:** compare diary years or upload two exports to find shared and profile-specific films and compare ratings.
- **Downloads:** save a filtered film CSV, a shareable report image, import diagnostics, or a restorable analysis backup.

## Optional TMDB details

Core analysis works without a TMDB credential. To add movie metadata, open **Data & privacy**, enter your own TMDB API key or read access token, review the disclosure, and enable consent before starting an enrichment batch. Get a credential from [TMDB account settings](https://www.themoviedb.org/settings/api). You can choose batches of 25, 100, or 250 titles and continue with another batch later.

For matched films, TMDB can provide posters, genres, release dates, runtimes, TMDB ratings, production countries, original languages, collections, overviews, directors, and the first ten billed cast members. A single exact title-and-year match can be accepted automatically. Ambiguous or near-year results need your review; you can confirm or correct a match. Metadata is not available for every film. Category averages require enough matched, rated films, and runtime totals exclude films without a known runtime.

Film titles, release years, and any supplied film IDs are sent from your browser directly to TMDB. Poster images are requested from TMDB's image service when poster loading is enabled. Your Letterboxd archive, personal ratings, diary dates, and review text are not sent to TMDB or an application server.

The credential stays in browser memory, is excluded from backups, and is cleared when you reload the page or clear the data. A browser-side credential cannot be hidden from someone inspecting the browser; a TMDB v3 key is included in request URLs. Use a credential you are comfortable using this way. Read [TMDB's terms](https://www.themoviedb.org/api-terms-of-use), [authentication guide](https://developer.themoviedb.org/docs/authentication-application), and [rate-limit guidance](https://developer.themoviedb.org/docs/rate-limiting) before enabling metadata. This product uses the TMDB API but is not endorsed or certified by TMDB. Commercial use may require a separate license from TMDB.

## Privacy and data controls

Your selected files are read and analyzed in your browser. By default, the analysis stays in memory and is cleared when you reload the page. You can optionally save it in browser storage on that device, download a backup, and restore the backup later. Anyone with access to that browser profile may be able to access a saved analysis, and browser cleanup may remove it.

Backups include imported source rows and any saved metadata; they can contain ratings, diary history, and review text. Keep downloaded files private. Only version 2 analysis backups can be restored. **Clear all imported and saved data** removes the current analysis, saved copy, comparison, and TMDB credential. It does not delete files you already downloaded.

Use a current Chrome, Edge, Firefox, or Safari. Saving uses browser storage, which may be unavailable or evicted.

## How to read the results

- Only a valid `Watched Date` in `diary.csv` supplies a viewing date. `Date` is an addition or activity timestamp, and `Year` is the film's release year. Neither is used as a viewing date.
- Each accepted diary row counts as a viewing event, including repeated rows. A film without a valid diary date remains undated and is left out of date-based views. A rewatch is counted only when the export explicitly marks it.
- Unique-film totals combine watched, rated, diary, and reviewed films; they are not lifetime viewing counts. Watchlist entries are counted separately. Ratings must be between 0.5 and 5 stars in half-star steps.
- Film identity uses a canonical Letterboxd film link when available; otherwise the app uses normalized title and exact release year. Unlinked films with the same title and year can collide.
- Partial exports produce partial results. The app does not infer activity for missing dates or records.
- Profile comparison matches normalized film titles and exact release years; unknown years match only other unknown years. Rating correlation needs at least three shared films rated by both profiles and variation in both rating sets. It describes rating patterns, not compatibility or personality.
- Watchlist picks are limited to titles in your imported watchlist and the preference evidence available in your data. They are not predictions of how you will rate a film.

For profile comparison, `profile.csv` may supply a username. Other profile fields, such as email, real name, bio, and location, are discarded.

Third-party acknowledgements and asset notices are listed in [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).
