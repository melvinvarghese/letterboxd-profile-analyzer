"use client";
import { useMemo, useState } from "react";
import {
  ArrowUpRight,
  Download,
  Film,
  CalendarDays,
  Star,
  RotateCcw,
  Sparkles,
} from "lucide-react";
import {
  analyze,
  filterDataset,
  sortFilms,
  prioritizeWatchlist,
  comparePeriods,
  groupFilms,
  titleKey,
  ratingHeatmap,
} from "../lib/analytics.mjs";
import {
  Button,
  Title,
  Section,
  Metric,
  Columns,
  Bars,
  Empty,
  FilmGrid,
  FilmList,
  Poster,
  Pager,
  fmt,
} from "./ui";
const months = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];
export function Overview({
  scope,
  result,
  onNavigate,
  onFilm,
  onRating,
  onYear,
}: any) {
  const { stats: s, activity: a } = result;
  return (
    <>
      <Title kicker="THE BIG PICTURE" title="Your life, measured in films.">
        Every rating, every return, every late-night discovery. Here’s what your
        imported journal reveals.
      </Title>
      <div className="metrics">
        <Metric
          label="Unique films"
          value={s.uniqueFilms.toLocaleString()}
          detail="Distinct film identities"
          onClick={() => onNavigate("films")}
        />
        <Metric
          label="Diary entries"
          value={s.diaryEntries.toLocaleString()}
          detail={`${a.dated} dated · ${a.undated} undated`}
          onClick={() => onNavigate("diary")}
        />
        <Metric
          label="Personal average"
          value={s.average == null ? "—" : `${fmt(s.average)} ★`}
          detail={`${s.ratedFilms} films rated · out of 5`}
          onClick={() => onNavigate("ratings")}
        />
        <Metric
          label="Rewatch flags"
          value={s.rewatches.toLocaleString()}
          detail="Explicit diary flags only"
          onClick={() => onNavigate("diary")}
        />
      </div>
      <div className="two-col chart-split">
        <Section
          title="The rhythm of your watching"
          sub="Diary entries per recorded year. Choose a year to explore."
          action={
            <button className="text-btn" onClick={() => onNavigate("diary")}>
              Open diary <ArrowUpRight size={14} />
            </button>
          }
        >
          <Columns data={a.years} onSelect={(d: any) => onYear(d.name)} />
          <p className="footnote">
            {a.first ? `${a.first} — ${a.last}. ` : ""}Viewing dates come only
            from diary Watched Date; repeat viewings count separately.
          </p>
        </Section>
        <Section
          title="Your rating fingerprint"
          sub="Current personal rating per unique film."
        >
          <Columns
            data={s.ratingDistribution.map((d: any) => ({
              ...d,
              name: String(d.rating),
            }))}
            onSelect={(d: any) => onRating(d.rating)}
            color="amber"
          />
          <p className="footnote">
            Half-star steps on a 5-star scale. {s.uniqueFilms - s.ratedFilms}{" "}
            films are unrated.
          </p>
        </Section>
      </div>
      <Section
        title="Films you hold in high regard"
        sub="Highest personal ratings in this selection; tied films share their rating."
        action={
          <button className="text-btn" onClick={() => onNavigate("films")}>
            The full collection <ArrowUpRight size={14} />
          </button>
        }
      >
        {result.highest.length ? (
          <FilmGrid films={result.highest} onFilm={onFilm} />
        ) : (
          <Empty title="The unrated chapter">
            Add ratings.csv to see your highest-rated films.
          </Empty>
        )}
      </Section>
      <div className="two-col">
        <Section
          title="Between the frames"
          sub="Observations drawn from your records."
        >
          <div className="insights">
            {result.insights.length ? (
              result.insights.map((i: any) => (
                <article key={i.title}>
                  <Sparkles size={17} />
                  <div>
                    <h3>{i.title}</h3>
                    <p>{i.detail}</p>
                    <small>{i.method}</small>
                  </div>
                </article>
              ))
            ) : (
              <Empty>
                Your import has no ratings or dated diary entries in this
                selection.
              </Empty>
            )}
          </div>
        </Section>
        <Section
          title="Time spent in other worlds"
          sub="Runtime coverage, without filling in the blanks."
        >
          <div className="time-number">
            {s.runtimeFilms ? `${fmt(s.runtimeMinutes / 60, 1)}h` : "—"}
            <small>unique film runtime</small>
          </div>
          <p className="body-copy">
            {s.runtimeFilms
              ? `Sum of TMDB runtimes for ${s.runtimeFilms} of ${s.uniqueFilms} films. ${fmt(s.runtimeEventMinutes / 60, 1)} hours across ${s.runtimeEventCount} diary events with a known runtime, including repeats.`
              : "Add optional TMDB metadata to calculate runtime. Standard Letterboxd CSVs do not contain film lengths."}
          </p>
          <p className="footnote">
            This is recorded runtime, not measured time watching. Missing
            runtimes are excluded; films without a diary log contribute only to
            the unique-film sum.
          </p>
          <Button onClick={() => onNavigate("settings")}>
            {s.metadataFilms
              ? "Review metadata coverage"
              : "Add optional metadata"}{" "}
            <ArrowUpRight size={15} />
          </Button>
        </Section>
      </div>
      <Section
        title="Your data, in context"
        sub="Coverage is part of the story."
      >
        <div className="coverage-inline">
          <span>
            <b>
              {s.ratedFilms}/{s.uniqueFilms}
            </b>{" "}
            films rated
          </span>
          <span>
            <b>
              {s.metadataFilms}/{s.uniqueFilms}
            </b>{" "}
            films with TMDB metadata
          </span>
          <span>
            <b>{a.activeDays}</b> distinct diary days
          </span>
          <span>
            <b>{s.watchlistSize}</b> watchlist titles in the full import
          </span>
        </div>
        <p className="footnote">
          Importing a partial export gives a partial history. No activity is
          inferred for periods with no diary records.{" "}
          <button className="text-btn" onClick={() => onNavigate("settings")}>
            Read the counting rules
          </button>
        </p>
      </Section>
    </>
  );
}
export function Explorer({ scope, onFilm, onExport }: any) {
  const [query, setQuery] = useState(""),
    [status, setStatus] = useState("all"),
    [sort, setSort] = useState("title"),
    [page, setPage] = useState(1),
    [layout, setLayout] = useState("table");
  const films = useMemo(
    () =>
      sortFilms(filterDataset(scope, { search: query, status }).films, sort),
    [scope, query, status, sort],
  );
  const safePage = Math.min(page, Math.max(1, Math.ceil(films.length / 30)));
  const rows = films.slice((safePage - 1) * 30, safePage * 30);
  return (
    <>
      <Title kicker="THE PERSONAL ARCHIVE" title="Every title has a story.">
        Search your collection, follow a thread, or open a film to see its diary
        history and metadata.
      </Title>
      <Section
        title={`${films.length.toLocaleString()} films`}
        sub="Search and status filters apply to this explorer and its CSV export."
        action={
          <Button onClick={() => onExport(films)}>
            <Download size={15} /> Export CSV
          </Button>
        }
      >
        <div className="explorer-tools">
          <label className="search-label">
            <span className="sr-only">Search films</span>
            <input
              type="search"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setPage(1);
              }}
              placeholder="Search title, year, director or actor…"
            />
          </label>
          <label>
            <span className="sr-only">Film status</span>
            <select
              value={status}
              onChange={(e) => {
                setStatus(e.target.value);
                setPage(1);
              }}
            >
              <option value="all">All films</option>
              <option value="rated">Rated</option>
              <option value="unrated">Unrated</option>
              <option value="rewatches">Flagged rewatches</option>
            </select>
          </label>
          <label>
            <span className="sr-only">Sort films</span>
            <select
              value={sort}
              onChange={(e) => {
                setSort(e.target.value);
                setPage(1);
              }}
            >
              <option value="title">Title A–Z</option>
              <option value="rating-desc">Highest rated</option>
              <option value="rating-asc">Lowest rated</option>
              <option value="year-desc">Newest release</option>
              <option value="date">Latest diary date</option>
              <option value="rewatches">Most diary entries</option>
            </select>
          </label>
          <Button
            onClick={() => setLayout(layout === "table" ? "grid" : "table")}
          >
            {layout === "table" ? "Poster grid" : "Table view"}
          </Button>
          <button
            className="text-btn"
            onClick={() => {
              setQuery("");
              setStatus("all");
              setSort("title");
              setPage(1);
            }}
          >
            Reset explorer
          </button>
        </div>
        {rows.length ? (
          layout === "grid" ? (
            <FilmGrid films={rows} onFilm={onFilm} limit={30} />
          ) : (
            <div className="table-scroll">
              <table>
                <caption className="sr-only">
                  Filtered films. Ratings are personal out of 5; TMDB ratings
                  are out of 10.
                </caption>
                <thead>
                  <tr>
                    <th scope="col">Film / release year</th>
                    <th scope="col">Your rating</th>
                    <th scope="col">Latest diary</th>
                    <th scope="col">Logs</th>
                    <th scope="col">TMDB</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((f: any) => (
                    <tr key={f.key}>
                      <td>
                        <button
                          className="table-film"
                          onClick={() => onFilm(f)}
                        >
                          <Poster film={f} />
                          <span>
                            <strong>{f.title}</strong>
                            <small>
                              {f.year ?? "Year unknown"}
                              {f.directors?.length
                                ? ` · ${f.directors.join(", ")}`
                                : ""}
                            </small>
                          </span>
                        </button>
                      </td>
                      <td className="rating">
                        {f.rating != null ? `${f.rating} ★` : "—"}
                      </td>
                      <td>{f.date || "Undated"}</td>
                      <td>{f.entryCount}</td>
                      <td>
                        {f.externalRating != null
                          ? `${fmt(f.externalRating, 1)} / 10`
                          : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        ) : (
          <Empty title="No films match">
            Reset the explorer filters or widen the date and rating selection
            above.
          </Empty>
        )}
        <Pager page={safePage} total={films.length} onPage={setPage} />
      </Section>
    </>
  );
}
export function Diary({ scope, result, onFilm, onRange }: any) {
  const { activity: a } = result,
    available = a.years.map((y: any) => y.name);
  const [calendarYear, setCalendarYear] = useState(
    available.at(-1) || String(new Date().getFullYear()),
  );
  const [page, setPage] = useState(1);
  const year = available.includes(calendarYear)
    ? calendarYear
    : available.at(-1) || calendarYear;
  const y = Number(year),
    first = new Date(Date.UTC(y, 0, 1)),
    days = Math.round((Date.UTC(y + 1, 0, 1) - +first) / 86400000),
    offset = (first.getUTCDay() + 6) % 7;
  const entries = [...scope.diary].sort((x, y) =>
    (y.date || "").localeCompare(x.date || ""),
  );
  const map = new Map(scope.films.map((f: any) => [f.key, f]));
  const monthData = months.map((name, i) => ({
    name,
    count: scope.diary.filter((e: any) =>
      e.date?.startsWith(`${year}-${String(i + 1).padStart(2, "0")}`),
    ).length,
    index: i,
  }));
  return (
    <>
      <Title kicker="TIME IN THE DARK" title="A calendar of other lives.">
        Your diary records viewing events. A film can appear many times; a
        watched mark without Watched Date stays outside the calendar.
      </Title>
      <div className="metrics">
        <Metric
          label="Dated entries"
          value={a.dated}
          detail={`${a.undated} undated retained`}
        />
        <Metric
          label="Active days"
          value={a.activeDays}
          detail="At least one diary entry"
        />
        <Metric
          label="Longest streak"
          value={`${a.streak.days} days`}
          detail={
            a.streak.start
              ? `${a.streak.start} to ${a.streak.end}`
              : "No valid diary dates"
          }
        />
        <Metric
          label="Explicit rewatches"
          value={result.stats.rewatches}
          detail="A missing flag means unknown"
        />
      </div>
      <Section
        title="Your viewing calendar"
        sub="Each square is a day. Choose an active day to explore its films."
        action={
          <label className="inline-label">
            Calendar year
            <select
              aria-label="Calendar year"
              value={year}
              onChange={(e) => setCalendarYear(e.target.value)}
            >
              {available.length ? (
                available.map((v: string) => <option key={v}>{v}</option>)
              ) : (
                <option>{year}</option>
              )}
            </select>
          </label>
        }
      >
        {a.dated ? (
          <>
            <div className="calendar-scroll">
              <div className="calendar-months">
                {months.map((m) => (
                  <span key={m}>{m}</span>
                ))}
              </div>
              <div
                className="calendar"
                style={{
                  gridTemplateColumns: `repeat(${Math.ceil((days + offset) / 7)}, 13px)`,
                }}
              >
                {Array.from({ length: offset }, (_, i) => (
                  <span key={`blank${i}`} />
                ))}
                {Array.from({ length: days }, (_, i) => {
                  const date = new Date(Date.UTC(y, 0, i + 1))
                      .toISOString()
                      .slice(0, 10),
                    count = a.days.get(date) || 0;
                  return count ? (
                    <button
                      key={date}
                      title={`${date}: ${count} entries`}
                      aria-label={`${date}: ${count} entries, explore`}
                      data-level={Math.min(4, count)}
                      onClick={() => onRange(date, date)}
                    />
                  ) : (
                    <span
                      key={date}
                      title={`${date}: no recorded entries`}
                      data-level="0"
                    />
                  );
                })}
              </div>
            </div>
            <div className="calendar-key">
              <span>No logs</span>
              {[0, 1, 2, 3, 4].map((l) => (
                <i key={l} data-level={l} />
              ))}
              <span>4+ logs</span>
              <span>Monday → Sunday, top to bottom</span>
            </div>
          </>
        ) : (
          <Empty title="No dated diary entries">
            Import diary.csv with valid Watched Date values. Generic Date and
            release Year never create a viewing date.
          </Empty>
        )}
      </Section>
      <div className="two-col">
        <Section
          title={`${year}, month by month`}
          sub="Zero means no recorded entries, not proof that no films were watched."
        >
          <Columns
            data={monthData}
            onSelect={(d: any) =>
              onRange(
                `${year}-${String(d.index + 1).padStart(2, "0")}-01`,
                new Date(Date.UTC(y, d.index + 1, 0))
                  .toISOString()
                  .slice(0, 10),
              )
            }
          />
        </Section>
        <Section
          title="Your days of the week"
          sub="All dated events in the current selection."
        >
          <Columns data={a.weekdays} />
          <p className="footnote">
            Dates are read as calendar days without timezone conversion.
          </p>
        </Section>
      </div>
      <div className="two-col">
        <Section
          title="The films you return to"
          sub="Two or more diary entries for a film; this differs from explicit Rewatch flags."
        >
          <FilmList films={result.repeated} onFilm={onFilm} detail="count" />
        </Section>
        <Section
          title="Seasonal rhythm"
          sub="Calendar month groups, independent of hemisphere."
        >
          <Columns data={a.seasons} />
          <p className="footnote">
            Logs without a valid Watched Date are excluded from every activity
            chart.
          </p>
        </Section>
      </div>
      <Section
        title="The diary itself"
        sub="Event ratings are shown as logged; they may differ from the film’s current rating."
      >
        {entries.length ? (
          <>
            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th scope="col">Watched Date</th>
                    <th scope="col">Film</th>
                    <th scope="col">Event rating</th>
                    <th scope="col">Rewatch flag</th>
                  </tr>
                </thead>
                <tbody>
                  {entries
                    .slice((page - 1) * 30, page * 30)
                    .map((e: any, i: number) => (
                      <tr key={`${e.id}-${i}`}>
                        <td>{e.date || "Undated"}</td>
                        <td>
                          <button
                            className="text-btn"
                            onClick={() => onFilm(map.get(e.key) || e)}
                          >
                            {e.title} ({e.year ?? "?"})
                          </button>
                        </td>
                        <td>{e.rating != null ? `${e.rating}★` : "—"}</td>
                        <td>{e.rewatch ? "Yes" : "Not set"}</td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
            <Pager page={page} total={entries.length} onPage={setPage} />
          </>
        ) : (
          <Empty>No diary entries are available in this selection.</Empty>
        )}
      </Section>
    </>
  );
}
export function Ratings({ result, onFilm, onRating, onDrill, scope }: any) {
  const { stats: s, activity: a } = result;
  return (
    <>
      <Title kicker="THE RATING FINGERPRINT" title="How you see what you see.">
        Patterns in your ratings, with their sample sizes attached. These
        describe the films you rated, without making claims about your
        personality.
      </Title>
      <div className="metrics">
        <Metric
          label="Mean rating"
          value={`${fmt(s.average)} ★`}
          detail={`${s.ratedFilms} current film ratings`}
        />
        <Metric
          label="Median"
          value={`${fmt(s.median)} ★`}
          detail="Middle of the sorted ratings"
        />
        <Metric
          label="Most common"
          value={
            s.mode.length ? s.mode.map((r: number) => `${r}★`).join(" · ") : "—"
          }
          detail={
            s.mode.length > 1
              ? "All tied modes shown"
              : "No unrated films included"
          }
        />
        <Metric
          label="Unrated films"
          value={s.uniqueFilms - s.ratedFilms}
          detail="Missing is never zero"
        />
      </div>
      <div className="two-col">
        <Section
          title="The full rating curve"
          sub="Choose a rating to see its films."
        >
          <Columns
            data={s.ratingDistribution.map((d: any) => ({
              ...d,
              name: `${d.rating}★`,
            }))}
            onSelect={(d: any) => onRating(d.rating)}
            color="amber"
          />
        </Section>
        <Section
          title="Ratings across diary years"
          sub="Mean of each event’s logged rating; repeat events count separately."
        >
          <Columns
            data={a.years
              .filter((v: any) => v.rated)
              .map((v: any) => ({ ...v, name: `${v.name} (n=${v.rated})` }))}
            value="average"
            suffix=" / 5"
          />
          <p className="footnote">
            Current film ratings above use ratings.csv when available; this time
            series uses only ratings attached to diary events.
          </p>
        </Section>
      </div>
      <div className="two-col">
        <Section
          title="Highest rated"
          sub="Titles are alphabetized within equal ratings."
        >
          <FilmList films={result.highest} onFilm={onFilm} />
        </Section>
        <Section title="Lowest rated" sub="Unrated films are excluded.">
          <FilmList films={result.lowest} onFilm={onFilm} />
        </Section>
      </div>
      <div className="two-col">
        <Section
          title="Away from your average"
          sub="Films at least 1.5 stars above or below your personal mean."
        >
          <FilmList films={result.outliers} onFilm={onFilm} />
        </Section>
        <Section
          title="Where you and TMDB differ"
          sub="Your stars minus TMDB’s mean divided by two; at least 50 TMDB votes."
        >
          <FilmList films={result.disagreements} onFilm={onFilm} detail="gap" />
          <p className="footnote">
            Different audiences and rating scales limit this comparison. TMDB is
            not a Letterboxd community rating.
          </p>
        </Section>
      </div>
      <Section
        title="Less widely rated on TMDB"
        sub="Lowest TMDB vote counts among matched films in this selection. This measures that service’s voting coverage, not rarity or quality."
      >
        <FilmList films={result.unusual} onFilm={onFilm} detail="votes" />
      </Section>
      <Section
        title="Release decades, rated"
        sub="At least three rated films per decade. Means describe your selection."
      >
        <Bars
          data={result.decadeAnalysis
            .filter((g: any) => g.rated >= 3)
            .sort((a: any, b: any) => b.average - a.average)}
          average
          onSelect={(g: any) =>
            onDrill(
              `${g.name} · rated films`,
              scope.films.filter(
                (f: any) => g.keys.includes(f.key) && f.rating != null,
              ),
            )
          }
        />
      </Section>
    </>
  );
}
export function Taste({ scope, result, onDrill, onNavigate }: any) {
  const [order, setOrder] = useState("count");
  const ordered = (arr: any[]) =>
    order === "average"
      ? [...arr]
          .filter((g) => g.rated >= 3)
          .sort(
            (a, b) =>
              b.average - a.average ||
              b.rated - a.rated ||
              a.name.localeCompare(b.name),
          )
      : arr;
  const pairs = useMemo(() => {
    const m = new Map();
    for (const f of scope.films.filter((f: any) => f.tmdbId)) {
      const gs = [...(f.genres || [])].sort();
      for (let i = 0; i < gs.length; i++)
        for (let j = i + 1; j < gs.length; j++) {
          const name = `${gs[i]} + ${gs[j]}`,
            g = m.get(name) || { name, count: 0, rated: 0, total: 0, keys: [] };
          g.count++;
          g.keys.push(f.key);
          if (f.rating != null) {
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
  }, [scope]);
  const heat = useMemo(() => ratingHeatmap(scope.films), [scope.films]);
  const drill = (g: any) =>
    onDrill(
      g.name,
      scope.films.filter((f: any) => g.keys.includes(f.key)),
    );
  return (
    <>
      <Title kicker="TASTE & TERRITORY" title="Follow your cinematic compass.">
        Frequency tells you where you spend time. Ratings tell you how those
        visits felt. Both describe only the imported and matched films.
      </Title>
      <div className="view-toolbar">
        <span>
          {result.stats.metadataFilms} of {scope.films.length} films have TMDB
          metadata.
        </span>
        <label>
          Rank categories by
          <select value={order} onChange={(e) => setOrder(e.target.value)}>
            <option value="count">Films watched</option>
            <option value="average">Personal mean (≥3 rated)</option>
          </select>
        </label>
        <button className="text-btn" onClick={() => onNavigate("settings")}>
          Manage metadata <ArrowUpRight size={14} />
        </button>
      </div>
      <div className="two-col">
        <Section
          title="Genres in your orbit"
          sub="A film counts once in every one of its TMDB genres."
        >
          <Bars
            data={ordered(result.genres)}
            average={order === "average"}
            onSelect={drill}
          />
        </Section>
        <Section
          title="Release decades"
          sub="Release Year, independent of when you watched."
        >
          <Bars
            data={
              order === "count"
                ? result.decadeAnalysis
                : ordered(result.decadeAnalysis)
            }
            average={order === "average"}
            onSelect={drill}
          />
        </Section>
      </div>
      <div className="two-col">
        <Section
          title="Countries of production"
          sub="Co-productions count in each country; this is not filming location."
        >
          <Bars
            data={ordered(result.countries)}
            average={order === "average"}
            onSelect={drill}
          />
        </Section>
        <Section
          title="Original languages"
          sub="TMDB original language, not the language of the print you watched."
        >
          <Bars
            data={ordered(
              result.languages.map((g: any) => ({
                ...g,
                name: languageName(g.name),
              })),
            )}
            average={order === "average"}
            onSelect={drill}
          />
        </Section>
      </div>
      <div className="two-col">
        <Section
          title="Genre double bills"
          sub="Pairs actually appearing together in your matched films."
        >
          <Bars
            data={ordered(pairs)}
            average={order === "average"}
            limit={7}
            onSelect={drill}
          />
        </Section>
        <Section
          title="Less travelled, within your collection"
          sub="Least represented production countries in the matched subset."
        >
          <Bars
            data={[...result.countries].sort(
              (a: any, b: any) =>
                a.count - b.count || a.name.localeCompare(b.name),
            )}
            limit={6}
            onSelect={drill}
          />
          <p className="footnote">
            Missing countries and incomplete metadata are unknown. This does not
            measure diversity against the world’s film catalogue.
          </p>
        </Section>
      </div>
      <Section
        title="Genres through the decades"
        sub="Personal rating means across your eight most represented matched genres and decades. Each cell needs at least three rated films."
      >
        {heat.rows.length ? (
          <div className="table-scroll">
            <table className="heat-table">
              <thead>
                <tr>
                  <th scope="col">Genre</th>
                  {heat.columns.map((c: string) => (
                    <th key={c} scope="col">
                      {c}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {heat.rows.map((r: any) => (
                  <tr key={r.name}>
                    <th scope="row">{r.name}</th>
                    {r.cells.map((c: any) => (
                      <td key={c.column}>
                        <button
                          disabled={!c.count}
                          title={`${r.name} · ${c.column}: ${c.count} films, ${c.rated} rated, ${c.average == null ? "mean withheld below 3 ratings" : fmt(c.average) + " stars"}`}
                          className={
                            c.average == null ? "heat-cell" : "heat-cell enough"
                          }
                          onClick={() =>
                            onDrill(
                              `${r.name} · ${c.column}`,
                              scope.films.filter((f: any) =>
                                c.keys.includes(f.key),
                              ),
                            )
                          }
                        >
                          {c.average == null ? "—" : fmt(c.average)}
                          <small>n={c.rated}</small>
                        </button>
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <Empty title="A richer picture needs metadata">
            Add matched genre metadata to build the rating matrix.
          </Empty>
        )}
      </Section>
      <Section
        title="Collections you have visited"
        sub="TMDB collection membership is shown where known; no franchise completion is inferred."
      >
        <Bars
          data={groupFilms(
            scope.films.filter((f: any) => f.tmdbId),
            "collection",
          )}
          onSelect={drill}
        />
      </Section>
    </>
  );
}
function languageName(code: string) {
  try {
    return new Intl.DisplayNames(["en"], { type: "language" }).of(code) || code;
  } catch {
    return code;
  }
}
export function People({ scope, result, onDrill }: any) {
  const [role, setRole] = useState("directors"),
    [order, setOrder] = useState("count");
  const arr = result[role],
    groups =
      order === "rating"
        ? [...arr]
            .filter((g: any) => g.rated >= 3)
            .sort(
              (a: any, b: any) =>
                b.average - a.average ||
                b.rated - a.rated ||
                a.name.localeCompare(b.name),
            )
        : arr;
  return (
    <>
      <Title
        kicker="THE PEOPLE BEHIND THE PICTURES"
        title="Familiar names. New perspectives."
      >
        Count unique films, rather than repeat viewings. Cast analysis uses the
        first ten billed actors per matched film.
      </Title>
      <div className="view-toolbar">
        <div className="segmented">
          <button
            aria-pressed={role === "directors"}
            onClick={() => setRole("directors")}
          >
            Directors
          </button>
          <button
            aria-pressed={role === "cast"}
            onClick={() => setRole("cast")}
          >
            Actors
          </button>
        </div>
        <label>
          Sort by
          <select value={order} onChange={(e) => setOrder(e.target.value)}>
            <option value="count">Most films watched</option>
            <option value="rating">Highest mean (≥3 rated)</option>
          </select>
        </label>
      </div>
      <Section
        title={
          role === "directors"
            ? "The directors in your collection"
            : "The faces in your collection"
        }
        sub={`${groups.length} ${role === "directors" ? "directors" : "actors"} in this selection. Choose a name for your imported filmography.`}
      >
        <Bars
          data={groups}
          average={order === "rating"}
          limit={30}
          onSelect={(g: any) =>
            onDrill(
              `${g.name} · films in your collection`,
              scope.films.filter((f: any) => g.keys.includes(f.key)),
            )
          }
        />
        <p className="footnote">
          This explores the films you imported, not a complete external
          filmography. Counts and means use the matched subset and may be
          incomplete. Ties are ordered by rated sample size, then name.
        </p>
      </Section>
    </>
  );
}
export function Watchlist({ data, onFilm, onExport }: any) {
  const [query, setQuery] = useState(""),
    [prioritized, setPrioritized] = useState(true),
    [page, setPage] = useState(1);
  const picks = prioritizeWatchlist(data),
    watchedKeys = new Set(data.films.map((f: any) => f.key || titleKey(f))),
    overlap = data.watchlist.filter((f: any) =>
      watchedKeys.has(f.key || titleKey(f)),
    ).length;
  const films = (
    prioritized
      ? picks
      : data.watchlist.map((f: any) => ({
          ...f,
          reason: watchedKeys.has(f.key)
            ? "Also present in your watched collection."
            : "Imported watchlist title.",
        }))
  ).filter((f: any) => f.title.toLowerCase().includes(query.toLowerCase()));
  const safePage = Math.min(page, Math.max(1, Math.ceil(films.length / 30)));
  return (
    <>
      <Title kicker="THE NEXT FRAME" title="Stories still waiting for you.">
        Your own watchlist, with explainable leads from your ratings.
        Suggestions never reach outside the films you imported.
      </Title>
      <div className="metrics three">
        <Metric
          label="Watchlist titles"
          value={data.watchlist.length}
          detail="Kept separate from watched totals"
        />
        <Metric
          label="Still to explore"
          value={data.watchlist.length - overlap}
          detail="No watched identity match"
        />
        <Metric
          label="Also marked watched"
          value={overlap}
          detail="A snapshot overlap, not historical progress"
        />
      </div>
      <Section
        title="Choose your next film"
        sub="Suggestions use the full imported profile; the dashboard date filters do not apply here."
        action={
          <Button onClick={() => onExport(films)}>
            <Download size={15} /> Export CSV
          </Button>
        }
      >
        <div className="explorer-tools">
          <label className="search-label">
            <span className="sr-only">Search watchlist</span>
            <input
              type="search"
              placeholder="Search your watchlist…"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setPage(1);
              }}
            />
          </label>
          <label className="checkbox-label">
            <input
              type="checkbox"
              checked={prioritized}
              onChange={(e) => {
                setPrioritized(e.target.checked);
                setPage(1);
              }}
            />
            Prioritize unwatched titles
          </label>
        </div>
        <p className="body-copy">
          Genre suggestions need at least three rated films in a genre and a
          mean above your overall average. Without genre evidence,
          release-decade evidence receives half weight. Tied scores are
          alphabetized; titles without evidence remain unranked.
        </p>
        {films.length ? (
          <div className="watchlist-cards">
            {films.slice((safePage - 1) * 30, safePage * 30).map((f: any) => (
              <article key={f.key}>
                <button className="watchlist-film" onClick={() => onFilm(f)}>
                  <Poster film={f} />
                  <span>
                    <strong>{f.title}</strong>
                    <small>{f.year ?? "Year unknown"}</small>
                  </span>
                </button>
                <p>{f.reason}</p>
                {f.score != null && (
                  <span className="tag">
                    Taste signal · {fmt(f.score)}★ above your baseline
                  </span>
                )}
              </article>
            ))}
          </div>
        ) : (
          <Empty title="The next chapter is open">
            Import watchlist.csv or clear the search to see titles here.
          </Empty>
        )}
        <Pager page={safePage} total={films.length} onPage={setPage} />
      </Section>
    </>
  );
}
export function YearCompare({ data, onFilm }: any) {
  const years = analyze(data).activity.years.map((v: any) => v.name),
    [yearA, setA] = useState(years.at(-2) || years[0] || ""),
    [yearB, setB] = useState(years.at(-1) || years[0] || "");
  const results = comparePeriods(data, yearA, yearB);
  return (
    <>
      <Title
        kicker="HISTORICAL PERSPECTIVE"
        title="Two years. A different rhythm."
      >
        Compare two recorded diary years from your full import. Undated films
        are excluded, and partial years remain partial.
      </Title>
      <div className="view-toolbar">
        {[
          ["Year A", yearA, setA],
          ["Year B", yearB, setB],
        ].map(([label, value, setter]: any) => (
          <label key={label}>
            {label}
            <select
              aria-label={label}
              value={value}
              onChange={(e) => setter(e.target.value)}
            >
              {years.map((y: string) => (
                <option key={y}>{y}</option>
              ))}
            </select>
          </label>
        ))}
      </div>
      {years.length ? (
        <>
          <div className="two-col">
            {results.map((r: any, i: number) => (
              <Section
                key={i}
                title={`${i === 0 ? "A" : "B"} · ${r.year}`}
                sub={`${r.activity.first || "No logs"} — ${r.activity.last || "No logs"}`}
              >
                <div className="metrics two">
                  <Metric label="Diary entries" value={r.diaryEntries} />
                  <Metric label="Unique films logged" value={r.uniqueFilms} />
                  <Metric
                    label="Event mean rating"
                    value={fmt(r.activity.years[0]?.average)}
                    detail={`${r.activity.years[0]?.rated || 0} rated diary events`}
                  />
                  <Metric
                    label="Longest streak"
                    value={`${r.activity.streak.days} days`}
                  />
                </div>
                <Columns
                  data={r.months.map((m: any, j: number) => ({
                    ...m,
                    name: months[j],
                  }))}
                  color={i === 0 ? "amber" : "cyan"}
                />
                <p className="footnote">
                  Current film mean: {fmt(r.average)} / 5 across {r.ratedFilms}{" "}
                  films; this differs from the event mean above.
                </p>
                <Columns
                  data={r.ratingDistribution.map((d: any) => ({
                    ...d,
                    name: `${d.rating}★`,
                  }))}
                  color={i === 0 ? "amber" : "cyan"}
                />
              </Section>
            ))}
          </div>
          <Section
            title="What changed"
            sub="A comparison of recorded activity, without extrapolating missing periods."
          >
            <p className="body-copy">
              {results[1].year} has{" "}
              {Math.abs(results[1].diaryEntries - results[0].diaryEntries)}{" "}
              {results[1].diaryEntries >= results[0].diaryEntries
                ? "more"
                : "fewer"}{" "}
              diary entries than {results[0].year}. These totals include repeat
              viewings. Equal year selections show the same data.
            </p>
            <p className="footnote">
              To compare custom date ranges, use the dashboard’s From and To
              controls and export each selection. This view compares calendar
              years only.
            </p>
          </Section>
        </>
      ) : (
        <Empty title="Two years need dates">
          Import a dated diary to compare its years.
        </Empty>
      )}
    </>
  );
}
