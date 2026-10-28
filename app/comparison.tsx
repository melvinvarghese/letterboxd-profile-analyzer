"use client";
import { useMemo, useRef, useState } from "react";
import { Upload, Trash2, ArrowRightLeft } from "lucide-react";
import { buildComparisonProfile, compareProfiles } from "../lib/analytics.mjs";
import { useExportReader } from "./importer";
import { Button, Title, Section, Metric, Empty, Pager, fmt } from "./ui";
export default function Comparison() {
  const [sides, setSides] = useState<any>({ A: null, B: null }),
    [result, setResult] = useState<any>(null),
    [tab, setTab] = useState("shared"),
    [page, setPage] = useState(1),
    [query, setQuery] = useState("");
  const readerA = useExportReader(),
    readerB = useExportReader(),
    aRef = useRef<HTMLInputElement>(null),
    bRef = useRef<HTMLInputElement>(null);
  const choose = async (files: File[], side: "A" | "B") => {
    setResult(null);
    setSides((s: any) => ({ ...s, [side]: null }));
    const reader = side === "A" ? readerA : readerB;
    const r = await reader.read(files);
    if (r) {
      const profile = buildComparisonProfile(r.data.sourceFiles, r.username);
      if (!profile.films.length) {
        reader.setError(
          `Profile ${side} needs watched, rated or diary films. A watchlist alone cannot be compared.`,
        );
        return;
      }
      setSides((s: any) => ({
        ...s,
        [side]: { profile, report: r.report, skippedPaths: r.skippedPaths },
      }));
    }
  };
  const films = useMemo(() => {
    if (!result) return [];
    return (
      tab === "shared"
        ? result.sharedFilms
        : tab === "A"
          ? result.uniqueToA
          : result.uniqueToB
    )
      .filter((f: any) => f.title.toLowerCase().includes(query.toLowerCase()))
      .sort((a: any, b: any) => a.title.localeCompare(b.title));
  }, [result, tab, query]);
  const safePage = Math.min(page, Math.max(1, Math.ceil(films.length / 30)));
  const labelA = sides.A?.profile.username || "Profile A",
    labelB = sides.B?.profile.username || "Profile B";
  return (
    <>
      <Title kicker="TWO TASTES, SIDE BY SIDE" title="Find your common ground.">
        Compare two separate Letterboxd exports or two snapshots in time. Films
        match by normalized title and exact release year; unknown years only
        match other unknown years.
      </Title>
      <p className="notice">
        Comparison stays in memory and leaves your primary analysis unchanged.
        Only Username is read from profile.csv; other profile fields are
        discarded.
      </p>
      <div className="two-col">
        {(["A", "B"] as const).map((side) => {
          const reader = side === "A" ? readerA : readerB,
            ref = side === "A" ? aRef : bRef,
            state = sides[side];
          return (
            <Section
              key={side}
              title={`Profile ${side}`}
              sub={state?.profile.username || "Username unavailable"}
            >
              <input
                type="file"
                className="sr-only"
                ref={ref}
                accept=".zip,.csv"
                multiple
                aria-label={`Choose Profile ${side} export`}
                onChange={(e) => {
                  void choose(Array.from(e.target.files || []), side);
                  e.target.value = "";
                }}
              />
              <div className="compare-upload">
                <ArrowRightLeft size={27} />
                <h3>
                  {state
                    ? `${state.profile.films.length} films ready`
                    : "Choose one film journal"}
                </h3>
                <p>One ZIP or several CSV files from the same export.</p>
                <Button
                  disabled={reader.busy}
                  onClick={() => ref.current?.click()}
                >
                  <Upload size={16} />
                  {reader.busy
                    ? reader.progress.message
                    : `Choose Profile ${side} files`}
                </Button>
              </div>
              {reader.busy && (
                <>
                  <progress
                    max="100"
                    value={reader.progress.percent}
                    aria-label={`Profile ${side} import progress`}
                  />
                  <Button onClick={reader.cancel}>Cancel</Button>
                </>
              )}
              {reader.error && (
                <p className="notice error" role="alert">
                  {reader.error}
                </p>
              )}
              {state && (
                <details className="warnings">
                  <summary>Files and validation summary</summary>
                  <ul>
                    {state.report.map((f: any) => (
                      <li key={f.type}>
                        {f.name}: {f.acceptedRows} accepted, {f.skippedRows}{" "}
                        excluded, {f.issues.length} notices
                      </li>
                    ))}
                  </ul>
                  {state.skippedPaths.length > 0 && (
                    <p>
                      {state.skippedPaths.length} unrelated or nested paths
                      excluded.
                    </p>
                  )}
                </details>
              )}
            </Section>
          );
        })}
      </div>
      <div className="view-toolbar">
        <Button
          primary
          disabled={!sides.A || !sides.B || readerA.busy || readerB.busy}
          onClick={() => {
            setResult(compareProfiles(sides.A.profile, sides.B.profile));
            setTab("shared");
            setPage(1);
            setQuery("");
          }}
        >
          Compare profiles
        </Button>
        <Button
          onClick={() => {
            readerA.cancel();
            readerB.cancel();
            setSides({ A: null, B: null });
            setResult(null);
            readerA.setError("");
            readerB.setError("");
          }}
        >
          <Trash2 size={15} /> Clear comparison
        </Button>
      </div>
      <p role="status" className="sr-only">
        {result
          ? `Comparison complete: ${result.sharedFilms.length} shared films; ${result.uniqueToA.length} unique to Profile A; ${result.uniqueToB.length} unique to Profile B.`
          : ""}
      </p>
      {result && (
        <>
          <div className="metrics three">
            <Metric label="Shared films" value={result.sharedFilms.length} />
            <Metric
              label={`Only ${labelA} (A)`}
              value={result.uniqueToA.length}
            />
            <Metric
              label={`Only ${labelB} (B)`}
              value={result.uniqueToB.length}
            />
          </div>
          <Section
            title="Rating correlation"
            sub={`${result.sharedRatedFilms} shared films rated by both profiles.`}
          >
            <p className="body-copy">
              {result.sharedRatedFilms < 3
                ? "At least three shared films rated by both profiles are needed to calculate a correlation."
                : result.ratingCorrelation === null
                  ? "Correlation is unavailable because the ratings do not vary in one or both profiles."
                  : `Pearson correlation: ${fmt(result.ratingCorrelation)}. This describes how the two sets of shared-film ratings move together; it is not a compatibility or personality score.`}
            </p>
          </Section>
          <Section
            title="The films behind the comparison"
            sub="Missing ratings are shown as —. Differences are Profile A minus Profile B."
          >
            <div className="explorer-tools">
              <div className="segmented">
                {[
                  ["shared", "Shared films"],
                  ["A", `Only A`],
                  ["B", `Only B`],
                ].map(([v, label]) => (
                  <button
                    key={v}
                    aria-pressed={tab === v}
                    onClick={() => {
                      setTab(v);
                      setPage(1);
                    }}
                  >
                    {label}
                  </button>
                ))}
              </div>
              <label className="search-label">
                <span className="sr-only">Search comparison films</span>
                <input
                  type="search"
                  value={query}
                  placeholder="Search comparison…"
                  onChange={(e) => {
                    setQuery(e.target.value);
                    setPage(1);
                  }}
                />
              </label>
            </div>
            {films.length ? (
              <div className="table-scroll">
                <table>
                  <thead>
                    <tr>
                      <th scope="col">Film</th>
                      <th scope="col">
                        {tab === "shared" ? `${labelA} (A)` : "Personal rating"}
                      </th>
                      <th scope="col">
                        {tab === "shared" ? `${labelB} (B)` : "Diary dates"}
                      </th>
                      {tab === "shared" && <th scope="col">A − B</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {films
                      .slice((safePage - 1) * 30, safePage * 30)
                      .map((f: any, i: number) => (
                        <tr key={i}>
                          <td>
                            <strong>{f.title}</strong>
                            <small>{f.year ?? "Year unknown"}</small>
                          </td>
                          <td>
                            {tab === "shared" ? (
                              <>
                                {f.a.rating ?? "—"}
                                <small>
                                  {f.a.diaryDates.join(", ") ||
                                    "No dated diary logs"}
                                </small>
                              </>
                            ) : (
                              (f.rating ?? "—")
                            )}
                          </td>
                          <td>
                            {tab === "shared" ? (
                              <>
                                {f.b.rating ?? "—"}
                                <small>
                                  {f.b.diaryDates.join(", ") ||
                                    "No dated diary logs"}
                                </small>
                              </>
                            ) : (
                              f.diaryDates.join(", ") || "No dated diary logs"
                            )}
                          </td>
                          {tab === "shared" && (
                            <td>{fmt(f.ratingDifference)}</td>
                          )}
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <Empty>No matching films in this comparison tab.</Empty>
            )}
            <Pager page={safePage} total={films.length} onPage={setPage} />
          </Section>
        </>
      )}
    </>
  );
}
