import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { zipSync, strToU8 } from "fflate";
import {
  parseCSV,
  parseCSVWithDiagnostics,
  parseDate,
  normalize,
  mergeDatasets,
  filterDataset,
  analyze,
  sortFilms,
  groupFilms,
  prioritizeWatchlist,
  comparePeriods,
  canonicalFilmURL,
  ratingHeatmap,
} from "../lib/analytics.mjs";
import {
  importSources,
  extractArchive,
  validateZipArchive,
} from "../lib/import.mjs";
import {
  makeSnapshot,
  readSnapshot,
  filmsCSV,
  reportSVG,
  describeFilters,
} from "../lib/export.mjs";
const source = (name, text) => ({ name, bytes: strToU8(text) });
const files = await Promise.all(
  ["watched", "ratings", "diary", "watchlist"].map(async (n) => ({
    name: n + ".csv",
    bytes: new Uint8Array(
      await readFile(new URL("./fixtures/" + n + ".csv", import.meta.url)),
    ),
  })),
);
const fixture = (await importSources(files)).data;
test("synthetic fixture metrics, timelines, ties and runtime coverage match known results", () => {
  const r = analyze(fixture);
  assert.equal(r.stats.uniqueFilms, 8);
  assert.equal(r.stats.diaryEntries, 9);
  assert.equal(r.stats.ratedFilms, 7);
  assert.equal(r.stats.average, 26 / 7);
  assert.deepEqual(r.stats.mode, [4]);
  assert.equal(r.stats.rewatches, 1);
  assert.equal(r.activity.dated, 7);
  assert.equal(r.activity.undated, 2);
  assert.equal(r.activity.streak.days, 4);
  assert.equal(r.activity.streak.start, "2024-12-31");
  assert.equal(r.activity.streak.end, "2025-01-03");
  assert.equal(r.stats.runtimeMinutes, 0);
  assert.equal(
    r.stats.ratingDistribution.reduce((n, b) => n + b.count, 0),
    7,
  );
  assert.deepEqual(
    r.activity.years.map((y) => [y.name, y.count]),
    [
      ["2024", 4],
      ["2025", 3],
    ],
  );
});
test("Unicode film identities remain distinct in the same release year", () => {
  assert.equal(normalize("東京物語"), "東京物語");
  const d = mergeDatasets([
    {
      type: "watched",
      name: "watched.csv",
      rows: [
        { Name: "東京物語", Year: "2000" },
        { Name: "千と千尋の神隠し", Year: "2000" },
      ],
    },
  ]);
  assert.equal(d.films.length, 2);
  assert.equal(normalize("Été"), "ete");
});
test("invalid half-star ratings are retained as unrated with diagnostics", () => {
  const d = mergeDatasets([
    {
      name: "ratings.csv",
      type: "ratings",
      rows: parseCSV("Name,Rating\nA,3.7\nB,0\nC,6\nD,NaN\nE,4.5"),
    },
  ]);
  assert.deepEqual(
    d.films.map((f) => f.rating),
    [null, null, null, null, 4.5],
  );
  assert.equal(d.importReport[0].issues.length, 4);
  assert.equal(analyze(d).stats.average, 4.5);
});
test("CSV validation handles BOM, quotes, Unicode, newlines, header aliases and errors", () => {
  const r = parseCSVWithDiagnostics(
    '\uFEFF name , release year , your rating , WatchedDate\r\n"Été, \"\"one\"\"\nfin",2000,4,2024-02-29\r\nBad,2000,4,2024-01-01,extra\r\nShort,2001\r\n',
  );
  assert.equal(r.sourceRows, 3);
  assert.equal(r.rows.length, 2);
  assert.equal(r.issues.length, 2);
  const d = mergeDatasets([{ name: "diary.csv", type: "diary", ...r }]);
  assert.equal(d.films[0].date, "2024-02-29");
  assert.match(d.films[0].title, /Été,/);
  assert.throws(() => parseCSV("Name,Name\nA,B"), /duplicate/);
  assert.throws(() => parseCSV('Name,Year\n"unfinished,2000'), /unclosed/);
  assert.throws(() => parseCSV('Name,Year\n"Done"oops,2000'), /closing quote/);
});
test("a missing title and malformed row are reported rather than silently counted", async () => {
  const { data } = await importSources([
    source("watched.csv", "Name,Year\nA,2000\n,2001\nToo,Many,Cells\n"),
  ]);
  assert.equal(data.films.length, 1);
  assert.equal(data.importReport[0].sourceRows, 3);
  assert.equal(data.importReport[0].acceptedRows, 1);
  assert.equal(data.importReport[0].skippedRows, 2);
});
test("invalid dates, ambiguous formats and timezone-bearing strings do not shift the calendar", () => {
  assert.equal(parseDate("2024-02-29"), "2024-02-29");
  assert.equal(parseDate("2025-02-29"), null);
  assert.equal(parseDate("2024-12-31T23:30:00-08:00"), "2024-12-31");
  assert.equal(parseDate("31/12/2024"), null);
  assert.equal(parseDate("2/29/2024"), "2024-02-29");
  assert.equal(parseDate("0-01-01"), null);
});
test("duplicate watched records coalesce while identical diary events remain with a warning", () => {
  const rows = [
    { Name: "Same", Year: "2000", "Watched Date": "2024-01-01" },
    { Name: "Same", Year: "2000", "Watched Date": "2024-01-01" },
  ];
  const d = mergeDatasets([
    { type: "watched", name: "watched.csv", rows },
    { type: "diary", name: "diary.csv", rows },
  ]);
  assert.equal(d.films.length, 1);
  assert.equal(d.diary.length, 2);
  assert.equal(d.films[0].entryCount, 2);
  assert.ok(
    d.importReport.every((r) =>
      r.issues.some((i) => i.reason.includes("identical")),
    ),
  );
});
test("stable links merge renamed titles and disambiguate films sharing a title/year", () => {
  const d = mergeDatasets([
    {
      type: "watched",
      name: "watched.csv",
      rows: [
        {
          Name: "Title",
          Year: "2000",
          "Letterboxd URI": "https://letterboxd.com/film/a/",
        },
        {
          Name: "Title",
          Year: "2000",
          "Letterboxd URI": "https://letterboxd.com/film/b/",
        },
      ],
    },
    {
      type: "ratings",
      name: "ratings.csv",
      rows: [
        {
          Name: "New title",
          Year: "2000",
          Rating: "4",
          "Letterboxd URI": "https://letterboxd.com/name/film/a/1/",
        },
      ],
    },
  ]);
  assert.equal(d.films.length, 2);
  assert.equal(d.films[0].rating, 4);
  assert.equal(canonicalFilmURL("javascript:alert(1)"), "");
  assert.equal(
    canonicalFilmURL("https://letterboxd.com.evil.test/film/a/"),
    "",
  );
});
test("rating precedence is independent of input-file order and respects export dates", () => {
  const ratings = {
      type: "ratings",
      name: "ratings.csv",
      rows: [
        { Name: "A", Rating: "5", Date: "2023-01-01" },
        { Name: "A", Rating: "2", Date: "2022-01-01" },
      ],
    },
    diary = {
      type: "diary",
      name: "diary.csv",
      rows: [{ Name: "A", Rating: "1", "Watched Date": "2025-01-01" }],
    };
  assert.equal(mergeDatasets([ratings, diary]).films[0].rating, 5);
  assert.equal(mergeDatasets([diary, ratings]).films[0].rating, 5);
});
test("global filters intersect correctly and do not mutate the dataset", () => {
  assert.equal(filterDataset(fixture, { year: "2024" }).films.length, 3);
  assert.equal(filterDataset(fixture, { year: "2024" }).diary.length, 4);
  assert.equal(
    filterDataset(fixture, { from: "2024-12-31", to: "2025-01-02" }).films
      .length,
    3,
  );
  assert.equal(
    filterDataset(fixture, { from: "2025-01-02", to: "2025-01-01" }).films
      .length,
    0,
  );
  assert.equal(
    filterDataset(fixture, { rating: "4", year: "2024" }).films.length,
    1,
  );
  assert.equal(filterDataset(fixture, { search: "東京" }).films.length, 1);
  assert.equal(filterDataset(fixture, { decade: "1950" }).films.length, 2);
  assert.equal(fixture.films.length, 8);
  assert.equal(sortFilms(fixture.films, "rating-asc").at(-1).rating, null);
});
test("watchlist overlap uses identity including release year; suggestions expose evidence", () => {
  assert.equal(prioritizeWatchlist(fixture).length, 2);
  const d = {
    ...fixture,
    films: fixture.films.map((f) => ({ ...f, tmdbId: 1, genres: ["Drama"] })),
    watchlist: fixture.watchlist.map((f) => ({ ...f, genres: ["Drama"] })),
  };
  assert.ok(prioritizeWatchlist(d).every((f) => f.score === null));
  const d2 = {
    films: [1, 2, 3]
      .map((i) => ({
        key: "a" + i,
        title: "A" + i,
        year: 2000,
        rating: 5,
        genres: ["Drama"],
        tmdbId: i,
      }))
      .concat([
        {
          key: "low",
          title: "Low",
          year: 1999,
          rating: 1,
          genres: ["Horror"],
          tmdbId: 10,
        },
      ]),
    watchlist: [{ key: "pick", title: "Pick", genres: ["Drama"], year: 2000 }],
  };
  const pick = prioritizeWatchlist(d2)[0];
  assert.ok(pick.score > 0);
  assert.match(pick.reason, /3 films/);
});
test("genre/people rankings count unique films and exclude missing ratings from means", () => {
  const d = {
    films: [
      {
        key: "a",
        tmdbId: 1,
        rating: 4,
        genres: ["Drama", "Drama"],
        directors: ["A"],
        runtime: 100,
      },
      {
        key: "b",
        tmdbId: 2,
        rating: null,
        genres: ["Drama"],
        directors: ["A"],
        runtime: 0,
      },
    ],
    diary: [
      { key: "a", date: "2024-01-01" },
      { key: "a", date: "2024-01-02" },
    ],
  };
  const r = analyze(d);
  assert.equal(r.genres[0].count, 2);
  assert.equal(r.genres[0].rated, 1);
  assert.equal(r.genres[0].average, 4);
  assert.equal(r.stats.runtimeMinutes, 100);
  assert.equal(r.stats.runtimeEventMinutes, 200);
  assert.equal(r.stats.runtimeEventCount, 2);
});
test("all tied busiest years and rating modes are disclosed", () => {
  const d = mergeDatasets([
    {
      name: "diary.csv",
      type: "diary",
      rows: [
        { Name: "A", Rating: "4", "Watched Date": "2024-01-01" },
        { Name: "B", Rating: "5", "Watched Date": "2025-01-01" },
      ],
    },
  ]);
  const r = analyze(d);
  assert.deepEqual(r.stats.mode, [4, 5]);
  assert.equal(r.stats.mostActiveYears.length, 2);
  assert.match(r.insights[1].detail, /2024, 2025/);
});
test("year comparison uses events, not release years or Date values", () => {
  const [a, b] = comparePeriods(fixture, "2024", "2025");
  assert.equal(a.diaryEntries, 4);
  assert.equal(a.uniqueFilms, 3);
  assert.equal(b.diaryEntries, 3);
  assert.equal(b.ratedFilms, 3);
  assert.equal(a.months.length, 12);
  assert.equal(
    a.months.reduce((s, m) => s + m.count, 0),
    4,
  );
});
test("ZIP extraction reads only active canonical CSVs and a single wrapper folder", async () => {
  for (const prefix of ["", "letterboxd-export/"]) {
    const entries = Object.fromEntries(
      files.map((f) => [prefix + f.name, f.bytes]),
    );
    entries[prefix + "deleted/diary.csv"] = strToU8("Name\nDeleted");
    entries[prefix + "profile.csv"] = strToU8(
      "Username,Email,Bio\nfixture-user,private@example.test,SECRET",
    );
    const r = await importSources([
      { name: "export.zip", bytes: zipSync(entries) },
    ]);
    assert.equal(r.data.films.length, 8);
    assert.equal(r.username, "fixture-user");
    assert.ok(r.skippedPaths.some((p) => p.includes("deleted")));
    assert.ok(!JSON.stringify(r).includes("private@example.test"));
    assert.ok(!JSON.stringify(r).includes("SECRET"));
  }
});
test("ZIP safety rejects traversal, bad checksums, invalid directories and duplicate datasets", async () => {
  assert.throws(() => extractArchive(strToU8("Not a ZIP")), /damaged/);
  assert.throws(
    () => extractArchive(zipSync({ "../watched.csv": strToU8("Name\nA") })),
    /Unsafe/,
  );
  const zip = zipSync({ "watched.csv": strToU8("Name\nA") }, { level: 0 });
  const damaged = new Uint8Array(zip);
  damaged[42] ^= 1;
  assert.throws(() => extractArchive(damaged), /checksum|disagree|damaged/);
  await assert.rejects(
    () =>
      importSources([source("a.zip", ""), source("watched.csv", "Name\nA")]),
    /one ZIP/,
  );
  await assert.rejects(
    () =>
      importSources([
        source("watched.csv", "Name\nA"),
        source("watched.csv", "Name\nB"),
      ]),
    /Multiple/,
  );
});
test("unsupported, empty and malformed inputs fail without producing fake statistics", async () => {
  await assert.rejects(
    () => importSources([source("random.csv", "Name\nA")]),
    /No supported/,
  );
  await assert.rejects(
    () => importSources([source("watched.csv", "Name,Year\n")]),
    /No valid/,
  );
  await assert.rejects(
    () => importSources([source("watched.csv", "Film,Year\nA,2000")]),
    /missing/,
  );
  await assert.rejects(
    () => importSources([source("watched.csv", 'Name\n"bad')]),
    /unclosed/,
  );
  const d = (
    await importSources([source("watchlist.csv", "Name,Year\nA,2000")])
  ).data;
  assert.equal(analyze(d).stats.uniqueFilms, 0);
  assert.equal(d.watchlist.length, 1);
});
test("large datasets maintain exact counts without quadratic runtime joins", (t) => {
  const rows = Array.from({ length: 30000 }, (_, i) => ({
    Name: "Synthetic " + i,
    Year: String(1900 + (i % 120)),
    Rating: String(0.5 + (i % 10) * 0.5),
    "Watched Date": `2024-01-${String(1 + (i % 31)).padStart(2, "0")}`,
  }));
  const start = performance.now();
  const d = mergeDatasets([{ type: "diary", name: "diary.csv", rows }]);
  const r = analyze(d);
  assert.equal(r.stats.uniqueFilms, 30000);
  assert.equal(r.stats.diaryEntries, 30000);
  assert.equal(r.stats.average, 2.75);
  assert.equal(r.activity.dated, 30000);
  t.diagnostic(
    `30,000 rows: ${Math.round(performance.now() - start)} ms on this test host. Timing is reported rather than used as a machine-dependent correctness assertion.`,
  );
});
test("snapshot restores full source data and metadata but no credentials", () => {
  const d = {
    ...fixture,
    credential: "NEVER-SAVE",
    films: fixture.films.map((f) => ({ ...f, tmdbId: 1, genres: ["Drama"] })),
  };
  const snapshot = makeSnapshot(d);
  assert.ok(!JSON.stringify(snapshot).includes("NEVER-SAVE"));
  const restored = readSnapshot(JSON.stringify(snapshot));
  assert.equal(restored.diary.length, 9);
  assert.equal(restored.films.length, 8);
  assert.equal(restored.films[0].tmdbId, 1);
  assert.equal(analyze(restored).stats.average, 26 / 7);
  assert.throws(() => readSnapshot("{}"), /Unsupported/);
  assert.throws(() => readSnapshot("invalid"), /valid JSON/);
});
test("untrusted backup metadata cannot inject external image URLs or executable strings", () => {
  const s = makeSnapshot(fixture),
    key = fixture.films[0].key;
  s.metadata[key] = {
    tmdbId: 1,
    posterUrl: "https://evil.example/pixel",
    genres: ["<script>alert(1)</script>"],
  };
  const d = readSnapshot(s);
  assert.equal(d.films[0].posterUrl, undefined);
  assert.equal(d.films[0].genres[0], "<script>alert(1)</script>");
});
test("CSV export prevents spreadsheet formulas and preserves quotes/Unicode", () => {
  const csv = filmsCSV([
    { title: '=HYPERLINK("evil")', year: 2000 },
    { title: "東京,物語", year: 1953 },
  ]);
  assert.match(csv, /'=HYPERLINK/);
  assert.match(csv, /東京,物語/);
  assert.match(csv, /""evil""/);
});
test("shareable SVG contains computed metrics and escapes imported text", () => {
  const svg = reportSVG({ ...fixture, label: "<script>&" }, "2024");
  assert.ok(svg.startsWith("<svg"));
  assert.match(svg, /&lt;script&gt;&amp;/);
  assert.match(svg, /2024 in cinema/);
  assert.doesNotMatch(svg, /<script>/);
  assert.match(svg, /3.71/);
  const filtered = reportSVG(
    fixture,
    "2024",
    describeFilters({
      year: "2024",
      rating: "4",
      genre: "Drama",
      decade: "2000",
    }),
  );
  for (const text of [
    "Diary year 2024",
    "Personal rating 4 / 5",
    "TMDB genre: Drama",
    "Release decade: 2000s",
  ])
    assert.ok(filtered.includes(text));
});

test("browser File inputs with a native bytes method use arrayBuffer rather than a function value", async () => {
  const file = new File(["Name,Year\nA,2000"], "watched.csv", {
    type: "text/csv",
  });
  assert.equal((await importSources([file])).data.films.length, 1);
});

test("genre-decade matrix withholds small samples and drills into the exact cell film set", () => {
  const films = [1, 2, 3]
    .map((i) => ({
      key: "a" + i,
      title: "A" + i,
      tmdbId: i,
      year: 2000,
      rating: 4,
      genres: ["Drama"],
    }))
    .concat([
      {
        key: "b",
        title: "B",
        tmdbId: 4,
        year: 1999,
        rating: 5,
        genres: ["Drama"],
      },
    ]);
  const heat = ratingHeatmap(films);
  assert.deepEqual(heat.columns, ["1990s", "2000s"]);
  assert.equal(heat.rows[0].cells[0].average, null);
  assert.equal(heat.rows[0].cells[1].average, 4);
  assert.equal(heat.rows[0].cells[1].keys.length, 3);
});

test("backup retains physical source line numbers after multiline fields", async () => {
  const r = await importSources([
    source(
      "diary.csv",
      'Name,Year,Rating,Watched Date\n"A\nB",2000,4,2024-01-01\nBad,2001,3.7,invalid\n',
    ),
  ]);
  const restored = readSnapshot(JSON.stringify(makeSnapshot(r.data)));
  assert.equal(
    restored.importReport[0].issues.find((i) =>
      i.reason.startsWith("Invalid personal"),
    ).row,
    4,
  );
});
