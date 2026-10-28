# Repository audit and product decisions

Audited upstream commit `c0ed6a4aa51c80ab4cdf62f9d6148056a1dff0c4` on 27 October 2026. The actual public repository was cloned and every tracked source, configuration, test and document was inspected. No AGENTS.md instructions were present. The upstream worktree was kept separately; changes are in the supplied project.

## Baseline observed

Next.js 15 App Router, React 19, TypeScript, Tailwind 3, Recharts 2, and fflate; static `output: export`; repository-name base path configured in the Pages workflow. Existing Node test runner, 58 tests, type check and static build passed after `npm ci`. The initial dependency-install race caused one temporary Tailwind test failure; the clean rerun passed all 58. Original first-load JavaScript was 231 KB. The actual original empty page ran in Chromium without page errors; there was **no visible theme toggle**, despite the README implying themes.

## Findings, severity and resolution

| Priority | Evidence in original | Resolution |
|---|---|---|
| High | `normalize` strips every non-ASCII character. Two Japanese titles in the same year collapse into one key. | Preserve Unicode letters/numbers and use canonical film links where present; test international identities and title changes. |
| High | A 3.7 rating passes normalization and the average but matches none of the ten distribution bins. | Validate the actual half-star scale; preserve film unrated and explain invalid ratings. |
| High | Missing titles and extra CSV fields can disappear without validation records. Unclosed quoted cells are accepted. | Deterministic parsing errors and per-file diagnostics, row exclusions, partial-row notices and atomic import previews. |
| High | ZIP/CSV work runs synchronously on the UI thread; CSV selections can mix exports. | Worker-based imports; reject mixed ZIP/CSV inputs and duplicate canonical datasets; size/entry/row limits. |
| High | TMDB errors discard all successful matches in an interrupted batch; search only, max 100 total, ASCII title matching, no credits/runtime/country data. | Preserve each completed result, bounded resumable batches, timeouts/retries/429 support, Unicode/original-title matching, details/credits, manual correction and provided-ID preference. |
| High | “Enable TMDB” in the people view cannot populate directors because the integration never retrieves credits. Recommendations simply repeat every watchlist film. | Real credits analytics and watchlist ranking from sufficiently supported personal preferences; unranked titles explicitly labeled. |
| High | JSON download omits diary/source data, cannot be restored; reload loses the analysis. | Versioned full source-data backup/restore, optional IndexedDB save, export formats and clear-all controls. |
| High | Dependency audit found PostCSS advisories through Next.js. | Pin a compatible patched PostCSS 8.5.32 override; verify clean install and npm audit. Keep Next 15, without framework migration. |
| Medium | Main page combines ingestion, network, analysis and UI in one dense 60 KB source file. | Separate pure analytics, import/worker, TMDB client, storage, export and UI/view modules. |
| Medium | Timeline is annual-only; explorer stops at 100 records without pagination; films have no details. | Calendars, streaks, months, weekdays, seasons, event diary, year comparison, film details and paginated search/export. |
| Medium | Watchlist overlap uses normalized title alone, so remakes can be marked watched. | Use consistent film identity including year/URI; call the figure overlap, not historical completion. |
| Medium | Search/select controls and charts have incomplete accessible alternatives. | Labels, visible focus, native dialog focus handling, textual chart values and keyboard actions; automated accessibility tests. |
| Medium | No user-facing persistence/theme control and an oversized repeated welcome block after import. | Dedicated empty experience, restrained cinematic design, remembered themes, clear analysis navigation and filter scope. |
| Low | API evaluation describes TMDB as not implemented although code calls TMDB. | Replace stale integration documentation and record present behavior/limits. |

## Valuable existing behavior preserved

Browser-only ZIP/CSV analysis; upload preview before replacement; exclusion of deleted/orphaned/list/likes data; genuine Watched Date semantics; independent diary events; watchlist separation; personal/external rating separation; title/year profile comparison, rating differences, three-pair Pearson correlation and zero-variance checks; username-only profile labels; creator attribution; Next/React/TypeScript/Tailwind/fflate; static GitHub Pages workflow.

All 23 original pure data/import regression tests are retained. Source-string/UI-style contract tests tied to the old markup and exact palette were replaced with actual browser behavior and contrast/accessibility checks. This is a test-strategy change, not a claim that those old source assertions still run.

## Research and differentiation

Consulted official product/project pages rather than copying code or proprietary designs:

- [Letterboxd Pro](https://letterboxd.com/about/pro/): annual/all-time personal stats establish the value of time scope. This app adds explicit event-versus-film accounting, import quality diagnostics and fully local export processing.
- [LePrAn](https://github.com/lombardo-luca/LePrAn): its own README describes genre/country/language/people/runtime summaries and JSON snapshots. This project retains its browser-only deployment and adds precise date/rating scope, backup validation, uncertain-match review and accessible charts. No competitor code was copied.
- [Letterboxd export](https://letterboxd.com/user/exportdata/) and [official support](https://support.letterboxd.com/hc/en-us/articles/15179196880911-Can-I-get-a-copy-of-my-account-data): exports are ZIPs containing CSVs, including deleted data. [Import format](https://letterboxd.com/about/importing-data/) is a related input reference, **not** a promise of every export header. Test fixtures use the actual column handling present in the audited repository plus representative synthetic edge cases; no private export was obtained or bundled.
- [TMDB search](https://developer.themoviedb.org/reference/search-movie), [find by external ID](https://developer.themoviedb.org/reference/find-by-id), [application authentication](https://developer.themoviedb.org/docs/authentication-application), [rate limits](https://developer.themoviedb.org/docs/rate-limiting), [FAQ/attribution](https://developer.themoviedb.org/docs/faq), [official approved logos](https://www.themoviedb.org/about/logos-attribution).
- [fflate official repository](https://github.com/101arrowz/fflate): retain the existing lightweight ZIP implementation, add validation/filtering/CRC verification and move it into a worker.
- [MDN IndexedDB](https://developer.mozilla.org/en-US/docs/Web/API/IndexedDB_API): explicit opt-in, async local persistence; backups remain the durable portable copy.
- [prompts.chat](https://prompts.chat/): evaluated as requested for audit→implementation→verification workflows. No external prompt was treated as a repository instruction, no runtime agent service was added, and no user data was sent there.
- [Vercel Labs skill catalogue](https://github.com/vercel-labs/agent-skills) and [Web Interface Guidelines](https://github.com/vercel-labs/web-interface-guidelines): reviewed accessibility, focus, long content, reduced motion, theme and performance guidance. No skill CLI or extra product dependency was installed.

Native HTML/CSS charts were chosen after evaluating the existing Recharts usage: the charts here need counts, means, calendar cells and drilldowns, not a heavyweight chart engine. Buttons expose exact chart values to keyboard and screen reader users; charts never depend solely on color. This removed Recharts and its animation dependencies and reduced the measured production entry bundle from 231 KB to about 138 KB.

## Advanced feature decisions

Implemented diary calendar, streaks, year/month/weekday/season activity, annual comparison, release-decade ratings, genre pairs, people within the imported collection, explainable watchlist suggestions, personal-mean outliers, external-rating differences with vote threshold, shareable SVG reports and two-export comparison. Similarity discovery outside a watchlist, external complete filmographies, streaming availability, AI personality labels, franchise-completion percentages, and inferred first-watch dates were excluded: they need additional coverage or make claims the imported data cannot support. All limitations are disclosed in product copy and README.
