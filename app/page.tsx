"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import {
  Clapperboard,
  Activity,
  Film,
  CalendarDays,
  Star,
  Compass,
  Users,
  Bookmark,
  ArrowRightLeft,
  ShieldCheck,
  Upload,
  Download,
  Sun,
  Moon,
  Menu,
  X,
  ArrowUpRight,
  RotateCcw,
  Trash2,
  Save,
  FolderOpen,
  Info,
  ChevronRight,
  CheckCircle2,
  Layers3,
} from "lucide-react";
import {
  analyze,
  filterDataset,
  canonicalFilmURL,
  sortFilms,
  titleKey,
} from "../lib/analytics.mjs";
import {
  makeSnapshot,
  readSnapshot,
  filmsCSV,
  reportSVG,
  describeFilters,
} from "../lib/export.mjs";
import {
  createTMDBClient,
  enrichFilms,
  metadataFromDetails,
} from "../lib/tmdb.mjs";
import { loadWorkspace, saveWorkspace, clearWorkspace } from "../lib/storage";
import {
  Button,
  Empty,
  Title,
  Section,
  Metric,
  Modal,
  Poster,
  FilmList,
  Pager,
  fmt,
  MediaConsent,
} from "./ui";
import { Importer, ImportReport } from "./importer";
import {
  Overview,
  Explorer,
  Diary,
  Ratings,
  Taste,
  People,
  Watchlist,
  YearCompare,
} from "./views";
const Comparison = dynamic(() => import("./comparison"), {
  loading: () => <p role="status">Opening comparison…</p>,
});
const navigation = [
  ["overview", "Overview", Activity],
  ["films", "Film explorer", Film],
  ["diary", "Diary & activity", CalendarDays],
  ["ratings", "Ratings", Star],
  ["taste", "Taste & places", Compass],
  ["people", "Directors & actors", Users],
  ["watchlist", "Watchlist & next picks", Bookmark],
  ["years", "Compare years", Layers3],
  ["compare", "Compare profiles", ArrowRightLeft],
  ["settings", "Data & privacy", ShieldCheck],
] as const;
const emptyFilters = {
  year: "",
  from: "",
  to: "",
  rating: "",
  genre: "",
  decade: "",
};
const base = process.env.NEXT_PUBLIC_BASE_PATH
  ? `/${process.env.NEXT_PUBLIC_BASE_PATH.replace(/^\/+|\/+$/g, "")}`
  : "";
