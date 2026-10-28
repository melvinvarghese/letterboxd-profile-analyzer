import { normalize } from "./analytics.mjs";
export const posterURL = (path) =>
  typeof path === "string" && /^\/[a-zA-Z0-9_-]+\.(jpg|png|webp)$/.test(path)
    ? `https://image.tmdb.org/t/p/w342${path}`
    : null;
export function rankMatches(film, results) {
  const candidates = results
    .filter((m) => Number.isSafeInteger(m.id) && m.id > 0)
    .map((m) => {
      const exact = [m.title, m.original_title].some(
        (t) => t && normalize(t) === normalize(film.title),
      );
      const y = m.release_date?.match(/^\d{4}/)?.[0],
        year = y ? +y : null,
        yearExact = !!film.year && year === film.year;
      return {
        id: m.id,
        title: m.title || m.original_title || "Untitled",
        year,
        posterUrl: posterURL(m.poster_path),
        score:
          (exact ? 100 : 0) +
          (yearExact
            ? 30
            : film.year && year && Math.abs(year - film.year) === 1
              ? 10
              : 0),
        exact,
        yearExact,
      };
    })
    .sort((a, b) => b.score - a.score || a.id - b.id);
  const high = candidates.filter((c) => c.exact && c.yearExact);
  return {
    match: high.length === 1 ? high[0] : null,
    candidates: candidates.slice(0, 8),
    status:
      high.length === 1
        ? "matched"
        : candidates.length
          ? "review"
          : "not-found",
  };
}
export const wait = (ms, signal) =>
  new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new DOMException("Cancelled", "AbortError"));
      return;
    }
    const done = () => {
      signal?.removeEventListener("abort", abort);
      resolve();
    };
    const timer = setTimeout(done, ms);
    const abort = () => {
      clearTimeout(timer);
      signal.removeEventListener("abort", abort);
      reject(new DOMException("Cancelled", "AbortError"));
    };
    signal?.addEventListener("abort", abort, { once: true });
  });
