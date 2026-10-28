import test from "node:test";
import assert from "node:assert/strict";
import * as analytics from "../lib/analytics.mjs";
const {
  parseCSV,
  normalizeRows,
  mergeDatasets,
  analyze,
  compareProfiles,
  classifyFile,
  parseDate,
} = analytics;

test("CSV handles quoted commas, escaped quotes, and multiline cells", () => {
  const r = parseCSV(
    'Name,Year,Review\r\n"Film, One",2001,"It said ""great""\nand left."\r\n',
  );
  assert.equal(r[0].Name, "Film, One");
  assert.equal(r[0].Review, 'It said "great"\nand left.');
});
test("classifies Letterboxd export files", () => {
  assert.equal(classifyFile("diary.csv"), "diary");
  assert.equal(classifyFile("watchlist.csv"), "watchlist");
  assert.equal(classifyFile("watched.csv"), "watched");
  assert.equal(classifyFile("lists.csv"), "other");
});
test("normalizes diary Watched Date and rejects invalid ratings", () => {
  const rows = normalizeRows(
    parseCSV("Name,Year,Rating,Watched Date\nA,2000,6,2020-02-03\nB,2001,,\n"),
    "diary",
  );
  assert.equal(rows[0].date, "2020-02-03");
  assert.equal(rows[0].rating, null);
  assert.equal(rows[1].rating, null);
  assert.equal(parseDate(""), null);
});
test("separates watchlist from watched films and merges rating/diary rows", () => {
  const d = mergeDatasets([
    {
      name: "diary.csv",
      type: "diary",
      rows: parseCSV(
        "Name,Year,Rating,Watched Date,Rewatch\nFilm A,2000,4,2020-01-01,Yes\nFilm A,2000,4,2021-01-01,No\n",
      ),
    },
    {
      name: "ratings.csv",
      type: "ratings",
      rows: parseCSV("Name,Year,Rating\nFilm A,2000,4.5\nFilm B,2010,3\n"),
    },
    {
      name: "watchlist.csv",
      type: "watchlist",
      rows: parseCSV("Name,Year\nUnseen Film,2024\n"),
    },
  ]);
  assert.equal(d.films.length, 2);
  assert.equal(d.films.find((f) => f.title === "Film A").rating, 4.5);
  assert.equal(d.films.find((f) => f.title === "Film A").entryCount, 2);
  assert.equal(d.watchlist.length, 1);
  assert.equal(
    d.films.some((f) => f.title === "Unseen Film"),
    false,
  );
});
test("statistics calculate mean, median, rating counts and coverage", () => {
  const d = mergeDatasets([
    {
      type: "diary",
      name: "diary.csv",
      rows: parseCSV(
        "Name,Year,Rating,Watched Date\nA,1999,5,2022-01-01\nB,2001,3,2022-01-02\nC,2010,,\n",
      ),
    },
  ]);
  const s = analyze(d).stats;
  assert.equal(s.uniqueFilms, 3);
  assert.equal(s.ratedFilms, 2);
  assert.equal(s.average, 4);
  assert.equal(s.median, 4);
  assert.equal(s.mostWatchedYear, "2022");
});
test("generic_dates_do_not_create_diary_years", () => {
  const d = mergeDatasets([
    {
      name: "watched.csv",
      type: "watched",
      rows: parseCSV("Name,Year,Date\nWatched film,2000,2020-01-01\n"),
    },
    {
      name: "ratings.csv",
      type: "ratings",
      rows: parseCSV("Name,Year,Rating,Date\nRated film,2001,4,2020-01-01\n"),
    },
    {
      name: "diary.csv",
      type: "diary",
      rows: parseCSV(
        "Name,Year,Date,Watched Date\nDated diary film,2002,2020-02-01,2021-03-04\nUndated diary film,2003,2020-02-01,\n",
      ),
    },
  ]);
  const stats = analyze(d).stats;
  assert.equal(d.films.length, 4);
  assert.equal(d.films.find((f) => f.title === "Watched film").date, null);
  assert.equal(d.films.find((f) => f.title === "Rated film").date, null);
  assert.equal(
    d.films.find((f) => f.title === "Dated diary film").date,
    "2021-03-04",
  );
  assert.equal(
    d.films.find((f) => f.title === "Undated diary film").date,
    null,
  );
  assert.equal(stats.diaryEntries, 2);
  assert.deepEqual(stats.yearCounts, [{ name: "2021", count: 1 }]);
  assert.equal(stats.firstDiaryDate, "2021-03-04");
  assert.equal(stats.lastDiaryDate, "2021-03-04");
});
test("missing_or_invalid_watched_date_stays_undated", () => {
  const d = mergeDatasets([
    {
      name: "diary.csv",
      type: "diary",
      rows: parseCSV(
        "Name,Year,Date,Watched Date\nBlank date film,2000,2020-01-01,\nImpossible date film,2001,2020-01-02,2021-02-30\n",
      ),
    },
  ]);
  assert.equal(d.diary.length, 2);
  assert.deepEqual(
    d.diary.map((f) => f.date),
    [null, null],
  );
  assert.equal(d.films.length, 2);
  assert.equal(parseDate("2021-02-30"), null);
  assert.equal(parseDate("2020-02-29"), "2020-02-29");
});
test("parseDate rejects impossible components before native date rollover", () => {
  assert.deepEqual(
    [
      "2021-02-30T00:00:00Z",
      "2/30/2021",
      "2021/02/30",
      "February 30, 2021",
    ].map(parseDate),
    [null, null, null, null],
  );
});
test("parseDate preserves the calendar day for slash-form dates", () => {
  assert.equal(parseDate("2/28/2021"), "2021-02-28");
});
test("repeated_diary_rows_count_by_event_year", () => {
  const d = mergeDatasets([
    {
      name: "diary.csv",
      type: "diary",
      rows: parseCSV(
        "Name,Year,Watched Date\nRepeated film,2000,2021-02-03\nRepeated film,2000,2022-03-04\n",
      ),
    },
  ]);
  const stats = analyze(d).stats;
  assert.equal(stats.uniqueFilms, 1);
  assert.equal(stats.diaryEntries, 2);
  assert.deepEqual(stats.yearCounts, [
    { name: "2021", count: 1 },
    { name: "2022", count: 1 },
  ]);
  assert.deepEqual(analytics.diaryYearCounts(d.diary), [
    { year: "2021", count: 1 },
    { year: "2022", count: 1 },
  ]);
  assert.equal(stats.firstDiaryDate, "2021-02-03");
  assert.equal(stats.lastDiaryDate, "2022-03-04");
});
test("diary year events are sorted chronologically", () => {
  assert.deepEqual(
    analytics.diaryYearCounts([
      { date: "2022-01-01" },
      { date: null },
      { date: "2020-02-01" },
      { date: "2022-03-01" },
    ]),
    [
      { year: "2020", count: 1 },
      { year: "2022", count: 2 },
    ],
  );
});
test("comparison suppresses correlation below three shared rated films", () => {
  const a = {
      films: [{ normalizedTitle: "a", year: 2000, rating: 5 }],
      diary: [],
    },
    b = { films: [{ normalizedTitle: "a", year: 2000, rating: 4 }], diary: [] };
  assert.equal(compareProfiles(a, b).ratingCorrelation, null);
});