function download(text: string, filename: string, type = "application/json") {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export default function Home() {
  const [data, setData] = useState<any>(null),
    [active, setActive] = useState("overview"),
    [importOpen, setImportOpen] = useState(false),
    [mobileNav, setMobileNav] = useState(false),
    [theme, setTheme] = useState("dark"),
    [notice, setNotice] = useState(""),
    [error, setError] = useState(""),
    [filters, setFilters] = useState(emptyFilters),
    [details, setDetails] = useState<any>(null),
    [drill, setDrill] = useState<any>(null),
    [drillPage, setDrillPage] = useState(1),
    [remember, setRemember] = useState(false),
    [storageMessage, setStorageMessage] = useState(
      "Analysis is held in memory until you choose to save it.",
    ),
    [showPosters, setShowPosters] = useState(false),
    [confirmClear, setConfirmClear] = useState(false),
    [comparisonVersion, setComparisonVersion] = useState(0),
    [comparisonVisited, setComparisonVisited] = useState(false);
  const [credential, setCredential] = useState(""),
    [consent, setConsent] = useState(false),
    [enriching, setEnriching] = useState(false),
    [enrichmentProgress, setEnrichmentProgress] = useState(""),
    [batchLimit, setBatchLimit] = useState("100"),
    [manualId, setManualId] = useState(""),
    [matchBusy, setMatchBusy] = useState(false),
    [snapshotBusy, setSnapshotBusy] = useState(false);
  const restoreRef = useRef<HTMLInputElement>(null),
    controllerRef = useRef<AbortController | null>(null),
    epoch = useRef(0),
    userActed = useRef(false),
    heading = useRef<HTMLDivElement>(null),
    saving = useRef(false);
  useEffect(() => {
    try {
      const preferred = localStorage.getItem("fbf-theme");
      const t = preferred === "light" ? "light" : "dark";
      setTheme(t);
      document.documentElement.dataset.theme = t;
    } catch {}
    let mounted = true;
    loadWorkspace()
      .then((s) => {
        if (s && mounted && !userActed.current) {
          setData(readSnapshot(s));
          setRemember(true);
          setStorageMessage("Restored the analysis saved on this device.");
          setNotice(
            "Your saved journal is ready. External poster images stay off until you enable them in Data & privacy.",
          );
        }
      })
      .catch(() => {
        if (mounted)
          setStorageMessage(
            "Browser storage is unavailable. Use a downloadable analysis backup.",
          );
      });
    return () => {
      mounted = false;
      controllerRef.current?.abort();
    };
  }, []);
  useEffect(() => {
    if (!mobileNav) return;
    const previous = document.activeElement as HTMLElement;
    const sidebar = document.querySelector<HTMLElement>(".sidebar")!;
    const items = () =>
      Array.from(
        sidebar.querySelectorAll<HTMLElement>("button:not([disabled]),a[href]"),
      ).filter((e) => e.getClientRects().length > 0);
    items()[0]?.focus();
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setMobileNav(false);
        return;
      }
      if (e.key === "Tab") {
        const list = items(),
          first = list[0],
          last = list.at(-1);
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last?.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first?.focus();
        }
      }
    };
    const resize = () => {
      if (window.innerWidth > 1050) setMobileNav(false);
    };
    document.addEventListener("keydown", key);
    window.addEventListener("resize", resize);
    return () => {
      document.removeEventListener("keydown", key);
      window.removeEventListener("resize", resize);
      setTimeout(() => {
        if (previous?.isConnected) previous.focus();
      }, 0);
    };
  }, [mobileNav]);
  useEffect(() => {
    if (!remember || !data) return;
    let alive = true;
    const timer = setTimeout(() => {
      saving.current = true;
      saveWorkspace(makeSnapshot(data))
        .then(() => {
          if (alive)
            setStorageMessage(
              "Saved on this browser and device. Download a backup for durable storage.",
            );
        })
        .catch((e: any) => {
          if (alive) {
            setError(e.message);
            setRemember(false);
          }
        })
        .finally(() => {
          saving.current = false;
        });
    }, 600);
    return () => {
      alive = false;
      clearTimeout(timer);
    };
  }, [remember, data]);
  const allResult = useMemo<any>(() => (data ? analyze(data) : null), [data]);
  const scope = useMemo(
      () => (data ? filterDataset(data, filters) : null),
      [data, filters],
    ),
    result = useMemo(() => (scope ? analyze(scope) : null), [scope]);
  const selectedFilm =
    details && data
      ? [...data.films, ...data.watchlist].find(
          (f: any) => f.key === details.key,
        ) || details
      : details;
  const go = useCallback((name: string) => {
    setActive(name);
    if (name === "compare") setComparisonVisited(true);
    setMobileNav(false);
    setError("");
    setTimeout(() => heading.current?.focus({ preventScroll: true }), 0);
    window.scrollTo({ top: 0, behavior: "instant" });
  }, []);
  const stopWork = () => {
    epoch.current++;
    controllerRef.current?.abort();
    setEnriching(false);
    setMatchBusy(false);
  };
  const accept = (next: any) => {
    userActed.current = true;
    stopWork();
    setData(next);
    setFilters(emptyFilters);
    setDetails(null);
    setImportOpen(false);
    setShowPosters(false);
    go("overview");
    setNotice(
      `Imported ${next.films.length} unique films and ${next.diary.length} diary entries. Review Data & privacy for validation notices.`,
    );
  };
  const closeImport = useCallback(() => setImportOpen(false), []),
    closeDetails = useCallback(() => {
      setDetails(null);
      setManualId("");
    }, []),
    closeDrill = useCallback(() => setDrill(null), []);
  const onFilm = (film: any) => {
    setManualId("");
    setDetails(film);
  };
  const onDrill = (title: string, films: any[]) => {
    setDrillPage(1);
    setDrill({ title, films });
  };
  const onRating = (r: number) => {
    setFilters((s) => ({ ...s, rating: String(r) }));
    go("films");
  };
  const onYear = (y: string) => {
    setFilters((s) => ({ ...s, year: y, from: "", to: "" }));
    go("diary");
  };
  const onRange = (from: string, to: string) => {
    setFilters((s) => ({ ...s, year: "", from, to }));
    go("films");
  };
  const exportCSV = (films: any[]) =>
    download(
      filmsCSV(films),
      "frame-by-frame-films.csv",
      "text/csv;charset=utf-8",
    );
  const diagnostics = (d: any) =>
    download(
      JSON.stringify(
        {
          files: d.importReport,
          excludedPaths: d.skippedPaths,
          missing: d.missing,
        },
        null,
        2,
      ),
      "frame-by-frame-import-diagnostics.json",
    );
  const changeTheme = () => {
    const t = theme === "dark" ? "light" : "dark";
    setTheme(t);
    document.documentElement.dataset.theme = t;
    try {
      localStorage.setItem("fbf-theme", t);
    } catch {}
  };
  const restore = async (file: File) => {
    setSnapshotBusy(true);
    try {
      if (file.size > 100 * 1024 * 1024)
        throw new Error("Analysis backups must be under 100 MB.");
      const next = readSnapshot(await file.text());
      accept(next);
      setNotice(
        "Analysis backup restored, including original source rows and saved metadata.",
      );
    } catch (e: any) {
      setError(e.message || "Unable to restore this backup.");
    } finally {
      setSnapshotBusy(false);
    }
  };
  const applyMetadata = (key: string, metadata: any, token: number) => {
    if (epoch.current !== token) return;
    setData((d: any) =>
      d
        ? {
            ...d,
            films: d.films.map((f: any) =>
              f.key === key ? { ...f, ...metadata } : f,
            ),
            watchlist: d.watchlist.map((f: any) =>
              f.key === key ? { ...f, ...metadata } : f,
            ),
          }
        : d,
    );
  };
  const runEnrichment = async () => {
    if (!data || !consent || !credential.trim() || enriching) return;
    const token = epoch.current;
    const controller = new AbortController();
    controllerRef.current = controller;
    setEnriching(true);
    setError("");
    setEnrichmentProgress("Connecting to TMDB…");
    setShowPosters(true);
    try {
      const request = createTMDBClient(credential, {
        signal: controller.signal,
      });
      const all = [
        ...new Map(
          [...data.films, ...data.watchlist].map((f: any) => [f.key, f]),
        ).values(),
      ];
      const res = await enrichFilms(all, request, {
        signal: controller.signal,
        limit: Number(batchLimit),
        onFilm: (key: string, m: any) => applyMetadata(key, m, token),
        onProgress: (p: any) => {
          if (epoch.current === token)
            setEnrichmentProgress(`${p.completed} / ${p.total}: ${p.title}`);
        },
      });
      if (epoch.current === token)
        setNotice(
          `TMDB batch finished: ${res.completed} titles checked; ${res.remaining} not yet checked. Open a film to review or correct its match.`,
        );
    } catch (e: any) {
      if (epoch.current === token) {
        if (e.name === "AbortError")
          setNotice("Metadata lookup stopped. Completed matches are retained.");
        else
          setError(
            e.message || "TMDB lookup failed. Your local analysis is safe.",
          );
      }
    } finally {
      if (epoch.current === token) {
        setEnriching(false);
        setEnrichmentProgress("");
      }
    }
  };
  const correctMatch = async (film: any, id: number) => {
    if (!credential.trim() || !consent) {
      setError(
        "Add your own TMDB key and enable metadata consent in Data & privacy before choosing a match.",
      );
      return;
    }
    if (!Number.isSafeInteger(id) || id < 1) {
      setError("Enter a valid numeric TMDB movie ID.");
      return;
    }
    setMatchBusy(true);
    setError("");
    const token = epoch.current,
      controller = new AbortController();
    controllerRef.current = controller;
    try {
      const req = createTMDBClient(credential, { signal: controller.signal });
      const meta = metadataFromDetails(
        await req(`movie/${id}`, { append_to_response: "credits" }),
        "manually-confirmed",
      );
      applyMetadata(film.key, meta, token);
      setShowPosters(true);
      setNotice(
        "TMDB match confirmed. Your imported title and personal ratings are unchanged.",
      );
    } catch (e: any) {
      if (epoch.current === token)
        setError(
          e.name === "AbortError" ? "Match lookup cancelled." : e.message,
        );
    } finally {
      if (epoch.current === token) setMatchBusy(false);
    }
  };
  const removeMetadata = (film: any) => {
    const keys = [
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
    setData((d: any) => {
      const clean = (f: any) => {
        if (f.key !== film.key) return f;
        const n = { ...f };
        keys.forEach((k) => delete n[k]);
        return n;
      };
      return {
        ...d,
        films: d.films.map(clean),
        watchlist: d.watchlist.map(clean),
      };
    });
    setNotice("Metadata removed for this film. It can be matched again.");
  };
  const clearAll = async () => {
    userActed.current = true;
    stopWork();
    setRemember(false);
    let storageFailure = "";
    try {
      await clearWorkspace();
    } catch {
      storageFailure =
        "The current journal and credential are cleared, but this browser blocked storage access. Deletion of a previously saved copy could not be confirmed. Clear this site’s data in your browser settings to remove that copy.";
    }
    setData(null);
    setCredential("");
    setConsent(false);
    setDetails(null);
    setDrill(null);
    setImportOpen(false);
    setShowPosters(false);
    setFilters(emptyFilters);
    setConfirmClear(false);
    setComparisonVersion((v) => v + 1);
    setComparisonVisited(false);
    setNotice(
      storageFailure
        ? "The current journal, comparison and session credential are cleared."
        : "Imported data, saved analysis, comparison and TMDB credential cleared.",
    );
    setStorageMessage(
      storageFailure
        ? "Browser storage is unavailable; deletion of a previously saved copy could not be confirmed."
        : "No analysis is saved on this device.",
    );
    go("overview");
    if (storageFailure) setError(storageFailure);
  };
  const scopedViews = !["compare", "years", "settings", "watchlist"].includes(
    active,
  );
  const filterCount = Object.values(filters).filter(Boolean).length;
  return (
    <MediaConsent.Provider value={showPosters}>
      <a className="skip-link" href="#main-content">
        Skip to analysis
      </a>
      <div className="app-shell">
        {mobileNav && (
          <button
            className="nav-backdrop"
            aria-label="Close navigation"
            onClick={() => setMobileNav(false)}
          />
        )}
        <aside
          aria-label="Journal navigation"
          className={`sidebar ${mobileNav ? "open" : ""}`}
        >
          <a
            href="#main-content"
            className="brand"
            onClick={(e) => {
              e.preventDefault();
              go("overview");
            }}
          >
            <span className="brand-mark">
              <Clapperboard size={23} />
            </span>
            <span>
              <strong>FRAME BY FRAME</strong>
              <small>A LETTERBOXD JOURNAL</small>
            </span>
          </a>
          <button
            className="icon-btn mobile-close"
            aria-label="Close navigation"
            onClick={() => setMobileNav(false)}
          >
            <X size={20} />
          </button>
          <div className="sidebar-caption">YOUR SCREENING ROOM</div>
          <nav aria-label="Main navigation">
            {navigation.map(([id, label, Icon]) => (
              <button
                key={id}
                aria-label={label}
                aria-current={active === id ? "page" : undefined}
                onClick={() => go(id)}
              >
                <Icon size={18} />
                <span>{label}</span>
                {id === "films" && data && <small>{data.films.length}</small>}
              </button>
            ))}
          </nav>
          <div className="sidebar-bottom">
            <p>
              <ShieldCheck size={16} /> A private screening.
            </p>
            <small>
              Your export stays in your browser. No account. No tracking.
            </small>
            <button className="text-btn" onClick={() => go("settings")}>
              Your data controls <ArrowUpRight size={13} />
            </button>
            <span className="edition">PERSONAL EDITION / 2.0</span>
          </div>
        </aside>
        <div className="workspace" inert={mobileNav}>
          <header className="topbar">
            <div className="topbar-title">
              <button
                className="icon-btn mobile-menu"
                aria-label="Open navigation"
                aria-expanded={mobileNav}
                onClick={() => setMobileNav(!mobileNav)}
              >
                {mobileNav ? <X size={21} /> : <Menu size={21} />}
              </button>
              <span className="topbar-crumb">
                Your journal <ChevronRight size={13} />
                <strong>{navigation.find((n) => n[0] === active)?.[1]}</strong>
              </span>
            </div>
            <div className="topbar-actions">
              <span className="local-badge">
                <i /> Local analysis
              </span>
              <button
                className="icon-btn"
                aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} theme`}
                onClick={changeTheme}
              >
                {theme === "dark" ? <Sun size={18} /> : <Moon size={18} />}
              </button>
              <Button
                aria-label="Import data"
                onClick={() => {
                  userActed.current = true;
                  setImportOpen(true);
                }}
              >
                <Upload size={16} />
                <span>Import data</span>
              </Button>
            </div>
          </header>
          <main
            id="main-content"
            className="main-content"
            ref={heading}
            tabIndex={-1}
          >
            <div className="status-region" role="status" aria-live="polite">
              {notice && (
                <div className="notice">
                  <CheckCircle2 size={17} />
                  <span>{notice}</span>
                  <button
                    className="icon-btn"
                    aria-label="Dismiss notification"
                    onClick={() => setNotice("")}
                  >
                    <X size={15} />
                  </button>
                </div>
              )}
            </div>
            {error && !details && (
              <div className="notice error" role="alert">
                <Info size={18} />
                <span>{error}</span>
                <button
                  className="icon-btn"
                  aria-label="Dismiss error"
                  onClick={() => setError("")}
                >
                  <X size={16} />
                </button>
              </div>
            )}
            {data && scopedViews && (
              <div className="filter-bar">
                <div className="filter-caption">
                  <span className="eyebrow">THE CURRENT CUT</span>
                  <span>
                    {scope.films.length.toLocaleString()} films ·{" "}
                    {scope.diary.length.toLocaleString()} diary entries
                  </span>
                </div>
                <div className="filters">
                  <label>
                    Diary year
                    <select
                      aria-label="Diary year"
                      value={filters.year}
                      onChange={(e) =>
                        setFilters((s) => ({
                          ...s,
                          year: e.target.value,
                          from: "",
                          to: "",
                        }))
                      }
                    >
                      <option value="">All time</option>
                      {allResult.activity.years.map((y: any) => (
                        <option key={y.name}>{y.name}</option>
                      ))}
                    </select>
                  </label>
                  <label>
                    From
                    <input
                      type="date"
                      value={filters.from}
                      onChange={(e) =>
                        setFilters((s) => ({
                          ...s,
                          year: "",
                          from: e.target.value,
                        }))
                      }
                    />
                  </label>
                  <label>
                    To
                    <input
                      type="date"
                      value={filters.to}
                      min={filters.from || undefined}
                      onChange={(e) =>
                        setFilters((s) => ({
                          ...s,
                          year: "",
                          to: e.target.value,
                        }))
                      }
                    />
                  </label>
                  <label>
                    Personal rating
                    <select
                      value={filters.rating}
                      onChange={(e) =>
                        setFilters((s) => ({ ...s, rating: e.target.value }))
                      }
                    >
                      <option value="">All ratings</option>
                      {Array.from({ length: 10 }, (_, i) => (
                        <option key={i} value={(i + 1) / 2}>
                          {(i + 1) / 2} ★
                        </option>
                      ))}
                    </select>
                  </label>
                  <details className="more-filters">
                    <summary>
                      More filters {filters.genre || filters.decade ? "•" : ""}
                    </summary>
                    <div>
                      <label>
                        TMDB genre
                        <select
                          value={filters.genre}
                          onChange={(e) =>
                            setFilters((s) => ({ ...s, genre: e.target.value }))
                          }
                        >
                          <option value="">All genres</option>
                          {allResult.genres.map((g: any) => (
                            <option key={g.name}>{g.name}</option>
                          ))}
                        </select>
                      </label>
                      <label>
                        Release decade
                        <select
                          value={filters.decade}
                          onChange={(e) =>
                            setFilters((s) => ({
                              ...s,
                              decade: e.target.value,
                            }))
                          }
                        >
                          <option value="">All decades</option>
                          {[...allResult.decadeAnalysis]
                            .sort((a: any, b: any) =>
                              a.name.localeCompare(b.name),
                            )
                            .map((d: any) => (
                              <option key={d.name} value={d.name.slice(0, -1)}>
                                {d.name}
                              </option>
                            ))}
                        </select>
                      </label>
                    </div>
                  </details>
                  <button
                    className="text-btn reset-filters"
                    onClick={() => setFilters(emptyFilters)}
                  >
                    <RotateCcw size={13} /> Reset
                    {filterCount ? ` (${filterCount})` : ""}
                  </button>
                </div>
                {(filters.year || filters.from || filters.to) && (
                  <p className="footnote">
                    Date filters select diary events and the unique films behind
                    them. Undated films are excluded; film ratings remain
                    current.
                  </p>
                )}
                {filters.from && filters.to && filters.from > filters.to && (
                  <p role="alert" className="error-text">
                    From is after To. Choose a valid range.
                  </p>
                )}
              </div>
            )}
            {!data && !["compare", "settings"].includes(active) && (
              <>
                <section className="welcome">
                  <div className="welcome-copy">
                    <span className="eyebrow">YOUR FILM LIFE, IN FOCUS</span>
                    <h1>
                      Every film leaves
                      <br />a <em>trace.</em>
                    </h1>
                    <p>
                      Find the patterns in what you watch, the stories you
                      return to, and the films that earn your stars.
                    </p>
                    <div className="welcome-actions">
                      <Button primary onClick={() => setImportOpen(true)}>
                        <Upload size={17} /> Analyze my Letterboxd data
                      </Button>
                      <button
                        className="text-btn"
                        onClick={() => go("compare")}
                      >
                        Compare two profiles <ArrowUpRight size={15} />
                      </button>
                    </div>
                    <span className="welcome-privacy">
                      <ShieldCheck size={16} /> No login. No uploads. Yours to
                      explore.
                    </span>
                  </div>
                  <div className="cover-art" aria-hidden="true">
                    <div className="cover-index">
                      A PERSONAL HISTORY
                      <br />
                      OF THE MOVING IMAGE
                    </div>
                    <div className="film-frame frame-one">
                      <span>01</span>
                      <Clapperboard size={56} />
                      <small>THE FIRST IMPRESSION</small>
                    </div>
                    <div className="film-frame frame-two">
                      <span>02</span>
                      <Star size={58} />
                      <small>THE LASTING FEELING</small>
                    </div>
                    <div className="cover-caption">
                      A closer look at your life in cinema.
                    </div>
                  </div>
                </section>
                <div className="welcome-strip">
                  <span>
                    <ShieldCheck size={16} /> Local by default
                  </span>
                  <span>
                    <Film size={16} /> No TMDB key required
                  </span>
                  <span>
                    <Download size={16} /> Keep your analysis
                  </span>
                </div>
                <div className="steps">
                  {[
                    [
                      "01",
                      "Export your journal",
                      "Download your account ZIP from Letterboxd settings. Your diary, watched films and ratings belong here.",
                    ],
                    [
                      "02",
                      "Bring it into focus",
                      "Choose the ZIP or extracted CSVs. We check dates, ratings and duplicates before you begin.",
                    ],
                    [
                      "03",
                      "Follow a thread",
                      "Explore your viewing rhythm, rating fingerprint and personal film archive. Keep a backup when you leave.",
                    ],
                  ].map(([n, title, body]) => (
                    <article key={n}>
                      <span>{n}</span>
                      <h2>{title}</h2>
                      <p>{body}</p>
                      {n === "01" ? (
                        <a
                          href="https://letterboxd.com/user/exportdata"
                          target="_blank"
                          rel="noreferrer"
                        >
                          Open Letterboxd export <ArrowUpRight size={13} />
                        </a>
                      ) : n === "02" ? (
                        <button
                          className="text-btn"
                          onClick={() => setImportOpen(true)}
                        >
                          Choose your files <ArrowUpRight size={13} />
                        </button>
                      ) : (
                        <button
                          className="text-btn"
                          disabled={snapshotBusy}
                          onClick={() => restoreRef.current?.click()}
                        >
                          <FolderOpen size={14} />
                          {snapshotBusy
                            ? "Restoring…"
                            : "Restore an analysis backup"}
                        </button>
                      )}
                    </article>
                  ))}
                </div>
              </>
            )}
            {data && result && active === "overview" && (
              <Overview
                scope={scope}
                result={result}
                onNavigate={go}
                onFilm={onFilm}
                onRating={onRating}
                onYear={onYear}
              />
            )}
            {data && active === "films" && (
              <Explorer
                key={JSON.stringify(filters)}
                scope={scope}
                onFilm={onFilm}
                onExport={exportCSV}
              />
            )}
            {data && active === "diary" && (
              <Diary
                key={JSON.stringify(filters)}
                scope={scope}
                result={result}
                onFilm={onFilm}
                onRange={onRange}
              />
            )}
            {data && active === "ratings" && (
              <Ratings
                scope={scope}
                result={result}
                onFilm={onFilm}
                onRating={onRating}
                onDrill={onDrill}
              />
            )}
            {data && active === "taste" && (
              <Taste
                scope={scope}
                result={result}
                onDrill={onDrill}
                onNavigate={go}
              />
            )}
            {data && active === "people" && (
              <People scope={scope} result={result} onDrill={onDrill} />
            )}
            {data && active === "watchlist" && (
              <Watchlist data={data} onFilm={onFilm} onExport={exportCSV} />
            )}
            {data && active === "years" && (
              <YearCompare data={data} onFilm={onFilm} />
            )}
            {comparisonVisited && (
              <div hidden={active !== "compare"}>
                <Comparison key={comparisonVersion} />
              </div>
            )}
            {active === "settings" && (
              <>
                <Title
                  kicker="YOUR DATA, YOUR CALL"
                  title="A private screening room."
                >
                  Understand your data, add optional metadata, and choose what
                  stays on this device.
                </Title>
                <div className="two-col">
                  <Section
                    title="Keep your journal"
                    sub="Saving is optional. By default your analysis stays in memory."
                  >
                    <label className="checkbox-label">
                      <input
                        type="checkbox"
                        checked={remember}
                        disabled={!data}
                        onChange={async (e) => {
                          const enabled = e.target.checked;
                          setRemember(enabled);
                          if (!enabled) {
                            try {
                              await clearWorkspace();
                              setStorageMessage(
                                "The saved copy was deleted. Your current session remains open.",
                              );
                            } catch (e: any) {
                              setError(e.message);
                            }
                          }
                        }}
                      />
                      Save analysis on this browser and device
                    </label>
                    <p className="body-copy">
                      {storageMessage} Anyone with access to this browser
                      profile can access a saved analysis. Browser cleanup may
                      remove it.
                    </p>
                    <div className="button-row">
                      <Button
                        disabled={!data}
                        onClick={() => {
                          download(
                            JSON.stringify(makeSnapshot(data), null, 2),
                            "frame-by-frame-analysis.json",
                          );
                          setNotice(
                            "Analysis backup downloaded. It contains film titles, ratings, diary and review data. Keep it private.",
                          );
                        }}
                      >
                        <Save size={16} /> Download analysis backup
                      </Button>
                      <Button
                        disabled={snapshotBusy}
                        onClick={() => restoreRef.current?.click()}
                      >
                        <FolderOpen size={16} />
                        {snapshotBusy ? "Restoring…" : "Restore analysis"}
                      </Button>
                    </div>
                  </Section>
                  <Section
                    title="Export the current cut"
                    sub="Use these files outside the app."
                  >
                    <p className="body-copy">
                      CSV contains the films in your current dashboard
                      selection. The SVG report is a shareable image with your
                      metrics and highest-rated titles. Backups always include
                      the full import.
                    </p>
                    <div className="button-row">
                      <Button
                        disabled={!data}
                        onClick={() => exportCSV(scope.films)}
                      >
                        <Download size={15} /> Filtered films CSV
                      </Button>
                      <Button
                        disabled={!data}
                        onClick={() =>
                          download(
                            reportSVG(
                              scope,
                              filters.year ||
                                (filters.from || filters.to
                                  ? "Selected period"
                                  : "All time"),
                              describeFilters(filters),
                            ),
                            "frame-by-frame-report.svg",
                            "image/svg+xml",
                          )
                        }
                      >
                        <Download size={15} /> Movie report image
                      </Button>
                    </div>
                    <p className="footnote">
                      Downloaded files may contain personal viewing history.
                      Clearing this app does not delete downloads.
                    </p>
                  </Section>
                </div>
                <Section
                  title="Optional TMDB metadata"
                  sub="Genres, people, runtimes, countries, original languages and posters."
                >
                  <div className="metadata-layout">
                    <div>
                      <p className="body-copy">
                        Core analysis needs no API key. If you enable metadata,
                        film titles, release years or provided film identifiers
                        are sent directly to TMDB. Poster requests go to TMDB’s
                        image service. Your archive, reviews and ratings are
                        never sent.
                      </p>
                      <p className="body-copy">
                        A static website cannot hide a secret. Use your own key
                        or read access token; it remains in memory, is excluded
                        from backups, and is cleared on reload. A v3 key is sent
                        in the request URL; a read token uses an Authorization
                        header.
                      </p>
                      <a
                        href="https://www.themoviedb.org/settings/api"
                        target="_blank"
                        rel="noreferrer"
                      >
                        Get your own TMDB credential <ArrowUpRight size={13} />
                      </a>
                    </div>
                    <div className="metadata-form">
                      <label htmlFor="tmdb-key">
                        Your TMDB API key or read access token
                      </label>
                      <input
                        id="tmdb-key"
                        type="password"
                        autoComplete="off"
                        spellCheck={false}
                        value={credential}
                        disabled={enriching || matchBusy}
                        onChange={(e) => setCredential(e.target.value)}
                        placeholder="Paste your personal TMDB credential"
                      />
                      <label className="checkbox-label">
                        <input
                          type="checkbox"
                          checked={consent}
                          onChange={(e) => {
                            setConsent(e.target.checked);
                            if (!e.target.checked) {
                              controllerRef.current?.abort();
                              setShowPosters(false);
                            }
                          }}
                        />
                        I choose to send film search terms to TMDB and load
                        poster images.
                      </label>
                      <label>
                        Batch size
                        <select
                          value={batchLimit}
                          disabled={enriching}
                          onChange={(e) => setBatchLimit(e.target.value)}
                        >
                          <option value="25">25 titles</option>
                          <option value="100">100 titles</option>
                          <option value="250">250 titles</option>
                        </select>
                      </label>
                      <div className="button-row">
                        <Button
                          primary
                          disabled={
                            !data ||
                            !credential.trim() ||
                            !consent ||
                            enriching ||
                            matchBusy
                          }
                          onClick={runEnrichment}
                        >
                          Enrich next batch
                        </Button>
                        {enriching && (
                          <Button
                            onClick={() => controllerRef.current?.abort()}
                          >
                            Stop lookup
                          </Button>
                        )}
                        <button
                          className="text-btn"
                          disabled={enriching || matchBusy}
                          onClick={() => {
                            setCredential("");
                            setConsent(false);
                          }}
                        >
                          Forget credential
                        </button>
                      </div>
                      <p role="status" className="footnote">
                        {enriching
                          ? enrichmentProgress
                          : data
                            ? `${[...data.films, ...data.watchlist].filter((f: any) => f.tmdbId).length} matched records · ${[...data.films, ...data.watchlist].filter((f: any) => f.matchStatus === "review").length} need match review`
                            : "Import films to enable metadata."}
                      </p>
                    </div>
                  </div>
                  <div className="metadata-footer">
                    <label className="checkbox-label">
                      <input
                        type="checkbox"
                        checked={showPosters}
                        onChange={(e) => setShowPosters(e.target.checked)}
                      />
                      Load external TMDB poster images
                    </label>
                    <p className="footnote">
                      Matched metadata is cached in the current analysis and
                      included in backups. Each batch skips already checked
                      films. Open a film to choose another match or remove
                      metadata to retry. Uncertain matches never contribute
                      metadata analytics.
                    </p>
                  </div>
                </Section>
                {data && (
                  <Section
                    title="Import quality & coverage"
                    sub="The full import, before dashboard filters."
                  >
                    <ImportReport data={data} onDownload={diagnostics} />
                    <p className="footnote">
                      Missing optional datasets:{" "}
                      {data.missing?.length
                        ? data.missing.map((t: string) => `${t}.csv`).join(", ")
                        : "none"}
                      .
                    </p>
                  </Section>
                )}
                <Section
                  title="How your numbers are counted"
                  sub="An audit trail for the entire dashboard."
                >
                  <div className="method-grid">
                    <article>
                      <h3>Films & identities</h3>
                      <p>
                        Distinct canonical Letterboxd film links are preferred.
                        When a link is missing, normalized Unicode title and
                        exact release year are used. Ambiguous same-title/year
                        films cannot always be resolved without links. Watched,
                        ratings, diary and reviews contribute films; watchlist
                        stays separate.
                      </p>
                    </article>
                    <article>
                      <h3>Diary events & dates</h3>
                      <p>
                        Every accepted diary row is one event, even if identical
                        to another row. Only Watched Date creates activity.
                        Generic Date and release Year never create viewing
                        dates. Rewatch counts use explicit flags; the absence of
                        a flag does not prove a first watch.
                      </p>
                    </article>
                    <article>
                      <h3>Personal ratings</h3>
                      <p>
                        Only 0.5 to 5 stars in half-star steps. Current
                        ratings.csv values override diary/review ratings; the
                        latest valid Date wins within ratings.csv, then source
                        row order. Without ratings.csv the latest rated diary
                        event wins. Event rating trends keep each diary rating.
                      </p>
                    </article>
                    <article>
                      <h3>Categories & runtime</h3>
                      <p>
                        Metadata analytics use only matched films. Multi-genre
                        films and co-productions count in each category. Actor
                        counts cover the first ten billed cast members. Runtime
                        sums exclude missing runtimes. Rankings by personal mean
                        require at least three ratings per category.
                      </p>
                    </article>
                    <article>
                      <h3>Privacy & retention</h3>
                      <p>
                        There is no upload endpoint or analytics tracker. Source
                        film CSV rows, including review text, are retained for
                        backups. Profile fields other than Username are
                        discarded. Save-on-device uses this site’s browser
                        storage; comparison is never saved.
                      </p>
                    </article>
                    <article>
                      <h3>Scope & limitations</h3>
                      <p>
                        Date filters select diary events and their film set.
                        Film means use current film ratings. Watchlist, year
                        comparison, profile comparison and this settings page
                        use the full import. Export gaps and unmatched metadata
                        remain unknown; this app does not scrape Letterboxd.
                      </p>
                    </article>
                  </div>
                </Section>
                <Section
                  title="Clear your screening room"
                  sub="Remove current imported data, the saved local copy, comparisons and the session credential."
                >
                  <Button
                    onClick={() => setConfirmClear(true)}
                    className="danger"
                  >
                    <Trash2 size={16} /> Clear all imported and saved data
                  </Button>
                  <p className="footnote">
                    Your theme preference is kept. Downloaded files and copies
                    stored elsewhere are unaffected.
                  </p>
                </Section>
                <Section
                  title="Credits & sources"
                  sub="Independent, personal movie analytics."
                >
                  <p className="body-copy">
                    Created and maintained by{" "}
                    <a
                      href="https://melvinvarghese.in"
                      target="_blank"
                      rel="noreferrer"
                    >
                      Melvin Varghese
                    </a>
                    . Not affiliated with Letterboxd. No official Letterboxd API
                    is used.
                  </p>
                  <a
                    href="https://www.themoviedb.org/"
                    target="_blank"
                    rel="noreferrer"
                  >
                    <img
                      className="tmdb-logo"
                      src={`${base}/tmdb.svg`}
                      width="112"
                      height="20"
                      alt="TMDB"
                    />
                  </a>
                  <p className="body-copy">
                    This product uses the TMDB API but is not endorsed or
                    certified by TMDB.
                  </p>
                  <p className="footnote">
                    Film data and posters, when enabled, come from TMDB.
                    Developer API use is subject to TMDB’s terms and attribution
                    rules; commercial use requires separate licensing.{" "}
                    <a
                      href="https://www.themoviedb.org/api-terms-of-use"
                      target="_blank"
                      rel="noreferrer"
                    >
                      Read TMDB terms ↗
                    </a>
                  </p>
                </Section>
              </>
            )}
            <footer className="footer">
              <span>
                FRAME BY FRAME <i> / </i> A PERSONAL FILM JOURNAL
              </span>
              <span>
                By{" "}
                <a
                  href="https://melvinvarghese.in"
                  target="_blank"
                  rel="noreferrer"
                >
                  Melvin Varghese
                </a>{" "}
                · Independent of Letterboxd
              </span>
            </footer>
          </main>
        </div>
      </div>
      <input
        ref={restoreRef}
        className="sr-only"
        type="file"
        aria-label="Restore saved analysis JSON"
        accept=".json,application/json"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) void restore(file);
          e.target.value = "";
        }}
      />
      {importOpen && (
        <Importer
          onAccept={accept}
          onClose={closeImport}
          onDownload={diagnostics}
        />
      )}
      {selectedFilm && (
        <Modal title={selectedFilm.title} onClose={closeDetails} wide>
          <div className="modal-body">
            <div className="detail-hero">
              <Poster film={selectedFilm} large />
              <div>
                <span className="eyebrow">
                  {selectedFilm.year ?? "RELEASE YEAR UNKNOWN"}
                </span>
                <h3>{selectedFilm.title}</h3>
                <p>
                  {selectedFilm.directors?.join(" · ") ||
                    "Director metadata not available"}
                </p>
                <div className="detail-ratings">
                  <span>
                    {selectedFilm.rating != null
                      ? `${selectedFilm.rating}★`
                      : "Unrated"}
                    <small>Your current rating / 5</small>
                  </span>
                  <span>
                    {selectedFilm.externalRating != null
                      ? `${fmt(selectedFilm.externalRating, 1)}`
                      : "—"}
                    <small>
                      TMDB / 10 · {selectedFilm.voteCount ?? 0} votes
                    </small>
                  </span>
                </div>
                {canonicalFilmURL(selectedFilm.url) && (
                  <a
                    href={canonicalFilmURL(selectedFilm.url)}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Open on Letterboxd <ArrowUpRight size={13} />
                  </a>
                )}
                {selectedFilm.tmdbId && (
                  <a
                    href={`https://www.themoviedb.org/movie/${selectedFilm.tmdbId}`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    TMDB movie {selectedFilm.tmdbId} ↗
                  </a>
                )}
              </div>
            </div>
            {selectedFilm.overview && (
              <p className="body-copy">{selectedFilm.overview}</p>
            )}
            <dl className="film-facts">
              <div>
                <dt>Genres</dt>
                <dd>{selectedFilm.genres?.join(", ") || "Unknown"}</dd>
              </div>
              <div>
                <dt>Runtime</dt>
                <dd>
                  {selectedFilm.runtime
                    ? `${selectedFilm.runtime} minutes`
                    : "Unknown"}
                </dd>
              </div>
              <div>
                <dt>Production countries</dt>
                <dd>{selectedFilm.countries?.join(", ") || "Unknown"}</dd>
              </div>
              <div>
                <dt>Original language</dt>
                <dd>{selectedFilm.languages?.join(", ") || "Unknown"}</dd>
              </div>
              <div>
                <dt>TMDB release date</dt>
                <dd>{selectedFilm.releaseDate || "Unknown"}</dd>
              </div>
              <div>
                <dt>Match method</dt>
                <dd>
                  {selectedFilm.tmdbMatchConfidence ||
                    selectedFilm.matchStatus ||
                    "Not checked"}
                </dd>
              </div>
            </dl>
            {selectedFilm.cast?.length > 0 && (
              <p className="body-copy">
                <b>First ten billed cast:</b> {selectedFilm.cast.join(", ")}
              </p>
            )}
            <h3 className="detail-heading">Your diary for this film</h3>
            <p className="footnote">
              {
                (data?.diary || []).filter(
                  (e: any) => e.key === selectedFilm.key,
                ).length
              }{" "}
              imported events. Missing rewatch flags mean unknown.
            </p>
            <ul className="diary-events">
              {(data?.diary || [])
                .filter((e: any) => e.key === selectedFilm.key)
                .slice(0, 200)
                .map((e: any, i: number) => (
                  <li key={i}>
                    <span>{e.date || "Undated"}</span>
                    <span>
                      {e.rating != null ? `${e.rating}★` : "Unrated"} ·{" "}
                      {e.rewatch ? "Rewatch flagged" : "No rewatch flag"}
                    </span>
                  </li>
                ))}
            </ul>
            {(data?.diary || []).filter((e: any) => e.key === selectedFilm.key)
              .length > 200 && (
              <p className="footnote">
                First 200 events displayed; all are retained in your analysis
                backup.
              </p>
            )}
            {selectedFilm.review && (
              <details className="warnings">
                <summary>Imported review text · may contain spoilers</summary>
                <p className="review-text">{selectedFilm.review}</p>
              </details>
            )}
            <details
              className="warnings"
              open={selectedFilm.matchStatus === "review"}
            >
              <summary>Review or correct the TMDB match</summary>
              <p className="body-copy">
                {selectedFilm.matchStatus === "review"
                  ? "The match is uncertain. Choose a candidate or provide a TMDB movie ID; metadata is excluded until confirmed."
                  : "Confirm a candidate or enter the numeric movie ID from a TMDB movie page. Your Letterboxd title stays unchanged."}
              </p>
              {error && (
                <p className="notice error" role="alert">
                  {error}
                </p>
              )}
              {credential.trim() && consent ? (
                <>
                  <div className="match-candidates">
                    {selectedFilm.candidates?.map((c: any) => (
                      <Button
                        key={c.id}
                        disabled={matchBusy || enriching}
                        onClick={() => correctMatch(selectedFilm, c.id)}
                      >
                        {c.title} ({c.year ?? "?"}) · Use ID {c.id}
                      </Button>
                    ))}
                  </div>
                  <div className="manual-match">
                    <label htmlFor="manual-tmdb">
                      TMDB movie ID
                      <input
                        id="manual-tmdb"
                        inputMode="numeric"
                        pattern="[0-9]+"
                        value={manualId}
                        onChange={(e) => setManualId(e.target.value)}
                        placeholder="e.g. 550"
                      />
                    </label>
                    <Button
                      disabled={
                        !/^\d+$/.test(manualId) || matchBusy || enriching
                      }
                      onClick={() =>
                        correctMatch(selectedFilm, Number(manualId))
                      }
                    >
                      {matchBusy ? "Looking up…" : "Use this movie ID"}
                    </Button>
                  </div>
                </>
              ) : (
                <Button
                  onClick={() => {
                    closeDetails();
                    go("settings");
                  }}
                >
                  Enable TMDB in Data & privacy
                </Button>
              )}
              {(selectedFilm.tmdbId || selectedFilm.metadataAt) && (
                <button
                  className="text-btn"
                  disabled={enriching || matchBusy}
                  onClick={() => removeMetadata(selectedFilm)}
                >
                  Remove metadata and allow retry
                </button>
              )}
            </details>
            <p className="footnote">
              TMDB data is a separate source. This product uses the TMDB API but
              is not endorsed or certified by TMDB.
            </p>
          </div>
        </Modal>
      )}
      {drill && (
        <Modal title={drill.title} onClose={closeDrill} wide>
          <div className="modal-body">
            <p className="body-copy">
              {drill.films.length} films in this result. Open a title for its
              diary and metadata.
            </p>
            <FilmList
              films={drill.films.slice((drillPage - 1) * 30, drillPage * 30)}
              limit={30}
              onFilm={(f: any) => {
                setDrill(null);
                onFilm(f);
              }}
            />
            <Pager
              page={drillPage}
              total={drill.films.length}
              onPage={setDrillPage}
            />
            <Button onClick={() => exportCSV(drill.films)}>
              <Download size={15} /> Export these films
            </Button>
          </div>
        </Modal>
      )}
      {confirmClear && (
        <Modal
          title="Clear all imported and saved data?"
          onClose={() => setConfirmClear(false)}
        >
          <div className="modal-body">
            <p className="body-copy">
              This removes the current analysis, the copy saved in this browser,
              comparisons, and your session TMDB credential. Download a backup
              first if you want to keep your work.
            </p>
            <div className="button-row">
              <Button onClick={() => setConfirmClear(false)}>
                Keep my analysis
              </Button>
              <Button className="danger" onClick={clearAll}>
                Clear all data
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </MediaConsent.Provider>
  );
}
