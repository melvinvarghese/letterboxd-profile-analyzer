import { parseCSV } from './analytics.mjs';

const canonicalTypes = new Map([
  ['watched.csv', 'watched'],
  ['ratings.csv', 'ratings'],
  ['diary.csv', 'diary'],
  ['watchlist.csv', 'watchlist'],
  ['reviews.csv', 'reviews'],
]);

export function parseLetterboxdArchive(entries) {
  const files = [];
  const skippedPaths = [];

  for (const [name, contents] of Object.entries(entries)) {
    let path = name.replace(/\\/g, '/');
    while (path.startsWith('./')) path = path.slice(2);

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