test("comparison_profiles_are_built_independently", () => {
  assert.equal(typeof analytics.buildComparisonProfile, "function");
  const profileA = analytics.buildComparisonProfile(
    [
      {
        name: "ratings.csv",
        type: "ratings",
        rows: [
          {
            Name: "Film A",
            Year: "2000",
            Rating: "4",
            Review: "private review text",
            "Letterboxd URI": "private://film-a",
            PrivateField: "private marker",
          },
        ],
      },
      {
        name: "reviews.csv",
        type: "reviews",
        rows: [
          {
            Name: "Film Review",
            Year: "2004",
            Rating: "3",
            Review: "another private review",
            URL: "private://film-review",
          },
        ],
      },
      {
        name: "watchlist.csv",
        type: "watchlist",
        rows: [{ Name: "Watchlist Ghost", Year: "2025" }],
      },
      {
        name: "other.csv",
        type: "other",
        rows: [{ Name: "Unsupported Ghost", Year: "2026", Rating: "5" }],
      },
    ],
    "  Alice  ",
  );
  const profileB = analytics.buildComparisonProfile(
    [
      {
        name: "watched.csv",
        type: "watched",
        rows: [{ Name: "Film B", Year: "2010" }],
      },
    ],
    "Bob",
  );
  assert.deepEqual(profileA, {
    username: "Alice",
    films: [
      { title: "Film A", normalizedTitle: "film a", year: 2000, rating: 4 },
      {
        title: "Film Review",
        normalizedTitle: "film review",
        year: 2004,
        rating: 3,
      },
    ],
    diary: [],
  });
  assert.deepEqual(profileB, {
    username: "Bob",
    films: [
      { title: "Film B", normalizedTitle: "film b", year: 2010, rating: null },
    ],
    diary: [],
  });
  assert.equal(JSON.stringify(profileA).includes("private"), false);
  assert.equal(JSON.stringify(profileA).includes("Watchlist Ghost"), false);
  assert.equal(JSON.stringify(profileA).includes("Unsupported Ghost"), false);
});

