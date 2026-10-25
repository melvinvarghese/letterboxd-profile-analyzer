import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { classifyFile } from '../lib/analytics.mjs';

const page = readFileSync(new URL('../app/page.tsx', import.meta.url), 'utf8');

test('export instructions link to Letterboxd data export in a new tab', () => {
  assert.match(page, /href="https:\/\/letterboxd\.com\/user\/exportdata"[^>]*target="_blank"/);
});

test('no demo, sample, or profile-analysis entry points remain', () => {
  for (const token of ['loadDemo', 'demoMode', 'sampleData', 'setProfile', 'compareProfiles(']) {
    assert.equal(page.includes(token), false, `unexpected page reference: ${token}`);
  }
  for (const label of ['Explore sample analysis', 'Preview with sample data', 'Load sample']) {
    assert.equal(page.includes(label), false, `unexpected sample button label: ${label}`);
  }
  assert.equal(/placeholder="[^"]*(?:username|profile URL)/i.test(page), false);
  assert.equal(/import\s*\{[^}]*compareProfiles[^}]*\}\s*from/.test(page), false);
});

test('viewing timeline is counted from diary entries', () => {
  assert.ok(page.includes('diaryYearCounts(data?.diary || [])'));
});

test('tracked fictional sample data is removed', () => {
  assert.equal(existsSync(new URL('../sample-data/', import.meta.url)), false);
});

test('compare profiles remains the existing nonfunctional placeholder', () => {
  assert.match(page, /\['Compare profiles',Layers3\]/);
  assert.ok(page.includes('Comparison status'));
  assert.ok(page.includes('Choose another export'));
});

test('upload errors are visible as alerts inside the open import dialog', () => {
  const importDialog = page.slice(page.indexOf('{showImport&&'), page.indexOf('</main>'));
  assert.match(importDialog, /\{messageError&&message&&<div role="alert"[\s\S]*?<span>\{message\}<\/span>/);
  assert.match(page, /\{!showImport&&message&&<div role=\{messageError\?'alert':'status'\}/);
});

test('icon-only dismiss controls have accessible labels', () => {
  assert.match(page, /<button[^>]*aria-label="Dismiss message"[^>]*>[\s\S]*?<X size=\{15\}\/><\/button>/);
  assert.match(page, /<button[^>]*aria-label="Close import dialog"[^>]*>[\s\S]*?<X size=\{18\}\/><\/button>/);
});

test('import dialog exposes modal semantics and contains, dismisses, and restores keyboard focus', () => {
  const importDialog = page.slice(page.indexOf('{showImport&&'), page.indexOf('</main>'));
  assert.match(importDialog, /role="dialog"[^>]*aria-modal="true"[^>]*aria-labelledby="import-dialog-title"/);
  assert.match(importDialog, /<h2 id="import-dialog-title"/);
  assert.match(page, /importTriggerRef=useRef<HTMLElement\|null>\(null\)/);
  assert.match(page, /function openImport\(trigger:HTMLElement\)[\s\S]*?importTriggerRef\.current=trigger;setShowImport\(true\)/);
  assert.match(page, /dialog\?\.querySelector<HTMLElement>\([\s\S]*?\)\?\.focus\(\)/);
  assert.match(page, /if\(!showImport\)\{[\s\S]*?importTriggerRef\.current\.focus\(\)/);
  assert.match(page, /event\.key==='Escape'[\s\S]*?setShowImport\(false\)/);
  assert.match(page, /event\.key!==\'Tab\'[\s\S]*?event\.shiftKey&&\(active===first\|\|!dialog\?\.contains\(active\)\)\)\{event\.preventDefault\(\);last\.focus\(\)/);
  assert.match(page, /else if\(!event\.shiftKey&&\(active===last\|\|!dialog\?\.contains\(active\)\)\)\{event\.preventDefault\(\);first\.focus\(\)/);
  assert.match(page, /onClick=\{closeImport\}/);
  assert.match(importDialog, /aria-label="Close import dialog" onClick=\{closeImport\}/);
});

test('closing the import dialog restores focus to a connected opener or the persistent header importer', () => {
  const header = page.slice(page.indexOf('<header'), page.indexOf('</header>'));
  assert.match(header, /ref=\{importFallbackRef\}/);
  assert.match(page, /importFallbackRef=useRef<HTMLButtonElement\|null>\(null\)/);
  assert.match(page, /importTriggerRef\.current\?\.isConnected/);
  assert.match(page, /else importFallbackRef\.current\?\.focus\(\)/);
});

test('readFiles does not reopen a dialog that the user closed while parsing', () => {
  const readFiles = page.slice(page.indexOf('async function readFiles'), page.indexOf('async function importData'));
  assert.doesNotMatch(readFiles, /setShowImport\(true\)/);
});

test('unsupported direct CSVs stay out of analysis and appear in format-agnostic diagnostics', () => {
  assert.equal(classifyFile('lists.csv'), 'other');

  const readFiles = page.slice(page.indexOf('async function readFiles'), page.indexOf('async function importData'));
  const csvBranch = readFiles.slice(readFiles.indexOf("else if(file.name.toLowerCase().endsWith('.csv'))"), readFiles.indexOf("else throw new Error('Choose a .zip archive or .csv file.')"));
  const skipUnsupported = "if(type==='other'){skipped.push(file.name);continue;}";
  assert.ok(csvBranch.includes(skipUnsupported), 'unsupported direct CSVs must be recorded as skipped');
  assert.ok(csvBranch.indexOf(skipUnsupported) < csvBranch.indexOf('found.push'), 'unsupported direct CSVs must continue before being added to found files');

  const importDialog = page.slice(page.indexOf('{showImport&&'), page.indexOf('</main>'));
  assert.match(importDialog, /Ignored CSV paths \(\{skippedPaths\.length\}\)[\s\S]*?\{skippedPaths\.slice\(0,10\)\.map\(\(path,i\)=>[\s\S]*?\{path\}<\/li>/);

  const supportedFormatsCopy = 'Choose supported individual CSVs or a Letterboxd ZIP containing canonical root CSVs.';
  const previewPathsCopy = 'Ignored paths are shown in the preview.';
  assert.ok(readFiles.includes(supportedFormatsCopy), 'the no-supported-files alert must cover individual CSV and ZIP inputs');
  assert.ok(readFiles.includes(previewPathsCopy), 'the no-supported-files alert must direct users to skipped-path diagnostics');
  assert.ok(!readFiles.includes('No canonical root Letterboxd CSV was recognized.'), 'direct CSV input must not be described as a missing ZIP root file');
  assert.ok(importDialog.includes(supportedFormatsCopy), 'the empty preview must use the same format-agnostic guidance');
  assert.ok(importDialog.includes(previewPathsCopy), 'the empty preview must explain where ignored paths appear');
  assert.ok(page.includes("message.startsWith('No supported CSV files were recognized.')"), 'the empty preview must recognize the format-agnostic no-supported-files alert');
});

test('busy Browse remains focusable and prevents a second file selection', () => {
  const browseStart = page.lastIndexOf('<button', page.indexOf('Browse files'));
  const browseButton = page.slice(browseStart, page.indexOf('</button>', browseStart));
  assert.match(browseButton, /aria-disabled=\{busy\}/);
  assert.doesNotMatch(browseButton, /\sdisabled=\{busy\}/);
  assert.match(browseButton, /onClick=\{\(\)=>\{if\(!busy\)fileRef\.current\?\.click\(\);\}\}/);
  assert.match(browseButton, /busy\?'Reading files…':'Browse files'/);
});
