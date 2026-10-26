import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { classifyFile } from '../lib/analytics.mjs';

const page = readFileSync(new URL('../app/page.tsx', import.meta.url), 'utf8');

test('export instructions link to Letterboxd data export in a new tab', () => {
  assert.match(page, /href="https:\/\/letterboxd\.com\/user\/exportdata"[^>]*target="_blank"/);
});

test('no demo, sample, or profile-scraping entry points remain', () => {
  for (const token of ['loadDemo', 'demoMode', 'sampleData', 'setProfile']) {
    assert.equal(page.includes(token), false, `unexpected page reference: ${token}`);
  }
  for (const label of ['Explore sample analysis', 'Preview with sample data', 'Load sample']) {
    assert.equal(page.includes(label), false, `unexpected sample button label: ${label}`);
  }
  assert.equal(/placeholder="[^"]*(?:username|profile URL)/i.test(page), false);
});

test('viewing timeline is counted from diary entries', () => {
  assert.ok(page.includes('diaryYearCounts(data?.diary || [])'));
});

test('tracked fictional sample data is removed', () => {
  assert.equal(existsSync(new URL('../sample-data/', import.meta.url)), false);
});

const comparisonView = page.slice(page.indexOf("active==='Compare profiles'&&"), page.indexOf("active==='Settings & privacy'"));
const comparisonHandler = page.slice(page.indexOf('async function readComparisonFiles'), page.indexOf('function compareImportedProfiles'));

test('home offers a distinct comparison action beside single-profile analysis', () => {
  const home = page.slice(page.indexOf('<section className="relative'), page.indexOf('</section>'));
  assert.ok(home.includes('Analyze my Letterboxd data'));
  assert.match(home, /onClick=\{\(\)=>setActive\('Compare profiles'\)\}[^>]*>[\s\S]*?Compare two profiles/);
});