test("comparison_matches_normalized_title_and_exact_year", () => {
  const profileA = {
    username: "A",
    films: [
      {
        title: "Amélie: Le Film!",
        normalizedTitle: "amelie le film",
        year: 2001,
        rating: 4,
      },
      {
        title: "Same Movie",
        normalizedTitle: "same movie",
        year: 2000,
        rating: null,
      },
      {
        title: "Unknown Pair",
        normalizedTitle: "unknown pair",
        year: null,
        rating: 3,
      },
      {
        title: "Yearless",
        normalizedTitle: "yearless",
        year: null,
        rating: null,
      },
      { title: "A Only", normalizedTitle: "a only", year: 1990, rating: 2 },
    ],
    diary: [],
  };
  const profileB = {
    username: "B",
    films: [
      {
        title: "AMELIE — LE FILM",
        normalizedTitle: "amelie le film",
        year: 2001,
        rating: 5,
      },
      {
        title: "Same Movie",
        normalizedTitle: "same movie",
        year: 2001,
        rating: 4,
      },
      {
        title: "Unknown Pair",
        normalizedTitle: "unknown pair",
        year: null,
        rating: 3,
      },
      { title: "Yearless", normalizedTitle: "yearless", year: 1999, rating: 2 },
      { title: "B Only", normalizedTitle: "b only", year: 1995, rating: 1 },
    ],
    diary: [],
  };
  const result = compareProfiles(profileA, profileB);
  assert.equal(
    Array.isArray(result.sharedFilms),
    true,
    "shared films must be returned as records",
  );
  assert.equal(
    Array.isArray(result.uniqueToA),
    true,
    "A-only films must be returned as records",
  );
  assert.equal(
    Array.isArray(result.uniqueToB),
    true,
    "B-only films must be returned as records",
  );
  assert.deepEqual(
    result.sharedFilms.map(({ title, year }) => ({ title, year })),
    [
      { title: "Amélie: Le Film!", year: 2001 },
      { title: "Unknown Pair", year: null },
    ],
  );
  assert.deepEqual(
    result.uniqueToA.map(({ title, year }) => ({ title, year })),
    [
      { title: "Same Movie", year: 2000 },
      { title: "Yearless", year: null },
      { title: "A Only", year: 1990 },
    ],
  );
  assert.deepEqual(
    result.uniqueToB.map(({ title, year }) => ({ title, year })),
    [
      { title: "Same Movie", year: 2001 },
      { title: "Yearless", year: 1999 },
      { title: "B Only", year: 1995 },
    ],
  );
});

test("comparison_rating_difference_is_a_minus_b_and_missing_rating_is_null", () => {
  const profileA = analytics.buildComparisonProfile(
    [
      {
        name: "ratings.csv",
        type: "ratings",
        rows: [
          { Name: "Rated Film", Year: "2000", Rating: "4" },
          { Name: "Missing Rating Film", Year: "2001", Rating: "" },
        ],
      },
    ],
    "A",
  );
  const profileB = analytics.buildComparisonProfile(
    [
      {
        name: "ratings.csv",
        type: "ratings",
        rows: [
          { Name: "Rated Film", Year: "2000", Rating: "3" },
          { Name: "Missing Rating Film", Year: "2001", Rating: "4.5" },
        ],
      },
    ],
    "B",
  );
  const result = compareProfiles(profileA, profileB);
  assert.deepEqual(
    result.sharedFilms.map(({ title, year, a, b, ratingDifference }) => ({
      title,
      year,
      a,
      b,
      ratingDifference,
    })),
    [
      {
        title: "Rated Film",
        year: 2000,
        a: { rating: 4, diaryDates: [] },
        b: { rating: 3, diaryDates: [] },
        ratingDifference: 1,
      },
      {
        title: "Missing Rating Film",
        year: 2001,
        a: { rating: null, diaryDates: [] },
        b: { rating: 4.5, diaryDates: [] },
        ratingDifference: null,
      },
    ],
  );
});

