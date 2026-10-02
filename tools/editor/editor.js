/* DCP New York — local editor.
   Injected at serve time by tools/editor/server.js; never shipped. */

(function () {
  'use strict';

  var CFG = window.__EDITOR__ || {};
  var API = '/__editor/api/';
  var editing = false;
  var state = { pages: [], status: null };

  /* ------------------------------------------------------------ utilities */

  function el(tag, cls, html) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (html !== undefined) n.innerHTML = html;
    return n;
  }

  var toasts = el('div', 'ed-toasts');

  /* ---------------------------------------------------------- busy state */
  /* Every call that touches disk shows a bar and a label, because some of
     them (resizing a dozen photos) take several seconds and silence reads
     as the page being broken. */
  var busyEl, busyBar, busyText, busyDepth = 0;

  function buildBusy() {
    busyEl = el('div', 'ed-busy');
    busyEl.hidden = true;
    busyBar = el('div', 'ed-busy__bar');
    var fill = el('div', 'ed-busy__fill');
    busyBar.appendChild(fill);
    busyText = el('div', 'ed-busy__text', '');
    busyEl.appendChild(busyText);
    busyEl.appendChild(busyBar);
    busyEl._fill = fill;
    return busyEl;
  }

  function busy(label, pct) {
    busyDepth++;
    busyEl.hidden = false;
    busyText.textContent = label;
    busyEl._fill.style.width = (pct === undefined ? 100 : pct) + '%';
    busyEl._fill.classList.toggle('is-indeterminate', pct === undefined);
    document.body.classList.add('ed-busy-on');
  }

  function busyUpdate(label, pct) {
    if (busyEl.hidden) return;
    if (label) busyText.textContent = label;
    if (pct !== undefined) {
      busyEl._fill.classList.remove('is-indeterminate');
      busyEl._fill.style.width = pct + '%';
    }
  }

  function busyDone() {
    busyDepth = Math.max(0, busyDepth - 1);
    if (busyDepth) return;
    busyEl._fill.style.width = '100%';
    setTimeout(function () {
      if (busyDepth) return;
      busyEl.hidden = true;
      document.body.classList.remove('ed-busy-on');
    }, 320);
  }

  function toast(msg, kind) {
    var t = el('div', 'ed-toast' + (kind ? ' ed-toast--' + kind : ''), msg);
    toasts.appendChild(t);
    setTimeout(function () {
      t.style.transition = 'opacity .3s'; t.style.opacity = '0';
      setTimeout(function () { t.remove(); }, 300);
    }, kind === 'err' ? 6000 : 2600);
  }

  function api(route, opts) {
    return fetch(API + route, opts).then(function (r) {
      return r.json().then(function (j) {
        if (!r.ok) throw new Error(j.error || ('request failed (' + r.status + ')'));
        return j;
      });
    });
  }

  var ICON_PAGE = '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.3"><path d="M4 1.5h5L12.5 5v9.5h-9z"/><path d="M9 1.5V5h3.5"/></svg>';
  var ICON_HOME = '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.3"><path d="M2.5 7L8 2.5 13.5 7v6.5h-11z"/></svg>';
  var ICON_BACK = '<svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M9.5 3L5 8l4.5 5"/></svg>';

  /* ---------------------------------------------------------------- panel */

  var panel, body, publishBtn;

  function buildPanel() {
    panel = el('div', 'ed-panel');

    var head = el('div', 'ed-head');
    head.appendChild(el('div', 'ed-head__dot'));
    var names = el('div');
    names.appendChild(el('div', 'ed-head__name', 'DCP New York'));
    names.appendChild(el('div', 'ed-head__sub', 'Local editor'));
    head.appendChild(names);
    panel.appendChild(head);

    body = el('div', 'ed-body');
    panel.appendChild(body);

    panel.appendChild(buildBusy());

    var foot = el('div', 'ed-foot');

    var prev = el('button', 'ed-btn ed-btn--preview', 'Preview');
    prev.type = 'button';
    prev.title = 'Open this page as it will look live, in a new tab';
    prev.addEventListener('click', function () {
      /* Preview has its own port, so clicking around inside the preview tab
         stays in preview instead of dropping back into the editor. */
      var port = Number(location.port || 80) + 1;
      window.open(location.protocol + '//' + location.hostname + ':' + port + location.pathname,
                  'dcp-preview');
    });
    foot.appendChild(prev);

    publishBtn = el('button', 'ed-btn ed-btn--primary ed-btn--publish', 'Publish');
    publishBtn.type = 'button';
    /* A red dot rather than a line of text: it says "there is something to
       publish" without taking up a row. */
    publishBtn.appendChild(el('span', 'ed-pub-dot'));
    publishBtn.addEventListener('click', openPublish);
    foot.appendChild(publishBtn);
    panel.appendChild(foot);

    document.body.appendChild(panel);
    document.body.appendChild(toasts);
    document.body.classList.add('ed-active');
  }

  function refreshStatus() {
    return api('status').then(function (s) {
      state.status = s;
      var pending = (s.changedCount || 0) + (s.unpushed || 0);
      publishBtn.classList.toggle('has-changes', pending > 0);

      /* The count still exists, just as a tooltip rather than a line of text. */
      var bits = [];
      if (s.changedCount) bits.push(s.changedCount + ' unsaved change' + (s.changedCount === 1 ? '' : 's'));
      if (s.unpushed) bits.push(s.unpushed + ' commit' + (s.unpushed === 1 ? '' : 's') + ' waiting to push');
      publishBtn.title = bits.length ? bits.join(', ') : 'Everything is published';
    }).catch(function () {
      publishBtn.classList.remove('has-changes');
      publishBtn.title = '';
    });
  }

  /* ------------------------------------------------------------ view: pages */

  function showPages() {
    body.innerHTML = '';

    var head = el('div', 'ed-pages-head');
    head.appendChild(el('span', 'ed-pages-head__t', 'Pages'));
    var add = el('button', 'ed-add', '<span>+</span> Add page');
    add.type = 'button';
    add.addEventListener('click', openAddPage);
    head.appendChild(add);
    body.appendChild(head);

    api('pages').then(function (r) {
      state.pages = r.pages;

      var inMenu = r.pages.filter(function (p) { return p.inMenu; });
      var hidden = r.pages.filter(function (p) { return !p.inMenu; });

      body.appendChild(el('div', 'ed-sec', 'Site menu'));
      var menuList = el('div', 'ed-list ed-list--menu');
      inMenu.forEach(function (p) { menuList.appendChild(pageRow(p)); });
      body.appendChild(menuList);
      wirePageDrag(menuList);

      body.appendChild(el('div', 'ed-sec', 'Not in menu'));
      var restList = el('div', 'ed-list ed-list--rest');
      hidden.forEach(function (p) { restList.appendChild(pageRow(p)); });
      body.appendChild(restList);
      wirePageDrag(restList);

      body.appendChild(el('div', 'ed-note',
        '<b>Draft pages</b>These exist in the repository but are left out of the ' +
        'deploy allowlist, so they are not on the live site. Publishing will not ' +
        'expose them.'));
    }).catch(function (e) {
      body.appendChild(el('div', 'ed-note', e.message));
    });
  }

  /* --------------------------------------------- drag pages to reorder */

  function wirePageDrag(list) {
    list.addEventListener('dragover', function (e) {
      e.preventDefault();
      var dragging = document.querySelector('.ed-row.ed-dragging');
      if (!dragging) return;

      list.classList.add('ed-list--target');

      var after = null;
      Array.prototype.slice.call(list.querySelectorAll('.ed-row:not(.ed-dragging)')).forEach(function (row) {
        var r = row.getBoundingClientRect();
        if (e.clientY > r.top + r.height / 2) after = row;
      });
      list.insertBefore(dragging, after ? after.nextSibling : list.firstChild);
    });

    ['dragleave', 'drop'].forEach(function (ev) {
      list.addEventListener(ev, function (e) {
        if (ev === 'drop') e.preventDefault();
        list.classList.remove('ed-list--target', 'ed-list--refuse');
      });
    });
  }

  function commitNav() {
    var list = body.querySelector('.ed-list--menu');
    if (!list) return;
    var order = Array.prototype.slice.call(list.querySelectorAll('.ed-row'))
      .map(function (r) { return r.dataset.path; });

    busy('Updating site menu…');
    api('nav', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ order: order }),
    }).then(function (r) {
      busyDone();
      if (r.nowPublished && r.nowPublished.length) {
        toast(r.nowPublished.join(' and ') + ' added to the menu and set to go live. ' +
              'Press Publish to put it on the site.', 'ok');
      } else {
        toast('Menu updated. Press Publish to put it on the site.', 'ok');
      }
      refreshStatus();
      showPages();
    }).catch(function (e) {
      busyDone();
      toast(e.message, 'err');
      showPages();
    });
  }

  function pageRow(p) {
    var row = el('button', 'ed-row');
    row.type = 'button';
    row.draggable = true;
    row.dataset.path = p.path;
    row.dataset.published = String(p.published);

    row.addEventListener('dragstart', function (e) {
      row.classList.add('ed-dragging');
      e.dataTransfer.effectAllowed = 'move';
      try { e.dataTransfer.setData('text/plain', p.path); } catch (_) {}
    });
    row.addEventListener('dragend', function () {
      row.classList.remove('ed-dragging');
      document.querySelectorAll('.ed-list--target,.ed-list--refuse')
        .forEach(function (n) { n.classList.remove('ed-list--target', 'ed-list--refuse'); });
      commitNav();
    });
    if (p.url === location.pathname || (p.url === '/' && location.pathname === '/index.html')) {
      row.classList.add('is-current');
    }

    row.appendChild(el('span', 'ed-row__ico', p.url === '/' ? ICON_HOME : ICON_PAGE));
    row.appendChild(el('span', 'ed-row__label', p.label));

    if (!p.published) row.appendChild(el('span', 'ed-tag ed-tag--draft', 'Draft'));
    else if (!p.inMenu) row.appendChild(el('span', 'ed-tag ed-tag--hidden', 'Unlinked'));
    else if (p.gallery) row.appendChild(el('span', 'ed-row__meta', p.photos));

    row.addEventListener('click', function () {
      if (p.url === location.pathname) { showPage(p); return; }
      sessionStorage.setItem('ed-open', p.path);
      location.href = p.url;
    });
    return row;
  }

  /* ------------------------------------------------------- view: one page */

  function showPage(p) {
    body.innerHTML = '';

    var back = el('button', 'ed-back', ICON_BACK + '<span>Pages</span>');
    back.type = 'button';
    back.addEventListener('click', function () { if (editing) stopEditing(); showPages(); });
    body.appendChild(back);

    body.appendChild(el('div', 'ed-title', p.label));
    body.appendChild(publishOption(p));

    if (!p.gallery) {
      body.appendChild(textBlockList(p));
      return;
    }

    api('settings?gallery=' + encodeURIComponent(p.gallery)).then(function (s) {
      renderBlock(p, s);
    }).catch(function (e) { body.appendChild(el('div', 'ed-note', e.message)); });
  }

  /* Whether the page is part of the live site. Separate from the menu: a page
     can be live without being linked, as New York is. */
  function publishOption(p) {
    var opts = el('div', 'ed-opts');
    opts.appendChild(toggleOption(
      'Include on the live site', p.published,
      p.inMenu
        ? 'This page is in the site menu, so it has to stay on the site. Drag it out of the menu first to hold it back.'
        : 'Off keeps the page, and its photos, out of the deploy entirely. Nothing changes on the web until you press Publish.',
      function (on) {
        busy(on ? 'Including page…' : 'Holding page back…');
        api('pages/publish', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ page: p.path, live: on }),
        }).then(function () {
          busyDone();
          toast(on ? 'Will go live on the next Publish' : 'Held back from the site', 'ok');
          p.published = on;
          refreshStatus();
        }).catch(function (e) {
          busyDone();
          toast(e.message, 'err');
          showPage(p);
        });
      }
    ));
    return opts;
  }

  /* Lists the text blocks on the page so they can be picked from the panel
     rather than hunted for on the page. */
  function textBlockList(p) {
    var wrap = el('div');
    var nodes = Array.prototype.slice.call(document.querySelectorAll('[data-ed]'));

    wrap.appendChild(el('div', 'ed-sec', 'Text blocks'));

    if (!nodes.length) {
      wrap.appendChild(el('div', 'ed-note', 'This page has no editable text.'));
      return wrap;
    }

    var list = el('div', 'ed-list');
    nodes.forEach(function (node) {
      var row = el('button', 'ed-row ed-row--text');
      row.type = 'button';
      row.appendChild(el('span', 'ed-row__tag', TAG_NAMES[node.tagName] || node.tagName));
      var words = (node.textContent || '').trim().replace(/\s+/g, ' ');
      row.appendChild(el('span', 'ed-row__label', words.slice(0, 48) + (words.length > 48 ? '…' : '')));
      row.addEventListener('click', function () {
        startEditing();
        node.scrollIntoView({ behavior: 'smooth', block: 'center' });
        node.focus();
        selectText(node);
      });
      list.appendChild(row);
    });
    wrap.appendChild(list);

    wrap.appendChild(el('div', 'ed-note',
      '<b>Formatting</b>Pick a block to change its font, size, alignment, or to make ' +
      'words bold or italic. You can also click the text straight on the page.'));
    return wrap;
  }

  function thumbPath(p, file) {
    return '/assets/img/' + p.gallery + '/' + file;
  }

  function renderBlock(p, s) {
    var isGrid = s.type === 'grid';

    body.appendChild(el('div', 'ed-sec', isGrid ? 'Photo grid' : 'Photo slider'));

    /* big preview + "Manage Photos" */
    var hero = el('button', 'ed-hero');
    hero.type = 'button';
    if (s.photos[0]) {
      var img = el('img');
      img.src = thumbPath(p, s.photos[0]);
      hero.appendChild(img);
    }
    hero.appendChild(el('div', 'ed-hero__veil',
      '<svg viewBox="0 0 16 16" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.4">' +
      '<rect x="2" y="4" width="9" height="8"/><path d="M5 4V2.5h9V10h-1.5"/></svg><span>Manage photos</span>'));
    hero.addEventListener('click', function () { startEditing(); });
    body.appendChild(hero);

    /* thumbnail strip */
    var strip = el('div', 'ed-thumbs');
    s.photos.slice(1, 6).forEach(function (f) {
      var d = el('div');
      var i = el('img'); i.src = thumbPath(p, f); d.appendChild(i);
      strip.appendChild(d);
    });
    if (s.photos.length > 6) {
      strip.appendChild(el('div', 'ed-thumbs__more', '+' + (s.photos.length - 6)));
    }
    body.appendChild(strip);

    var opts = el('div', 'ed-opts');
    opts.appendChild(el('div', 'ed-opts__h', 'Options'));

    if (isGrid) {
      /* columns */
      var o = el('div', 'ed-opt');
      o.appendChild(el('span', 'ed-opt__label', 'Columns'));
      var seg = el('div', 'ed-seg');
      [2, 3, 4].forEach(function (n) {
        var b = el('button', s.settings.columns === n ? 'is-on' : '', String(n));
        b.type = 'button';
        b.addEventListener('click', function () { saveSettings(p, { columns: n }); });
        seg.appendChild(b);
      });
      o.appendChild(seg);
      o.appendChild(el('div', 'ed-opt__hint', 'Desktop only. Phones always show two columns.'));
      opts.appendChild(o);
    } else {
      /* arrow controls */
      opts.appendChild(toggleOption(
        'Show slider controls', s.settings.showControls,
        'The arrows under the strip. Dragging and the keyboard still work either way.',
        function (on) { saveSettings(p, { showControls: on }); }
      ));
    }

    opts.appendChild(el('div', 'ed-opt',
      '<span class="ed-opt__label">Photos</span>' +
      '<div class="ed-opt__hint">' + s.photos.length + ' in this gallery. ' +
      'Open <b>Manage photos</b> to drag them into a new order, add more, or remove one.</div>'));

    body.appendChild(opts);
    body.appendChild(editToggleButton('Manage photos'));
    body.appendChild(textBlockList(p));
  }

  function toggleOption(label, value, hint, onChange) {
    var o = el('div', 'ed-opt');
    o.appendChild(el('span', 'ed-opt__label', label));

    var wrap = el('label', 'ed-toggle');
    var input = el('input'); input.type = 'checkbox'; input.checked = !!value;
    var track = el('span', 'ed-toggle__track');
    var stateTxt = el('span', 'ed-toggle__state', value ? 'On' : 'Off');
    input.addEventListener('change', function () {
      stateTxt.textContent = input.checked ? 'On' : 'Off';
      onChange(input.checked);
    });
    wrap.appendChild(input); wrap.appendChild(track); wrap.appendChild(stateTxt);
    o.appendChild(wrap);
    if (hint) o.appendChild(el('div', 'ed-opt__hint', hint));
    return o;
  }

  function saveSettings(p, patch) {
    busy('Applying setting…');
    api('settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ gallery: p.gallery, settings: patch }),
    }).then(function () {
      busyUpdate('Rebuilding…');
      toast('Setting saved', 'ok');
      sessionStorage.setItem('ed-open', p.path);
      setTimeout(function () { location.reload(); }, 500);
    }).catch(function (e) { toast(e.message, 'err'); });
  }

  function editToggleButton(labelOn) {
    var wrap = el('div');
    wrap.style.padding = '18px 16px 0';
    var b = el('button', 'ed-btn ed-btn--wide ed-btn--ghost', editing ? 'Done editing' : labelOn);
    b.type = 'button';
    b.addEventListener('click', function () {
      if (editing) { stopEditing(); } else { startEditing(); b.textContent = 'Done editing'; }
    });
    wrap.appendChild(b);
    return wrap;
  }

  /* ------------------------------------------------------------ edit mode */

  function startEditing() {
    if (editing) return;
    editing = true;
    document.body.classList.add('ed-editing');

    var box = galleryContainer();
    if (box && CFG.gallery) {
      Array.prototype.slice.call(box.children).forEach(function (c) {
        if (c.getAttribute('aria-hidden') === 'true') c.remove();
      });
      decorateItems(box);
      addDropZone(box);
    }
    enableText();
    toast('Drag photos to reorder. Click text to rewrite it.');
  }

  function stopEditing() {
    editing = false;
    location.reload();
  }

  function galleryContainer() {
    return document.querySelector('.headshot-grid') || document.querySelector('.carousel__track');
  }

  function fileOf(item) {
    var img = item.querySelector('img');
    return img ? img.getAttribute('src').split('/').pop().split('?')[0] : null;
  }

  function renumber(box) {
    Array.prototype.slice.call(box.children)
      .filter(function (c) { return c.classList.contains('ed-item'); })
      .forEach(function (c, i) {
        var n = c.querySelector('.ed-item__n');
        if (n) n.textContent = i + 1;
      });
  }

  function decorateItems(box) {
    Array.prototype.slice.call(box.children)
      .filter(function (c) { return c.querySelector('img'); })
      .forEach(function (item, i) {
        item.classList.add('ed-item');
        item.draggable = true;
        item.appendChild(el('span', 'ed-item__n', String(i + 1)));

        var del = el('button', 'ed-item__del', '×');
        del.type = 'button';
        del.title = 'Remove this photo';
        del.addEventListener('click', function (e) {
          e.preventDefault(); e.stopPropagation(); removePhoto(fileOf(item));
        });
        item.appendChild(del);

        item.addEventListener('dragstart', function (e) {
          item.classList.add('ed-dragging');
          e.dataTransfer.effectAllowed = 'move';
          try { e.dataTransfer.setData('text/plain', fileOf(item)); } catch (_) {}
        });
        item.addEventListener('dragend', function () {
          item.classList.remove('ed-dragging');
          document.querySelectorAll('.ed-over').forEach(function (n) { n.classList.remove('ed-over'); });
          commitOrder(box);
        });
        item.addEventListener('dragover', function (e) {
          e.preventDefault();
          var dragging = box.querySelector('.ed-dragging');
          if (!dragging || dragging === item) return;
          item.classList.add('ed-over');
          var r = item.getBoundingClientRect();
          box.insertBefore(dragging, (e.clientX - r.left) > r.width / 2 ? item.nextSibling : item);
          renumber(box);
        });
        item.addEventListener('dragleave', function () { item.classList.remove('ed-over'); });
        item.addEventListener('drop', function (e) { e.preventDefault(); item.classList.remove('ed-over'); });
      });
  }

  var orderTimer;
  function commitOrder(box) {
    clearTimeout(orderTimer);
    orderTimer = setTimeout(function () {
      var order = Array.prototype.slice.call(box.children)
        .filter(function (c) { return c.classList.contains('ed-item'); })
        .map(fileOf).filter(Boolean);
      if (!order.length) return;

      busy('Saving order…');
      api('gallery/reorder', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ gallery: CFG.gallery, order: order }),
      }).then(function (r) {
        /* Reordering renames every file on disk, so adopt the new names now.
           Without this the page keeps the old ones and the next drag is
           rejected as out of step. */
        if (r.files) adoptNames(box, r.files);
        busyDone();
        toast('Order saved', 'ok');
        refreshStatus();
      }).catch(function (e) {
        busyDone();
        toast(e.message, 'err');
        /* Genuinely out of step: reload so the page picks up the real names. */
        if (/out of step/i.test(e.message)) {
          sessionStorage.setItem('ed-open', CFG.page);
          setTimeout(function () { location.reload(); }, 2000);
        }
      });
    }, 250);
  }

  /* Point each item at the filename the server gave it after a rename. */
  function adoptNames(box, files) {
    Array.prototype.slice.call(box.children)
      .filter(function (c) { return c.classList.contains('ed-item'); })
      .forEach(function (item, i) {
        var img = item.querySelector('img');
        if (!img || !files[i]) return;
        var src = img.getAttribute('src').split('?')[0];
        img.setAttribute('src', src.replace(/[^/]+$/, files[i]) + '?t=' + Date.now());
      });
  }

  function removePhoto(file) {
    if (!file) return;
    if (!confirm('Remove ' + file + ' from this gallery?\n\nA copy is kept in .originals/removed/.')) return;
    busy('Removing photo…');
    api('gallery/delete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ gallery: CFG.gallery, file: file }),
    }).then(function (r) {
      busyUpdate('Rebuilding…');
      toast('Removed. ' + r.remaining + ' photos left.', 'ok');
      sessionStorage.setItem('ed-open', CFG.page);
      setTimeout(function () { location.reload(); }, 600);
    }).catch(function (e) { toast(e.message, 'err'); });
  }

  function addDropZone(box) {
    var dz = el('div', 'ed-drop',
      '<b>Drop photos here to add them</b>JPEGs only, resized for the web automatically.');
    box.parentNode.insertBefore(dz, box.nextSibling);

    ['dragenter', 'dragover'].forEach(function (ev) {
      dz.addEventListener(ev, function (e) { e.preventDefault(); dz.classList.add('ed-drop--hot'); });
    });
    ['dragleave', 'drop'].forEach(function (ev) {
      dz.addEventListener(ev, function () { dz.classList.remove('ed-drop--hot'); });
    });
    dz.addEventListener('drop', function (e) {
      e.preventDefault();
      var files = Array.prototype.slice.call(e.dataTransfer.files || [])
        .filter(function (f) { return /\.jpe?g$/i.test(f.name); });
      if (!files.length) { toast('Only .jpg files can be added', 'err'); return; }
      uploadQueue(files);
    });
    dz.addEventListener('click', function () {
      var input = el('input');
      input.type = 'file'; input.accept = 'image/jpeg'; input.multiple = true;
      input.addEventListener('change', function () { uploadQueue(Array.prototype.slice.call(input.files)); });
      input.click();
    });
  }

  /* Uploads run one at a time with visible progress, then a single finalize
     pass resizes and rebuilds. Doing the heavy work once at the end is what
     makes adding a dozen photos take seconds rather than a minute. */
  function uploadQueue(files) {
    var done = 0, failed = 0;
    busy('Adding photo 1 of ' + files.length, 0);

    (function next(i) {
      if (i >= files.length) {
        busyUpdate('Optimising ' + done + ' photo' + (done === 1 ? '' : 's') + '…');
        api('gallery/finalize', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ gallery: CFG.gallery }),
        }).then(function () {
          busyUpdate('Rebuilding page…', 100);
          toast('Added ' + done + ' photo' + (done === 1 ? '' : 's') +
                (failed ? ', ' + failed + ' skipped' : ''), failed ? 'err' : 'ok');
          sessionStorage.setItem('ed-open', CFG.page);
          setTimeout(function () { busyDone(); location.reload(); }, 500);
        }).catch(function (e) {
          busyDone();
          toast('Photos were added but the rebuild failed: ' + e.message, 'err');
        });
        return;
      }

      busyUpdate('Adding photo ' + (i + 1) + ' of ' + files.length,
                 Math.round((i / files.length) * 90));

      files[i].arrayBuffer().then(function (buf) {
        return fetch(API + 'gallery/upload', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/octet-stream',
            'X-Gallery': CFG.gallery,
            'X-Filename': files[i].name,
          },
          body: buf,
        }).then(function (r) { return r.json(); });
      }).then(function (j) {
        if (j.error) { failed++; toast(j.error, 'err'); } else done++;
        next(i + 1);
      }).catch(function (e) { failed++; toast(e.message, 'err'); next(i + 1); });
    })(0);
  }

  /* -------------------------------------------------------------- add page */

  function openAddPage() {
    var modal = el('div', 'ed-modal');
    modal.innerHTML =
      '<div class="ed-modal__box">' +
      '  <div class="ed-modal__head">Add a page</div>' +
      '  <div class="ed-modal__body">' +
      '    <p>Creates an empty gallery page built from the same template as Portraits, with its own photo folder.</p>' +
      '    <input type="text" class="ed-name" placeholder="Page name, e.g. Weddings">' +
      '    <div class="ed-opt__hint ed-slug"></div>' +
      '    <div class="ed-note" style="margin:14px 0 0">' +
      '      <b>It starts as a draft</b>The page is left out of the deploy allowlist and the ' +
      '      menus, so publishing will not put it on the live site until you add it deliberately.' +
      '    </div>' +
      '  </div>' +
      '  <div class="ed-modal__foot">' +
      '    <button class="ed-btn ed-cancel" type="button">Cancel</button>' +
      '    <button class="ed-btn ed-btn--primary ed-go" type="button" style="flex:0 0 auto">Create page</button>' +
      '  </div>' +
      '</div>';
    document.body.appendChild(modal);

    var input = modal.querySelector('.ed-name');
    var slugEl = modal.querySelector('.ed-slug');
    var go = modal.querySelector('.ed-go');
    input.focus();

    function slugify(s) {
      return s.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
    }
    function sync() {
      var s = slugify(input.value);
      slugEl.textContent = s ? 'Address: /' + s + '/' : '';
    }
    input.addEventListener('input', sync);
    input.addEventListener('keydown', function (e) { if (e.key === 'Enter') go.click(); });

    modal.querySelector('.ed-cancel').addEventListener('click', function () { modal.remove(); });
    modal.addEventListener('click', function (e) { if (e.target === modal) modal.remove(); });

    go.addEventListener('click', function () {
      var label = input.value.trim();
      if (!label) { input.focus(); return; }
      go.disabled = true;
      go.textContent = 'Creating…';
      busy('Creating page…');

      api('pages/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ label: label }),
      }).then(function (r) {
        busyDone();
        modal.remove();
        toast('Created ' + r.label, 'ok');
        sessionStorage.setItem('ed-open', r.slug + '/index.html');
        location.href = r.url;
      }).catch(function (e) {
        busyDone();
        go.disabled = false;
        go.textContent = 'Create page';
        toast(e.message, 'err');
      });
    });
  }

  /* ------------------------------------------------------------ text edits */

  var selectedText = null;

  function enableText() {
    document.querySelectorAll('[data-ed]').forEach(function (node) {
      node.contentEditable = 'true';
      node.spellcheck = true;
      node.dataset.edOriginal = node.innerHTML;

      node.addEventListener('focus', function () { selectText(node); });
      node.addEventListener('mouseup', function () { syncInlineButtons(); });
      node.addEventListener('keyup', function () { syncInlineButtons(); });
      node.addEventListener('blur', function () { saveText(node); });

      node.addEventListener('keydown', function (e) {
        if (e.key === 'Escape') { node.innerHTML = node.dataset.edOriginal; node.blur(); }
        /* Enter would otherwise inject a <div> or <br> the design never
           expects, so commit instead. Shift+Enter still makes a line break. */
        if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); node.blur(); }
      });
    });
  }

  function saveText(node) {
    var html = node.innerHTML;
    var style = readStyle(node);
    var styleChanged = JSON.stringify(style) !== (node.dataset.edStyle || '{}');
    if (html === node.dataset.edOriginal && !styleChanged) return;

    busy('Saving text…');
    api('text', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        page: CFG.page,
        index: Number(node.dataset.ed),
        html: html,
        text: node.textContent,
        style: style,
      }),
    }).then(function () {
      busyDone();
      node.classList.remove('ed-text-unsaved');
      node.dataset.edOriginal = html;
      node.dataset.edStyle = JSON.stringify(style);
      toast('Text saved', 'ok');
      refreshStatus();
    }).catch(function (e) {
      busyDone();
      /* Never throw away what was typed. Reverting here was making a failed
         save look like the edit had silently vanished. */
      toast('Not saved: ' + e.message + ' Your text is still on screen.', 'err');
      node.classList.add('ed-text-unsaved');
    });
  }

  var STYLE_PROPS = ['fontFamily', 'fontSize', 'textAlign', 'fontWeight', 'fontStyle', 'letterSpacing', 'lineHeight', 'color'];
  var CSS_NAME = {
    fontFamily: 'font-family', fontSize: 'font-size', textAlign: 'text-align',
    fontWeight: 'font-weight', fontStyle: 'font-style', letterSpacing: 'letter-spacing',
    lineHeight: 'line-height', color: 'color',
  };

  function readStyle(node) {
    var out = {};
    STYLE_PROPS.forEach(function (p) {
      if (node.style[p]) out[CSS_NAME[p]] = node.style[p];
    });
    return out;
  }

  /* ------------------------------------------------ the text format panel */

  var FONTS = [
    { label: 'Default', value: '' },
    { label: 'Serif',   value: '"Quincy CF", Georgia, serif' },
    { label: 'Sans',    value: '"Work Sans", Helvetica, Arial, sans-serif' },
  ];
  var SIZES = [
    { label: 'Default', value: '' },
    { label: 'XS',  value: '0.75rem' },  { label: 'S',   value: '0.875rem' },
    { label: 'M',   value: '1rem' },     { label: 'L',   value: '1.25rem' },
    { label: 'XL',  value: '1.75rem' },  { label: '2XL', value: '2.5rem' },
    { label: '3XL', value: '3.5rem' },
  ];
  var TAG_NAMES = { H1: 'Heading 1', H2: 'Heading 2', H3: 'Heading 3', H4: 'Heading 4', H5: 'Heading 5', H6: 'Eyebrow', P: 'Paragraph' };

  function selectText(node) {
    selectedText = node;
    document.querySelectorAll('.ed-text-on').forEach(function (n) { n.classList.remove('ed-text-on'); });
    node.classList.add('ed-text-on');
    showTextPanel(node);
  }

  function showTextPanel(node) {
    body.innerHTML = '';

    var back = el('button', 'ed-back', ICON_BACK + '<span>Done</span>');
    back.type = 'button';
    back.addEventListener('click', function () {
      node.blur();
      node.classList.remove('ed-text-on');
      selectedText = null;
      stopEditing();
    });
    body.appendChild(back);

    body.appendChild(el('div', 'ed-title', 'Text'));
    body.appendChild(el('div', 'ed-sec', TAG_NAMES[node.tagName] || node.tagName));

    var opts = el('div', 'ed-opts');

    /* ---- inline: bold / italic / underline ---- */
    var o = el('div', 'ed-opt');
    o.appendChild(el('span', 'ed-opt__label', 'Style'));
    var inline = el('div', 'ed-seg ed-seg--icons');
    [['bold', '<b>B</b>', 'Bold'], ['italic', '<i>I</i>', 'Italic'], ['underline', '<u>U</u>', 'Underline']]
      .forEach(function (c) {
        var b = el('button', 'js-inline', c[1]);
        b.type = 'button'; b.title = c[2]; b.dataset.cmd = c[0];
        b.addEventListener('mousedown', function (e) { e.preventDefault(); });
        b.addEventListener('click', function () {
          node.focus();
          document.execCommand(c[0], false, null);
          syncInlineButtons();
          saveText(node);
        });
        inline.appendChild(b);
      });
    o.appendChild(inline);
    o.appendChild(el('div', 'ed-opt__hint', 'Applies to the words you have selected.'));
    opts.appendChild(o);

    /* ---- alignment ---- */
    opts.appendChild(segOption('Alignment', [
      { label: 'Left', value: 'left' }, { label: 'Centre', value: 'center' }, { label: 'Right', value: 'right' },
    ], node.style.textAlign || '', function (v) {
      node.style.textAlign = v;
      saveText(node);
    }));

    /* ---- font ---- */
    opts.appendChild(segOption('Font', FONTS, node.style.fontFamily || '', function (v) {
      node.style.fontFamily = v;
      saveText(node);
    }, 'Only the two faces the site loads. Anything else would not render for visitors.'));

    /* ---- size ---- */
    opts.appendChild(selectOption('Size', SIZES, node.style.fontSize || '', function (v) {
      node.style.fontSize = v;
      saveText(node);
    }, 'Default keeps this block on the site\'s type scale, which stays readable on phones.'));

    /* ---- clear ---- */
    var clear = el('button', 'ed-btn ed-btn--wide ed-btn--ghost', 'Clear formatting');
    clear.type = 'button';
    clear.addEventListener('click', function () {
      STYLE_PROPS.forEach(function (p) { node.style[p] = ''; });
      node.innerHTML = node.textContent;
      saveText(node);
      showTextPanel(node);
    });
    var wrap = el('div'); wrap.style.padding = '6px 16px 0'; wrap.appendChild(clear);
    opts.appendChild(wrap);

    body.appendChild(opts);
    body.appendChild(el('div', 'ed-note',
      '<b>Editing this block</b>Type straight into the page. Enter saves, Escape ' +
      'undoes, Shift+Enter makes a line break.'));

    syncInlineButtons();
  }

  function syncInlineButtons() {
    document.querySelectorAll('.js-inline').forEach(function (b) {
      var on = false;
      try { on = document.queryCommandState(b.dataset.cmd); } catch (_) {}
      b.classList.toggle('is-on', on);
    });
  }

  function segOption(label, choices, current, onPick, hint) {
    var o = el('div', 'ed-opt');
    o.appendChild(el('span', 'ed-opt__label', label));
    var seg = el('div', 'ed-seg');
    choices.forEach(function (c) {
      var b = el('button', current === c.value ? 'is-on' : '', c.label);
      b.type = 'button';
      b.addEventListener('click', function () {
        seg.querySelectorAll('button').forEach(function (x) { x.classList.remove('is-on'); });
        b.classList.add('is-on');
        onPick(c.value);
      });
      seg.appendChild(b);
    });
    o.appendChild(seg);
    if (hint) o.appendChild(el('div', 'ed-opt__hint', hint));
    return o;
  }

  function selectOption(label, choices, current, onPick, hint) {
    var o = el('div', 'ed-opt');
    o.appendChild(el('span', 'ed-opt__label', label));
    var sel = el('select', 'ed-select');
    choices.forEach(function (c) {
      var op = el('option', '', c.label);
      op.value = c.value;
      if (c.value === current) op.selected = true;
      sel.appendChild(op);
    });
    sel.addEventListener('change', function () { onPick(sel.value); });
    o.appendChild(sel);
    if (hint) o.appendChild(el('div', 'ed-opt__hint', hint));
    return o;
  }

  /* ---------------------------------------------------------------- publish */

  function openPublish() {
    var modal = el('div', 'ed-modal');
    modal.innerHTML =
      '<div class="ed-modal__box">' +
      '  <div class="ed-modal__head">Publish changes</div>' +
      '  <div class="ed-modal__body">' +
      '    <p>Commits everything currently changed and pushes it to GitHub. The live site updates within a minute. Draft pages stay off the site.</p>' +
      '    <input type="text" class="ed-msg" placeholder="Describe the change" value="Update site content">' +
      '    <div class="ed-log" hidden></div>' +
      '  </div>' +
      '  <div class="ed-modal__foot">' +
      '    <button class="ed-btn ed-cancel" type="button">Cancel</button>' +
      '    <button class="ed-btn ed-btn--primary ed-go" type="button" style="flex:0 0 auto">Publish</button>' +
      '  </div>' +
      '</div>';
    document.body.appendChild(modal);

    var input = modal.querySelector('.ed-msg');
    var log = modal.querySelector('.ed-log');
    var go = modal.querySelector('.ed-go');
    input.focus(); input.select();

    modal.querySelector('.ed-cancel').addEventListener('click', function () { modal.remove(); });
    modal.addEventListener('click', function (e) { if (e.target === modal) modal.remove(); });

    go.addEventListener('click', function () {
      go.disabled = true; go.textContent = 'Publishing…';
      log.hidden = false; log.textContent = 'Working…';
      api('publish', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: input.value }),
      }).then(function (r) {
        log.textContent = r.log || '(no output)';
        go.textContent = 'Published';
        toast(r.nothingToCommit ? 'Nothing new to commit; pushed pending commits.' : 'Published to GitHub', 'ok');
        refreshStatus();
        setTimeout(function () { modal.remove(); }, 2200);
      }).catch(function (e) {
        log.textContent = e.message;
        go.disabled = false; go.textContent = 'Retry';
        toast('Publish failed: ' + e.message, 'err');
      });
    });
  }

  /* ------------------------------------------------------------------ boot */

  document.addEventListener('DOMContentLoaded', function () {
    buildPanel();
    refreshStatus();
    setInterval(refreshStatus, 15000);

    /* Open on the page list, so the first thing you do is choose what to work
       on. The panel for a particular page opens only when you deliberately
       went there: by clicking it in the list, or after an action that reloads
       (adding photos, changing a setting), both of which set this flag. */
    var wanted = sessionStorage.getItem('ed-open');
    sessionStorage.removeItem('ed-open');

    if (!wanted) { showPages(); return; }

    api('pages').then(function (r) {
      state.pages = r.pages;
      var here = r.pages.filter(function (p) { return p.path === CFG.page; })[0];
      if (here && wanted === CFG.page) showPage(here);
      else showPages();
    }).catch(showPages);
  });
})();