test('comparison navigation renders before a primary dataset exists', () => {
  assert.match(page, /\{active==='Compare profiles'&&/);
  assert.doesNotMatch(comparisonView, /^data&&/);
});

test('comparison mode suppresses the primary-profile empty-state prompt', () => {
  assert.match(page, /\{!data&&active!=='Overview'&&active!=='Compare profiles'&&<div className="panel p-8"/);
});

test('comparison slots keep separate A/B previews and show username-only labels', () => {
  assert.match(page, /\[comparisonSides,setComparisonSides\]=useState<any>\(\{A:null,B:null\}\)/);
  assert.match(page, /comparisonAFileRef=useRef<HTMLInputElement\|null>\(null\)/);
  assert.match(page, /comparisonBFileRef=useRef<HTMLInputElement\|null>\(null\)/);
  assert.ok(comparisonView.includes('Profile A'));
  assert.ok(comparisonView.includes('Profile B'));
  assert.match(comparisonView, /state=comparisonSides\[side\]/);
  assert.match(comparisonView, /state\?\.profile\.username\|\|'Username unavailable'/);
  assert.doesNotMatch(comparisonView, /profile\.(?:Name|Email|Location|Website|Bio)/);
});

test('comparison results render shared, unique, rating, and diary-date details', () => {
  assert.match(comparisonView, /comparisonResult\.sharedFilms\.map/);
  assert.match(comparisonView, /comparisonResult\.uniqueToA\.map/);
  assert.match(comparisonView, /comparisonResult\.uniqueToB\.map/);
  assert.match(comparisonView, /film\.a\.rating/);
  assert.match(comparisonView, /film\.b\.rating/);
  assert.match(comparisonView, /film\.ratingDifference/);
  assert.match(comparisonView, /film\.a\.diaryDates/);
  assert.match(comparisonView, /film\.b\.diaryDates/);
});

test('comparison keeps its status region mounted and announces result counts separately from detailed results', () => {
  const statusRegion = comparisonView.match(/<p role="status" className="sr-only">([\s\S]*?)<\/p>/);
  assert.ok(statusRegion, 'comparison mode must render a persistent status region');
  assert.match(statusRegion[1], /^\{comparisonResult&&<>Comparison complete:[\s\S]*<\/>\}$/);
  assert.doesNotMatch(comparisonView, /\{comparisonResult&&<p role="status"/);
  const detailedResults = comparisonView.slice(comparisonView.indexOf('<div className="mt-6 space-y-5">'));
  assert.doesNotMatch(detailedResults, /role="status"|aria-live=/);
});

test('comparison explains the three-film minimum separately from zero-variance correlation', () => {
  assert.match(comparisonView, /sharedRatedFilms<3/);
  assert.match(comparisonView, /At least three shared films rated by both profiles/);
  assert.match(comparisonView, /ratingCorrelation===null/);
  assert.match(comparisonView, /ratings do not vary/);
  assert.match(comparisonView, /ratingCorrelation\.toFixed\(2\)/);
});

test('comparison inputs reject mixed ZIP/CSV selections and multiple ZIPs per slot', () => {
  assert.match(comparisonHandler, /readComparisonFiles\(list:FileList\|null,side:'A'\|'B'\)/);
  assert.match(comparisonHandler, /archives\.length>1\|\|\(archives\.length===1&&selected\.length!==1\)/);
  assert.match(comparisonHandler, /validateZipArchive\(bytes\)[\s\S]*?unzipSync\(bytes/);
  assert.match(comparisonHandler, /parseProfileUsername\(/);
  assert.match(comparisonHandler, /buildComparisonProfile\(files,username(?: as any)?\)/);
});

test('replacing one comparison side preserves the other and never touches primary import state', () => {
  assert.match(comparisonHandler, /setComparisonSides\(\(current:any\)=>\(\{\.\.\.current,\[side\]:null\}\)\)/);
  assert.match(comparisonHandler, /setComparisonSides\(\(current:any\)=>\(\{\.\.\.current,\[side\]:\{/);
  assert.match(comparisonHandler, /setComparisonResult\(null\)/);
  assert.doesNotMatch(comparisonHandler, /setData|importData|fetch|TMDB|localStorage|sessionStorage/);
});

test('comparison requires film records on both sides before the compare action is enabled', () => {
  assert.match(page, /const comparisonReady=Boolean\(comparisonSides\.A\?\.profile\.films\.length&&comparisonSides\.B\?\.profile\.films\.length\)/);
  assert.match(comparisonView, /disabled=\{!comparisonReady/);
});

test('Clear comparison clears both sides, result, errors, and pending reads', () => {
  const clearComparison = page.slice(page.indexOf('function clearComparison'), page.indexOf('function clearSession'));
  assert.match(clearComparison, /setComparisonSides\(\{A:null,B:null\}\)/);
  assert.match(clearComparison, /setComparisonResult\(null\)/);
  assert.match(clearComparison, /comparisonReadToken\.current\.A\+\+/);
  assert.match(clearComparison, /comparisonReadToken\.current\.B\+\+/);
});

test('the existing clear-session action also clears comparison state', () => {
  const clearSession = page.slice(page.indexOf('function clearSession'), page.indexOf('function downloadReport'));
  assert.match(clearSession, /clearComparison\(\)/);
  assert.match(page, /Clear comparison/);
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

const filmExplorer = page.slice(page.indexOf("{data&&active==='Film explorer'&&"), page.indexOf("{data&&active==='Watchlist'&&"));
const importData = page.slice(page.indexOf('async function importData'), page.indexOf('function parseProfileUsername'));
test('Film Explorer displays matched TMDB metadata separately from personal ratings and diary dates', () => {
  assert.ok(filmExplorer.includes('f.posterUrl'));
  assert.match(filmExplorer, /alt=\{`TMDB poster: \$\{f\.title\}`\}/);
  assert.ok(filmExplorer.includes('f.genres'));
  assert.ok(filmExplorer.includes('f.externalRating'));
  assert.ok(filmExplorer.includes('f.releaseDate'));
  assert.match(filmExplorer, />YOUR RATING</);
  assert.match(filmExplorer, />TMDB RATING</);
  assert.match(filmExplorer, />DIARY DATE</);
  assert.match(filmExplorer, />TMDB RELEASE DATE</);
  assert.ok(filmExplorer.includes('data.tmdbMatchedCount'));
  assert.ok(filmExplorer.includes('data.tmdbSearchedCount'));
});
test('Taste analysis renders matched TMDB genres and imported Letterboxd ratings', () => {
  const tasteAnalysis = page.slice(page.indexOf("{data&&stats&&active==='Taste analysis'&&"), page.indexOf("{data&&active==='Directors & actors'&&"));
  assert.ok(tasteAnalysis.includes('result?.genreAnalysis'));
  assert.match(tasteAnalysis, />TMDB genre</);
  assert.match(tasteAnalysis, />Matched films \(TMDB\)</);
  assert.match(tasteAnalysis, />Average rating \(Letterboxd\)</);
  assert.match(tasteAnalysis, /Rated films \(Letterboxd\)/);
  assert.doesNotMatch(tasteAnalysis, /No genre labels are inferred from titles/);
});
test('TMDB match counts are saved after lookup without changing the 100-film cap', () => {
  assert.match(importData, /const targets=merged\.films\.filter\(\(f:any\)=>f\.title\)\.slice\(0,100\)/);
  assert.match(importData, /tmdbMatchedCount:matched/);
  assert.match(importData, /tmdbSearchedCount:targets\.length/);
});
