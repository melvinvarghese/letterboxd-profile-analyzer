/** Pure analytics. No network, browser storage, or mutable global state. */
export const normalize = (s = "") =>
  String(s)
    .normalize("NFKD")
    .replace(/\p{M}/gu, "")
    .toLocaleLowerCase("en")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
const headerKey = (s) => normalize(s).replace(/ /g, "");
export const numberOrNull = (v) =>
  v == null || String(v).trim() === "" || !Number.isFinite(Number(v))
    ? null
    : Number(v);
export const validRating = (v) =>
  Number.isFinite(v) && v >= 0.5 && v <= 5 && Number.isInteger(v * 2);
export const mean = (values) =>
  values.length ? values.reduce((s, v) => s + v, 0) / values.length : null;
export function parseDate(value) {
  if (!value) return null;
  const s = String(value).trim();
  if (
    s.includes("T") &&
    !/T(?:[01]\d|2[0-3]):[0-5]\d(?::[0-5]\d(?:\.\d+)?)?(?:Z|[+-](?:[01]\d|2[0-3]):[0-5]\d)?$/.test(
      s,
    )
  )
    return null;
  // Preserve the source calendar day; never shift a diary date into another timezone.
  let m =
    s.match(/^(\d{4})([-/.])(\d{1,2})\2(\d{1,2})$/) ||
    s.match(
      /^(\d{4})(-)(\d{2})-(\d{2})T\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?(?:Z|[+-]\d{2}:\d{2})?$/,
    );
  let y, month, d;
  if (m) {
    y = +m[1];
    month = +m[3];
    d = +m[4];
  } else {
    m = s.match(/^(\d{1,2})([/.])(\d{1,2})\2(\d{4})$/);
    if (!m) return null;
    month = +m[1];
    d = +m[3];
    y = +m[4];
  }
  const leap = y % 4 === 0 && (y % 100 !== 0 || y % 400 === 0);
  if (
    y < 1800 ||
    y > 2200 ||
    month < 1 ||
    month > 12 ||
    d < 1 ||
    d > [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][month - 1]
  )
    return null;
  return `${y}-${String(month).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}
export function parseCSVWithDiagnostics(input) {
  const text = String(input).replace(/^\uFEFF/, "");
  const records = [];
  let row = [],
    cell = "",
    quoted = false,
    closed = false,
    line = 1,
    start = 1;
  const finish = () => {
    if (records.length > 250000)
      throw new Error(
        "CSV exceeds 250,000 source rows. Select a smaller export.",
      );
    row.push(cell);
    if (row.some((v) => v.trim())) records.push({ values: row, line: start });
    row = [];
    cell = "";
    closed = false;
    start = line + 1;
  };
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (c === '"') {
        quoted = false;
        closed = true;
      } else {
        cell += c;
        if (c === "\n") line++;
      }
    } else if (c === '"' && cell === "" && !closed) quoted = true;
    else if (c === ",") {
      row.push(cell);
      cell = "";
      closed = false;
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      finish();
      line++;
    } else if (closed && !/\s/.test(c))
      throw new Error(
        `Malformed CSV near line ${line}: unexpected text after a closing quote.`,
      );
    else if (!closed) cell += c;
  }
  if (quoted)
    throw new Error(
      `Malformed CSV: an unclosed quoted field begins near line ${start}. Re-download the CSV.`,
    );
  if (cell !== "" || row.length || closed) finish();
  if (!records.length)
    return { rows: [], headers: [], issues: [], sourceRows: 0 };
  const headers = records.shift().values.map((h) => h.trim());
  if (
    headers.some((h) => !h) ||
    new Set(headers.map(headerKey)).size !== headers.length
  )
    throw new Error(
      "CSV has empty or duplicate column headers. Use the original Letterboxd export.",
    );
  const rows = [],
    issues = [];
  for (const r of records) {
    if (r.values.length > headers.length) {
      issues.push({
        row: r.line,
        reason: "Too many columns; row excluded. Check commas and quotes.",
        excluded: true,
      });
      continue;
    }
    if (r.values.length < headers.length)
      issues.push({
        row: r.line,
        reason: "Missing trailing columns; empty values retained.",
        excluded: false,
      });
    const result = Object.fromEntries(
      headers.map((h, i) => [h, (r.values[i] ?? "").trim()]),
    );
    Object.defineProperty(result, "_line", {
      value: r.line,
      enumerable: false,
    });
    rows.push(result);
  }
  return {
    rows,
    headers,
    issues,
    sourceRows: records.length,
    sourceLines: rows.map((r) => r._line),
  };
}
export const parseCSV = (input) => parseCSVWithDiagnostics(input).rows;
export const pick = (row, ...keys) => {
  const map = Object.fromEntries(
    Object.entries(row).map(([k, v]) => [headerKey(k), v]),
  );
  for (const k of keys)
    if (map[headerKey(k)] !== undefined && map[headerKey(k)] !== "")
      return map[headerKey(k)];
  return "";
};
export function classifyFile(filename = "") {
  const n = String(filename).replace(/\\/g, "/").split("/").pop().toLowerCase();
  return (
    {
      "watched.csv": "watched",
      "ratings.csv": "ratings",
      "diary.csv": "diary",
      "watchlist.csv": "watchlist",
      "reviews.csv": "reviews",
    }[n] || "other"
  );
}
export function canonicalFilmURL(input) {
  try {
    const url = new URL(input);
    if (url.protocol !== "https:" && url.protocol !== "http:") return "";
    const host = url.hostname.toLowerCase().replace(/^www\./, "");
    if (host === "boxd.it" && /^\/[a-zA-Z0-9]+\/?$/.test(url.pathname))
      return `https://boxd.it${url.pathname.replace(/\/$/, "")}`;
    if (host !== "letterboxd.com") return "";
    const m = url.pathname.match(/(?:^|\/)film\/([^/]+)(?:\/|$)/);
    return m ? `https://letterboxd.com/film/${m[1]}/` : "";
  } catch {
    return "";
  }
}
export const titleKey = (f) =>
  `${f.normalizedTitle ?? normalize(f.title)}|${f.year ?? ""}`;
