"use client";
import {
  useEffect,
  useRef,
  useState,
  ReactNode,
  createContext,
  useContext,
} from "react";
import { X, Film, ChevronLeft, ChevronRight } from "lucide-react";
export const MediaConsent = createContext(false);
export const fmt = (v: number | null | undefined, d = 2) =>
  v == null
    ? "—"
    : Number(v).toLocaleString("en", {
        maximumFractionDigits: d,
        minimumFractionDigits: d,
      });
export function Button({ children, onClick, primary = false, ...props }: any) {
  return (
    <button
      type="button"
      {...props}
      className={`btn ${primary ? "primary" : ""} ${props.className || ""}`}
      onClick={onClick}
    >
      {children}
    </button>
  );
}
export function Modal({
  title,
  children,
  onClose,
  wide = false,
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
  wide?: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null),
    closeRef = useRef(onClose);
  closeRef.current = onClose;
  useEffect(() => {
    const d = ref.current!,
      previous = document.activeElement as HTMLElement;
    d.showModal();
    const close = (e: Event) => {
      e.preventDefault();
      closeRef.current();
    };
    d.addEventListener("cancel", close);
    return () => {
      d.removeEventListener("cancel", close);
      d.close();
      if (previous?.isConnected) previous.focus();
    };
  }, []);
  return (
    <dialog
      ref={ref}
      aria-labelledby="dialog-title"
      className={wide ? "modal wide" : "modal"}
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          const r = e.currentTarget.getBoundingClientRect();
          if (
            e.clientX < r.left ||
            e.clientX > r.right ||
            e.clientY < r.top ||
            e.clientY > r.bottom
          )
            onClose();
        }
      }}
    >
      <header className="modal-header">
        <h2 id="dialog-title">{title}</h2>
        <button
          className="icon-btn"
          aria-label="Close dialog"
          onClick={onClose}
        >
          <X size={20} />
        </button>
      </header>
      {children}
    </dialog>
  );
}
export function Empty({ title = "No records in this view", children }: any) {
  return (
    <div className="empty">
      <Film size={24} />
      <h3>{title}</h3>
      <p>{children}</p>
    </div>
  );
}
export function Metric({ label, value, detail, onClick }: any) {
  const contents = (
    <>
      <span className="eyebrow">{label}</span>
      <strong>{value}</strong>
      <small>{detail}</small>
    </>
  );
  return onClick ? (
    <button className="metric" onClick={onClick}>
      {contents}
    </button>
  ) : (
    <div className="metric">{contents}</div>
  );
}
export function Section({ title, sub, action, children, className = "" }: any) {
  return (
    <section className={`panel ${className}`}>
      <div className="section-head">
        <div>
          <h2>{title}</h2>
          {sub && <p>{sub}</p>}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}
export function Title({ kicker, title, children }: any) {
  return (
    <div className="page-title">
      <span className="eyebrow">{kicker}</span>
      <h1>{title}</h1>
      <p>{children}</p>
    </div>
  );
}
export function Columns({
  data,
  onSelect,
  value = "count",
  label = "name",
  suffix = "",
  color = "green",
}: any) {
  const max = Math.max(1, ...data.map((d: any) => d[value] || 0));
  return data.length ? (
    <div
      className={`columns ${color}`}
      aria-label="Interactive chart; choose a bar to explore its records"
    >
      {data.map((d: any, i: number) => (
        <button
          key={i}
          className="column"
          disabled={!onSelect}
          onClick={() => onSelect?.(d)}
          title={`${d[label]}: ${d[value] ?? "No data"}${suffix}`}
          aria-label={`${d[label]}: ${d[value] ?? "No data"}${suffix}${onSelect ? ", show records" : ""}`}
        >
          <span className="column-value">
            {d[value] == null
              ? "—"
              : Number.isInteger(d[value])
                ? d[value]
                : fmt(d[value])}
          </span>
          <span className="column-track">
            <span
              style={{
                height: `${Math.max(0, ((d[value] || 0) / max) * 100)}%`,
              }}
            />
          </span>
          <span className="column-label">{d[label]}</span>
        </button>
      ))}
    </div>
  ) : (
    <Empty>No dated activity is available.</Empty>
  );
}
export function Bars({ data, onSelect, average = false, limit = 10 }: any) {
  const max = Math.max(
    1,
    ...data.map((d: any) => (average ? d.average || 0 : d.count)),
  );
  return data.length ? (
    <div className="bar-list">
      {data.slice(0, limit).map((d: any, i: number) => (
        <button
          key={d.name}
          disabled={!onSelect}
          onClick={() => onSelect?.(d)}
          className="bar-row"
          title={`${d.name}: ${d.count} films, ${d.rated || 0} rated, mean ${fmt(d.average)}`}
        >
          <span className="bar-rank">{String(i + 1).padStart(2, "0")}</span>
          <span className="bar-content">
            <span>{d.name}</span>
            <span className="bar-track">
              <span
                style={{
                  width: `${((average ? d.average || 0 : d.count) / max) * 100}%`,
                }}
              />
            </span>
          </span>
          <span className="bar-number">
            {average ? `${fmt(d.average)}★` : d.count}
            <small>
              {average
                ? `n=${d.rated}`
                : `${fmt(d.average)}★ · n=${d.rated ?? 0}`}
            </small>
          </span>
        </button>
      ))}
    </div>
  ) : (
    <Empty title="Metadata adds this chapter">
      Connect your own TMDB key in Settings to add genres, filmmakers,
      countries, and languages. Core analysis works without it.
    </Empty>
  );
}
export function Poster({ film, large = false }: any) {
  const allowed = useContext(MediaConsent),
    [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [film.posterUrl]);
  return (
    <div className={`poster ${large ? "large" : ""}`} aria-hidden="true">
      {allowed && film.posterUrl && !failed ? (
        <img
          src={film.posterUrl}
          onError={() => setFailed(true)}
          loading="lazy"
          alt=""
          referrerPolicy="no-referrer"
        />
      ) : (
        <>
          <span className="poster-year">{film.year || "FILM"}</span>
          <Film size={large ? 30 : 18} />
          <span className="poster-type">F / F</span>
        </>
      )}
    </div>
  );
}
export function FilmGrid({ films, onFilm, limit = 6 }: any) {
  return (
    <div className="film-grid">
      {films.slice(0, limit).map((f: any) => (
        <button
          className="film-tile"
          key={f.key || f.title}
          onClick={() => onFilm(f)}
        >
          <Poster film={f} large />
          <strong>{f.title}</strong>
          <span>
            {f.year ?? "Year unknown"}{" "}
            <b>{f.rating != null ? `${f.rating} ★` : ""}</b>
          </span>
        </button>
      ))}
    </div>
  );
}
export function FilmList({ films, onFilm, limit = 5, detail = "rating" }: any) {
  return films.length ? (
    <div className="film-list">
      {films.slice(0, limit).map((f: any, i: number) => (
        <button key={f.key || i} onClick={() => onFilm(f)}>
          <Poster film={f} />
          <span className="film-label">
            <strong>{f.title}</strong>
            <small>
              {f.year || "Year unknown"}
              {f.date ? ` · ${f.date}` : ""}
            </small>
          </span>
          <b>
            {detail === "votes"
              ? `${f.voteCount.toLocaleString()} votes`
              : detail === "count"
                ? `${f.entryCount} logs`
                : detail === "gap"
                  ? `${f.gap > 0 ? "+" : ""}${fmt(f.gap)}★`
                  : f.rating != null
                    ? `${f.rating}★`
                    : "—"}
          </b>
        </button>
      ))}
    </div>
  ) : (
    <Empty>There are no eligible records in the current selection.</Empty>
  );
}
export function Pager({ page, total, size = 30, onPage }: any) {
  const pages = Math.max(1, Math.ceil(total / size));
  return (
    <div className="pager">
      <span>
        {total
          ? `${(page - 1) * size + 1}–${Math.min(page * size, total)} of ${total}`
          : "0 records"}
      </span>
      <div>
        <button
          className="icon-btn"
          aria-label="Previous page"
          disabled={page <= 1}
          onClick={() => onPage(page - 1)}
        >
          <ChevronLeft size={18} />
        </button>
        <span>
          {page} / {pages}
        </span>
        <button
          className="icon-btn"
          aria-label="Next page"
          disabled={page >= pages}
          onClick={() => onPage(page + 1)}
        >
          <ChevronRight size={18} />
        </button>
      </div>
    </div>
  );
}
