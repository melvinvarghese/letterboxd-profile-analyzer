import test from 'node:test';
import assert from 'node:assert/strict';
import * as letterboxdImport from '../lib/import.mjs';

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

  const result = letterboxdImport.parseLetterboxdArchive(entries);

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

  const result = letterboxdImport.parseLetterboxdArchive(entries);

  assert.equal(result.files.length, 1);
  assert.equal(result.files[0].name, 'watched.csv');
  assert.equal(result.files[0].type, 'watched');
  assert.deepEqual(result.files[0].rows, [
    { Name: 'The Good, the Bad and the Ugly', Year: '1966' },
  ]);
  assert.deepEqual(result.skippedPaths, []);
});

test('archive_parser_keeps_header_only_files_empty', () => {
  const result = letterboxdImport.parseLetterboxdArchive({
    'watchlist.csv': bytes('Name,Year,Letterboxd URI\n'),
  });

  assert.equal(result.files.length, 1);
  assert.deepEqual(result.files[0].rows, []);
});

test('comparison_archive_extracts_only_root_profile_username', () => {
  assert.equal(typeof letterboxdImport.parseComparisonArchive, 'function');
  const entries = {
    'profile.csv': bytes('Name,Username,Email,Location,Website,Bio\nMira Example,cinephile,secret@example.test,Hidden Place,https://private.example,Private bio\n'),
    'nested/profile.csv': bytes('Name,Username,Email\nNested Person,nested-user,nested@example.test\n'),
    'ratings.csv': bytes('Name,Year,Rating\nArrival,2016,4\n'),
  };

  const result = letterboxdImport.parseComparisonArchive(entries);

  assert.equal(result.username, 'cinephile');
  assert.deepEqual(result.files.map(({ name, type }) => ({ name, type })), [
    { name: 'ratings.csv', type: 'ratings' },
  ]);
  assert.deepEqual(result.skippedPaths, ['nested/profile.csv']);
  const serialized = JSON.stringify(result);
  for (const privateValue of [
    'Mira Example',
    'secret@example.test',
    'Hidden Place',
    'https://private.example',
    'Private bio',
    'nested-user',
    'nested@example.test',
  ]) {
    assert.equal(serialized.includes(privateValue), false);
  }
});

test('profile_username_is_unavailable_for_missing_or_blank_value', () => {
  assert.equal(typeof letterboxdImport.parseProfileUsername, 'function');
  for (const csv of [
    'Name,Email\nMira,secret@example.test\n',
    'Name,Username\nMira,\n',
    'Name,Username\nMira,   \n',
  ]) {
    assert.equal(letterboxdImport.parseProfileUsername(csv), null);
  }
});
