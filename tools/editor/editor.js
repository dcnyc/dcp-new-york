/* DCP New York — local editor overlay.
   Injected at serve time by tools/editor/server.js. Never shipped to the
   published site. */

(function () {
  'use strict';

  var CFG = window.__EDITOR__ || {};
  var API = '/__editor/api/';
  var editing = false;

  /* ------------------------------------------------------------ utilities */

  function el(tag, cls, html) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (html !== undefined) n.innerHTML = html;
    return n;
  }

  var toasts = el('div', 'ed-toasts');
  document.addEventListener('DOMContentLoaded', function () { document.body.appendChild(toasts); });

  function toast(msg, kind) {
    var t = el('div', 'ed-toast' + (kind ? ' ed-toast--' + kind : ''), msg);
    toasts.appendChild(t);
    setTimeout(function () {
      t.style.transition = 'opacity .3s';
      t.style.opacity = '0';
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

  /* -------------------------------------------------------------- toolbar */

  var bar, statusEl, editBtn;

  function buildBar() {
    bar = el('div', 'ed-bar');

    bar.appendChild(el('span', 'ed-bar__brand', 'DCP Editor'));
    bar.appendChild(el('span', 'ed-bar__sep'));

    editBtn = el('button', 'ed-btn', 'Edit page');
    editBtn.type = 'button';
    editBtn.addEventListener('click', toggleEditing);
    bar.appendChild(editBtn);

    statusEl = el('span', 'ed-bar__status', 'Loading…');
    bar.appendChild(statusEl);

    bar.appendChild(el('span', 'ed-bar__spacer'));

    var view = el('button', 'ed-btn', 'Open live site');
    view.type = 'button';
    view.addEventListener('click', function () {
      window.open('https://www.dcpnewyork.com/', '_blank', 'noopener');
    });
    bar.appendChild(view);

    var pub = el('button', 'ed-btn ed-btn--publish', 'Publish…');
    pub.type = 'button';
    pub.addEventListener('click', openPublish);
    bar.appendChild(pub);

    document.body.appendChild(bar);
    document.body.classList.add('ed-active');
  }

  function refreshStatus() {
    api('status').then(function (s) {
      var bits = [];
      bits.push('<b>' + s.changedCount + '</b> unsaved change' + (s.changedCount === 1 ? '' : 's'));
      if (s.unpushed) bits.push('<b>' + s.unpushed + '</b> unpublished commit' + (s.unpushed === 1 ? '' : 's'));
      statusEl.innerHTML = bits.join(' &middot; ');
    }).catch(function (e) { statusEl.textContent = 'status unavailable: ' + e.message; });
  }

  /* ------------------------------------------------------------ edit mode */

  function toggleEditing() {
    editing = !editing;
    document.body.classList.toggle('ed-editing', editing);
    editBtn.textContent = editing ? 'Done editing' : 'Edit page';
    editBtn.classList.toggle('ed-btn--on', editing);

    if (editing) { enterEditing(); }
    else { exitEditing(); }
  }

  function galleryContainer() {
    return document.querySelector('.headshot-grid') || document.querySelector('.carousel__track');
  }

  function enterEditing() {
    var box = galleryContainer();
    if (box && CFG.gallery) {
      /* The carousel clones its slides three times at runtime; drop the copies
         so we are reordering the real set. */
      Array.prototype.slice.call(box.children).forEach(function (c) {
        if (c.getAttribute('aria-hidden') === 'true') c.remove();
      });
      decorateItems(box);
      addDropZone(box);
    }
    enableText();
    toast('Editing on. Drag photos to reorder, click text to rewrite.');
  }

  function exitEditing() {
    document.querySelectorAll('.ed-item__n,.ed-item__del').forEach(function (n) { n.remove(); });
    document.querySelectorAll('.ed-item').forEach(function (n) {
      n.classList.remove('ed-item');
      n.draggable = false;
    });
    var dz = document.querySelector('.ed-drop');
    if (dz) dz.remove();
    disableText();
    /* Reload so the carousel rebuilds its clones and the page is true to disk. */
    location.reload();
  }

  /* ------------------------------------------------------- drag to reorder */

  function fileOf(item) {
    var img = item.querySelector('img');
    if (!img) return null;
    return img.getAttribute('src').split('/').pop().split('?')[0];
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
    var items = Array.prototype.slice.call(box.children).filter(function (c) { return c.querySelector('img'); });

    items.forEach(function (item, i) {
      item.classList.add('ed-item');
      item.draggable = true;

      item.appendChild(el('span', 'ed-item__n', String(i + 1)));

      var del = el('button', 'ed-item__del', '×');
      del.type = 'button';
      del.title = 'Remove this photo';
      del.addEventListener('click', function (e) {
        e.preventDefault(); e.stopPropagation();
        removePhoto(fileOf(item));
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
        var after = (e.clientX - r.left) > r.width / 2;
        box.insertBefore(dragging, after ? item.nextSibling : item);
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
        .map(fileOf)
        .filter(Boolean);
      if (!order.length) return;

      api('gallery/reorder', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ gallery: CFG.gallery, order: order }),
      }).then(function () {
        toast('Order saved', 'ok');
        refreshStatus();
      }).catch(function (e) { toast(e.message, 'err'); });
    }, 250);
  }

  function removePhoto(file) {
    if (!file) return;
    if (!confirm('Remove ' + file + ' from this gallery?\n\nA copy is kept in .originals/removed/.')) return;
    api('gallery/delete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ gallery: CFG.gallery, file: file }),
    }).then(function (r) {
      toast('Removed. ' + r.remaining + ' photos left.', 'ok');
      setTimeout(function () { location.reload(); }, 600);
    }).catch(function (e) { toast(e.message, 'err'); });
  }

  /* -------------------------------------------------------- add new photos */

  function addDropZone(box) {
    var dz = el('div', 'ed-drop',
      '<b>Drop photos here to add them</b>JPEGs only. They are resized for the web automatically.');
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
      input.type = 'file';
      input.accept = 'image/jpeg';
      input.multiple = true;
      input.addEventListener('change', function () {
        uploadQueue(Array.prototype.slice.call(input.files));
      });
      input.click();
    });
  }

  function uploadQueue(files) {
    toast('Adding ' + files.length + ' photo' + (files.length === 1 ? '' : 's') + '…');
    var done = 0;

    (function next(i) {
      if (i >= files.length) {
        toast('Added ' + done + ' photo' + (done === 1 ? '' : 's'), 'ok');
        setTimeout(function () { location.reload(); }, 700);
        return;
      }
      var f = files[i];
      f.arrayBuffer().then(function (buf) {
        return fetch(API + 'gallery/upload', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/octet-stream',
            'X-Gallery': CFG.gallery,
            'X-Filename': f.name,
          },
          body: buf,
        }).then(function (r) { return r.json(); });
      }).then(function (j) {
        if (j.error) toast(j.error, 'err'); else done++;
        next(i + 1);
      }).catch(function (e) { toast(e.message, 'err'); next(i + 1); });
    })(0);
  }

  /* ------------------------------------------------------------ text edits */

  function enableText() {
    document.querySelectorAll('[data-ed]').forEach(function (node) {
      node.contentEditable = 'true';
      node.spellcheck = true;
      node.dataset.edOriginal = node.textContent;

      node.addEventListener('blur', function () {
        var text = node.textContent.replace(/\s+/g, ' ').trim();
        if (text === (node.dataset.edOriginal || '').replace(/\s+/g, ' ').trim()) return;

        api('text', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ page: CFG.page, index: Number(node.dataset.ed), text: text }),
        }).then(function () {
          node.dataset.edOriginal = text;
          toast('Text saved', 'ok');
          refreshStatus();
        }).catch(function (e) {
          toast(e.message, 'err');
          node.textContent = node.dataset.edOriginal;
        });
      });

      /* Enter commits rather than inserting a newline. */
      node.addEventListener('keydown', function (e) {
        if (e.key === 'Enter') { e.preventDefault(); node.blur(); }
        if (e.key === 'Escape') { node.textContent = node.dataset.edOriginal; node.blur(); }
      });
    });
  }

  function disableText() {
    document.querySelectorAll('[data-ed]').forEach(function (n) { n.contentEditable = 'false'; });
  }

  /* -------------------------------------------------------------- publish */

  function openPublish() {
    var modal = el('div', 'ed-modal');
    modal.innerHTML =
      '<div class="ed-modal__box">' +
      '  <div class="ed-modal__head">Publish changes</div>' +
      '  <div class="ed-modal__body">' +
      '    <p>This commits everything currently changed and pushes it to GitHub. The live site updates within a minute.</p>' +
      '    <input type="text" class="ed-msg" placeholder="Describe the change" value="Update site content">' +
      '    <div class="ed-log" hidden></div>' +
      '  </div>' +
      '  <div class="ed-modal__foot">' +
      '    <button class="ed-btn ed-cancel" type="button">Cancel</button>' +
      '    <button class="ed-btn ed-btn--publish ed-go" type="button">Publish</button>' +
      '  </div>' +
      '</div>';
    document.body.appendChild(modal);

    var input = modal.querySelector('.ed-msg');
    var log = modal.querySelector('.ed-log');
    var go = modal.querySelector('.ed-go');
    input.focus();
    input.select();

    modal.querySelector('.ed-cancel').addEventListener('click', function () { modal.remove(); });
    modal.addEventListener('click', function (e) { if (e.target === modal) modal.remove(); });

    go.addEventListener('click', function () {
      go.disabled = true;
      go.textContent = 'Publishing…';
      log.hidden = false;
      log.textContent = 'Working…';

      api('publish', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: input.value }),
      }).then(function (r) {
        log.textContent = r.log || '(no output)';
        go.textContent = 'Published';
        toast(r.nothingToCommit ? 'Nothing new to commit; pushed any pending commits.' : 'Published to GitHub', 'ok');
        refreshStatus();
        setTimeout(function () { modal.remove(); }, 2200);
      }).catch(function (e) {
        log.textContent = e.message;
        go.disabled = false;
        go.textContent = 'Retry';
        toast('Publish failed: ' + e.message, 'err');
      });
    });
  }

  /* ----------------------------------------------------------------- boot */

  document.addEventListener('DOMContentLoaded', function () {
    buildBar();
    refreshStatus();
    setInterval(refreshStatus, 15000);
  });
})();
