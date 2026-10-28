# Verification record · Frame by Frame 2.0

Verified 27 October 2026. This file distinguishes executed checks from implementation claims. Only synthetic data was used.

## Executed checks

| Check | Observed result |
|---|---|
| Original upstream `npm ci`, `npm test`, type check and production export | Passed; 58 original tests. Original page also opened in Chromium with no page errors. |
| Final `npm test` | **60 passed, 0 failed**. Includes all 23 original pure import/analytics regressions and new integrity, backup, matrix and TMDB tests. |
| `npm run lint` / build TypeScript checks | Passed. This command is a TypeScript check, not an ESLint certification. |
| `npm run build:pages` | Passed, static export at the repository subpath, with worker and logo assets. |
| `node scripts/verify-static.mjs` | Passed: index, nine referenced local assets, .nojekyll, 404 and logo present. |
| `npm run test:e2e` against the production export | **17 passed, 0 failed** in Chromium, including real worker ZIP/CSV import. |
| axe-core WCAG 2 A/AA and 2.1 AA automated checks | No reported violations on the tested welcome/overview/explorer states; explorer tested in both themes at 360, 768 and 1440 px. Not a claim of complete manual WCAG conformance. |
| Responsive overflow checks | No page-wide horizontal overflow in explorer, diary and settings at 360, 768 and 1440 px. Dense tables/calendars scroll inside their own containers. |
| Console/runtime/local assets | Browser suite fails on unhandled page errors and local HTTP failures; none observed in the final run. |
| `npm audit` | **0 known vulnerabilities**, including dev dependencies, at the recorded check. Patched PostCSS override resolved the original advisories. |
| Large synthetic import | 30,000 films and diary events produced exact counts, mean 2.75, full dated-event count. Latest isolated run: about 1.4 seconds on the test host. Timing is diagnostic, not a machine-dependent pass criterion. |
| Production JavaScript | Original first load: 231 KB. Final first load: 139 KB as reported by Next.js. No external font or chart runtime. |
| `git diff --check` | Passed. |

## The 17 actual browser scenarios

1. Empty state, keyboard skip link, theme switch/reload, and automated accessibility.
2. CSV preview → confirmation → exact metrics, zero external requests in local mode, overview accessibility.
3. ZIP extraction in the real import worker, wrapper folder, deleted-path exclusion and discarded profile email.
4. Invalid ZIP recovery, unchanged prior analysis, Escape close and restored import-button focus.
5. Year/date/rating filters, chart drilldown and reset affecting the records shown.
6. Unicode search, sorting, film details/diary dates and an actual downloaded CSV.
7. Calendar-day drilldown and recorded-event year comparison.
8. Full backup download/restore, explicit local save, reload restoration, clear and post-clear reload.
9. Downloaded report is a real SVG with calculated values, explicit active-filter scope, and no executable markup.
10. Two-profile comparison before a main import, exact correlation, retained results after navigation, and clear.
11. TMDB opt-in, mocked details/credits enrichment, uncertain-candidate review, manual correction, updated people drilldown and credential clearing on reload.
12–14. Phone/tablet/desktop screenshots, overflow checks, and both-theme accessibility checks.
15. All 65 synthetic films reachable through pagination; missing diary/ratings/metadata views remain useful.
16. Imported markup remains literal text; watchlist-only imports never inflate watched totals.
17. Clearing removes the current journal and session credential even when browser storage is blocked; inability to confirm deletion of a saved copy is reported.

## Data and API edge cases

Tests cover RFC-style quoted fields, escaped quotes, multiline fields, UTF-8/BOM, header aliases, invalid headers/rows, missing titles, invalid half-star values, undated events, date boundaries/leap days, explicit duplicate policy, repeat diary events, canonical link identity/renamed titles, distinct non-Latin names, rating precedence, filter intersections, rankings/ties, watchlist overlap and preference evidence, genre/decade matrix sample thresholds, runtime coverage, malformed/unsafe/checksum-failing ZIPs, empty/partial datasets, native browser File methods, source line numbers through backups, JSON validation, credential exclusion, untrusted image URLs, CSV formula defense and SVG escaping.

TMDB tests use deterministic mock HTTP responses for exact/original-title matching, ambiguous/remake/unknown-year cases, stable TMDB/IMDb identifiers, constrained-search fallback, credits/runtime extraction, v3-key/bearer behavior, 401, 429 with numeric Retry-After, bounded 5xx/network retries, unreadable JSON, cache/batch limits and cancellation. Error handling and the 12-second request timeout are implemented; live timeout behavior was not measured against the real service.

## Material failures found and fixed

- First browser import failed because modern File objects have a `bytes()` method; the importer had confused that with synthetic byte-buffer input. It now checks `instanceof Uint8Array`, with a dedicated regression test.
- axe found an inline creator link distinguishable only by color. Inline text links now have underlines; final checks pass.
- Compact header hid the import button's accessible text; an explicit accessible name fixes phone use.
- Visual inspection found explorer selects shrinking to arrows; they now receive usable widths. Mobile bar spacing keeps the 12-month chart legible.
- When browser storage was blocked, clear-all initially left in-memory data behind. Session clearing now always runs; saved-copy deletion failures are reported without claiming success. A dedicated browser test exercises this failure.
- Comparison state initially reset when leaving its view; it is now kept in memory until clear/reload, and navigation retention is tested.
- A development-server/build overlap produced an incomplete intermediate export. The release build runs separately, and static verification now rejects any missing index/assets.
- An early wall-clock performance assertion failed under concurrent CPU load. Duplicate normalization and repeated watchlist grouping were removed; the test verifies exact large-data results and records timing rather than enforcing hardware speed.
- Initial Playwright browser download was unavailable in this managed environment. A packaged Chromium binary was used with the documented executable override. No browser binary or machine path is included in the project archives.

## Fresh archive verification procedure

The release process tests ZIP CRC integrity, inspects essential/root files, extracts the source into a new directory, runs `npm ci`, all unit tests, type checking, the Pages build, static-path checks and the browser suite from that extracted project. The deployment ZIP is extracted separately and its bytes compared to the verified static export; the browser suite is also run against those deployed files. None of these checks require a source file outside the ZIP. The browser executable is a testing-environment dependency, not a production-site dependency.

## Limits of verification

No live TMDB credential or private export was supplied. Authenticated live API calls, current matching coverage for a real account, Safari/Firefox execution, assistive-technology user studies and the actual remote GitHub Actions/Pages deployment were **not** verified. Production metadata remains opt-in; incomplete matches stay explicit. Basic analysis has no API/network dependency beyond loading the static site. No outstanding failure remains in the recorded final local suite; these limits are not represented as passing tests.
