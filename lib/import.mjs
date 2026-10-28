import { unzipSync } from "fflate";
import {
  classifyFile,
  parseCSV,
  parseCSVWithDiagnostics,
  mergeDatasets,
  pick,
} from "./analytics.mjs";
export const LIMITS = {
  file: 80 * 1024 * 1024,
  total: 120 * 1024 * 1024,
  expanded: 150 * 1024 * 1024,
  entry: 40 * 1024 * 1024,
  entries: 10000,
  rows: 250000,
};
const pathOf = (name) =>
  String(name)
    .replace(/\\/g, "/")
    .replace(/^(\.\/)+/, "");
const canonical = new Set([
  "watched.csv",
  "ratings.csv",
  "diary.csv",
  "watchlist.csv",
  "reviews.csv",
  "profile.csv",
]);
function exportRoot(names) {
  const paths = names.map(pathOf);
  if (paths.some((n) => canonical.has(n.toLowerCase()))) return "";
  const possible = paths.filter(
    (n) =>
      n.split("/").length === 2 &&
      canonical.has(n.split("/")[1].toLowerCase()) &&
      !/^(deleted|orphaned|likes|lists|__macosx)\//i.test(n),
  );
  const prefixes = new Set(possible.map((n) => n.split("/")[0]));
  return prefixes.size === 1 ? [...prefixes][0] + "/" : "";
}
function entryType(name, root) {
  const p = pathOf(name);
  if (!p.startsWith(root)) return "other";
  const rest = p.slice(root.length);
  return rest.includes("/") ? "other" : classifyFile(rest);
}
export function parseLetterboxdArchive(entries) {
  const root = exportRoot(Object.keys(entries)),
    files = [],
    skippedPaths = [];
  for (const [name, contents] of Object.entries(entries)) {
    if (!/\.csv$/i.test(name)) continue;
    const type = entryType(name, root);
    if (type === "other") {
      skippedPaths.push(name);
      continue;
    }
    const parsed = parseCSVWithDiagnostics(
      new TextDecoder("utf-8", { fatal: true }).decode(contents),
    );
    files.push({ name, type, ...parsed });
  }
  return { files, skippedPaths };
}
export function parseProfileUsername(input) {
  const r = parseCSV(input)[0];
  return r ? String(pick(r, "Username")).trim() || null : null;
}
export function parseComparisonArchive(entries) {
  const parsed = parseLetterboxdArchive(entries),
    root = exportRoot(Object.keys(entries));
  const entry = Object.entries(entries).find(
    ([name]) =>
      pathOf(name).toLowerCase() === (root + "profile.csv").toLowerCase(),
  );
  return {
    ...parsed,
    username: entry
      ? parseProfileUsername(new TextDecoder().decode(entry[1]))
      : null,
    skippedPaths: parsed.skippedPaths.filter((n) => n !== entry?.[0]),
  };
}
/** Validate the central directory before allocating any decompression buffers. ZIP64/multidisk/encrypted archives are explicitly unsupported. */
export function validateZipArchive(bytes) {
  if (bytes.length < 22)
    throw new Error(
      "This ZIP is damaged or incomplete. Download the export again.",
    );
  const v = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let end = -1;
  for (let i = bytes.length - 22; i >= Math.max(0, bytes.length - 65557); i--)
    if (
      v.getUint32(i, true) === 0x06054b50 &&
      i + 22 + v.getUint16(i + 20, true) === bytes.length
    ) {
      end = i;
      break;
    }
  if (end < 0)
    throw new Error("ZIP directory is missing. Download the export again.");
  const count = v.getUint16(end + 10, true),
    size = v.getUint32(end + 12, true),
    offset = v.getUint32(end + 16, true);
  if (
    v.getUint16(end + 4, true) ||
    v.getUint16(end + 6, true) ||
    count !== v.getUint16(end + 8, true) ||
    count === 65535 ||
    offset === 0xffffffff
  )
    throw new Error(
      "ZIP64 and multi-disk archives are unsupported. Select the extracted CSV files instead.",
    );
  if (count > LIMITS.entries || offset + size > end)
    throw new Error("ZIP directory exceeds safety limits or is damaged.");
  const records = [],
    seen = new Set();
  let cursor = offset,
    total = 0;
  for (let i = 0; i < count; i++) {
    if (cursor + 46 > end || v.getUint32(cursor, true) !== 0x02014b50)
      throw new Error("ZIP directory is malformed.");
    const flags = v.getUint16(cursor + 8, true),
      method = v.getUint16(cursor + 10, true),
      crc = v.getUint32(cursor + 16, true),
      compressed = v.getUint32(cursor + 20, true),
      expanded = v.getUint32(cursor + 24, true),
      nl = v.getUint16(cursor + 28, true),
      xl = v.getUint16(cursor + 30, true),
      cl = v.getUint16(cursor + 32, true),
      local = v.getUint32(cursor + 42, true);
    if (cursor + 46 + nl + xl + cl > offset + size)
      throw new Error("ZIP directory entry is truncated.");
    const name = new TextDecoder().decode(
        bytes.subarray(cursor + 46, cursor + 46 + nl),
      ),
      path = pathOf(name);
    if (flags & 1)
      throw new Error(
        "Password-protected ZIPs are unsupported. Select the original export.",
      );
    if (![0, 8].includes(method))
      throw new Error(
        "Unsupported ZIP compression. Select the extracted CSV files.",
      );
    if (
      /^(\/|[a-zA-Z]:)/.test(path) ||
      path.split("/").includes("..") ||
      name.includes("\0")
    )
      throw new Error("Unsafe path detected in ZIP.");
    if (seen.has(path.toLowerCase()))
      throw new Error(
        "Duplicate archive paths found. Use a fresh Letterboxd export.",
      );
    seen.add(path.toLowerCase());
    total += expanded;
    if (
      expanded > LIMITS.entry ||
      total > LIMITS.expanded ||
      (!compressed && expanded) ||
      (compressed && expanded / compressed > 1500)
    )
      throw new Error(
        "ZIP expands beyond safety limits. Select smaller extracted CSV files.",
      );
    if (local + 30 > offset || v.getUint32(local, true) !== 0x04034b50)
      throw new Error("ZIP file header is damaged.");
    const localFlags = v.getUint16(local + 6, true),
      localMethod = v.getUint16(local + 8, true),
      localNameLength = v.getUint16(local + 26, true),
      localExtraLength = v.getUint16(local + 28, true);
    if (
      localFlags !== flags ||
      localMethod !== method ||
      local + 30 + localNameLength + localExtraLength + compressed > offset
    )
      throw new Error("ZIP file header disagrees with its directory.");
    const localName = new TextDecoder().decode(
      bytes.subarray(local + 30, local + 30 + localNameLength),
    );
    if (localName !== name) throw new Error("ZIP filenames disagree.");
    records.push({ name, size: expanded, crc });
    cursor += 46 + nl + xl + cl;
  }
  if (cursor !== offset + size)
    throw new Error("ZIP directory length is inconsistent.");
  return records;
}
const crcTable = Array.from({ length: 256 }, (_, i) => {
  let c = i;
  for (let j = 0; j < 8; j++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
const crc32 = (bytes) => {
  let c = 0xffffffff;
  for (const b of bytes) c = crcTable[(c ^ b) & 255] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
};
export function extractArchive(bytes) {
  const directory = validateZipArchive(bytes),
    root = exportRoot(directory.map((e) => e.name));
  const wanted = new Set(
    directory
      .filter(
        (e) =>
          entryType(e.name, root) !== "other" ||
          pathOf(e.name).toLowerCase() === (root + "profile.csv").toLowerCase(),
      )
      .map((e) => e.name),
  );
  let entries;
  try {
    entries = unzipSync(bytes, { filter: (e) => wanted.has(e.name) });
  } catch {
    throw new Error(
      "This ZIP could not be opened. Re-download it or choose extracted CSVs.",
    );
  }
  for (const record of directory)
    if (wanted.has(record.name)) {
      const bytes = entries[record.name];
      if (!bytes || bytes.length !== record.size || crc32(bytes) !== record.crc)
        throw new Error("ZIP checksum failed. Download the export again.");
    }
  const parsed = parseComparisonArchive(entries);
  parsed.skippedPaths = directory
    .filter((e) => /\.csv$/i.test(e.name) && !wanted.has(e.name))
    .map((e) => e.name);
  return parsed;
}
export async function importSources(sources, onProgress = (_progress) => {}) {
  if (!sources.length)
    throw new Error("Choose a Letterboxd export ZIP or CSV files.");
  let total = 0;
  for (const s of sources) {
    const size = s.size ?? s.bytes?.length ?? 0;
    if (size > LIMITS.file)
      throw new Error(`${s.name} exceeds the 80 MB file limit.`);
    total += size;
  }
  if (total > LIMITS.total)
    throw new Error("Selected files exceed the 120 MB total limit.");
  const zips = sources.filter((s) => /\.zip$/i.test(s.name));
  if (zips.length && (sources.length !== 1 || zips.length !== 1))
    throw new Error(
      "Choose one ZIP or a batch of CSV files. Do not combine exports.",
    );
  let files = [],
    skippedPaths = [],
    username = null;
  for (let i = 0; i < sources.length; i++) {
    const source = sources[i];
    onProgress({
      percent: Math.round(10 + (70 * i) / sources.length),
      message: `Reading ${source.name}…`,
    });
    const bytes =
      source.bytes instanceof Uint8Array
        ? source.bytes
        : new Uint8Array(await source.arrayBuffer());
    if (/\.zip$/i.test(source.name)) {
      const parsed = extractArchive(bytes);
      files.push(...parsed.files);
      skippedPaths.push(...parsed.skippedPaths);
      username = parsed.username;
    } else if (/\.csv$/i.test(source.name)) {
      const type = classifyFile(source.name);
      if (source.name.toLowerCase() === "profile.csv") {
        try {
          username = parseProfileUsername(
            new TextDecoder("utf-8", { fatal: true }).decode(bytes),
          );
        } catch {
          throw new Error(
            "profile.csv is malformed. Omit it and import again.",
          );
        }
        continue;
      }
      if (type === "other") {
        skippedPaths.push(source.name);
        continue;
      }
      const text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
      files.push({ name: source.name, type, ...parseCSVWithDiagnostics(text) });
    } else
      throw new Error(
        "Choose .zip or .csv files. For a saved analysis use Restore analysis.",
      );
  }
  if (!files.length)
    throw new Error(
      "No supported CSVs found. Select watched.csv, ratings.csv, diary.csv, watchlist.csv, or reviews.csv from one export. Deleted and orphaned folders are excluded.",
    );
  const types = new Set();
  let rows = 0;
  for (const file of files) {
    if (types.has(file.type))
      throw new Error(
        `Multiple ${file.type}.csv files found. Import one export at a time.`,
      );
    types.add(file.type);
    rows += file.rows.length;
    if (
      file.rows.length &&
      !file.headers?.some((h) =>
        ["name", "title", "filmtitle"].includes(
          h.toLowerCase().replace(/\s/g, ""),
        ),
      )
    )
      throw new Error(`${file.name} is missing a Name/Title column.`);
  }
  if (rows > LIMITS.rows)
    throw new Error(
      "This export exceeds 250,000 source rows. Select smaller CSV files.",
    );
  onProgress({
    percent: 88,
    message: "Checking film identities, ratings and dates…",
  });
  const data = mergeDatasets(files);
  if (!data.films.length && !data.watchlist.length)
    throw new Error(
      "No valid film titles found. Empty files and rows without a title cannot create an analysis.",
    );
  const missing = ["watched", "ratings", "diary", "watchlist"].filter(
    (t) => !types.has(t),
  );
  data.importedAt = new Date().toISOString();
  data.label = username || "My film journal";
  data.skippedPaths = skippedPaths;
  data.missing = missing;
  onProgress({ percent: 100, message: "Import checked. Ready to review." });
  return { data, username, skippedPaths, report: data.importReport, missing };
}
