import { parseCSV } from './analytics.mjs';

const canonicalTypes = new Map([
  ['watched.csv', 'watched'],
  ['ratings.csv', 'ratings'],
  ['diary.csv', 'diary'],
  ['watchlist.csv', 'watchlist'],
  ['reviews.csv', 'reviews'],
]);

const normalizeArchivePath = name => {
  let path = name.replace(/\\/g, '/');
  while (path.startsWith('./')) path = path.slice(2);
  return path;
};

export function parseLetterboxdArchive(entries) {
  const files = [];
  const skippedPaths = [];

  for (const [name, contents] of Object.entries(entries)) {
    const path = normalizeArchivePath(name);

    if (!path.toLowerCase().endsWith('.csv')) continue;

    const type = path.includes('/') ? undefined : canonicalTypes.get(path.toLowerCase());
    if (!type) {
      skippedPaths.push(name);
      continue;
    }

    files.push({ name, type, rows: parseCSV(new TextDecoder().decode(contents)) });
  }

  return { files, skippedPaths };
}

export function parseProfileUsername(input) {
  const username = parseCSV(input)[0]?.Username?.trim();
  return username || null;
}

export function parseComparisonArchive(entries) {
  const { files, skippedPaths } = parseLetterboxdArchive(entries);
  const profileEntry = Object.entries(entries).find(([name]) =>
    normalizeArchivePath(name).toLowerCase() === 'profile.csv'
  );
  const username = profileEntry
    ? parseProfileUsername(new TextDecoder().decode(profileEntry[1]))
    : null;

  return {
    files,
    username,
    skippedPaths: skippedPaths.filter(name =>
      normalizeArchivePath(name).toLowerCase() !== 'profile.csv'
    ),
  };
}
