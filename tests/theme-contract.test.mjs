import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const css = readFileSync(new URL('../app/globals.css', import.meta.url), 'utf8');
const tailwind = readFileSync(new URL('../tailwind.config.ts', import.meta.url), 'utf8');
const page = readFileSync(new URL('../app/page.tsx', import.meta.url), 'utf8');
const root = css.match(/:root\s*\{([^}]*)\}/s)?.[1] ?? '';

const tokens = {
  '--color-background': '#14181C',
  '--color-poster': '#12161A',
  '--color-surface': '#202830',
  '--color-raised': '#283038',
  '--color-border': '#2C3440',
  '--color-primary-green': '#00E054',
  '--color-button-green': '#00AC1C',
  '--color-button-hover': '#00C030',
  '--color-button-active': '#009926',
  '--color-text-primary': '#FFFFFF',
  '--color-text-body': '#99AABB',
  '--color-text-secondary': '#AABBCC',
  '--color-text-muted': '#778899',
  '--color-text-subtle': '#667788',
  '--color-link': '#DDEEFF',
  '--color-link-hover': '#40BCF4',
  '--color-error-border': '#704642',
  '--color-error-surface': '#261A18',
  '--color-error-text': '#F1B8AD',
  '--color-error-icon': '#F1A69B',
  '--color-warning-border': '#5B4934',
  '--color-warning-surface': '#211D17',
  '--color-warning-text': '#D9C6A5',
};

const tailwindAliases = {
  background: '--color-background',
  poster: '--color-poster',
  surface: '--color-surface',
  raised: '--color-raised',
  line: '--color-border',
  primary: '--color-text-primary',
  body: '--color-text-body',
  secondary: '--color-text-secondary',
  muted: '--color-text-muted',
  subtle: '--color-text-subtle',
  'primary-green': '--color-primary-green',
  'button-green': '--color-button-green',
  'button-hover': '--color-button-hover',
  'button-active': '--color-button-active',
  link: '--color-link',
  'link-hover': '--color-link-hover',
  'error-border': '--color-error-border',
  'error-surface': '--color-error-surface',
  'error-text': '--color-error-text',
  'error-icon': '--color-error-icon',
  'warning-border': '--color-warning-border',
  'warning-surface': '--color-warning-surface',
  'warning-text': '--color-warning-text',
};

function relativeLuminance(hex) {
  const channels = [1, 3, 5].map((i) => Number.parseInt(hex.slice(i, i + 2), 16) / 255);
  const linear = channels.map((channel) => channel <= 0.04045
    ? channel / 12.92
    : ((channel + 0.055) / 1.055) ** 2.4);
  return 0.2126 * linear[0] + 0.7152 * linear[1] + 0.0722 * linear[2];
}

function contrastRatio(a, b) {
  const [lighter, darker] = [relativeLuminance(a), relativeLuminance(b)].sort((x, y) => y - x);
  return (lighter + 0.05) / (darker + 0.05);
}

test('approved palette and semantic state colors are centralized with their specified values', () => {
  for (const [name, expected] of Object.entries(tokens)) {
    const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const match = root.match(new RegExp(`${escaped}\\s*:\\s*([^;]+);`));
    assert.ok(match, `missing root token ${name}`);
    assert.equal(match[1].trim().toUpperCase(), expected.toUpperCase(), `${name} value`);
  }
  assert.match(root, /--color-chart-personal\s*:\s*var\(--color-primary-green\)/);
  assert.match(root, /--color-chart-external\s*:\s*var\(--color-link-hover\)/);
  assert.match(root, /--color-focus\s*:\s*var\(--color-primary-green\)/);
});

test('Tailwind semantic colors reference the shared CSS variables', () => {
  for (const [name, variable] of Object.entries(tailwindAliases)) {
    const escapedName = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const escapedVariable = variable.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const mapping = new RegExp(`['"]?${escapedName}['"]?\\s*:\\s*['"]var\\(${escapedVariable}\\)['"]`);
    assert.match(tailwind, mapping, `${name} must map to ${variable}`);
  }
  assert.match(tailwind, /system-ui/);
});

