import test from 'node:test';
import assert from 'node:assert/strict';
import { parseLetterboxdArchive } from '../lib/import.mjs';

const encoder = new TextEncoder();
const bytes = value => encoder.encode(value);

test('archive_parser_normalizes_root_and_excludes_nested_csvs', () => {
  const entries = {
    'diary.csv': bytes('Name,Year\nArrival,2016\n'),
    'watchlist.csv': bytes('Name,Year\nDune,2021\n'),
    './ratings.csv': bytes('Name,Year,Rating\nArrival,2016,4\n'),
    'deleted/diary.csv': bytes('Name\nDeleted film\n'),
    'orphaned/diary.csv': bytes('Name\nOrphaned film\n'),
    'likes/films.csv': bytes('Name\nLiked film\n'),
    'deleted\\watched.csv': bytes('Name\nWindows nested film\n'),
    'profile.csv': bytes('Name\nProfile data\n'),
    'images/poster.jpg': bytes('not a CSV'),
  };

  const result = parseLetterboxdArchive(entries);

  assert.deepEqual(result.files.map(({ name, type }) => ({ name, type })), [
    { name: 'diary.csv', type: 'diary' },
    { name: 'watchlist.csv', type: 'watchlist' },
    { name: './ratings.csv', type: 'ratings' },
  ]);
  assert.deepEqual(result.skippedPaths, [
    'deleted/diary.csv',
    'orphaned/diary.csv',
    'likes/films.csv',
    'deleted\\watched.csv',
    'profile.csv',
  ]);
});

test('archive_parser_handles_bom_and_quoted_titles', () => {
  const entries = {
    'watched.csv': bytes('\uFEFFName,Year\r\n"The Good, the Bad and the Ugly",1966\r\n'),
  };

  const result = parseLetterboxdArchive(entries);

  assert.equal(result.files.length, 1);
  assert.equal(result.files[0].name, 'watched.csv');
  assert.equal(result.files[0].type, 'watched');
  assert.deepEqual(result.files[0].rows, [
    { Name: 'The Good, the Bad and the Ugly', Year: '1966' },
  ]);
  assert.deepEqual(result.skippedPaths, []);
});

test('archive_parser_keeps_header_only_files_empty', () => {
  const result = parseLetterboxdArchive({
    'watchlist.csv': bytes('Name,Year,Letterboxd URI\n'),
  });

  assert.equal(result.files.length, 1);
  assert.deepEqual(result.files[0].rows, []);
});