export function normalizeRows(rows, type = "other", issues = []) {
  return rows.flatMap((r, i) => {
    const cells = Object.fromEntries(
      Object.entries(r).map(([k, v]) => [headerKey(k), v]),
    );
    const get = (...keys) => {
      for (const key of keys)
        if (cells[key] !== undefined && cells[key] !== "") return cells[key];
      return "";
    };
    const sourceRow = r._line || i + 2,
      title = String(get("name", "title", "filmtitle")).trim();
    const warn = (reason) =>
      issues.push({ row: sourceRow, reason, excluded: false });
    if (!title) {
      issues.push({
        row: sourceRow,
        reason: "Missing film title; row excluded.",
        excluded: true,
      });
      return [];
    }
    const rawYear = get("year", "releaseyear"),
      y = numberOrNull(rawYear),
      year =
        y !== null && Number.isInteger(y) && y >= 1800 && y <= 2200 ? y : null;
    if (rawYear && year === null)
      warn("Invalid release year; film retained with unknown year.");
    const rawRating = get("rating", "yourrating"),
      n = numberOrNull(rawRating),
      rating = validRating(n) ? n : null;
    if (rawRating && rating === null)
      warn(
        "Invalid personal rating; only 0.5–5 in half-star steps is accepted. Film retained unrated.",
      );
    const rawDate = type === "diary" ? get("watcheddate") : "",
      date = parseDate(rawDate);
    if (type === "diary" && !date)
      warn(
        rawDate
          ? "Invalid Watched Date; diary entry retained undated."
          : "Missing Watched Date; diary entry retained undated.",
      );
    const rawURL = get("letterboxduri", "letterboxdurl", "url"),
      url = canonicalFilmURL(rawURL);
    if (rawURL && !url)
      warn(
        "Unrecognized film link; link disabled and title/year used for identity.",
      );
    const tmdb = numberOrNull(get("tmdbid")),
      imdb = String(get("imdbid"));
    return [
      {
        id: `${type}-${i}`,
        key: url || `${normalize(title)}|${year ?? ""}`,
        title,
        normalizedTitle: normalize(title),
        year,
        rating,
        date,
        addedDate: parseDate(get("date")),
        rewatch: /^(yes|true|1|y)$/i.test(get("rewatch", "rewatched")),
        url,
        type,
        review: String(get("review", "reviewtext")),
        sourceRow,
        raw: r,
        ...(Number.isSafeInteger(tmdb) && tmdb > 0
          ? { sourceTmdbId: tmdb }
          : {}),
        ...(/^tt\d{5,12}$/.test(imdb) ? { imdbId: imdb } : {}),
      },
    ];
  });
}
export function mergeDatasets(files) {
  const groups = {
      watched: [],
      ratings: [],
      diary: [],
      reviews: [],
      watchlist: [],
    },
    counts = {},
    reports = [],
    inputOrder = [];
  for (const file of files) {
    const type = file.type || classifyFile(file.name);
    if (!groups[type]) continue;
    const issues = [...(file.issues || [])];
    const rows = normalizeRows(file.rows, type, issues);
    counts[type] = (counts[type] || 0) + file.rows.length;
    for (const row of rows) {
      groups[type].push(row);
      if (type !== "watchlist") inputOrder.push(row);
    }
    const seen = new Set();
    let duplicates = 0;
    for (const r of rows) {
      const k = JSON.stringify(r.raw);
      if (seen.has(k)) duplicates++;
      seen.add(k);
    }
    if (duplicates)
      issues.push({
        row: null,
        reason:
          type === "diary"
            ? `${duplicates} identical diary row(s) retained as separate events; the export cannot prove they are accidental duplicates.`
            : `${duplicates} identical row(s) coalesced by film identity.`,
        excluded: false,
      });
    reports.push({
      name: file.name,
      type,
      sourceRows: file.sourceRows ?? file.rows.length,
      acceptedRows: rows.length,
      skippedRows: issues.filter((i) => i.excluded).length,
      issues,
    });
  }
  const all = Object.values(groups).flat();
  const aliases = new Map();
  for (const f of all)
    if (f.url) {
      const k = titleKey(f);
      if (!aliases.has(k)) aliases.set(k, new Set());
      aliases.get(k).add(f.url);
    }
  for (const f of all)
    f.key =
      f.url ||
      (aliases.get(titleKey(f))?.size === 1
        ? [...aliases.get(titleKey(f))][0]
        : titleKey(f));
  const byKey = new Map();
  // Stable precedence: watched < reviews < chronological diary < latest ratings.csv.
  const ordered = [
    ...groups.watched,
    ...groups.reviews,
    ...[...groups.diary].sort((a, b) =>
      (a.date || "").localeCompare(b.date || ""),
    ),
    ...[...groups.ratings].sort((a, b) =>
      (a.addedDate || "").localeCompare(b.addedDate || ""),
    ),
  ];
  for (const f of ordered) {
    const hit = byKey.get(f.key);
    if (!hit)
      byKey.set(f.key, {
        ...f,
        id: f.key,
        diaryDates: [],
        entryCount: 0,
        rewatchCount: 0,
        watchedMarked: false,
      });
    const target = byKey.get(f.key);
    if (f.rating !== null) target.rating = f.rating;
    if (!target.url && f.url) target.url = f.url;
    if (f.review) target.review = f.review;
    if (f.type === "diary") {
      target.entryCount++;
      if (f.date) target.diaryDates.push(f.date);
      if (f.rewatch) target.rewatchCount++;
    }
    target.watchedMarked ||= f.type === "watched";
  }
  const insertionOrder = new Map();
  for (const f of inputOrder)
    if (!insertionOrder.has(f.key))
      insertionOrder.set(f.key, insertionOrder.size);
  const films = [...byKey.values()]
    .sort(
      (a, b) =>
        (insertionOrder.get(a.key) ?? 0) - (insertionOrder.get(b.key) ?? 0),
    )
    .map((f) => ({ ...f, date: [...f.diaryDates].sort().at(-1) || null }));
  const dedupe = (rows) => [
    ...new Map(rows.map((f) => [f.key, { ...f, id: f.key }])).values(),
  ];
  return {
    films,
    diary: groups.diary,
    watchlist: dedupe(groups.watchlist),
    reviews: dedupe(groups.reviews),
    counts,
    importReport: reports,
    sourceFiles: files
      .filter((f) => groups[f.type || classifyFile(f.name)])
      .map((f) => ({
        name: f.name,
        type: f.type || classifyFile(f.name),
        rows: f.rows,
        issues: f.issues || [],
        sourceRows: f.sourceRows ?? f.rows.length,
        sourceLines: f.sourceLines || f.rows.map((r, i) => r._line || i + 2),
      })),
  };
}
export function diaryYearCounts(entries) {
  const m = new Map();
  for (const e of entries || []) {
    const d = parseDate(e?.date);
    if (d) m.set(d.slice(0, 4), (m.get(d.slice(0, 4)) || 0) + 1);
  }
  return [...m]
    .map(([year, count]) => ({ year, count }))
    .sort((a, b) => a.year.localeCompare(b.year));
}
export function groupFilms(films, field) {
  const m = new Map();
  for (const f of films) {
    const values =
      field === "decades"
        ? f.year
          ? [`${Math.floor(f.year / 10) * 10}s`]
          : []
        : Array.isArray(f[field])
          ? f[field]
          : f[field]
            ? [f[field]]
            : [];
    for (const name of new Set(values)) {
      const g = m.get(name) || { name, count: 0, rated: 0, total: 0, keys: [] };
      g.count++;
      g.keys.push(f.key || titleKey(f));
      if (validRating(f.rating)) {
        g.rated++;
        g.total += f.rating;
      }
      m.set(name, g);
    }
  }
  return [...m.values()]
    .map(({ total, ...g }) => ({
      ...g,
      average: g.rated ? total / g.rated : null,
    }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
}
export function activityAnalytics(entries) {
  const dated = entries.filter((e) => parseDate(e.date));
  const byDay = new Map(),
    byMonth = new Map(),
    week = Array.from({ length: 7 }, (_, i) => ({
      name: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"][i],
      count: 0,
    }));
  const byYear = new Map(),
    seasons = Array.from({ length: 4 }, (_, i) => ({
      name: ["Dec–Feb", "Mar–May", "Jun–Aug", "Sep–Nov"][i],
      count: 0,
    }));
  for (const e of dated) {
    byDay.set(e.date, (byDay.get(e.date) || 0) + 1);
    const month = e.date.slice(0, 7);
    byMonth.set(month, (byMonth.get(month) || 0) + 1);
    week[(new Date(e.date + "T12:00:00Z").getUTCDay() + 6) % 7].count++;
    const sn = Math.floor((+e.date.slice(5, 7) % 12) / 3);
    seasons[sn].count++;
    const y = e.date.slice(0, 4),
      g = byYear.get(y) || { name: y, count: 0, ratings: [] };
    g.count++;
    if (validRating(e.rating)) g.ratings.push(e.rating);
    byYear.set(y, g);
  }
  const dates = [...byDay.keys()].sort();
  let longest = 0,
    run = 0,
    previous = null,
    start = null,
    bestStart = null,
    bestEnd = null;
  for (const d of dates) {
    const epoch = Date.parse(d + "T00:00:00Z") / 86400000;
    if (previous !== null && epoch === previous + 1) run++;
    else {
      run = 1;
      start = d;
    }
    if (run > longest) {
      longest = run;
      bestStart = start;
      bestEnd = d;
    }
    previous = epoch;
  }
  const years = [...byYear.values()]
    .map(({ ratings, ...g }) => ({
      ...g,
      average: mean(ratings),
      rated: ratings.length,
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
  return {
    dated: dated.length,
    undated: entries.length - dated.length,
    days: byDay,
    months: [...byMonth]
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => a.name.localeCompare(b.name)),
    weekdays: week,
    seasons,
    years,
    streak: { days: longest, start: bestStart, end: bestEnd },
    activeDays: dates.length,
    first: dates[0] || null,
    last: dates.at(-1) || null,
  };
}
export function filterDataset(data, filters = {}) {
  const {
    year = "",
    from = "",
    to = "",
    rating = "",
    genre = "",
    decade = "",
    status = "all",
    search = "",
  } = filters;
  const hasDate = !!(year || from || to);
  const dateMatch = (e) =>
    e.date &&
    (!year || e.date.startsWith(String(year))) &&
    (!from || e.date >= from) &&
    (!to || e.date <= to);
  const events = (data.diary || []).filter((e) => !hasDate || dateMatch(e));
  const eventKeys = new Set(events.map((e) => e.key || titleKey(e)));
  const q = normalize(search);
  const match = (f) =>
    (!hasDate || eventKeys.has(f.key || titleKey(f))) &&
    (!rating || f.rating === Number(rating)) &&
    (!genre || f.genres?.includes(genre)) &&
    (!decade || Math.floor((f.year || 0) / 10) * 10 === Number(decade)) &&
    (status !== "rated" || validRating(f.rating)) &&
    (status !== "unrated" || !validRating(f.rating)) &&
    (status !== "rewatches" || f.rewatchCount > 0) &&
    (!q ||
      normalize(
        [f.title, f.year, ...(f.directors || []), ...(f.cast || [])].join(" "),
      ).includes(q));
  const films = (data.films || []).filter(match);
  const keys = new Set(films.map((f) => f.key || titleKey(f)));
  return {
    ...data,
    films,
    diary: events.filter((e) => keys.has(e.key || titleKey(e))),
    scopeFiltered: hasDate,
  };
}
export function sortFilms(films, sort = "title") {
  return [...films].sort((a, b) => {
    let diff = 0;
    if (sort === "rating-desc") diff = (b.rating ?? -1) - (a.rating ?? -1);
    else if (sort === "rating-asc") diff = (a.rating ?? 6) - (b.rating ?? 6);
    else if (sort === "year-desc") diff = (b.year ?? 0) - (a.year ?? 0);
    else if (sort === "date") diff = (b.date || "").localeCompare(a.date || "");
    else if (sort === "rewatches")
      diff = (b.entryCount || 0) - (a.entryCount || 0);
    return (
      diff ||
      a.title.localeCompare(b.title) ||
      String(a.key || "").localeCompare(String(b.key || ""))
    );
  });
}
export function analyze(data) {
  const films = data.films || [],
    rated = films.filter((f) => validRating(f.rating)),
    values = rated.map((f) => f.rating).sort((a, b) => a - b),
    mid = Math.floor(values.length / 2);
  const dist = Array.from({ length: 10 }, (_, i) => ({
    rating: (i + 1) / 2,
    name: `${(i + 1) / 2}★`,
    count: rated.filter((f) => f.rating === (i + 1) / 2).length,
  }));
  const activity = activityAnalytics(data.diary || []),
    decades = groupFilms(films, "decades");
  const max = Math.max(0, ...dist.map((d) => d.count));
  const metadata = films.filter((f) => f.tmdbId),
    runtimes = films.filter((f) => f.tmdbId && f.runtime > 0),
    runtimeMap = new Map(films.map((f) => [f.key || titleKey(f), f])),
    runtimeEvents = (data.diary || [])
      .map((e) => runtimeMap.get(e.key || titleKey(e)))
      .filter((f) => f?.runtime > 0);
  const years = [...activity.years].sort(
    (a, b) => b.count - a.count || a.name.localeCompare(b.name),
  );
  const stats = {
    uniqueFilms: films.length,
    diaryEntries: (data.diary || []).length,
    ratedFilms: rated.length,
    average: mean(values),
    median: values.length
      ? values.length % 2
        ? values[mid]
        : (values[mid - 1] + values[mid]) / 2
      : null,
    ratingDistribution: dist,
    mode: dist
      .filter((d) => d.count > 0 && d.count === max)
      .map((d) => d.rating),
    mostWatchedYear: years[0]?.name ?? null,
    mostActiveYears: years.filter((y) => y.count === years[0]?.count),
    favoriteDecade: decades[0]?.name ?? null,
    rewatches: (data.diary || []).filter((e) => e.rewatch).length,
    firstDiaryDate: activity.first,
    lastDiaryDate: activity.last,
    watchlistSize: (data.watchlist || []).length,
    yearCounts: years.map(({ name, count }) => ({ name, count })),
    decades: decades.map(({ name, count }) => ({ name, count })),
    metadataFilms: metadata.length,
    runtimeFilms: runtimes.length,
    runtimeMinutes: runtimes.reduce((s, f) => s + f.runtime, 0),
    runtimeEventCount: runtimeEvents.length,
    runtimeEventMinutes: runtimeEvents.reduce((s, f) => s + f.runtime, 0),
  };
  const genres = groupFilms(metadata, "genres"),
    directors = groupFilms(metadata, "directors"),
    cast = groupFilms(metadata, "cast"),
    countries = groupFilms(metadata, "countries"),
    languages = groupFilms(metadata, "languages");
  const insights = [];
  if (rated.length)
    insights.push({
      title: "Your rating centre",
      detail: `${stats.average.toFixed(2)} / 5 across ${rated.length} rated films. ${Math.round((rated.filter((f) => f.rating >= 4).length / rated.length) * 100)}% receive four stars or more.`,
      sampleSize: rated.length,
      method: "Current personal ratings; missing values excluded.",
    });
  if (years.length)
    insights.push({
      title:
        "Your busiest recorded year" +
        (stats.mostActiveYears.length > 1 ? "s" : ""),
      detail: `${stats.mostActiveYears.map((y) => y.name).join(", ")} · ${years[0].count} diary entries each.`,
      sampleSize: activity.dated,
      method:
        "Dated diary events, including repeat viewings; tied years share the lead.",
    });
  if (activity.streak.days > 1)
    insights.push({
      title: "A run of movie days",
      detail: `${activity.streak.days} consecutive days, ${activity.streak.start} to ${activity.streak.end}.`,
      sampleSize: activity.activeDays,
      method: "At least one valid diary event per consecutive calendar day.",
    });
  if (genres.length) {
    const eligible = genres
      .filter((g) => g.rated >= 3)
      .sort((a, b) => b.average - a.average || b.rated - a.rated);
    if (eligible.length)
      insights.push({
        title: "Frequency meets appreciation",
        detail: `${genres[0].name} is most frequent (${genres[0].count} films${genres.filter((g) => g.count === genres[0].count).length > 1 ? "; tied" : ""}). ${eligible[0].name} has a top mean of ${eligible[0].average.toFixed(2)}★ among genres with ≥3 ratings${eligible.filter((g) => g.average === eligible[0].average).length > 1 ? " (tied)" : ""}.`,
        sampleSize: metadata.length,
        method:
          "Unique matched films; a multi-genre film counts once in each genre. This describes the matched subset.",
      });
  }
  const repeated = films
    .filter((f) => f.entryCount >= 2)
    .sort(
      (a, b) => b.entryCount - a.entryCount || a.title.localeCompare(b.title),
    );
  return {
    stats,
    activity,
    insights,
    genres,
    directors,
    cast,
    countries,
    languages,
    decadeAnalysis: decades,
    genreAnalysis: genres.map((g) => ({
      name: g.name,
      matchedFilms: g.count,
      ratedFilms: g.rated,
      averageRating: g.average,
    })),
    repeated,
    highest: sortFilms(rated, "rating-desc"),
    lowest: sortFilms(rated, "rating-asc"),
    disagreements: films
      .filter(
        (f) =>
          validRating(f.rating) &&
          Number.isFinite(f.externalRating) &&
          f.voteCount >= 50,
      )
      .map((f) => ({ ...f, gap: f.rating - f.externalRating / 2 }))
      .sort((a, b) => Math.abs(b.gap) - Math.abs(a.gap)),
    unusual: metadata
      .filter((f) => Number.isFinite(f.voteCount) && f.voteCount > 0)
      .sort((a, b) => a.voteCount - b.voteCount),
    outliers: rated
      .filter((f) => Math.abs(f.rating - stats.average) >= 1.5)
      .sort(
        (a, b) =>
          Math.abs(b.rating - stats.average) -
          Math.abs(a.rating - stats.average),
      ),
  };
}
export function prioritizeWatchlist(data) {
  const watched = new Set(data.films.map((f) => f.key || titleKey(f))),
    rated = data.films.filter((f) => validRating(f.rating)),
    baseline = mean(rated.map((f) => f.rating));
  const preferences = groupFilms(
    rated.filter((f) => f.tmdbId),
    "genres",
  ).filter((g) => g.rated >= 3);
  const decadePreferences = groupFilms(rated, "decades");
  return (data.watchlist || [])
    .filter((f) => !watched.has(f.key || titleKey(f)))
    .map((f) => {
      const signals = preferences.filter(
        (g) => f.genres?.includes(g.name) && g.average > baseline,
      );
      const decade = decadePreferences.find(
        (g) =>
          g.name === `${Math.floor((f.year || 0) / 10) * 10}s` &&
          g.rated >= 3 &&
          g.average > baseline,
      );
      const score = signals.length
        ? mean(signals.map((g) => g.average - baseline))
        : decade
          ? (decade.average - baseline) * 0.5
          : null;
      const reason = signals.length
        ? signals
            .map(
              (g) =>
                `${g.name}: you average ${g.average.toFixed(2)}★ across ${g.rated} films`,
            )
            .join("; ")
        : decade
          ? `${decade.name}: you average ${decade.average.toFixed(2)}★ across ${decade.rated} films`
          : "Insufficient preference evidence; shown as an unranked watchlist title.";
      return { ...f, score, reason };
    })
    .sort(
      (a, b) =>
        (b.score ?? -1) - (a.score ?? -1) || a.title.localeCompare(b.title),
    );
}
export function comparePeriods(data, yearA, yearB) {
  return [yearA, yearB].map((year) => {
    const scope = filterDataset(data, { year });
    const result = analyze(scope);
    return {
      year,
      ...result.stats,
      months: Array.from({ length: 12 }, (_, i) => ({
        name: String(i + 1).padStart(2, "0"),
        count: scope.diary.filter(
          (e) => e.date?.slice(5, 7) === String(i + 1).padStart(2, "0"),
        ).length,
      })),
      activity: result.activity,
    };
  });
}

export function buildComparisonProfile(files, username = null) {
  const supported = new Set(["diary", "ratings", "watched", "reviews"]);
  const comparisonFiles = (files || [])
    .filter((file) => supported.has(file.type || classifyFile(file.name || "")))
    .map((file) => ({
      ...file,
      type: file.type || classifyFile(file.name || ""),
    }));
  const merged = mergeDatasets(comparisonFiles);
  return {
    username:
      typeof username === "string" && username.trim() ? username.trim() : null,
    films: merged.films.map(({ title, normalizedTitle, year, rating }) => ({
      title,
      normalizedTitle,
      year,
      rating,
    })),
    diary: merged.diary.map(({ normalizedTitle, year, date }) => ({
      normalizedTitle,
      year,
      date,
    })),
  };
}
export function compareProfiles(profileA, profileB) {
  const filmsA = profileA?.films || [],
    filmsB = profileB?.films || [];
  const key = (film) =>
    `${film.normalizedTitle ?? normalize(film.title ?? "")}|${film.year ?? ""}`;
  const mapA = new Map(filmsA.map((film) => [key(film), film])),
    mapB = new Map(filmsB.map((film) => [key(film), film]));
  const shared = filmsA
    .filter((film) => mapB.has(key(film)))
    .map((a) => ({ a, b: mapB.get(key(a)) }));
  const uniqueA = filmsA.filter((film) => !mapB.has(key(film))),
    uniqueB = filmsB.filter((film) => !mapA.has(key(film)));
  const diaryDates = (profile) => {
    const dates = new Map();
    for (const entry of profile?.diary || []) {
      const date = parseDate(entry?.date);
      if (!date) continue;
      const filmKey = key(entry);
      if (!dates.has(filmKey)) dates.set(filmKey, []);
      dates.get(filmKey).push(date);
    }
    return dates;
  };
  const datesA = diaryDates(profileA),
    datesB = diaryDates(profileB);
  const validRating = (value) => Number.isFinite(value);
  const sideDetails = (film, dates) => ({
    rating: validRating(film.rating) ? film.rating : null,
    diaryDates: dates.get(key(film)) || [],
  });
  const rated = shared.filter(
    ({ a, b }) => validRating(a.rating) && validRating(b.rating),
  );
  let correlation = null;
  if (rated.length >= 3) {
    const xs = rated.map(({ a }) => a.rating),
      ys = rated.map(({ b }) => b.rating),
      mx = xs.reduce((sum, value) => sum + value, 0) / xs.length,
      my = ys.reduce((sum, value) => sum + value, 0) / ys.length;
    const numerator = xs.reduce(
        (sum, x, index) => sum + (x - mx) * (ys[index] - my),
        0,
      ),
      dx = Math.sqrt(xs.reduce((sum, x) => sum + (x - mx) ** 2, 0)),
      dy = Math.sqrt(ys.reduce((sum, y) => sum + (y - my) ** 2, 0));
    if (dx && dy) correlation = numerator / (dx * dy);
  }
  return {
    sharedFilms: shared.map(({ a, b }) => ({
      title: a.title,
      year: a.year ?? null,
      a: sideDetails(a, datesA),
      b: sideDetails(b, datesB),
      ratingDifference:
        validRating(a.rating) && validRating(b.rating)
          ? a.rating - b.rating
          : null,
    })),
    uniqueToA: uniqueA.map((film) => ({
      title: film.title,
      year: film.year ?? null,
      ...sideDetails(film, datesA),
    })),
    uniqueToB: uniqueB.map((film) => ({
      title: film.title,
      year: film.year ?? null,
      ...sideDetails(film, datesB),
    })),
    sharedRatedFilms: rated.length,
    ratingCorrelation: correlation,
  };
}

export function ratingHeatmap(films) {
  const matched = films.filter((f) => f.tmdbId),
    genres = groupFilms(matched, "genres").slice(0, 8),
    decades = groupFilms(matched, "decades")
      .slice(0, 8)
      .sort((a, b) => a.name.localeCompare(b.name));
  return {
    columns: decades.map((g) => g.name),
    rows: genres.map((g) => ({
      name: g.name,
      cells: decades.map((d) => {
        const keys = new Set(d.keys),
          genreKeys = new Set(g.keys);
        const subset = matched.filter(
            (f) =>
              genreKeys.has(f.key || titleKey(f)) &&
              keys.has(f.key || titleKey(f)),
          ),
          rated = subset.filter((f) => validRating(f.rating));
        return {
          column: d.name,
          count: subset.length,
          rated: rated.length,
          average: rated.length >= 3 ? mean(rated.map((f) => f.rating)) : null,
          keys: subset.map((f) => f.key || titleKey(f)),
        };
      }),
    })),
  };
}