/** @param {string} credential @param {any} options */
export function createTMDBClient(
  credential,
  { fetcher = fetch, pause = wait, signal } = {},
) {
  const key = String(credential).trim();
  if (!key)
    throw new Error("Enter your own TMDB API key or read access token.");
  const token = !/^[a-f\d]{32}$/i.test(key);
  let last = 0;
  return async function request(path, params = {}) {
    for (let attempt = 0; attempt < 3; attempt++) {
      if (signal?.aborted) throw new DOMException("Cancelled", "AbortError");
      const delay = Math.max(0, 260 - (Date.now() - last));
      if (delay) await pause(delay, signal);
      last = Date.now();
      const url = new URL(`https://api.themoviedb.org/3/${path}`);
      for (const [k, v] of Object.entries(params))
        if (v !== null && v !== undefined && v !== "")
          url.searchParams.set(k, String(v));
      if (!token) url.searchParams.set("api_key", key);
      const controller = new AbortController(),
        abort = () => controller.abort();
      signal?.addEventListener("abort", abort, { once: true });
      const timer = setTimeout(() => controller.abort(), 12000);
      let response;
      try {
        response = await fetcher(url.toString(), {
          headers: {
            Accept: "application/json",
            ...(token ? { Authorization: `Bearer ${key}` } : {}),
          },
          signal: controller.signal,
          referrerPolicy: "no-referrer",
        });
      } catch (error) {
        if (signal?.aborted) throw new DOMException("Cancelled", "AbortError");
        if (attempt === 2)
          throw new Error(
            "TMDB could not be reached or timed out. Your local analysis is safe.",
          );
        await pause(600 * (attempt + 1), signal);
        continue;
      } finally {
        clearTimeout(timer);
        signal?.removeEventListener("abort", abort);
      }
      if (response.status === 401 || response.status === 403)
        throw new Error(
          "TMDB rejected the credential. Check your personal API key or read access token.",
        );
      if (response.status === 429 || response.status >= 500) {
        if (attempt === 2)
          throw new Error(
            response.status === 429
              ? "TMDB is rate limiting requests. Try again later; completed matches are retained."
              : "TMDB is temporarily unavailable. Completed matches are retained.",
          );
        const retry = Number(response.headers.get("retry-after"));
        await pause(
          Math.min(
            60000,
            Math.max(1000, (Number.isFinite(retry) ? retry : 1) * 1000),
          ),
          signal,
        );
        continue;
      }
      if (response.status === 404) return null;
      if (!response.ok)
        throw new Error(
          `TMDB returned HTTP ${response.status}. Completed matches are retained.`,
        );
      try {
        return await response.json();
      } catch {
        throw new Error(
          "TMDB sent an unreadable response. Try again later; your local analysis and completed matches are safe.",
        );
      }
    }
  };
}
export function metadataFromDetails(m, confidence = "verified-id") {
  if (!m || !Number.isSafeInteger(m.id) || m.id <= 0)
    throw new Error("TMDB returned an invalid movie record.");
  const names = (arr) =>
    Array.isArray(arr)
      ? [
          ...new Set(
            arr.filter((x) => typeof x?.name === "string").map((x) => x.name),
          ),
        ]
      : [];
  return {
    tmdbId: m.id,
    tmdbTitle: m.title || m.original_title || "",
    posterUrl: posterURL(m.poster_path),
    genres: names(m.genres),
    directors: names(m.credits?.crew?.filter((p) => p.job === "Director")),
    cast: names(m.credits?.cast?.slice(0, 10)),
    countries: names(m.production_countries),
    languages:
      typeof m.original_language === "string" ? [m.original_language] : [],
    runtime:
      Number.isFinite(m.runtime) && m.runtime > 0 && m.runtime <= 1500
        ? m.runtime
        : null,
    releaseDate: typeof m.release_date === "string" ? m.release_date : null,
    externalRating:
      Number.isFinite(m.vote_average) && m.vote_average > 0 && m.vote_count > 0
        ? m.vote_average
        : null,
    voteCount:
      Number.isFinite(m.vote_count) && m.vote_count >= 0 ? m.vote_count : null,
    popularity: Number.isFinite(m.popularity) ? m.popularity : null,
    collection: m.belongs_to_collection?.name || null,
    overview: typeof m.overview === "string" ? m.overview : "",
    tmdbMatchConfidence: confidence,
    metadataAt: new Date().toISOString(),
    matchStatus: "matched",
    candidates: [],
  };
}
export async function matchFilm(film, request) {
  if (film.sourceTmdbId)
    return metadataFromDetails(
      await request(`movie/${film.sourceTmdbId}`, {
        append_to_response: "credits",
      }),
      "provided-tmdb-id",
    );
  if (film.imdbId) {
    const found = await request(`find/${film.imdbId}`, {
      external_source: "imdb_id",
    });
    if (found?.movie_results?.length === 1)
      return metadataFromDetails(
        await request(`movie/${found.movie_results[0].id}`, {
          append_to_response: "credits",
        }),
        "provided-imdb-id",
      );
  }
  let result = await request("search/movie", {
    query: film.title,
    year: film.year,
    include_adult: false,
  });
  let ranked = rankMatches(film, result?.results || []);
  if (!ranked.match && film.year) {
    result = await request("search/movie", {
      query: film.title,
      include_adult: false,
    });
    const map = new Map([...(result?.results || [])].map((m) => [m.id, m]));
    ranked = rankMatches(film, [...map.values()]);
  }
  if (ranked.match)
    return metadataFromDetails(
      await request(`movie/${ranked.match.id}`, {
        append_to_response: "credits",
      }),
      "exact-title-year",
    );
  return {
    matchStatus: ranked.status,
    candidates: ranked.candidates,
    metadataAt: new Date().toISOString(),
  };
}
/** @param {any[]} films @param {any} request @param {any} options */
export async function enrichFilms(
  films,
  request,
  {
    onFilm = (_key, _metadata) => {},
    onProgress = (_progress) => {},
    signal,
    limit = 250,
    force = false,
  } = {},
) {
  const targets = films
    .filter((f) => force || (!f.tmdbId && !f.metadataAt))
    .slice(0, limit);
  let completed = 0;
  for (const film of targets) {
    if (signal?.aborted) throw new DOMException("Cancelled", "AbortError");
    const metadata = await matchFilm(film, request);
    onFilm(film.key, metadata);
    completed++;
    onProgress({ completed, total: targets.length, title: film.title });
  }
  return {
    completed,
    remaining: Math.max(
      0,
      films.filter((f) => !f.tmdbId && !f.metadataAt).length - completed,
    ),
  };
}
