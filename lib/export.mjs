import { mergeDatasets, analyze, validRating } from "./analytics.mjs";
const string = (v) => (typeof v === "string" ? v : "");
const metadataKeys = [
  "tmdbId",
  "tmdbTitle",
  "posterUrl",
  "genres",
  "directors",
  "cast",
  "countries",
  "languages",
  "runtime",
  "releaseDate",
  "externalRating",
  "voteCount",
  "popularity",
  "collection",
  "overview",
  "tmdbMatchConfidence",
  "metadataAt",
  "matchStatus",
  "candidates",
];
export function makeSnapshot(data) {
  const metadata = {};
  for (const f of [...data.films, ...data.watchlist]) {
    const m = Object.fromEntries(
      metadataKeys.filter((k) => f[k] !== undefined).map((k) => [k, f[k]]),
    );
    if (Object.keys(m).length) metadata[f.key] = m;
  }
  return {
    format: "frame-by-frame",
    version: 2,
    createdAt: new Date().toISOString(),
    label: data.label,
    importedAt: data.importedAt,
    files: data.sourceFiles,
    metadata,
    skippedPaths: data.skippedPaths || [],
  };
}
function sanitizeMetadata(raw) {
  if (!raw || typeof raw !== "object") return {};
  const m = {};
  for (const k of [
    "tmdbTitle",
    "releaseDate",
    "collection",
    "overview",
    "tmdbMatchConfidence",
    "metadataAt",
    "matchStatus",
  ])
    if (typeof raw[k] === "string") m[k] = raw[k].slice(0, 20000);
  for (const k of [
    "tmdbId",
    "runtime",
    "externalRating",
    "voteCount",
    "popularity",
  ])
    if (Number.isFinite(raw[k]) && raw[k] >= 0) m[k] = raw[k];
  if (m.tmdbId && (!Number.isSafeInteger(m.tmdbId) || m.tmdbId < 1))
    delete m.tmdbId;
  if (m.externalRating > 10) delete m.externalRating;
  if (m.runtime > 1500) delete m.runtime;
  if (
    typeof raw.posterUrl === "string" &&
    /^https:\/\/image\.tmdb\.org\/t\/p\/w342\/[a-zA-Z0-9_-]+\.(jpg|png|webp)$/.test(
      raw.posterUrl,
    )
  )
    m.posterUrl = raw.posterUrl;
  for (const k of ["genres", "directors", "cast", "countries", "languages"])
    m[k] = Array.isArray(raw[k])
      ? raw[k]
          .filter((v) => typeof v === "string")
          .slice(0, 100)
          .map((v) => v.slice(0, 500))
      : [];
  m.candidates = Array.isArray(raw.candidates)
    ? raw.candidates
        .filter((c) => Number.isSafeInteger(c.id) && c.id > 0)
        .slice(0, 8)
        .map((c) => ({
          id: c.id,
          title: string(c.title).slice(0, 1000),
          year: Number.isSafeInteger(c.year) ? c.year : null,
        }))
    : [];
  return m;
}
export function readSnapshot(input) {
  let s;
  try {
    s = typeof input === "string" ? JSON.parse(input) : input;
  } catch {
    throw new Error(
      "This is not valid JSON. Choose a Frame by Frame analysis backup.",
    );
  }
  if (
    !s ||
    s.format !== "frame-by-frame" ||
    s.version !== 2 ||
    !Array.isArray(s.files) ||
    s.files.length > 5
  )
    throw new Error(
      "Unsupported analysis backup. Use a version 2 backup or re-import your Letterboxd ZIP.",
    );
  const seen = new Set();
  let count = 0;
  const files = s.files.map((f) => {
    if (
      !f ||
      !["diary", "watched", "ratings", "reviews", "watchlist"].includes(
        f.type,
      ) ||
      seen.has(f.type) ||
      !Array.isArray(f.rows)
    )
      throw new Error(
        "Invalid or duplicate dataset in backup. Re-import the original export.",
      );
    seen.add(f.type);
    count += f.rows.length;
    if (count > 250000) throw new Error("Backup exceeds 250,000 source rows.");
    const rows = f.rows.map((r, index) => {
      if (!r || typeof r !== "object" || Array.isArray(r))
        throw new Error("Invalid source row in backup.");
      const e = Object.entries(r);
      if (
        e.length > 100 ||
        e.some(
          ([k, v]) =>
            k.length > 200 || typeof v !== "string" || v.length > 2000000,
        )
      )
        throw new Error("Invalid source values in backup.");
      const row = Object.fromEntries(e);
      if (
        Number.isSafeInteger(f.sourceLines?.[index]) &&
        f.sourceLines[index] >= 2
      )
        Object.defineProperty(row, "_line", {
          value: f.sourceLines[index],
          enumerable: false,
        });
      return row;
    });
    const issues = Array.isArray(f.issues)
      ? f.issues
          .filter((i) => i && typeof i.reason === "string")
          .slice(0, 250000)
          .map((i) => ({
            row: Number.isSafeInteger(i.row) ? i.row : null,
            reason: i.reason.slice(0, 2000),
            excluded: i.excluded === true,
          }))
      : [];
    return {
      name: `${f.type}.csv`,
      type: f.type,
      rows,
      issues,
      sourceRows:
        Number.isSafeInteger(f.sourceRows) && f.sourceRows >= rows.length
          ? f.sourceRows
          : rows.length,
    };
  });
  const data = mergeDatasets(files);
  if (!data.films.length && !data.watchlist.length)
    throw new Error("The backup contains no valid film records.");
  const attach = (f) => ({ ...f, ...sanitizeMetadata(s.metadata?.[f.key]) });
  return {
    ...data,
    films: data.films.map(attach),
    watchlist: data.watchlist.map(attach),
    label: string(s.label).slice(0, 100) || "My film journal",
    importedAt: string(s.importedAt),
    skippedPaths: Array.isArray(s.skippedPaths)
      ? s.skippedPaths.filter((v) => typeof v === "string")
      : [],
    missing: ["watched", "ratings", "diary", "watchlist"].filter(
      (t) => !seen.has(t),
    ),
  };
}
export function csvCell(value) {
  let s = value == null ? "" : String(value);
  if (/^[\s]*[=+@-]/.test(s)) s = "'" + s;
  return '"' + s.replace(/"/g, '""') + '"';
}
export function filmsCSV(films) {
  const headers = [
    "Title",
    "Release year",
    "Personal rating /5",
    "Latest diary date",
    "Diary entries",
    "Flagged rewatches",
    "Genres (TMDB)",
    "Directors (TMDB)",
    "Runtime minutes (TMDB)",
    "TMDB rating /10",
    "TMDB ID",
    "Letterboxd URL",
  ];
  return (
    "\uFEFF" +
    [
      headers,
      ...films.map((f) => [
        f.title,
        f.year,
        f.rating,
        f.date,
        f.entryCount,
        f.rewatchCount,
        f.genres?.join("; "),
        f.directors?.join("; "),
        f.runtime,
        f.externalRating,
        f.tmdbId,
        f.url,
      ]),
    ]
      .map((row) => row.map(csvCell).join(","))
      .join("\r\n")
  );
}
const xml = (s) =>
  String(s ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&apos;",
      })[c],
  );
