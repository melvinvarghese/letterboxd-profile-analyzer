# API Evaluation Report

**Research date:** 2026-10-25. Candidate discovery began at the requested [public-apis/public-apis](https://github.com/public-apis/public-apis/tree/master) repository. The current upstream README's Entertainment section was inspected; it does not currently list a movie metadata provider. This is a directory, not an API server. Letterboxd's own API page/FAQ is the strongest link to a relevant candidate: Letterboxd recommends applying directly to TMDB for non-Letterboxd film/TV data.

## Candidates

| API | Purpose / useful fields | Authentication | Cost / limits verified | Limitations | Decision |
|---|---|---|---|---|---|
| [The Movie Database (TMDB)](https://developer.themoviedb.org/docs/getting-started) | Search and movie details; genres, release dates, credits/cast/crew, runtime, original language, vote average/count, popularity, poster paths and image configuration | API key or bearer read token; keep server-side | Free for non-commercial use with attribution; commercial/revenue-primary use requires contacting TMDB for a commercial license. Rate page says legacy fixed limit disabled, with anti-bulk upper limits around 40 req/s and 429 responses to respect. No SLA. | Key approval/terms required; metadata can be missing or mismatched; provider ratings/popularity reflect external audiences, not the user's ratings; poster use has attribution and branding requirements. | **Preferred optional enrichment**, not implemented in this MVP. Core analytics must not depend on it. |
| [OMDb](https://www.omdbapi.com/) | Movie/series title search, IMDb ID, year, genre, director, actors, runtime, poster, IMDb/Rotten Tomatoes/Metacritic ratings where available | API key | Official key page advertises a 1,000/day free tier. API data license shown as CC BY-NC 4.0. | Non-commercial license can preclude commercial use; daily quota; field coverage depends on title and provider data. Official docs do not establish a formal SLA in the reviewed material. | **Reject for default integration** because licensing limits reuse and its coverage is less suited to deep discovery/credits than TMDB. Consider only after license review. |
| [Wikidata Query Service](https://www.mediawiki.org/wiki/Wikidata_Query_Service/User_Manual) | Open structured facts for some films/people, identifiers and relationships where community-maintained statements exist | No API key for SPARQL endpoint; requires a descriptive User-Agent and respectful query practices | Query service documentation describes a 60-second query deadline, processing-time quotas, 429 throttling and up to 5 parallel queries per IP at the time documented; limits can change. Data is CC0. | Uneven coverage and inconsistent metadata; not suitable for fuzzy text search or broad bulk querying; facts need validation and may lack posters/runtime/ratings. | **Reject as primary source**; potential future fallback for isolated facts/identifier crosswalks. |
| [Trakt API](https://trakt.docs.apiary.io/) | Community watching trends, lists, movie/show metadata and user activity | API client credentials; OAuth for user-authorized functionality | Exact current plan/limits and commercial terms were **not independently verified** in this research pass. | User-data sync requires consent; adds another user ecosystem and does not solve Letterboxd import. | **Not selected**; redundant for MVP, terms/limits require verification before use. |
| [TVmaze API](https://www.tvmaze.com/api) | TV show/episode/cast/crew data | Public API access; endpoint-specific policy should be checked | Current numeric quota and commercial terms were **not independently verified** in this research pass. | TV-first, not a comprehensive film catalogue for this use case. | **Reject** for a movie-focused product. |

> The Trakt and TVmaze entries are comparison candidates found during the broader public-API discovery process; the current upstream `public-apis` Entertainment category does not list them in the inspected README. They are not represented as current upstream entries.

## Official source checks

- Letterboxd says account export is a ZIP of CSV files and describes public RSS feeds for diary entries, reviews and lists: https://letterboxd.com/api-beta/access/ and https://letterboxd.com/faq/
- TMDB getting started/authentication: https://developer.themoviedb.org/docs/getting-started and https://developer.themoviedb.org/docs/authentication-application
- TMDB commercial/free-tier and attribution FAQ: https://developer.themoviedb.org/docs/faq
- TMDB rate limiting: https://developer.themoviedb.org/docs/rate-limiting
- OMDb key quota and license: https://www.omdbapi.com/apikey.aspx
- Wikidata query limits: https://www.mediawiki.org/wiki/Wikidata_Query_Service/User_Manual

## Selection rationale

1. **No API in the critical path.** Parse Letterboxd's user-provided CSV export locally. This ensures the product remains useful without credentials or provider availability.
2. **TMDB is the best optional enrichment candidate.** It covers the fields needed for genre, director, cast, release-year, poster, runtime and external-popularity analytics. The product must remain non-commercial under the developer terms or obtain an appropriate commercial license before monetization.
3. **No external recommendation API.** Recommendations can be deterministic and explainable from observed user ratings plus a metadata catalogue. A third-party recommender would add another dependency without improving transparency.
4. **Do not scrape around controls.** Public RSS/profile ingestion should only be added after verifying current access behavior and applicable terms; it must be conservative, report partial coverage, and fall back to export import.

## Current integration status

- Local CSV/ZIP parsing and analytics: implemented.
- TMDB: selected for future optional integration; no API calls in this code version.
- OMDb, Wikidata, Trakt, TVmaze: not integrated.
- Letterboxd official API: not used.
