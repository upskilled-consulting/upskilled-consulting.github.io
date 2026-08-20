/* ==========================================================================
   Minimal vanilla presentation engine (no reveal.js).
   - Fixed 1280x720 design canvas, scaled to fit any projector/share window
   - Step-through builds: [data-frag="n"] elements + JS animation steps
   - Speaker-notes window (press S) with timer + next-slide preview
   - Overview grid (press O), blackout (B), fullscreen (F), help (?)
   - Print/PDF export: just Ctrl+P — every slide renders fully built
   ========================================================================== */
(function (global) {
  'use strict';

  var W = 1280, H = 720;

  var Deck = {
    slides: [],
    i: 0,          // slide index
    k: 0,          // step index within slide
    hooks: {},     // slideId -> { steps, enter, step, leave }
    speaker: null,
    started: Date.now()
  };

  /* ---- registration ---------------------------------------------------- */
  Deck.on = function (id, spec) { Deck.hooks[id] = spec || {}; };

  /* ---- scaling --------------------------------------------------------- */
  function fit() {
    if (document.body.classList.contains('overview')) return;
    var stage = document.getElementById('stage');
    var s = Math.min(global.innerWidth / W, global.innerHeight / H);
    stage.style.transform = 'scale(' + s + ')';
  }

  /* ---- steps ----------------------------------------------------------- */
  function maxFrag(el) {
    var m = 0;
    el.querySelectorAll('[data-frag]').forEach(function (f) {
      m = Math.max(m, parseInt(f.getAttribute('data-frag'), 10) || 0);
    });
    return m;
  }
  function stepCount(idx) {
    var el = Deck.slides[idx];
    var hook = Deck.hooks[el.id] || {};
    return Math.max(maxFrag(el), hook.steps || 0);
  }

  function applyFrags(el, k) {
    el.querySelectorAll('[data-frag]').forEach(function (f) {
      var n = parseInt(f.getAttribute('data-frag'), 10) || 0;
      f.classList.toggle('on', k >= n);
      var until = f.getAttribute('data-until');
      f.classList.toggle('dim', until !== null && k > (parseInt(until, 10) || 0));
    });
  }

  /* ---- navigation ------------------------------------------------------- */
  function render(animate) {
    var el = Deck.slides[Deck.i];
    Deck.slides.forEach(function (s, n) { s.classList.toggle('active', n === Deck.i); });
    applyFrags(el, Deck.k);

    var hook = Deck.hooks[el.id];
    if (hook) {
      if (animate && hook.enter) { try { hook.enter(el, Deck.k); } catch (e) { console.error('[' + el.id + '] enter', e); } }
      if (hook.step) { try { hook.step(Deck.k, el); } catch (e) { console.error('[' + el.id + '] step', e); } }
    }

    var pct = Deck.slides.length > 1 ? (Deck.i / (Deck.slides.length - 1)) * 100 : 100;
    document.querySelector('#progress > i').style.width = pct + '%';
    document.getElementById('slideno').textContent =
      String(Deck.i + 1).padStart(2, '0') + ' / ' + String(Deck.slides.length).padStart(2, '0');

    location.replace('#/' + Deck.i + (Deck.k ? '/' + Deck.k : ''));
    pushToSpeaker();
  }

  function goto(i, k, animate) {
    i = Math.max(0, Math.min(Deck.slides.length - 1, i));
    var changed = i !== Deck.i;
    var prev = Deck.slides[Deck.i];
    if (changed && prev) {
      var ph = Deck.hooks[prev.id];
      if (ph && ph.leave) { try { ph.leave(prev); } catch (e) {} }
    }
    Deck.i = i;
    var max = stepCount(i);
    Deck.k = k === 'end' ? max : Math.max(0, Math.min(max, k || 0));
    render(changed || animate !== false);
    document.body.classList.add('moved');
  }

  function next() {
    if (Deck.k < stepCount(Deck.i)) { Deck.k++; render(false); document.body.classList.add('moved'); }
    else if (Deck.i < Deck.slides.length - 1) { goto(Deck.i + 1, 0); }
  }
  function prev() {
    if (Deck.k > 0) { Deck.k--; render(false); }
    else if (Deck.i > 0) { goto(Deck.i - 1, 'end'); }
  }

  Deck.goto = goto; Deck.next = next; Deck.prev = prev;

  /* ---- speaker notes window --------------------------------------------- */
  function notesOf(idx) {
    var el = Deck.slides[idx];
    if (!el) return '';
    var n = el.querySelector('.notes');
    return n ? n.innerHTML : '';
  }
  function titleOf(idx) {
    var el = Deck.slides[idx];
    if (!el) return '—';
    var h = el.querySelector('h1, h2');
    if (!h) return el.getAttribute('data-title') || el.id;
    // <br> is a real break in the headline; keep it as a space, not a collision
    var tmp = document.createElement('div');
    tmp.innerHTML = h.innerHTML.replace(/<br\s*\/?>/gi, ' ');
    return tmp.textContent.replace(/\s+/g, ' ').trim();
  }

  function pushToSpeaker() {
    if (!Deck.speaker || Deck.speaker.closed) return;
    try {
      Deck.speaker.postMessage({
        type: 'state',
        i: Deck.i, k: Deck.k, steps: stepCount(Deck.i), total: Deck.slides.length,
        title: titleOf(Deck.i), notes: notesOf(Deck.i),
        nextTitle: Deck.i + 1 < Deck.slides.length ? titleOf(Deck.i + 1) : null,
        nextNotes: Deck.i + 1 < Deck.slides.length ? notesOf(Deck.i + 1) : '',
        started: Deck.started
      }, '*');
    } catch (e) { /* window closing */ }
  }

  function openSpeaker() {
    if (Deck.speaker && !Deck.speaker.closed) { Deck.speaker.focus(); return; }
    var w = global.open('speaker.html', 'nextup-speaker', 'width=1100,height=760');
    Deck.speaker = w;
    if (!w) { alert('Speaker window was blocked. Allow pop-ups for this page and press S again.'); return; }
    var t = setInterval(function () {
      if (!Deck.speaker || Deck.speaker.closed) { clearInterval(t); return; }
      pushToSpeaker();
    }, 900);
  }

  global.addEventListener('message', function (e) {
    var d = e.data || {};
    if (d.type === 'nav') {
      if (d.dir === 'next') next();
      else if (d.dir === 'prev') prev();
      else if (d.dir === 'goto') goto(d.i, d.k || 0);
    } else if (d.type === 'ready') {
      pushToSpeaker();
    } else if (d.type === 'reset-timer') {
      Deck.started = Date.now(); pushToSpeaker();
    }
  });

  /* ---- keyboard --------------------------------------------------------- */
  function onKey(e) {
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    var k = e.key;
    if (document.body.classList.contains('helping') && k !== '?') {
      document.body.classList.remove('helping');
      if (k === 'Escape') { e.preventDefault(); return; }
    }
    switch (k) {
      case ' ': case 'ArrowRight': case 'PageDown': case 'Enter': case 'n':
        e.preventDefault(); next(); break;
      case 'ArrowLeft': case 'PageUp': case 'Backspace': case 'p':
        e.preventDefault(); prev(); break;
      case 'ArrowDown': e.preventDefault(); goto(Deck.i + 1, 0); break;
      case 'ArrowUp': e.preventDefault(); goto(Deck.i - 1, 0); break;
      case 'Home': e.preventDefault(); goto(0, 0); break;
      case 'End': e.preventDefault(); goto(Deck.slides.length - 1, 0); break;
      case 'f': case 'F': toggleFull(); break;
      case 's': case 'S': openSpeaker(); break;
      case 'o': case 'O': case 'Escape': toggleOverview(); break;
      case 'b': case 'B': case '.': document.body.classList.toggle('blacked'); break;
      case 'r': case 'R': Deck.started = Date.now(); pushToSpeaker(); break;
      case '?': document.body.classList.toggle('helping'); break;
      default:
        if (/^[0-9]$/.test(k)) { /* number jump buffer */ jumpBuffer(k); }
    }
  }

  var buf = '', bufT = null;
  function jumpBuffer(d) {
    buf += d; clearTimeout(bufT);
    bufT = setTimeout(function () {
      var n = parseInt(buf, 10); buf = '';
      if (!isNaN(n) && n >= 1) goto(n - 1, 0);
    }, 600);
  }

  function toggleFull() {
    if (!document.fullscreenElement) document.documentElement.requestFullscreen().catch(function () {});
    else document.exitFullscreen();
  }

  function toggleOverview() {
    var on = document.body.classList.toggle('overview');
    if (on) {
      document.getElementById('stage').style.transform = '';
      Deck.slides.forEach(function (s, n) {
        s.onclick = function () { document.body.classList.remove('overview'); fit(); goto(n, 0); };
      });
      var active = Deck.slides[Deck.i];
      if (active && active.scrollIntoView) active.scrollIntoView({ block: 'center' });
    } else {
      Deck.slides.forEach(function (s) { s.onclick = null; });
      fit(); render(true);
    }
  }

  /* ---- pointer / touch --------------------------------------------------- */
  function wireGestures() {
    var x0 = null, y0 = null;
    document.addEventListener('touchstart', function (e) {
      x0 = e.changedTouches[0].clientX; y0 = e.changedTouches[0].clientY;
    }, { passive: true });
    document.addEventListener('touchend', function (e) {
      if (x0 === null) return;
      var dx = e.changedTouches[0].clientX - x0, dy = e.changedTouches[0].clientY - y0;
      if (Math.abs(dx) > 55 && Math.abs(dx) > Math.abs(dy)) { dx < 0 ? next() : prev(); }
      x0 = null;
    }, { passive: true });

    document.addEventListener('click', function (e) {
      if (document.body.classList.contains('overview')) return;
      if (e.target.closest('a, button, .no-advance')) return;
      next();
    });
    document.addEventListener('contextmenu', function (e) { e.preventDefault(); prev(); });
  }

  /* ---- print: force every slide into its finished state ------------------ */
  function buildAll() {
    global.__deckPrint = true;               // slides.js snaps transitions to 0ms
    Deck.slides.forEach(function (el) {
      applyFrags(el, 999);
      var h = Deck.hooks[el.id];
      if (!h) return;
      try {
        if (h.enter) h.enter(el, h.steps || 999);
        if (h.step) h.step(h.steps == null ? 999 : h.steps, el);
      } catch (e) { console.error('[print] ' + el.id, e); }
    });
  }

  /* ---- boot -------------------------------------------------------------- */
  function boot() {
    Deck.slides = Array.prototype.slice.call(document.querySelectorAll('#stage > .slide'));
    Deck.slides.forEach(function (s, n) { if (!s.id) s.id = 'slide-' + n; });

    fit();
    global.addEventListener('resize', fit);
    document.addEventListener('keydown', onKey);
    wireGestures();

    var m = /^#\/(\d+)(?:\/(\d+))?/.exec(location.hash);
    goto(m ? +m[1] : 0, m && m[2] ? +m[2] : 0);

    // Print: build every slide fully so Ctrl+P captures the finished state.
    global.addEventListener('beforeprint', buildAll);
    global.addEventListener('afterprint', function () {
      global.__deckPrint = false;
      render(true);
    });

    if (/[?&]print-pdf/.test(location.search)) {
      buildAll();
      setTimeout(function () { global.print(); }, 1600);
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();

  global.Deck = Deck;
})(window);
