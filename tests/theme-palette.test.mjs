import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const css = readFileSync(new URL('../app/globals.css', import.meta.url), 'utf8');
const ui = readFileSync(new URL('../app/ui.tsx', import.meta.url), 'utf8');
const views = readFileSync(new URL('../app/views.tsx', import.meta.url), 'utf8');
const layout = readFileSync(new URL('../app/layout.tsx', import.meta.url), 'utf8');

function declarations(block) {
  return Object.fromEntries(
    [...block.matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)].map(([, name, value]) => [name, value.trim()]),
  );
}

const dark = declarations(css.match(/:root\s*\{([^}]*)\}/s)?.[1] ?? '');
const light = declarations(css.match(/:root\[data-theme="light"\]\s*\{([^}]*)\}/s)?.[1] ?? '');

function value(tokens, name) {
  assert.ok(tokens[name], `missing ${name}`);
  return tokens[name];
}

function color(tokens, name) {
  const current = value(tokens, name);
  const alias = current.match(/^var\((--[\w-]+)\)$/);
  return alias ? color(tokens, alias[1]) : current;
}

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

test('dark and light themes expose the approved palette through shared semantic tokens', () => {
  const expectedDark = {
    '--bg': '#111923',
    '--surface': '#1B2732',
    '--raised': '#24333F',
    '--line': '#40515C',
    '--ink': '#F1EFE8',
    '--body': '#A8B4BA',
    '--muted': '#8E9CA4',
    '--amber': '#E7AD45',
    '--cyan': '#69BDC7',
    '--link': 'var(--cyan)',
    '--button': 'var(--amber)',
    '--button-text': '#111923',
    '--focus': 'var(--amber)',
    '--chart-primary': 'var(--amber)',
    '--chart-secondary': 'var(--cyan)',
    '--activity-1': '#B07725',
    '--activity-2': '#C07E29',
    '--activity-3': '#D39232',
    '--activity-4': '#E7AD45',
  };
  const expectedLight = {
    '--bg': '#F4F1E8',
    '--surface': '#FFFCF5',
    '--raised': '#E9E5DA',
    '--line': '#C8C3B7',
    '--ink': '#24313B',
    '--body': '#45545C',
    '--muted': '#52616A',
    '--amber': '#785000',
    '--cyan': '#126B75',
    '--link': 'var(--cyan)',
    '--button': 'var(--amber)',
    '--button-text': '#F4F1E8',
    '--focus': 'var(--amber)',
    '--chart-primary': 'var(--amber)',
    '--chart-secondary': 'var(--cyan)',
    '--activity-1': '#785000',
    '--activity-2': '#876015',
    '--activity-3': '#966F2B',
    '--activity-4': '#A47C3B',
  };
  for (const [name, expected] of Object.entries(expectedDark)) assert.equal(value(dark, name), expected, `dark ${name}`);
  for (const [name, expected] of Object.entries(expectedLight)) assert.equal(value(light, name), expected, `light ${name}`);
});

test('theme text, links, buttons, and focus indicators retain accessible contrast on every surface', () => {
  for (const [mode, tokens] of [['dark', dark], ['light', light]]) {
    const backgrounds = ['--bg', '--surface', '--raised'].map((name) => value(tokens, name));
    const textColors = ['--ink', '--body', '--muted', '--link', '--amber'].map((name) => color(tokens, name));
    for (const foreground of textColors) {
      for (const background of backgrounds) {
        assert.ok(contrastRatio(foreground, background) >= 4.5,
          `${mode} ${foreground} on ${background} must meet 4.5:1`);
      }
    }
    const buttonText = color(tokens, '--button-text');
    const button = color(tokens, '--button');
    assert.ok(contrastRatio(buttonText, button) >= 4.5, `${mode} button text must meet 4.5:1`);
    const focus = color(tokens, '--focus');
    for (const background of backgrounds) {
      assert.ok(contrastRatio(focus, background) >= 3,
        `${mode} focus outline on ${background} must meet 3:1`);
    }
    for (const name of ['--activity-1', '--activity-2', '--activity-3', '--activity-4']) {
      assert.ok(contrastRatio(color(tokens, name), value(tokens, '--raised')) >= 3,
        `${mode} ${name} chart mark must meet 3:1 against its panel`);
    }
  }
  assert.ok(contrastRatio(value(dark, '--error'), value(dark, '--error-bg')) >= 4.5);
  assert.ok(contrastRatio(value(light, '--error'), value(light, '--error-bg')) >= 4.5);
});

test('links, selected controls, chart series, browser chrome, and reduced motion use the theme contract', () => {
  assert.match(css, /a\s*\{[^}]*color:\s*var\(--link\)/s);
  assert.match(css, /:where\(button\s*,\s*a\s*,\s*input\s*,\s*select\s*,\s*textarea\s*,\s*summary\s*,\s*\[tabindex\]\):focus-visible\s*\{[^}]*outline:\s*2px solid var\(--focus\)/s);
  assert.match(css, /\.sidebar nav button\[aria-current="page"\]\s*\{[^}]*color:\s*var\(--amber\)/s);
  assert.match(css, /\.segmented button\[aria-pressed="true"\]\s*\{[^}]*color:\s*var\(--amber\)/s);
  assert.match(css, /\.column-track\s*>\s*span\s*\{[^}]*background:\s*var\(--chart-primary\)/s);
  assert.match(css, /\.columns\.cyan\s+\.column-track\s*>\s*span\s*\{[^}]*background:\s*var\(--chart-secondary\)/s);
  assert.match(css, /\.bar-track\s*>\s*span\s*\{[^}]*background:\s*var\(--chart-primary\)/s);
  for (const level of [1, 2, 3, 4]) {
    assert.match(css, new RegExp(`\\[data-level="${level}"\\]\\s*\\{[^}]*background:\\s*var\\(--activity-${level}\\)`, 's'));
  }
  assert.match(ui, /color\s*=\s*"amber"/);
  assert.match(views, /color=\{i\s*===\s*0\s*\?\s*"amber"\s*:\s*"cyan"\}/);
  assert.match(layout, /themeColor:\s*"#111923"/);
  assert.match(css, /@media\s*\(prefers-reduced-motion:\s*reduce\)[\s\S]*?transition:\s*none\s*!important/);
});
