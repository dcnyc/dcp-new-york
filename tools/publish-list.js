/* ============================================================================
   Works out exactly which files get deployed.
   ----------------------------------------------------------------------------
   The list of published pages lives in site.config.json under "publish", so
   the local editor can change what is live and push it. It used to live inside
   the deploy workflow, which the editor cannot push without the `workflow`
   credential scope.

       node tools/publish-list.js        → one path per line

   Only the asset folders belonging to published pages are included, so the
   photos of a draft page are never uploaded even though they sit under
   assets/.
   ========================================================================== */

'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');

/* Shipped on every build regardless of which pages are live. */
const ALWAYS = [
  'index.html',
  'CNAME',
  '.nojekyll',
  'assets/css',
  'assets/js',
  'assets/fonts',
  'assets/img/logo.png',
  'assets/img/about',
];

/* If the config is unreadable, fall back to the pages that were live when this
   was introduced, so a typo in the config cannot silently empty the site. */
const FALLBACK = [
  'index.html', 'events/index.html', 'newyork/index.html',
  'contact/index.html', 'client/index.html',
];

function readConfig() {
  try { return JSON.parse(fs.readFileSync(path.join(ROOT, 'site.config.json'), 'utf8')); }
  catch (_) { return {}; }
}

function publishedPages() {
  const cfg = readConfig();
  const list = Array.isArray(cfg.publish) && cfg.publish.length ? cfg.publish : FALLBACK;
  return list.filter(p => fs.existsSync(path.join(ROOT, p)));
}

function paths() {
  const out = [];
  const add = p => {
    if (!out.includes(p) && fs.existsSync(path.join(ROOT, p))) out.push(p);
  };

  ALWAYS.forEach(add);

  for (const page of publishedPages()) {
    const slug = page === 'index.html' ? '' : page.split('/')[0];
    if (slug) add(slug);
    /* The home page's photos live under portraits rather than a folder of
       its own. */
    add(slug ? `assets/img/${slug}` : 'assets/img/portraits');
  }

  return out;
}

module.exports = { paths, publishedPages };

if (require.main === module) {
  process.stdout.write(paths().join('\n') + '\n');
}
