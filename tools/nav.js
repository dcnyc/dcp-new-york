/* ============================================================================
   Site navigation — the single source of truth for menu order.
   ----------------------------------------------------------------------------
   Order lives in site.config.json under "nav". tools/build.sh calls this to
   emit menus for the generated pages, and the local editor calls it to rewrite
   the menus in the hand-written ones, so both stay in step.

       node tools/nav.js <section> <prefix> <home> <activePath>

   section: header-left | header-right | overlay | footer
   prefix:  "" at the site root, "../" inside a page folder
   home:    "./" at the root, "../" inside a page folder
   ========================================================================== */

'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const CONFIG = path.join(ROOT, 'site.config.json');

/* Used when a page has no label of its own in the config. */
const LABELS = {
  'index.html': 'Portraits',
  'events/index.html': 'Event',
  'newyork/index.html': 'New York',
  'headshots/index.html': 'Headshots',
  'contact/index.html': 'Contact',
  'client/index.html': 'Client',
};

/* The menu as it stood before any of this was configurable. */
const DEFAULT_NAV = ['index.html', 'events/index.html', 'client/index.html', 'contact/index.html'];

function readConfig() {
  try { return JSON.parse(fs.readFileSync(CONFIG, 'utf8')); }
  catch (_) { return {}; }
}

function labelFor(p, cfg) {
  return (cfg.pages && cfg.pages[p] && cfg.pages[p].label)
      || LABELS[p]
      || p.split('/')[0].replace(/[-_]+/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

/* The ordered menu, dropping anything whose file has gone missing. */
function navItems() {
  const cfg = readConfig();
  const order = Array.isArray(cfg.nav) && cfg.nav.length ? cfg.nav : DEFAULT_NAV;
  return order
    .filter(p => fs.existsSync(path.join(ROOT, p)))
    .map(p => ({
      path: p,
      label: labelFor(p, cfg),
      slug: p === 'index.html' ? '' : p.split('/')[0],
    }));
}

function hrefFor(item, prefix, home) {
  return item.slug === '' ? home : `${prefix}${item.slug}/`;
}

/* The header splits around the centred logo: first half left, rest right. */
function split(items) {
  const half = Math.ceil(items.length / 2);
  return { left: items.slice(0, half), right: items.slice(half) };
}

function emit(section, prefix, home, active) {
  const items = navItems();
  const isOn = it => (it.path === active ? ' is-active' : '');

  if (section === 'header-left' || section === 'header-right') {
    const part = split(items)[section === 'header-left' ? 'left' : 'right'];
    return part
      .map(it => `        <a class="nav-link${isOn(it)}" href="${hrefFor(it, prefix, home)}">${it.label}</a>`)
      .join('\n');
  }

  if (section === 'overlay') {
    return items
      .map(it => `    <a class="${isOn(it).trim()}" href="${hrefFor(it, prefix, home)}">${it.label}</a>`)
      .join('\n');
  }

  if (section === 'footer') {
    return items
      .map(it => `        <a class="${isOn(it).trim()}" href="${hrefFor(it, prefix, home)}">${it.label}</a>`)
      .join('\n');
  }

  throw new Error('unknown nav section: ' + section);
}

module.exports = { navItems, emit, DEFAULT_NAV, labelFor, readConfig };

if (require.main === module) {
  const [section, prefix = '', home = './', active = ''] = process.argv.slice(2);
  process.stdout.write(emit(section, prefix, home, active));
}
