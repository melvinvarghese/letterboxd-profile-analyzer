"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  Upload,
  ShieldCheck,
  CheckCircle2,
  FileArchive,
  Download,
} from "lucide-react";
import { Modal, Button } from "./ui";
export function useExportReader() {
  const worker = useRef<Worker | null>(null),
    rejectRef = useRef<((e: Error) => void) | null>(null);
  const [busy, setBusy] = useState(false),
    [progress, setProgress] = useState({ percent: 0, message: "" }),
    [error, setError] = useState("");
  const cancel = useCallback(() => {
    worker.current?.terminate();
    worker.current = null;
    rejectRef.current?.(
      new Error("Import cancelled. Your current analysis is unchanged."),
    );
    rejectRef.current = null;
    setBusy(false);
  }, []);
  useEffect(
    () => () => {
      worker.current?.terminate();
      rejectRef.current?.(new Error("Import cancelled."));
    },
    [],
  );
  const read = useCallback(async (files: File[]) => {
    worker.current?.terminate();
    rejectRef.current?.(new Error("Import replaced."));
    setBusy(true);
    setError("");
    setProgress({ percent: 3, message: "Opening your export locally…" });
    try {
      const result = await new Promise<any>((resolve, reject) => {
        rejectRef.current = reject;
        const w = new Worker(new URL("./import.worker.ts", import.meta.url), {
          type: "module",
        });
        worker.current = w;
        w.onmessage = (event) => {
          const m = event.data;
          if (m.type === "progress") setProgress(m.progress);
          if (m.type === "complete") {
            w.terminate();
            worker.current = null;
            rejectRef.current = null;
            resolve(m.result);
          }
          if (m.type === "error") {
            w.terminate();
            worker.current = null;
            rejectRef.current = null;
            reject(new Error(m.message));
          }
        };
        w.onerror = () => {
          w.terminate();
          worker.current = null;
          rejectRef.current = null;
          reject(
            new Error(
              "The import worker could not start. Reload the page and try again in a current browser.",
            ),
          );
        };
        w.postMessage(files);
      });
      return result;
    } catch (e: any) {
      setError(e.message || "Unable to read this export.");
      return null;
    } finally {
      setBusy(false);
    }
  }, []);
  return { read, cancel, busy, progress, error, setError };
}
export function Importer({ onAccept, onClose, onDownload }: any) {
  const reader = useExportReader(),
    [pending, setPending] = useState<any>(null),
    input = useRef<HTMLInputElement>(null),
    [drag, setDrag] = useState(false);
  const choose = async (files: File[]) => {
    setPending(null);
    const result = await reader.read(files);
    if (result) setPending(result);
  };
  const close = useCallback(() => {
    reader.cancel();
    onClose();
  }, [reader.cancel, onClose]);
  return (
    <Modal title="Bring your film journal in" onClose={close} wide>
      <div className="modal-body">
        <p className="body-copy">
          Choose a Letterboxd export ZIP or its extracted CSV files. Review the
          results before replacing your current analysis.
        </p>
        <div
          className={`dropzone ${drag ? "dragging" : ""}`}
          onDragOver={(e) => {
            e.preventDefault();
            setDrag(true);
          }}
          onDragLeave={() => setDrag(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDrag(false);
            if (!reader.busy) void choose(Array.from(e.dataTransfer.files));
          }}
        >
          <FileArchive size={32} />
          <h3>
            {reader.busy
              ? "Reading your journal…"
              : "Drop your ZIP or CSVs here"}
          </h3>
          <p>One ZIP or several CSV files · up to 80 MB per file</p>
          <input
            className="sr-only"
            aria-label="Choose Letterboxd export files"
            ref={input}
            type="file"
            multiple
            accept=".zip,.csv"
            onChange={(e) => {
              void choose(Array.from(e.target.files || []));
              e.target.value = "";
            }}
          />
          <Button
            primary
            disabled={reader.busy}
            onClick={() => input.current?.click()}
          >
            <Upload size={16} /> Choose files
          </Button>
        </div>
        {reader.busy && (
          <div className="import-progress" role="status">
            <progress
              max="100"
              value={reader.progress.percent}
              aria-label="Import progress"
            />
            <p>{reader.progress.message}</p>
            <Button onClick={reader.cancel}>Cancel import</Button>
          </div>
        )}
        {reader.error && (
          <p className="notice error" role="alert">
            {reader.error}
          </p>
        )}
        {pending && (
          <>
            <div className="preview-heading">
              <CheckCircle2 size={20} />
              <div>
                <h3>Import checked. Ready to explore.</h3>
                <p>
                  {pending.data.films.length} unique films ·{" "}
                  {pending.data.diary.length} diary entries ·{" "}
                  {pending.data.watchlist.length} watchlist titles
                </p>
              </div>
            </div>
            <ImportReport data={pending.data} onDownload={onDownload} />
            <p className="footnote">
              Optional datasets missing:{" "}
              {pending.missing.length
                ? pending.missing.map((s: string) => `${s}.csv`).join(", ")
                : "none"}
              . You can explore the datasets you have.
            </p>
            <Button
              primary
              className="full-width"
              onClick={() => onAccept(pending.data)}
            >
              Analyze my data <CheckCircle2 size={17} />
            </Button>
          </>
        )}
        <div className="privacy-line">
          <ShieldCheck size={17} />
          <span>
            Files are processed locally. Profile email, bio, and location are
            never retained.
          </span>
        </div>
        <p className="footnote">
          Need your export?{" "}
          <a
            href="https://letterboxd.com/user/exportdata"
            target="_blank"
            rel="noreferrer"
          >
            Open Letterboxd’s export page ↗
          </a>
          . Optional TMDB metadata can be added after import.
        </p>
      </div>
    </Modal>
  );
}
export function ImportReport({ data, onDownload }: any) {
  const reports = data.importReport || [],
    issues = reports.reduce((n: number, r: any) => n + r.issues.length, 0);
  return (
    <div className="import-report">
      <div className="table-scroll">
        <table>
          <thead>
            <tr>
              <th scope="col">Recognized file</th>
              <th scope="col">Source rows</th>
              <th scope="col">Accepted</th>
              <th scope="col">Excluded</th>
            </tr>
          </thead>
          <tbody>
            {reports.map((r: any) => (
              <tr key={r.type}>
                <td>{r.name}</td>
                <td>{r.sourceRows}</td>
                <td>{r.acceptedRows}</td>
                <td>{r.skippedRows}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {issues > 0 && (
        <details className="warnings">
          <summary>{issues} validation notices · review details</summary>
          {reports
            .filter((r: any) => r.issues.length)
            .map((r: any) => (
              <div key={r.type}>
                <h4>{r.name}</h4>
                <ul>
                  {r.issues.slice(0, 40).map((i: any, n: number) => (
                    <li key={n}>
                      {i.row ? `Row ${i.row}: ` : ""}
                      {i.reason}
                    </li>
                  ))}
                </ul>
                {r.issues.length > 40 && (
                  <p>
                    {r.issues.length - 40} more notices are included in the
                    diagnostic download.
                  </p>
                )}
              </div>
            ))}
        </details>
      )}
      {data.skippedPaths?.length > 0 && (
        <details className="warnings">
          <summary>
            {data.skippedPaths.length} excluded paths · deleted, orphaned,
            lists, likes or unrelated data
          </summary>
          <ul>
            {data.skippedPaths.slice(0, 50).map((s: string, i: number) => (
              <li key={i}>{s}</li>
            ))}
          </ul>
        </details>
      )}
      <button className="text-btn" onClick={() => onDownload(data)}>
        <Download size={14} /> Download full import diagnostics
      </button>
      <p className="footnote">
        Accepted source rows may describe the same film. Diary rows stay
        separate, even if identical; repeated non-diary rows coalesce by
        identity.
      </p>
    </div>
  );
}
