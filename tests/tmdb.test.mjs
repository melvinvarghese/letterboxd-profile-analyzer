import test from "node:test";
import assert from "node:assert/strict";
import {
  rankMatches,
  createTMDBClient,
  matchFilm,
  metadataFromDetails,
  enrichFilms,
  posterURL,
} from "../lib/tmdb.mjs";
const movie = {
  id: 1,
  title: "A Film",
  original_title: "映画",
  release_date: "2000-01-01",
  vote_average: 8,
  vote_count: 200,
  poster_path: "/abc.jpg",
  runtime: 100,
  genres: [{ name: "Drama" }],
  production_countries: [{ name: "Japan" }],
  original_language: "ja",
  credits: {
    crew: [
      { name: "Director A", job: "Director" },
      { name: "Writer", job: "Writer" },
    ],
    cast: Array.from({ length: 15 }, (_, i) => ({ name: "Actor " + i })),
  },
};
test("matching accepts a unique exact normalized or original title and release year", () => {
  assert.equal(rankMatches({ title: "映画", year: 2000 }, [movie]).match.id, 1);
  assert.equal(
    rankMatches({ title: "A Film", year: 2000 }, [
      movie,
      { ...movie, id: 2, release_date: "2010-01-01" },
    ]).match.id,
    1,
  );
  assert.equal(
    rankMatches({ title: "A Film", year: 2000 }, [
      { ...movie, release_date: "1999-01-01" },
    ]).status,
    "review",
  );
});
test("same-title remakes, missing years and duplicate candidates require manual review", () => {
  for (const film of [
    { title: "A Film", year: null },
    { title: "Other", year: 2000 },
  ])
    assert.equal(rankMatches(film, [movie]).match, null);
  assert.equal(
    rankMatches({ title: "A Film", year: 2000 }, [movie, { ...movie, id: 2 }])
      .match,
    null,
  );
  assert.equal(
    rankMatches({ title: "A Film", year: 2000 }, []).status,
    "not-found",
  );
});
test("provided TMDB and IMDb identifiers bypass fragile title search", async () => {
  const paths = [];
  const req = async (path) => {
    paths.push(path);
    return path.startsWith("find/") ? { movie_results: [{ id: 1 }] } : movie;
  };
  assert.equal((await matchFilm({ sourceTmdbId: 1 }, req)).tmdbId, 1);
  assert.equal(paths[0], "movie/1");
  paths.length = 0;
  assert.equal(
    (await matchFilm({ imdbId: "tt0000001" }, req)).tmdbMatchConfidence,
    "provided-imdb-id",
  );
  assert.deepEqual(paths, ["find/tt0000001", "movie/1"]);
});
test("failed year-constrained search retries unconstrained but never guesses an uncertain match", async () => {
  const calls = [];
  const req = async (path, params) => {
    calls.push([path, params]);
    return {
      results: params.year ? [] : [{ ...movie, release_date: "2001-01-01" }],
    };
  };
  const m = await matchFilm({ title: "A Film", year: 2000 }, req);
  assert.equal(m.matchStatus, "review");
  assert.equal(m.tmdbId, undefined);
  assert.equal(calls.length, 2);
});
test("details fetch supplies runtime, original language, directors and first ten cast only", () => {
  const m = metadataFromDetails(movie);
  assert.equal(m.runtime, 100);
  assert.deepEqual(m.directors, ["Director A"]);
  assert.equal(m.cast.length, 10);
  assert.deepEqual(m.languages, ["ja"]);
  assert.equal(m.externalRating, 8);
  assert.equal(m.posterUrl, "https://image.tmdb.org/t/p/w342/abc.jpg");
  assert.equal(
    metadataFromDetails({ ...movie, vote_count: 0, vote_average: 0 })
      .externalRating,
    null,
  );
  assert.throws(() => metadataFromDetails(null), /invalid/);
  assert.equal(posterURL("/../evil.svg"), null);
});
test("API requests use session credentials and a bearer token stays out of the URL", async () => {
  const requests = [];
  const req = createTMDBClient("personal-read-token", {
    fetcher: async (url, opts) => {
      requests.push({ url, opts });
      return new Response("{}");
    },
    pause: async () => {},
  });
  await req("search/movie", { query: "A & B", year: 2000 });
  assert.ok(!requests[0].url.includes("personal-read-token"));
  assert.equal(
    requests[0].opts.headers.Authorization,
    "Bearer personal-read-token",
  );
  assert.equal(new URL(requests[0].url).searchParams.get("query"), "A & B");
});
test("API v3 key is sent to TMDB only, with no other personal data", async () => {
  const key = "a".repeat(32);
  const req = createTMDBClient(key, {
    fetcher: async (url) => {
      assert.equal(new URL(url).origin, "https://api.themoviedb.org");
      assert.equal(new URL(url).searchParams.get("api_key"), key);
      return new Response("{}");
    },
    pause: async () => {},
  });
  await req("search/movie", { query: "Title", year: 2000 });
});
test("401/403 fail clearly without retries or credential disclosure", async () => {
  let calls = 0;
  const req = createTMDBClient("private", {
    fetcher: async () => {
      calls++;
      return new Response("{}", { status: 401 });
    },
    pause: async () => {},
  });
  await assert.rejects(
    () => req("search/movie"),
    (e) => e.message.includes("rejected") && !e.message.includes("private"),
  );
  assert.equal(calls, 1);
});
test("429 Retry-After is respected and retries are bounded", async () => {
  let calls = 0;
  const pauses = [];
  const req = createTMDBClient("private", {
    fetcher: async () => {
      calls++;
      return new Response("{}", {
        status: calls === 1 ? 429 : 200,
        headers: { "Retry-After": "3" },
      });
    },
    pause: async (ms) => pauses.push(ms),
  });
  await req("search/movie");
  assert.equal(calls, 2);
  assert.ok(pauses.includes(3000));
  const broken = createTMDBClient("private", {
    fetcher: async () => new Response("{}", { status: 503 }),
    pause: async () => {},
  });
  await assert.rejects(() => broken("movie/1"), /temporarily unavailable/);
});
test("network errors retry then recover or fail with a helpful message", async () => {
  let calls = 0;
  const req = createTMDBClient("private", {
    fetcher: async () => {
      calls++;
      if (calls < 2) throw new Error("offline");
      return new Response("{}");
    },
    pause: async () => {},
  });
  await req("movie/1");
  assert.equal(calls, 2);
  const bad = createTMDBClient("private", {
    fetcher: async () => {
      throw new Error("offline");
    },
    pause: async () => {},
  });
  await assert.rejects(() => bad("movie/1"), /could not be reached/);
});
test("batch caching, bounded work and cancellation retain completed metadata", async () => {
  const completed = [],
    progress = [],
    controller = new AbortController();
  const films = [
    { key: "cached", tmdbId: 123 },
    { key: "checked", metadataAt: "2025-01-01" },
    { key: "a", sourceTmdbId: 1 },
    { key: "b", sourceTmdbId: 1 },
  ];
  const res = await enrichFilms(films, async () => movie, {
    limit: 1,
    onFilm: (key, m) => completed.push([key, m]),
    onProgress: (p) => progress.push(p),
  });
  assert.equal(res.completed, 1);
  assert.equal(completed[0][0], "a");
  assert.equal(res.remaining, 1);
  await assert.rejects(
    () =>
      enrichFilms(films, async () => movie, {
        signal: controller.signal,
        onFilm: () => controller.abort(),
      }),
    (e) => e.name === "AbortError",
  );
});

test("unreadable successful API responses produce a recovery message", async () => {
  const request = createTMDBClient("private", {
    fetcher: async () => new Response("not-json"),
    pause: async () => {},
  });
  await assert.rejects(() => request("movie/1"), /unreadable response/);
});
