/* DCP New York — carousel + menu behaviour */
(function () {
  'use strict';

  /* ---------------- Mobile overlay menu ---------------- */
  var toggle = document.querySelector('.js-nav-toggle');
  var overlay = document.querySelector('.js-overlay-menu');
  var closeBtn = document.querySelector('.js-overlay-close');

  function openMenu() {
    if (!overlay) return;
    overlay.classList.add('is-open');
    document.body.classList.add('menu-open');
  }
  function closeMenu() {
    if (!overlay) return;
    overlay.classList.remove('is-open');
    document.body.classList.remove('menu-open');
  }

  if (toggle) toggle.addEventListener('click', openMenu);
  if (closeBtn) closeBtn.addEventListener('click', closeMenu);
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') closeMenu();
  });

  /* ---------------- Smooth "back to top" ---------------- */
  var toTop = document.querySelector('.js-to-top');
  if (toTop) {
    toTop.addEventListener('click', function (e) {
      e.preventDefault();
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
  }

  /* ---------------- Contact form ----------------
     No backend: compose a mail message from the fields. Swap in a real
     endpoint by giving the <form> an action/method and dropping data-mailto. */
  var cform = document.querySelector('.js-contact-form');

  /* The address is stored split so it is not a harvestable "a@b.c" string in
     the page source; join it only when it is actually needed. */
  function recipient(form) {
    var u = form.dataset.mailtoUser, d = form.dataset.mailtoDomain;
    if (u && d) return u + String.fromCharCode(64) + d;
    return form.dataset.mailto || '';
  }

  if (cform && recipient(cform)) {
    cform.addEventListener('submit', function (e) {
      e.preventDefault();

      var required = cform.querySelectorAll('[required]');
      for (var i = 0; i < required.length; i++) {
        if (!required[i].value.trim()) {
          required[i].focus();
          required[i].reportValidity && required[i].reportValidity();
          return;
        }
      }

      var get = function (n) {
        var el = cform.elements[n];
        return el ? el.value.trim() : '';
      };

      var lines = [
        'Name: ' + get('name'),
        'Email: ' + get('email'),
        'Session type: ' + (get('session') || '—'),
        'Heard about me via: ' + (get('source') || '—'),
        '',
        get('message')
      ];

      window.location.href =
        'mailto:' + recipient(cform) +
        '?subject=' + encodeURIComponent('Website enquiry from ' + get('name')) +
        '&body=' + encodeURIComponent(lines.join('\n'));
    });
  }

  /* ---------------- Photo carousel ----------------
     Centred and endless. The real slide set is cloned once on each side, so
     there is always material to the left and right; whenever scrolling settles
     outside the middle copy we jump by exactly one set width. The copies are
     identical, so the jump is invisible and the strip never hits an edge.

     On load the FIRST photo sits centred in the viewport, which puts the LAST
     photo (from the leading clone set) in the slot to its left. */
  document.querySelectorAll('.js-carousel').forEach(function (carousel) {
    var track = carousel.querySelector('.carousel__track');
    if (!track) return;

    var originals = Array.prototype.slice.call(track.children);
    var count = originals.length;
    if (!count) return;

    /* ---- build the leading and trailing clones ---- */
    var fragAfter = document.createDocumentFragment();
    var fragBefore = document.createDocumentFragment();
    originals.forEach(function (slide) {
      var a = slide.cloneNode(true);
      var b = slide.cloneNode(true);
      a.setAttribute('aria-hidden', 'true');
      b.setAttribute('aria-hidden', 'true');
      fragAfter.appendChild(a);
      fragBefore.appendChild(b);
    });
    track.appendChild(fragAfter);
    track.insertBefore(fragBefore, track.firstChild);

    /* Middle (real) copy occupies indices [count, 2*count-1]. */
    var FIRST_REAL = count;

    function slideAt(i) { return track.children[i]; }

    /* Scroll offset that puts a given slide in the middle of the viewport. */
    function centreOffset(el) {
      return el.offsetLeft - (track.clientWidth - el.offsetWidth) / 2;
    }

    /* Width of one full copy of the set. */
    function setWidth() {
      return slideAt(FIRST_REAL).offsetLeft - slideAt(0).offsetLeft;
    }

    function centreOn(i, smooth) {
      var el = slideAt(i);
      if (!el) return;
      track.scrollTo({ left: centreOffset(el), behavior: smooth ? 'smooth' : 'auto' });
    }

    /* Index of whichever slide currently sits nearest the centre. */
    function nearestIndex() {
      var centre = track.scrollLeft + track.clientWidth / 2;
      var best = FIRST_REAL, bestDist = Infinity;
      for (var i = 0; i < track.children.length; i++) {
        var s = track.children[i];
        var d = Math.abs(s.offsetLeft + s.offsetWidth / 2 - centre);
        if (d < bestDist) { bestDist = d; best = i; }
      }
      return best;
    }

    /* Pull the scroll position back into the middle copy. Because the copies
       are identical this is visually a no-op. */
    function normalise() {
      var w = setWidth();
      if (w <= 0) return;

      var delta = 0;
      if (track.scrollLeft < w * 0.5) delta = w;
      else if (track.scrollLeft > w * 1.5) delta = -w;
      if (!delta) return;

      /* On phones the track uses mandatory scroll-snap, which would try to
         animate this jump and undo it. Lift snapping for the one frame the
         jump takes, then restore it. */
      var snap = track.style.scrollSnapType;
      track.style.scrollSnapType = 'none';
      track.scrollLeft += delta;
      requestAnimationFrame(function () {
        track.style.scrollSnapType = snap;
      });
    }

    function step(dir) {
      centreOn(nearestIndex() + dir, true);
    }

    /* Re-centre / re-wrap once scrolling has come to rest. */
    var settleTimer;
    track.addEventListener('scroll', function () {
      clearTimeout(settleTimer);
      settleTimer = setTimeout(normalise, 140);
    });

    carousel.querySelectorAll('.js-prev').forEach(function (b) {
      b.addEventListener('click', function () { step(-1); });
    });
    carousel.querySelectorAll('.js-next').forEach(function (b) {
      b.addEventListener('click', function () { step(1); });
    });

    /* Click-and-drag panning (desktop), with a small threshold so
       a plain click on the edge zones still registers as a click. */
    var down = false, startX = 0, startScroll = 0, moved = false;

    track.addEventListener('pointerdown', function (e) {
      if (e.pointerType === 'touch') return; // native touch scrolling
      down = true; moved = false;
      startX = e.clientX;
      startScroll = track.scrollLeft;
      track.classList.add('is-dragging');
    });

    track.addEventListener('pointermove', function (e) {
      if (!down) return;
      var dx = e.clientX - startX;
      if (Math.abs(dx) > 3) moved = true;
      track.scrollLeft = startScroll - dx;
    });

    function endDrag() {
      if (!down) return;
      down = false;
      track.classList.remove('is-dragging');
      centreOn(nearestIndex(), true); // settle onto the nearest photo
    }
    track.addEventListener('pointerup', endDrag);
    track.addEventListener('pointercancel', endDrag);
    track.addEventListener('pointerleave', endDrag);

    /* Suppress the click that follows a drag. */
    track.addEventListener('click', function (e) {
      if (moved) { e.preventDefault(); e.stopPropagation(); }
    }, true);

    /* The wide invisible edge zones duplicate the visible arrow buttons, so
       keep them out of the tab order and hidden from assistive tech. */
    carousel.querySelectorAll('.carousel__zone').forEach(function (z) {
      z.setAttribute('tabindex', '-1');
      z.setAttribute('aria-hidden', 'true');
    });

    /* Keyboard: arrows work whenever focus is not inside a form control.
       The track needs no tabindex of its own for this. */
    document.addEventListener('keydown', function (e) {
      if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
      var t = e.target;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' ||
                t.tagName === 'SELECT' || t.isContentEditable)) return;
      e.preventDefault();
      step(e.key === 'ArrowRight' ? 1 : -1);
    });

    /* ---- initial position: first photo centred ---- */
    function reset() { centreOn(FIRST_REAL, false); }
    reset();
    window.addEventListener('load', reset);

    /* Keep the centred photo centred across resizes. */
    var resizeTimer;
    window.addEventListener('resize', function () {
      var i = nearestIndex();
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(function () { centreOn(i, false); }, 120);
    });
  });
})();