export function describeFilters(filters = {}) {
  const parts = [];
  if (filters.year) parts.push(`Diary year ${filters.year}`);
  if (filters.from) parts.push(`From ${filters.from}`);
  if (filters.to) parts.push(`To ${filters.to}`);
  if (filters.rating) parts.push(`Personal rating ${filters.rating} / 5`);
  if (filters.genre) parts.push(`TMDB genre: ${filters.genre}`);
  if (filters.decade) parts.push(`Release decade: ${filters.decade}s`);
  return parts.length
    ? parts.join(" · ")
    : "All imported films; no dashboard filters.";
}
export function reportSVG(
  data,
  label = "All time",
  scopeDescription = "All imported films; no dashboard filters.",
) {
  const { stats, activity, highest } = analyze(data),
    rated = highest.filter((f) => validRating(f.rating));
  const scopeLines =
    String(scopeDescription).match(/.{1,105}(?:\s|$)|.{1,105}/gu) || [];
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="900" viewBox="0 0 1200 900"><rect width="1200" height="900" fill="#101b16"/><g fill="#edece3" font-family="system-ui, sans-serif"><text x="72" y="82" font-size="18" letter-spacing="4" fill="#a8c6ad">FRAME BY FRAME · A FILM JOURNAL</text><text x="72" y="175" font-size="58">${xml(label)} in cinema</text><text x="72" y="220" font-size="22" fill="#aebdaf">${xml(data.label || "My film journal")}</text>${scopeLines
    .slice(0, 2)
    .map(
      (line, i) =>
        `<text x="72" y="${247 + i * 20}" font-size="15" fill="#aebdaf">${xml(line)}</text>`,
    )
    .join("")}<path d="M72 285H1128" stroke="#39473d"/>${[
    [stats.uniqueFilms, "unique films"],
    [stats.diaryEntries, "diary entries"],
    [stats.average?.toFixed(2) ?? "—", "mean rating / 5"],
    [activity.streak.days, "day longest streak"],
  ]
    .map(
      ([value, name], i) =>
        `<text x="${72 + i * 275}" y="355" font-size="60">${value}</text><text x="${72 + i * 275}" y="398" font-size="20" fill="#aebdaf">${name}</text>`,
    )
    .join(
      "",
    )}<text x="72" y="475" font-size="18" letter-spacing="3" fill="#a8c6ad">HIGHEST RATED · TIES SHARE A RATING</text>${rated
    .slice(0, 5)
    .map(
      (f, i) =>
        `<text x="72" y="${528 + i * 48}" font-size="24">${xml(f.title.slice(0, 65))} ${f.year ? "(" + f.year + ")" : ""}</text><text x="1128" y="${528 + i * 48}" text-anchor="end" font-size="24" fill="#bad9a6">${f.rating} / 5</text>`,
    )
    .join(
      "",
    )}<path d="M72 790H1128" stroke="#39473d"/><text x="72" y="834" font-size="17" fill="#aebdaf">Current personal film ratings. Diary totals include repeat and undated entries.</text><text x="72" y="864" font-size="17" fill="#aebdaf">Only imported records · Not affiliated with Letterboxd · Generated locally</text></g></svg>`;
}