test("comparison_correlation_requires_three_shared_ratings_and_rejects_zero_variance", () => {
  const profileFrom = (username, ratings) =>
    analytics.buildComparisonProfile(
      [
        {
          name: "ratings.csv",
          type: "ratings",
          rows: ratings.map(([Name, Rating]) => ({
            Name,
            Year: "2000",
            Rating: String(Rating),
          })),
        },
      ],
      username,
    );
  const two = compareProfiles(
    profileFrom("A", [
      ["One", 4],
      ["Two", 2],
    ]),
    profileFrom("B", [
      ["One", 1],
      ["Two", 5],
    ]),
  );
  assert.equal(two.sharedRatedFilms, 2);
  assert.equal(two.ratingCorrelation, null);
  assert.deepEqual(
    two.sharedFilms.map(({ a, b }) => [a?.rating, b?.rating]),
    [
      [4, 1],
      [2, 5],
    ],
  );
  const correlated = compareProfiles(
    profileFrom("A", [
      ["One", 1],
      ["Two", 2],
      ["Three", 3],
    ]),
    profileFrom("B", [
      ["One", 2],
      ["Two", 3],
      ["Three", 4],
    ]),
  );
  assert.equal(correlated.sharedRatedFilms, 3);
  assert.ok(Math.abs(correlated.ratingCorrelation - 1) < 1e-12);
  const zeroVarianceA = compareProfiles(
    profileFrom("A", [
      ["One", 3],
      ["Two", 3],
      ["Three", 3],
    ]),
    profileFrom("B", [
      ["One", 2],
      ["Two", 3],
      ["Three", 4],
    ]),
  );
  const zeroVarianceB = compareProfiles(
    profileFrom("A", [
      ["One", 1],
      ["Two", 2],
      ["Three", 3],
    ]),
    profileFrom("B", [
      ["One", 4],
      ["Two", 4],
      ["Three", 4],
    ]),
  );
  assert.equal(zeroVarianceA.ratingCorrelation, null);
  assert.equal(zeroVarianceB.ratingCorrelation, null);
});

test("genre analysis counts only TMDB-matched films and averages imported ratings", () => {
  const result = analyze({
    films: [
      {
        title: "Action Drama",
        tmdbId: 101,
        genres: ["Action", "Drama"],
        rating: 4,
      },
      {
        title: "Unrated Action",
        tmdbId: 102,
        genres: ["Action"],
        rating: null,
      },
      {
        title: "Action Horror",
        tmdbId: 103,
        genres: ["Action", "Horror"],
        rating: 2.5,
      },
      { title: "Unmatched Drama", genres: ["Drama"], rating: 5 },
      {
        title: "TMDB match without genres",
        tmdbId: 104,
        genres: [],
        rating: 1,
      },
    ],
  });
  assert.deepEqual(result.genreAnalysis, [
    { name: "Action", matchedFilms: 3, ratedFilms: 2, averageRating: 3.25 },
    { name: "Drama", matchedFilms: 1, ratedFilms: 1, averageRating: 4 },
    { name: "Horror", matchedFilms: 1, ratedFilms: 1, averageRating: 2.5 },
  ]);
  assert.equal(result.stats.average, 3.125);
});

test("comparison_diary_dates_use_watched_date_and_preserve_repeats", () => {
  const profileA = analytics.buildComparisonProfile(
    [
      {
        name: "diary.csv",
        type: "diary",
        rows: [
          {
            Name: "Common Film",
            Year: "2000",
            Date: "2019-01-01",
            "Watched Date": "2020-01-02",
          },
          {
            Name: "Common Film",
            Year: "2000",
            Date: "2019-01-01",
            "Watched Date": "2020-01-02",
          },
          {
            Name: "Common Film",
            Year: "2000",
            Date: "2019-02-02",
            "Watched Date": "",
          },
          {
            Name: "Common Film",
            Year: "2000",
            Date: "2019-03-03",
            "Watched Date": "2021-02-30",
          },
          { Name: "A Diary Only", Year: "2005", "Watched Date": "2022-04-05" },
        ],
      },
    ],
    "A",
  );
  const profileB = analytics.buildComparisonProfile(
    [
      {
        name: "diary.csv",
        type: "diary",
        rows: [
          {
            Name: "Common Film",
            Year: "2000",
            Date: "2018-01-01",
            "Watched Date": "2021-06-07",
          },
          {
            Name: "Common Film",
            Year: "2000",
            Date: "2018-02-02",
            "Watched Date": "",
          },
          { Name: "B Diary Only", Year: "2010", "Watched Date": "2023-08-09" },
        ],
      },
    ],
    "B",
  );
  const result = compareProfiles(profileA, profileB);
  assert.deepEqual(
    result.sharedFilms.map(({ title, a, b, ratingDifference }) => ({
      title,
      a,
      b,
      ratingDifference,
    })),
    [
      {
        title: "Common Film",
        a: { rating: null, diaryDates: ["2020-01-02", "2020-01-02"] },
        b: { rating: null, diaryDates: ["2021-06-07"] },
        ratingDifference: null,
      },
    ],
  );
  assert.deepEqual(result.uniqueToA, [
    {
      title: "A Diary Only",
      year: 2005,
      rating: null,
      diaryDates: ["2022-04-05"],
    },
  ]);
  assert.deepEqual(result.uniqueToB, [
    {
      title: "B Diary Only",
      year: 2010,
      rating: null,
      diaryDates: ["2023-08-09"],
    },
  ]);
});