test('normal text, button labels, and semantic notices meet 4.5:1 contrast', () => {
  const backgrounds = {
    background: '#14181C',
    poster: '#12161A',
    surface: '#202830',
    raised: '#283038',
  };
  const foregrounds = {
    primary: '#FFFFFF',
    body: '#99AABB',
    secondary: '#AABBCC',
    link: '#DDEEFF',
  };
  for (const [foregroundName, foreground] of Object.entries(foregrounds)) {
    for (const [backgroundName, background] of Object.entries(backgrounds)) {
      assert.ok(contrastRatio(foreground, background) >= 4.5,
        `${foregroundName} on ${backgroundName} must meet 4.5:1`);
    }
  }
  assert.ok(contrastRatio('#778899', '#14181C') >= 4.5, 'muted text is only used on the page background');
  for (const button of ['#00AC1C', '#00C030', '#009926']) {
    assert.ok(contrastRatio('#14181C', button) >= 4.5, 'dark page-background button text must meet 4.5:1');
  }
  assert.ok(contrastRatio('#F1B8AD', '#261A18') >= 4.5, 'error text must meet 4.5:1');
  assert.ok(contrastRatio('#F1A69B', '#261A18') >= 3, 'error icon must meet the non-text 3:1 threshold');
  assert.ok(contrastRatio('#D9C6A5', '#211D17') >= 4.5, 'warning text must meet 4.5:1');
});

test('page UI uses semantic colors instead of hard-coded values or the legacy moss palette', () => {
  assert.doesNotMatch(page, /#[\da-f]{3,8}\b/i, 'component colors must come from shared tokens');
  assert.doesNotMatch(page, /(?:text|bg|border)-moss\b/, 'legacy moss classes must be removed');
  assert.match(page, /var\(--color-chart-personal\)/, 'rating indicators must use the chart token');
});

test('theme preserves the existing TMDB password field without adding a visibility toggle', () => {
  const field = page.match(/<input\s+id="tmdb-api-key"[^>]*>/)?.[0];
  assert.ok(field, 'the existing TMDB API key input must remain');
  assert.match(field, /type="password"/);
  assert.doesNotMatch(page, /aria-label="(?:Show|Hide) TMDB API key"/i);
});

test('interactive controls receive a visible primary-green focus treatment', () => {
  assert.match(css, /:where\(button\s*,\s*a\s*,\s*input\s*,\s*select\s*,\s*textarea\s*,\s*\[tabindex\]\s*\):focus-visible\s*\{[^}]*outline\s*:\s*2px solid var\(--color-focus\)/s);
});

// Compile the real theme config: source-token checks alone miss unsupported alpha variants.
test('Tailwind emits the header and modal backing colors used by the page', async () => {
  const { createRequire } = await import('node:module');
  const { fileURLToPath } = await import('node:url');
  const require = createRequire(import.meta.url);
  const postcss = require('postcss');
  const tailwindcss = require('tailwindcss');
  const loadConfig = require('tailwindcss/loadConfig');
  const config = loadConfig(fileURLToPath(new URL('../tailwind.config.ts', import.meta.url)));
  const result = await postcss([tailwindcss({ ...config, content: [{ raw: page, extension: 'tsx' }] })])
    .process('@tailwind utilities;', { from: undefined });
  assert.match(result.css, /\.bg-header\s*\{\s*background-color:\s*var\(--color-header\)/);
  assert.match(result.css, /\.bg-backdrop\s*\{\s*background-color:\s*var\(--color-backdrop\)/);
  assert.match(css, /--color-header:\s*color-mix\(in srgb, var\(--color-background\) 95%, transparent\)/);
  assert.match(css, /--color-backdrop:\s*color-mix\(in srgb, var\(--color-background\) 80%, transparent\)/);
});

test('every chart tooltip explicitly styles readable labels and items', () => {
  const tooltips = page.match(/<Tooltip\b[\s\S]*?\/>/g) || [];
  assert.equal(tooltips.length, 4);
  for (const tooltip of tooltips) {
    assert.match(tooltip, /labelStyle=\{\{color:'var\(--color-text-primary\)'\}\}/);
    assert.match(tooltip, /itemStyle=\{\{color:'var\(--color-text-primary\)'\}\}/);
  }
});

test('existing search, select, and API-key controls use the supplied input surface', () => {
  const field = page.slice(page.indexOf('<input id="tmdb-api-key"')).split('/>')[0];
  const search = page.slice(page.indexOf('<input value={search}')).split('/>')[0];
  const selects = page.match(/<select\b[\s\S]*?className="[^"]*"/g) || [];
  assert.match(field, /bg-surface/);
  assert.match(search, /bg-surface/);
  assert.equal(selects.length, 2);
  for (const select of selects) assert.match(select, /bg-surface/);
});
