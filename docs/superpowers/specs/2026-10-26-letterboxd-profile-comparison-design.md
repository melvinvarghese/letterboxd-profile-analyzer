# Letterboxd Profile Comparison Mode

**Status:** Draft for owner review; design only

## Goal

Add a separate way to compare two user-provided Letterboxd exports without replacing or mixing with the single-profile analysis. Comparison stays browser-only: no profile scraping, backend, or transmission of imported records.

## User flow

Add a distinct **Compare two profiles** button beside the existing single-profile analysis action. The **Compare profiles** navigation item opens the same mode and works before a single-profile import. The comparison screen has two independent upload slots. For each imported export, read only the `Username` field from its root `profile.csv` and use that username as the label throughout the comparison. Never use or display other `profile.csv` fields. For individual-CSV imports, `profile.csv` may be included as identity metadata alongside supported film CSVs. If a username is absent or blank, show **Username unavailable**; if both exports resolve to the same username, distinguish them as separate imports in the UI. Each side accepts one supported Letterboxd ZIP or a batch of supported CSV files, with independent previews and the existing import safeguards. Each side must contain at least one film record before comparison can run; files are never combined across sides. After reviewing both previews, the user confirms **Compare profiles**. Either side can be replaced and compared again without changing the normal single-profile dataset.

Keep both imported datasets, usernames, and results in browser memory only. Parse root `profile.csv` solely to extract `Username`; ignore all other profile fields, including name, email, location, website, and bio. Do not include profile metadata in film rows or previews. Provide a **Clear comparison** action for the pair; the existing clear-session action also clears the pair, and reloading clears all session data.

## Comparison results and rules

Match films by normalized title and exact release year; an unknown year matches only another unknown year. Do not use fuzzy title matching. Show the shared-film set and the films unique to each profile. For shared films, show both imported ratings when present and show a rating difference only when both have a rating, calculated as **Profile A − Profile B**. A missing rating is not zero.

Calculate Pearson rating correlation from shared films rated by both profiles. Show a value only with at least three such films. Below three, show no value and explain the minimum; with zero variance in either rating set, report correlation as unavailable.

In film details, show each profile’s valid diary dates when available, using only `Watched Date` from that profile’s diary rows. Preserve repeated diary entries as separate dates. Never substitute a generic `Date` or release year. The MVP has no aggregate cross-profile timeline or date-based score. Watchlists, external recommendations, profile URLs, and external metadata lookups are outside comparison mode.

## Privacy and acceptance checks

The comparison flow parses and compares locally, makes no calls to Letterboxd, a backend, or an external metadata service, and writes no profile data to browser storage. It must remain distinct from normal single-profile analysis; incomplete/invalid sides cannot produce results, and comparing or replacing a side cannot alter the primary dataset.

Synthetic tests should verify username extraction from each `profile.csv`, missing/blank username fallback, that non-username profile fields are not retained or displayed, title/year matching (including unknown years), shared and unique sets, rating-difference sign and missing ratings, the two-versus-three shared-rated-film correlation threshold and zero-variance case, repeated/missing diary dates, independent side imports, and clearing session data. No real Letterboxd export is committed or used in tests.

## Review notes

This spec adds only the approved two-profile comparison mode. The existing single-profile importer, analysis, and optional metadata behavior outside comparison mode remain unchanged. No unresolved product decisions remain within the approved scope.
