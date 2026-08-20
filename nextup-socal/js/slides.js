/* ==========================================================================
   Slide visuals — d3.js
   Every builder returns { step(k), destroy() }. The engine calls the builder
   on slide entry, then step(k) for each build. Sizes are hard-coded against
   the fixed 1280x720 design canvas so nothing depends on measuring a hidden
   element (which matters for the print/PDF path).
   ========================================================================== */
(function () {
  'use strict';

  var C = {
    indigo: '#2E236F', violet: '#5B3FD6', purple: '#6E5CE8', blue: '#3E8FC9',
    teal: '#2FBFC8', tealB: '#59DBDE', tealInk: '#0E6A72',
    ink: '#1A2138', inkSoft: '#5B647E', inkMute: '#97A0B7',
    line: 'rgba(46,35,111,.12)',
    warn: '#D4763A', alarm: '#C4443F', good: '#2C9E7E',
    onDark: '#FFFFFF', onDarkSoft: '#C3BCEA', onDarkMute: '#8F86C4',
    lineDark: 'rgba(255,255,255,.14)'
  };

  var F = {
    usd0: d3.format('$,.0f'),
    usd2: d3.format('$,.2f'),
    usd3: d3.format('$,.3f'),
    int: d3.format(','),
    pct: d3.format('.0%')
  };

  /* Money that shrinks gracefully: $0.0006 -> "$0.0006", $525000 -> "$525,000" */
  function money(v) {
    if (v >= 1000) return F.usd0(v);
    if (v >= 1) return F.usd2(v);
    if (v >= 0.01) return '$' + v.toFixed(3);
    return '$' + v.toFixed(4);
  }

  /* Print-aware transition. `name` scopes the transition: d3 cancels any
     running transition of the SAME name on an element, so animating two
     properties of one element at once requires two different names.

     In print mode we do NOT return a zero-duration transition — d3 still defers
     those to a timer tick, and a PDF snapshot can be taken before they flush,
     which silently prints empty charts. Instead we return a shim with the same
     chainable surface that applies every value synchronously. */
  function T(sel, dur, delay, name) {
    if (window.__deckPrint) {
      var shim = {
        attr:  function (k, v) { sel.attr(k, v);  return shim; },
        style: function (k, v) { sel.style(k, v); return shim; },
        ease: function () { return shim; },
        duration: function () { return shim; },
        delay: function () { return shim; },
        transition: function () { return shim; },
        interrupt: function () { return shim; },
        /* run the tween straight to its end state */
        tween: function (nm, fn) {
          sel.each(function () {
            var step = fn.apply(this, arguments);
            if (typeof step === 'function') step.call(this, 1);
          });
          return shim;
        },
        select:    function (q) { return T(sel.select(q), 0, 0); },
        selectAll: function (q) { return T(sel.selectAll(q), 0, 0); },
        node: function () { return sel.node(); },
        selection: function () { return sel; }
      };
      return shim;
    }
    var t = name ? sel.transition(name) : sel.transition();
    return t.duration(dur == null ? 620 : dur).delay(delay || 0);
  }

  function ease(t) { return t.ease(d3.easeCubicOut); }

  /* Animated number readout on any text node (SVG or HTML). */
  function countUp(sel, from, to, fmt, dur, delay) {
    ease(T(sel, dur == null ? 900 : dur, delay)).tween('cu', function () {
      var node = this, i = d3.interpolateNumber(from, to);
      return function (t) { node.textContent = fmt(i(t)); };
    });
    return sel;
  }

  /* Fires fn the first time `on` becomes true for this key, and resets when it
     goes false. Without this every later build step re-triggers the count-up. */
  function gate(state, key, on, fn, off) {
    if (on && !state[key]) { state[key] = true; fn(); }
    else if (!on && state[key]) { state[key] = false; if (off) off(); }
  }

  /* Whole numbers while interpolating — d3.format(',') leaks decimals mid-tween. */
  function fmtInt(v) { return F.int(Math.round(v)); }

  /* Value pops into place with a green rise arrow instead of ticking up.
     Used once the audience has already learned to read the count-up. */
  function popIn(sel, arrow, on, delay) {
    if (on) {
      sel.interrupt('pop').attr('opacity', 0).attr('transform', 'translate(0,16)');
      ease(T(sel, 520, delay || 0, 'pop')).attr('opacity', 1).attr('transform', 'translate(0,0)');
      if (arrow) {
        arrow.interrupt('pop').attr('opacity', 0).attr('transform', 'translate(0,22)');
        ease(T(arrow, 620, (delay || 0) + 120, 'pop')).attr('opacity', 1).attr('transform', 'translate(0,0)');
      }
    } else {
      sel.interrupt('pop').attr('opacity', 0);
      if (arrow) arrow.interrupt('pop').attr('opacity', 0);
    }
  }

  /* Green upward chevron — the "this went up again" marker. */
  function riseArrow(g, x, y, size) {
    var a = g.append('g').attr('opacity', 0);
    var s = size || 20;
    a.append('path')
      .attr('d', 'M' + x + ',' + (y - s) + ' L' + (x + s * 0.62) + ',' + (y - s * 0.18) +
                 ' L' + (x + s * 0.24) + ',' + (y - s * 0.18) + ' L' + (x + s * 0.24) + ',' + y +
                 ' L' + (x - s * 0.24) + ',' + y + ' L' + (x - s * 0.24) + ',' + (y - s * 0.18) +
                 ' L' + (x - s * 0.62) + ',' + (y - s * 0.18) + ' Z')
      .attr('fill', '#2C9E7E');
    return a;
  }

  var gradSeq = 0;
  function linGrad(svg, from, to, horizontal) {
    var id = 'g' + (++gradSeq);
    var g = svg.append('defs').append('linearGradient')
      .attr('id', id)
      .attr('x1', '0%').attr('y1', horizontal ? '0%' : '100%')
      .attr('x2', horizontal ? '100%' : '0%').attr('y2', '0%');
    g.append('stop').attr('offset', '0%').attr('stop-color', from);
    g.append('stop').attr('offset', '100%').attr('stop-color', to);
    return 'url(#' + id + ')';
  }

  function svgIn(container, w, h) {
    container.innerHTML = '';
    return d3.select(container)
      .append('svg')
      .attr('viewBox', '0 0 ' + w + ' ' + h)
      .attr('width', w).attr('height', h)
      .style('display', 'block').style('margin', '0 auto');
  }

  function txt(g, x, y, s, opts) {
    opts = opts || {};
    return g.append('text')
      .attr('x', x).attr('y', y)
      .attr('text-anchor', opts.anchor || 'start')
      .attr('fill', opts.fill || C.ink)
      .attr('font-size', opts.size || 14)
      .attr('font-weight', opts.weight || 600)
      .attr('letter-spacing', opts.ls == null ? 0 : opts.ls)
      .attr('font-family', opts.display ? "'Sora',sans-serif" : "'Manrope',sans-serif")
      .text(s);
  }

  /* Small-caps section label */
  function cap(g, x, y, s, dark) {
    return txt(g, x, y, s, {
      size: 11, weight: 800, ls: 1.7,
      fill: dark ? C.onDarkMute : C.inkMute
    });
  }

  function show(sel, on, dur) {
    T(sel, dur == null ? 420 : dur).attr('opacity', on ? 1 : 0);
  }

  var VIZ = {};   /* name -> function(container, slideEl) -> controller */
  var REG = [];   /* { id, steps } */

  /* ========================================================================
     VIZ BUILDERS
     ===================================================================== */

  /* --- 01 & 23 · ambient drifting token field ---------------------------- */
  VIZ.titlefield = function (container) {
    var W = 1280, H = 720;
    var svg = svgIn(container, W, H);
    var N = 84;
    var palette = ['#59DBDE', '#8E7BFF', '#B9A9FF', '#4FC3E8'];
    var data = d3.range(N).map(function (i) {
      return {
        x: Math.random() * (W + 200) - 100,
        y: 24 + Math.random() * (H - 48),
        w: 10 + Math.random() * 54,
        h: 8 + Math.random() * 4,
        v: 5 + Math.random() * 20,
        o: 0.05 + Math.random() * 0.16,
        c: palette[i % palette.length]
      };
    });
    var rects = svg.selectAll('rect').data(data).join('rect')
      .attr('rx', 4)
      .attr('x', function (d) { return d.x; })
      .attr('y', function (d) { return d.y; })
      .attr('width', function (d) { return d.w; })
      .attr('height', function (d) { return d.h; })
      .attr('fill', function (d) { return d.c; })
      .attr('opacity', function (d) { return d.o; });

    var last = 0, timer = null;
    if (!window.__deckPrint) {
      timer = d3.timer(function (el) {
        var dt = Math.min(60, el - last) / 1000; last = el;
        data.forEach(function (d) {
          d.x += d.v * dt;
          if (d.x > W + 60) { d.x = -80 - Math.random() * 120; d.y = 24 + Math.random() * (H - 48); }
        });
        rects.attr('x', function (d) { return d.x; }).attr('y', function (d) { return d.y; });
      });
    }
    return { destroy: function () { if (timer) timer.stop(); } };
  };

  /* --- 02 · the June 5 maturity ladder ----------------------------------- */
  VIZ.ladder = function (container) {
    var W = 648, H = 442;
    var svg = svgIn(container, W, H);
    var base = H - 74;

    var rungs = [
      { n: 'Level 1', t: 'Assistant',      h: 104, c1: '#4B3BB0', c2: '#6A57DB' },
      { n: 'Level 2', t: 'Collaborator',   h: 176, c1: '#5B4BC8', c2: '#4F8FD0' },
      { n: 'Level 3', t: 'Chief of Staff', h: 252, c1: '#3E8FC9', c2: '#35C6D0' }
    ];
    var bw = 150, gap = 26, x0 = 44;

    // baseline
    svg.append('line')
      .attr('x1', 20).attr('x2', W - 20).attr('y1', base + 0.5).attr('y2', base + 0.5)
      .attr('stroke', C.line).attr('stroke-width', 1);

    var groups = rungs.map(function (r, i) {
      var x = x0 + i * (bw + gap);
      var g = svg.append('g').attr('opacity', 0);
      g.append('rect')
        .attr('x', x).attr('y', base).attr('width', bw).attr('height', 0)
        .attr('rx', 14)
        .attr('fill', linGrad(svg, r.c1, r.c2, false));
      txt(g, x + bw / 2, base + 30, r.n, {
        anchor: 'middle', size: 11.5, weight: 800, ls: 1.8, fill: C.inkMute
      });
      txt(g, x + bw / 2, base + 52, r.t, {
        anchor: 'middle', size: 16.5, weight: 700, fill: C.indigo, display: true
      });
      return { g: g, x: x, r: r };
    });

    // the "?" price tag that lands on rung 3
    var tagX = x0 + 2 * (bw + gap) + bw / 2;
    var tagY = base - rungs[2].h - 62;
    var tag = svg.append('g').attr('opacity', 0);
    tag.append('rect')
      .attr('x', tagX - 78).attr('y', tagY - 34).attr('width', 156).attr('height', 62)
      .attr('rx', 14).attr('fill', '#FFF')
      .attr('stroke', C.alarm).attr('stroke-width', 2)
      .attr('filter', 'drop-shadow(0 8px 18px rgba(196,68,63,.22))');
    txt(tag, tagX, tagY - 12, 'PER YEAR', { anchor: 'middle', size: 10.5, weight: 800, ls: 1.8, fill: C.alarm });
    txt(tag, tagX, tagY + 18, '?', { anchor: 'middle', size: 34, weight: 800, fill: C.alarm, display: true });
    tag.append('path')
      .attr('d', 'M' + tagX + ',' + (tagY + 28) + ' l -9,0 l 9,14 l 9,-14 Z')
      .attr('fill', '#FFF').attr('stroke', C.alarm).attr('stroke-width', 2);

    var pulse = null;

    function step(k) {
      groups.forEach(function (o, i) {
        var on = k >= i + 1;
        T(o.g, 380).attr('opacity', on ? 1 : 0);
        ease(T(o.g.select('rect'), 620, on ? 90 : 0))
          .attr('height', on ? o.r.h : 0)
          .attr('y', on ? base - o.r.h : base);
      });
      var tagOn = k >= 4;
      T(tag, 420, tagOn ? 160 : 0).attr('opacity', tagOn ? 1 : 0);
      if (pulse) { pulse.stop(); pulse = null; }
      if (tagOn && !window.__deckPrint) {
        pulse = d3.interval(function () {
          tag.transition().duration(520).attr('transform', 'translate(0,-6)')
            .transition().duration(520).attr('transform', 'translate(0,0)');
        }, 1600);
      }
    }

    return { step: step, destroy: function () { if (pulse) pulse.stop(); } };
  };

  /* --- 04 · live tokenizer, then live generation ------------------------- */
  VIZ.tokenizer = function (container) {
    var TOKENS = ['Sum', 'mar', 'ize', ' the', ' Q', '3', ' category',
                  ' review', ' deck', ' for', ' the', ' leadership', ' team', '.'];
    var SENTENCE = TOKENS.join('');
    var IN_TOK = TOKENS.length, OUT_TOK = 180;
    var IN_COST = IN_TOK * 1.25 / 1e6;
    var OUT_COST = OUT_TOK * 10 / 1e6;

    var ANSWER = 'Category volume rose 4.1% against a 2.3% plan, but nearly all of the gain came from ' +
      'promotional units — base velocity was flat. Gross margin fell 60 basis points, driven by deeper ' +
      'promo depth in weeks 7 through 11 and a mix shift toward the value tier. Two SKUs account for 71% ' +
      'of the margin decline; both ran continuous promotion all quarter. Recommend holding promo depth ' +
      'flat through the December reset, moving those two SKUs to an every-other-week cadence, and ' +
      'revisiting value-tier facings at the January line review.';
    var WORDS = ANSWER.split(' ');

    container.innerHTML =
      '<div class="tk">' +
        '<div class="tk-side"><span class="tk-tag">the question</span></div>' +
        '<div class="tk-line"><span class="plain"></span></div>' +
        '<div class="tk-side"><span class="tk-tag out">the answer</span></div>' +
        '<div class="tk-line answer"><span class="stream"></span><span class="caret"></span></div>' +
        '<div class="tk-stats"></div>' +
        '<div class="tk-note"></div>' +
      '</div>';

    var line = container.querySelector('.tk-line');
    var ansWrap = container.querySelector('.tk-line.answer');
    var stream = container.querySelector('.stream');
    var caret = container.querySelector('.caret');
    var stats = container.querySelector('.tk-stats');
    var note = container.querySelector('.tk-note');
    var tagOut = container.querySelectorAll('.tk-side')[1];
    container.querySelector('.plain').textContent = '\u201c' + SENTENCE + '\u201d';

    var STATS = [
      { cap: 'Tokens in', v: IN_TOK, fmt: fmtInt, n: 'the question you asked' },
      { cap: 'Tokens out', v: OUT_TOK, fmt: fmtInt, n: 'the summary it wrote back' },
      { cap: 'Cost of the question', v: IN_COST, fmt: function (x) { return '$' + x.toFixed(5); }, n: '14 tokens @ $1.25 / 1M' },
      { cap: 'Cost of the answer', v: OUT_COST, fmt: function (x) { return '$' + x.toFixed(4); }, n: '180 tokens @ $10 / 1M', accent: true }
    ];
    STATS.forEach(function (st) {
      var d = document.createElement('div');
      d.className = 'tk-stat' + (st.accent ? ' accent' : '');
      d.innerHTML = '<div class="cap">' + st.cap + '</div><div class="v">0</div><div class="n">' + st.n + '</div>';
      d.style.opacity = 0;
      d.style.transform = 'translateY(14px)';
      d.style.transition = 'opacity .4s ease, transform .4s cubic-bezier(.22,.7,.3,1)';
      stats.appendChild(d);
    });
    var statEls = stats.querySelectorAll('.tk-stat');

    note.innerHTML = 'Output is priced <b>8× higher</b> than input — $10 vs $1.25 per million tokens. ' +
      'On this request <b>99% of the cost is the answer</b>. Agents flip that completely: they read far more than they write.';

    [ansWrap, tagOut, note].forEach(function (el) {
      el.style.opacity = 0;
      el.style.transition = 'opacity .4s ease, transform .4s cubic-bezier(.22,.7,.3,1)';
      el.style.transform = 'translateY(12px)';
    });

    var st8 = {};
    var typer = null;

    function renderChips() {
      line.innerHTML = '';
      TOKENS.forEach(function (t, i) {
        var sp = document.createElement('span');
        sp.className = 'token-chip big';
        sp.textContent = t.replace(/^ /, '');
        line.appendChild(sp);
        if (window.__deckPrint) {
          /* No deferral when exporting: a setTimeout(0) still waits for the next
             task, and a PDF/PNG snapshot can be taken before it runs - which is
             how this slide once exported with an empty question box. */
          sp.style.opacity = 1;
          return;
        }
        sp.style.opacity = 0;
        sp.style.transform = 'translateY(-10px) scale(.9)';
        sp.style.transition = 'opacity .3s ease, transform .34s cubic-bezier(.3,1.3,.5,1)';
        setTimeout(function () { sp.style.opacity = 1; sp.style.transform = 'none'; }, 40 + i * 44);
      });
    }
    function renderPlain() {
      line.innerHTML = '<span class="plain">\u201c' + SENTENCE + '\u201d</span>';
    }
    function stopTyping() { if (typer) { clearInterval(typer); typer = null; } }

    function generate() {
      stopTyping();
      stream.textContent = '';
      caret.style.display = 'inline-block';
      if (window.__deckPrint) { stream.textContent = ANSWER; caret.style.display = 'none'; return; }
      var i = 0;
      typer = setInterval(function () {
        stream.textContent += (i ? ' ' : '') + WORDS[i];
        i++;
        if (i >= WORDS.length) { stopTyping(); caret.style.display = 'none'; }
      }, 26);
    }

    function step(k) {
      gate(st8, 'chips', k >= 1, renderChips, renderPlain);

      var genOn = k >= 2;
      tagOut.style.opacity = genOn ? 1 : 0;
      ansWrap.style.opacity = genOn ? 1 : 0;
      ansWrap.style.transform = genOn ? 'none' : 'translateY(12px)';
      gate(st8, 'gen', genOn, generate, function () { stopTyping(); stream.textContent = ''; });

      var statsOn = k >= 3;
      statEls.forEach(function (el, i) {
        el.style.opacity = statsOn ? 1 : 0;
        el.style.transform = statsOn ? 'none' : 'translateY(14px)';
        el.style.transitionDelay = (statsOn && !window.__deckPrint ? i * 90 : 0) + 'ms';
      });
      gate(st8, 'stats', statsOn, function () {
        statEls.forEach(function (el, i) {
          countUp(d3.select(el.querySelector('.v')), 0, STATS[i].v, STATS[i].fmt, 850, i * 90);
        });
      }, function () {
        statEls.forEach(function (el) { d3.select(el.querySelector('.v')).interrupt().text('0'); });
      });

      note.style.opacity = k >= 4 ? 1 : 0;
      note.style.transform = k >= 4 ? 'none' : 'translateY(12px)';
    }

    return { step: step, destroy: stopTyping };
  };

  /* --- 05 · unit conversions --------------------------------------------- */
  VIZ.convert = function (container) {
    var W = 1152, H = 500;
    var svg = svgIn(container, W, H);

    /* ---- left: a literal block of 1,000 tokens ---- */
    var left = svg.append('g');
    cap(left, 0, 14, 'ONE THOUSAND TOKENS');

    var COLS = 40, ROWS = 25, SP = 8;
    var dots = left.append('g').attr('transform', 'translate(2,34)');
    var dotSel = dots.selectAll('circle')
      .data(d3.range(COLS * ROWS)).join('circle')
      .attr('cx', function (d) { return (d % COLS) * SP; })
      .attr('cy', function (d) { return Math.floor(d / COLS) * SP; })
      .attr('r', 2.5)
      .attr('fill', function (d) { return d3.interpolateRgb('#6A57DB', '#35C6D0')((d % COLS) / COLS); })
      .attr('opacity', 0);

    var EQ = [
      ['≈ 750', 'words'],
      ['≈ 4,000', 'characters'],
      ['≈ 1½', 'pages of text']
    ];
    var eqG = left.append('g').attr('opacity', 0);
    EQ.forEach(function (e, i) {
      var y = 306 + i * 52;
      txt(eqG, 2, y, e[0], { size: 27, weight: 800, fill: C.indigo, display: true });
      txt(eqG, 108, y, e[1], { size: 16, weight: 600, fill: C.inkSoft });
    });

    /* ---- right: what your artifacts weigh (log scale) ---- */
    var ITEMS = [
      { l: '1 PDF page', v: 650 },
      { l: '1 minute of speech', v: 850 },
      { l: '1,000 words', v: 1330 },
      { l: '1-hour meeting', v: 10000 },
      { l: '100-page report', v: 70000 }
    ];
    var X0 = 700, X1 = 1058;
    var x = d3.scaleLog().domain([400, 100000]).range([X0, X1]).clamp(true);
    var BAR_FILL = linGrad(svg, '#6A57DB', '#35C6D0', true);
    var right = svg.append('g');
    cap(right, 500, 14, 'WHAT YOUR ARTIFACTS WEIGH, IN TOKENS');

    // gridlines
    [1000, 10000, 100000].forEach(function (t) {
      right.append('line')
        .attr('x1', x(t)).attr('x2', x(t)).attr('y1', 40).attr('y2', 372)
        .attr('stroke', C.line).attr('stroke-dasharray', '3 4');
      txt(right, x(t), 398, d3.format('~s')(t).replace('k', 'K'), {
        anchor: 'middle', size: 11.5, weight: 700, fill: C.inkMute, ls: 1
      });
    });

    var rows = ITEMS.map(function (it, i) {
      var y = 74 + i * 66;
      var g = right.append('g').attr('opacity', 0);
      var lbl = txt(g, 682, y + 5, it.l, { anchor: 'end', size: 16, weight: 600, fill: C.ink });
      var bar = g.append('rect')
        .attr('x', X0).attr('y', y - 9).attr('height', 18).attr('rx', 9)
        .attr('width', 0)
        .attr('fill', BAR_FILL);
      var val = txt(g, X0, y + 5, F.int(it.v), { size: 16, weight: 800, fill: C.indigo, display: true });
      return { g: g, bar: bar, val: val, lbl: lbl, it: it, y: y };
    });

    var annot = txt(right, 500, 462, '', { size: 15.5, weight: 700, fill: C.tealInk });
    annot.attr('opacity', 0);

    function step(k) {
      // 1 — the block
      var b1 = k >= 1;
      dotSel.each(function (d, i) {
        var s = d3.select(this);
        T(s, 240, b1 && !window.__deckPrint ? (i % COLS) * 8 + Math.floor(i / COLS) * 10 : 0)
          .attr('opacity', b1 ? 0.85 : 0);
      });
      T(eqG, 400, b1 ? 700 : 0).attr('opacity', b1 ? 1 : 0);

      // 2 — the artifact ladder
      var b2 = k >= 2;
      rows.forEach(function (r, i) {
        T(r.g, 300, b2 && !window.__deckPrint ? i * 110 : 0).attr('opacity', b2 ? 1 : 0);
        ease(T(r.bar, 700, b2 && !window.__deckPrint ? i * 110 : 0))
          .attr('width', b2 ? Math.max(2, x(r.it.v) - X0) : 0);
        ease(T(r.val, 700, b2 && !window.__deckPrint ? i * 110 : 0))
          .attr('x', b2 ? x(r.it.v) + 12 : X0)
          .attr('opacity', b2 ? 1 : 0);
      });

      // 3 / 4 — highlight a row and annotate
      var hi = k >= 4 ? 4 : (k >= 3 ? 3 : -1);
      rows.forEach(function (r, i) {
        var on = i === hi;
        T(r.bar, 300, 0, 'hi').attr('fill', on ? C.teal : BAR_FILL);
        T(r.lbl, 300, 0, 'hi').attr('fill', on ? C.tealInk : C.ink).attr('font-weight', on ? 800 : 600);
        T(r.val, 300, 0, 'hi').attr('fill', on ? C.tealInk : C.indigo);
      });
      var msg = k >= 4 ? '70× the meeting — and, as you’re about to see, still under twenty cents.'
              : (k >= 3 ? 'An hour of six people talking is a small document. A meeting is cheap.' : '');
      annot.text(msg);
      T(annot, 300).attr('opacity', msg ? 1 : 0);
    }

    return { step: step };
  };

  /* --- 06 · cost per artifact -------------------------------------------- */
  VIZ.costtable = function (container) {
    var W = 1152, H = 488;
    var svg = svgIn(container, W, H);

    var ROWS = [
      { l: '1,000 characters', v: 0.0006 },
      { l: '1 PDF page', v: 0.0015 },
      { l: '1 minute of transcript', v: 0.0019 },
      { l: '1,000 words', v: 0.0030 },
      { l: '1-hour meeting', v: 0.0225 },
      { l: '100-page report', v: 0.1575 }
    ];
    var X0 = 320, X1 = 930;
    var x = d3.scaleLog().domain([0.00005, 0.25]).range([X0, X1]).clamp(true);
    var BAR_FILL = linGrad(svg, '#5B3FD6', '#3E8FC9', true);

    cap(svg, 0, 13, 'TOTAL COST PER ITEM — READ IN, SUMMARY BACK OUT');

    /* legend, top right */
    var lg = svg.append('g');
    lg.append('rect').attr('x', 640).attr('y', 4).attr('width', 20).attr('height', 10).attr('rx', 5).attr('fill', BAR_FILL);
    cap(lg, 668, 13, 'GPT-5 STANDARD');
    var lg2 = svg.append('g').attr('opacity', 0);
    lg2.append('rect').attr('x', 828).attr('y', 4).attr('width', 20).attr('height', 10).attr('rx', 5).attr('fill', C.teal);
    cap(lg2, 856, 13, 'SMALL-MODEL TIER (~10× CHEAPER)').attr('fill', C.tealInk);

    [0.0001, 0.001, 0.01, 0.1].forEach(function (t) {
      svg.append('line')
        .attr('x1', x(t)).attr('x2', x(t)).attr('y1', 28).attr('y2', 384)
        .attr('stroke', C.line).attr('stroke-dasharray', '3 4');
      txt(svg, x(t), 406, money(t), { anchor: 'middle', size: 11.5, weight: 700, fill: C.inkMute });
    });

    var rows = ROWS.map(function (r, i) {
      var y = 56 + i * 57;
      var g = svg.append('g').attr('opacity', 0);
      txt(g, X0 - 20, y - 1, r.l, { anchor: 'end', size: 16.5, weight: 600, fill: C.ink });
      var bar = g.append('rect')
        .attr('x', X0).attr('y', y - 15).attr('height', 19).attr('rx', 9.5)
        .attr('width', 0).attr('fill', BAR_FILL);
      var val = txt(g, X0, y, money(r.v), { size: 16, weight: 800, fill: C.indigo, display: true });

      var sg = svg.append('g').attr('opacity', 0);
      var sbar = sg.append('rect')
        .attr('x', X0).attr('y', y + 9).attr('height', 11).attr('rx', 5.5)
        .attr('width', 0).attr('fill', C.teal).attr('opacity', .8);
      var sval = txt(sg, X0, y + 19, money(r.v / 10), { size: 12.5, weight: 700, fill: C.tealInk });
      return { g: g, bar: bar, val: val, sg: sg, sbar: sbar, sval: sval, r: r };
    });

    var punch = svg.append('g').attr('opacity', 0);
    punch.append('rect').attr('x', 0).attr('y', 428).attr('width', W).attr('height', 56).attr('rx', 14)
      .attr('fill', 'rgba(47,191,200,.09)').attr('stroke', 'rgba(47,191,200,.28)');
    txt(punch, 24, 463, 'Nothing here is expensive — which is why the invoice often surprises people as they move up the levels.',
      { size: 18, weight: 700, fill: C.tealInk, display: true });

    function step(k) {
      var b1 = k >= 1, b2 = k >= 2;
      rows.forEach(function (r, i) {
        var dl = b1 && !window.__deckPrint ? i * 100 : 0;
        T(r.g, 280, dl, 'fade').attr('opacity', b1 ? 1 : 0);
        ease(T(r.bar, 720, dl)).attr('width', b1 ? Math.max(3, x(r.r.v) - X0) : 0);
        ease(T(r.val, 720, dl)).attr('x', b1 ? x(r.r.v) + 12 : X0);

        var dl2 = b2 && !window.__deckPrint ? i * 70 : 0;
        T(r.sg, 280, dl2, 'fade').attr('opacity', b2 ? 1 : 0);
        ease(T(r.sbar, 620, dl2)).attr('width', b2 ? Math.max(3, x(r.r.v / 10) - X0) : 0);
        ease(T(r.sval, 620, dl2)).attr('x', b2 ? x(r.r.v / 10) + 10 : X0);
      });
      T(lg2, 280, 0, 'fade').attr('opacity', b2 ? 1 : 0);
      T(punch, 380, 0, 'fade').attr('opacity', k >= 3 ? 1 : 0);
    }

    return { step: step };
  };

  /* --- 07a · budget rules of thumb --------------------------------------- */
  VIZ.budgettable = function (container) {
    var ROWS = [
      { k: 'A single email',                 v: '< $0.001', at: 1 },
      { k: 'A 10-page report',               v: '≈ 2¢',     at: 1 },
      { k: 'A one-hour meeting',             v: '≈ 2¢',     at: 1 },
      { k: 'A 100-page report',              v: '≈ 16¢',    at: 2 },
      { k: 'A day of email — 50 messages',   v: '≈ 5¢',     at: 2 },
      { k: '1,000 reports × 100 pages each', v: '≈ $158',   at: 2, hero: true }
    ];
    container.innerHTML = '<div class="btable"></div>';
    var box = container.querySelector('.btable');
    box.style.width = '100%';

    var els = ROWS.map(function (r) {
      var d = document.createElement('div');
      d.className = 'brow' + (r.hero ? ' hero' : '');
      d.innerHTML = '<span class="k">' + r.k + '</span><span class="v">' + r.v + '</span>';
      d.style.opacity = 0;
      d.style.transform = 'translateX(-16px)';
      d.style.transition = 'opacity .38s ease, transform .38s cubic-bezier(.22,.7,.3,1)';
      box.appendChild(d);
      return d;
    });

    function step(k) {
      ROWS.forEach(function (r, i) {
        var on = k >= r.at;
        els[i].style.opacity = on ? 1 : 0;
        els[i].style.transform = on ? 'none' : 'translateX(-16px)';
        els[i].style.transitionDelay = (on && !window.__deckPrint ? (i % 3) * 90 : 0) + 'ms';
      });
    }
    return { step: step };
  };

  /* --- 07b · one thousand documents, one dot each ------------------------ */
  VIZ.dotgrid = function (container) {
    var W = 468, H = 404;
    var svg = svgIn(container, W, H);
    var COLS = 40, ROWS = 25, SP = 11, N = COLS * ROWS;
    var PER_DOC = 0.1575;

    cap(svg, 4, 14, '1,000 REPORTS · 100 PAGES EACH');

    var g = svg.append('g').attr('transform', 'translate(8,42)');
    var dots = g.selectAll('circle').data(d3.range(N)).join('circle')
      .attr('cx', function (d) { return (d % COLS) * SP; })
      .attr('cy', function (d) { return Math.floor(d / COLS) * SP; })
      .attr('r', 3.4)
      .attr('fill', function (d) { return d3.interpolateRgb('#6A57DB', '#35C6D0')(Math.floor(d / COLS) / ROWS); })
      .attr('opacity', 0);

    var total = txt(svg, W / 2, 372, '$0', {
      anchor: 'middle', size: 62, weight: 800, fill: C.indigo, display: true
    });
    total.attr('opacity', 0);
    var tlabel = txt(svg, W / 2, 396, 'READ AND SUMMARIZED, FOR ABOUT THE PRICE OF ONE TEAM LUNCH', {
      anchor: 'middle', size: 10.5, weight: 800, ls: 1.5, fill: C.inkMute
    }).attr('opacity', 0);

    var st = {};
    function step(k) {
      var on = k >= 3;
      T(total, 260, 0, 'fade').attr('opacity', on ? 1 : 0);
      T(tlabel, 260, on ? 1900 : 0, 'fade').attr('opacity', on ? 1 : 0);
      /* fills once, then stays put when the punchline beat lands */
      gate(st, 'fill', on, function () {
        dots.each(function (d, i) {
          T(d3.select(this), 200, window.__deckPrint ? 0 : i * 1.9, 'fade').attr('opacity', 0.9);
        });
        countUp(total, 0, N * PER_DOC, function (v) { return '$' + v.toFixed(2); }, 2000, 0);
      }, function () {
        dots.interrupt('fade').attr('opacity', 0);
        total.interrupt().text('$0');
      });
    }
    return { step: step };
  };

  /* --- 08 · the multiplication that breaks the budget -------------------- */
  VIZ.equation = function (container) {
    var TERMS = [
      { v: '$0.02',    l: 'cost per task',  cls: 'first' },
      { v: '40',       l: 'tasks per day',  op: '×' },
      { v: '600',      l: 'people',         op: '×' },
      { v: '250',      l: 'working days',   op: '×' },
      { v: '$120,000', l: 'a year',         op: '=', cls: 'result' }
    ];
    container.innerHTML = '<div class="eq"></div>';
    var box = container.querySelector('.eq');

    var items = TERMS.map(function (t) {
      var wrap = document.createElement('div');
      wrap.style.display = 'contents';
      var parts = [];
      if (t.op) {
        var op = document.createElement('div');
        op.className = 'eq-op'; op.textContent = t.op;
        parts.push(op);
      }
      var d = document.createElement('div');
      d.className = 'eq-term' + (t.cls ? ' ' + t.cls : '');
      d.innerHTML = '<div class="v">' + t.v + '</div><div class="l">' + t.l + '</div>';
      parts.push(d);
      parts.forEach(function (p) {
        p.style.opacity = 0;
        p.style.transform = 'translateY(18px)';
        p.style.transition = 'opacity .42s ease, transform .42s cubic-bezier(.22,.7,.3,1)';
        box.appendChild(p);
      });
      return parts;
    });

    function step(k) {
      items.forEach(function (parts, i) {
        var on = k >= i + 1;
        parts.forEach(function (p) {
          p.style.opacity = on ? 1 : 0;
          p.style.transform = on ? 'none' : 'translateY(18px)';
        });
      });
    }
    return { step: step };
  };

  /* Rounded label chip drawn in SVG. Width is estimated from the string so it
     works while the slide is still display:none (getComputedTextLength is 0). */
  function svgPill(g, x, y, label, o) {
    o = o || {};
    var size = o.size || 14;
    var w = label.length * size * 0.58 + 30;
    var grp = g.append('g');
    grp.append('rect').attr('x', x).attr('y', y).attr('width', w).attr('height', size + 17)
      .attr('rx', (size + 17) / 2)
      .attr('fill', o.bg || 'rgba(94,79,233,.10)')
      .attr('stroke', o.stroke || 'rgba(94,79,233,.24)');
    txt(grp, x + 15, y + size + 4, label, {
      size: size, weight: 800, fill: o.fg || C.violet, display: true
    });
    return grp;
  }

  /* --- 09 / 10 / 11 · the three scenarios -------------------------------- */
  var SCEN = {
    sc1: { in: 20000,   out: 5000,   inLbl: 'what it reads',  outLbl: 'what it writes' },
    sc2: { in: 500000,  out: 20000,  inLbl: 'what it reads',  outLbl: 'what it writes' },
    sc3: { in: 2000000, out: 100000, inLbl: 'what it reads',  outLbl: 'what it writes' }
  };
  var USERS = 600, DAYS = 250, BASELINE_ANNUAL = 11250;

  VIZ.scenario = function (container, slideEl) {
    var key = container.getAttribute('data-key');
    var d = SCEN[key];
    var W = 1152, H = 476;
    var svg = svgIn(container, W, H);

    var inCost = d.in * 1.25 / 1e6;
    var outCost = d.out * 10 / 1e6;
    var daily = inCost + outCost;
    var annual = daily * USERS * DAYS;
    var mult = annual / BASELINE_ANNUAL;
    /* Scenario 1 teaches the count-up. After that the audience knows how to read
       it, so 2 and 3 snap into place with a rise arrow instead. */
    var TICKER = (key === 'sc1');

    /* ---------- left: the assumptions ---------- */
    var L = svg.append('g');
    cap(L, 0, 14, 'PER EMPLOYEE, PER DAY');

    var inG = L.append('g').attr('opacity', 0);
    cap(inG, 0, 60, 'INPUT — ' + d.inLbl.toUpperCase());
    var inVal = txt(inG, 0, 108, TICKER ? '0' : F.int(d.in), { size: 46, weight: 800, fill: C.indigo, display: true });
    txt(inG, 0, 134, 'tokens', { size: 15, weight: 600, fill: C.inkSoft });
    var inArrow = null;

    var outG = L.append('g').attr('opacity', 0);
    cap(outG, 0, 186, 'OUTPUT — ' + d.outLbl.toUpperCase());
    var outVal = txt(outG, 0, 234, TICKER ? '0' : F.int(d.out), { size: 46, weight: 800, fill: C.indigo, display: true });
    txt(outG, 0, 260, 'tokens', { size: 15, weight: 600, fill: C.inkSoft });
    var outArrow = null;

    L.append('line').attr('x1', 0).attr('x2', 400).attr('y1', 296).attr('y2', 296).attr('stroke', C.line);
    cap(L, 0, 330, 'AT GPT-5 STANDARD PRICING');
    txt(L, 0, 362, '$1.25', { size: 19, weight: 800, fill: C.violet, display: true });
    txt(L, 62, 362, 'per 1M input tokens', { size: 15, weight: 600, fill: C.inkSoft });
    txt(L, 0, 392, '$10', { size: 19, weight: 800, fill: C.teal, display: true });
    txt(L, 62, 392, 'per 1M output tokens', { size: 15, weight: 600, fill: C.inkSoft });

    /* ---------- right: where the money goes ---------- */
    var RX = 486, RW = 1152 - RX;
    var R = svg.append('g');
    cap(R, RX, 14, 'WHERE THE DAILY COST GOES');

    var barG = R.append('g').attr('opacity', 0);
    var inW = RW * (inCost / daily), outW = RW * (outCost / daily);
    var inRect = barG.append('rect').attr('x', RX).attr('y', 36).attr('height', 46)
      .attr('width', 0).attr('rx', 10).attr('fill', linGrad(svg, '#5B3FD6', '#7B62E8', true));
    var outRect = barG.append('rect').attr('x', RX).attr('y', 36).attr('height', 46)
      .attr('width', 0).attr('rx', 10).attr('fill', C.teal);
    var inLab = txt(barG, RX, 110, 'input ' + money(inCost) + ' · ' + Math.round(inCost / daily * 100) + '%',
      { size: 14.5, weight: 700, fill: C.violet });
    var outLab = txt(barG, RX, 110, 'output ' + money(outCost) + ' · ' + Math.round(outCost / daily * 100) + '%',
      { size: 14.5, weight: 700, fill: C.tealInk });

    var dailyG = R.append('g').attr('opacity', 0);
    cap(dailyG, RX, 166, 'DAILY, PER EMPLOYEE');
    var dailyFmt = function (v) { return '$' + v.toFixed(v >= 1 ? 2 : 3); };
    var dailyVal = txt(dailyG, RX, 222, TICKER ? '$0.00' : dailyFmt(daily),
      { size: 52, weight: 800, fill: C.indigo, display: true });
    var dailyArrow = null;

    var multG = R.append('g').attr('opacity', 0);
    txt(multG, RX, 268, '× ' + F.int(USERS) + ' employees   × ' + DAYS + ' working days',
      { size: 17.5, weight: 700, fill: C.inkSoft });

    var annualG = R.append('g').attr('opacity', 0);
    cap(annualG, RX, 316, 'EVERY YEAR');
    var annualVal = txt(annualG, RX, 392, TICKER ? '$0' : F.usd0(annual),
      { size: 76, weight: 800, display: true });
    annualVal.attr('fill', linGrad(svg, '#5B3FD6', '#2FBFC8', true));
    var annualArrow = null;

    var cmpG = null;
    if (key !== 'sc1') {
      cmpG = R.append('g').attr('opacity', 0);
      svgPill(cmpG, RX, 420, Math.round(mult) + '× scenario 1 — same 600 people', {
        size: 15, fg: '#A5322D', bg: 'rgba(196,68,63,.08)', stroke: 'rgba(196,68,63,.26)'
      });
    }

    var st = {};   /* one-shot guards: nothing re-animates on a later beat */

    function step(k) {
      T(inG, 380, 0, 'fade').attr('opacity', k >= 1 ? 1 : 0);
      gate(st, 'in', k >= 1,
        function () { TICKER ? countUp(inVal, 0, d.in, fmtInt, 800) : popIn(inVal, inArrow, true, 60); },
        function () { TICKER ? inVal.interrupt().text('0') : popIn(inVal, inArrow, false); });

      T(outG, 380, 0, 'fade').attr('opacity', k >= 2 ? 1 : 0);
      gate(st, 'out', k >= 2,
        function () { TICKER ? countUp(outVal, 0, d.out, fmtInt, 800) : popIn(outVal, outArrow, true, 60); },
        function () { TICKER ? outVal.interrupt().text('0') : popIn(outVal, outArrow, false); });

      var b3 = k >= 3;
      T(barG, 380, 0, 'fade').attr('opacity', b3 ? 1 : 0);
      gate(st, 'bar', b3, function () {
        ease(T(inRect, 800, 0, 'w')).attr('width', inW);
        ease(T(outRect, 800, 160, 'w')).attr('x', RX + inW + 4).attr('width', Math.max(6, outW - 4));
        ease(T(inLab, 800, 0, 'x')).attr('x', RX + 2);
        ease(T(outLab, 800, 160, 'x')).attr('x', RX + inW + 10);
        TICKER ? countUp(dailyVal, 0, daily, dailyFmt, 900, 200) : popIn(dailyVal, dailyArrow, true, 220);
      }, function () {
        inRect.interrupt('w').attr('width', 0);
        outRect.interrupt('w').attr('x', RX).attr('width', 0);
        inLab.interrupt('x').attr('x', RX);
        outLab.interrupt('x').attr('x', RX);
        TICKER ? dailyVal.interrupt().text('$0.00') : popIn(dailyVal, dailyArrow, false);
      });
      T(dailyG, 380, 0, 'fade').attr('opacity', b3 ? 1 : 0);

      var b4 = k >= 4;
      T(multG, 340, 0, 'fade').attr('opacity', b4 ? 1 : 0);
      T(annualG, 380, b4 ? 260 : 0, 'fade').attr('opacity', b4 ? 1 : 0);
      gate(st, 'annual', b4,
        function () { TICKER ? countUp(annualVal, 0, annual, F.usd0, 1400, 300) : popIn(annualVal, annualArrow, true, 420); },
        function () { TICKER ? annualVal.interrupt().text('$0') : popIn(annualVal, annualArrow, false); });

      if (cmpG) T(cmpG, 380, 0, 'fade').attr('opacity', k >= 5 ? 1 : 0);
    }

    return { step: step };
  };

  /* --- 12 · the 47x ramp -------------------------------------------------- */
  VIZ.ramp = function (container) {
    var W = 1152, H = 470;
    var svg = svgIn(container, W, H);

    var DATA = [
      { n: 'Scenario 1', t: 'Assistant',        v: 11250,  c1: '#4B3BB0', c2: '#6A57DB' },
      { n: 'Scenario 2', t: 'Agentic',          v: 123750, c1: '#5B4BC8', c2: '#4F8FD0' },
      { n: 'Scenario 3', t: 'Always-on agents', v: 525000, c1: '#3E8FC9', c2: '#35C6D0' }
    ];
    var BASE = 344, MAXH = 292, BW = 156;
    var y = d3.scaleLinear().domain([0, 525000]).range([0, MAXH]);
    var xs = [232, 556, 880];

    svg.append('line').attr('x1', 40).attr('x2', W - 40)
      .attr('y1', BASE + .5).attr('y2', BASE + .5)
      .attr('stroke', C.lineDark);

    var bars = DATA.map(function (d, i) {
      var x = xs[i] - BW / 2;
      var g = svg.append('g').attr('opacity', 0);
      var rect = g.append('rect')
        .attr('x', x).attr('y', BASE).attr('width', BW).attr('height', 0).attr('rx', 12)
        .attr('fill', linGrad(svg, d.c1, d.c2, false));
      var val = txt(g, xs[i], BASE - 14, F.usd0(d.v), {
        anchor: 'middle', size: 32, weight: 800, fill: '#fff', display: true
      });
      cap(g, xs[i], BASE + 30, d.n.toUpperCase(), true).attr('text-anchor', 'middle');
      txt(g, xs[i], BASE + 58, d.t, {
        anchor: 'middle', size: 19, weight: 700, fill: '#fff', display: true
      });
      var per = txt(g, xs[i], BASE + 96, '$' + (d.v / USERS).toFixed(2) + ' per person / year', {
        anchor: 'middle', size: 15, weight: 700, fill: C.tealB
      }).attr('opacity', 0);
      return { g: g, rect: rect, val: val, per: per, d: d, x: xs[i] };
    });

    /* the escalation, drawn as a curve through the bar tops */
    var note = svg.append('g').attr('opacity', 0);
    var pts = DATA.map(function (d, i) { return [xs[i], BASE - Math.max(3, y(d.v))]; });
    var curve = d3.line().x(function (p) { return p[0]; }).y(function (p) { return p[1]; })
      .curve(d3.curveMonotoneX);
    var curvePath = note.append('path')
      .attr('d', curve(pts))
      .attr('fill', 'none').attr('stroke', C.tealB).attr('stroke-width', 3)
      .attr('stroke-linecap', 'round').attr('stroke-dashoffset', 900);
    note.selectAll('circle.pt').data(pts).join('circle').attr('class', 'pt')
      .attr('cx', function (p) { return p[0]; }).attr('cy', function (p) { return p[1]; })
      .attr('r', 5).attr('fill', C.tealB);

    function step(k) {
      bars.forEach(function (b, i) {
        var on = k >= i + 1;
        T(b.g, 320, 0, 'fade').attr('opacity', on ? 1 : 0);
        ease(T(b.rect, 900, on ? 100 : 0))
          .attr('height', on ? Math.max(3, y(b.d.v)) : 0)
          .attr('y', on ? BASE - Math.max(3, y(b.d.v)) : BASE);
        ease(T(b.val, 900, on ? 100 : 0))
          .attr('y', on ? BASE - Math.max(3, y(b.d.v)) - 16 : BASE - 14);
        T(b.per, 340, 0, 'per').attr('opacity', k >= 4 ? 1 : 0);
      });
      /* curve draws itself in once all three bars are standing */
      var showCurve = k >= 3;
      T(note, 420, showCurve ? 300 : 0, 'fade').attr('opacity', showCurve ? 1 : 0);
      var len = 900;
      try { len = curvePath.node().getTotalLength() || 900; } catch (e) {}
      curvePath.attr('stroke-dasharray', len + ' ' + len);
      ease(T(curvePath, 900, showCurve ? 400 : 0, 'draw'))
        .attr('stroke-dashoffset', showCurve ? 0 : len);
    }

    return { step: step };
  };

  /* --- 13 · the savings waterfall ---------------------------------------- */
  VIZ.waterfall = function (container) {
    var W = 1152, H = 416;
    var svg = svgIn(container, W, H);

    var START = 525000;
    /* Percentages grounded where I have telemetry. "measured" figures come from
       913 instrumented runs of my own harness; "modeled" ones are arithmetic
       from the routing/scripting cases shown on the slides that follow. */
    var LEVERS = [
      { pct: .40, l1: 'Right-size',    l2: 'the model',    tag: 'modeled' },
      { pct: .15, l1: 'Script the',    l2: 'plain steps',  tag: 'modeled' },
      { pct: .25, l1: 'Engineer',      l2: 'the context',  tag: 'measured' },
      { pct: .15, l1: 'Stop redoing',  l2: 'work',         tag: 'measured' },
      { pct: .20, l1: 'Run commodity', l2: 'work local',   tag: 'modeled' }
    ];

    /* running remainders */
    var running = START, steps = [];
    LEVERS.forEach(function (L) {
      var cut = running * L.pct;
      steps.push({ from: running, to: running - cut, cut: cut, L: L });
      running -= cut;
    });
    var FINAL = running;

    var BASE = 336, MAXH = 300;
    var y = d3.scaleLinear().domain([0, START]).range([0, MAXH]);
    var band = d3.scaleBand().domain(d3.range(7)).range([16, 1136]).padding(0.34);
    var BW = band.bandwidth();
    var top = function (v) { return BASE - y(v); };

    svg.append('line').attr('x1', 8).attr('x2', W - 8).attr('y1', BASE + .5).attr('y2', BASE + .5)
      .attr('stroke', C.line);

    function colLabel(i, a, b) {
      var g = svg.append('g');
      txt(g, band(i) + BW / 2, 364, a, { anchor: 'middle', size: 13.5, weight: 700, fill: C.ink });
      if (b) txt(g, band(i) + BW / 2, 383, b, { anchor: 'middle', size: 13.5, weight: 700, fill: C.ink });
      return g;
    }

    var cols = [];

    /* column 0 — today */
    (function () {
      var g = svg.append('g').attr('opacity', 0);
      var r = g.append('rect').attr('x', band(0)).attr('width', BW).attr('rx', 8)
        .attr('y', BASE).attr('height', 0)
        .attr('fill', linGrad(svg, '#4B3BB0', '#6A57DB', false));
      var v = txt(g, band(0) + BW / 2, top(START) - 12, F.usd0(START),
        { anchor: 'middle', size: 21, weight: 800, fill: C.indigo, display: true });
      colLabel(0, 'Today', '').attr('opacity', 0).attr('opacity', 1);
      cols.push({ g: g, grow: function (on) {
        ease(T(r, 800, on ? 80 : 0)).attr('y', on ? top(START) : BASE).attr('height', on ? y(START) : 0);
        T(v, 300, 0, 'v').attr('opacity', on ? 1 : 0);
      } });
    })();

    /* columns 1..5 — the levers, each a floating drop */
    steps.forEach(function (s, i) {
      var idx = i + 1;
      var g = svg.append('g').attr('opacity', 0);
      var yTop = top(s.from), yBot = top(s.to);
      var r = g.append('rect').attr('x', band(idx)).attr('width', BW).attr('rx', 7)
        .attr('y', yTop).attr('height', 0)
        .attr('fill', linGrad(svg, '#E0885F', '#D4763A', false)).attr('opacity', .92);
      txt(g, band(idx) + BW / 2, yTop - 26, '−' + F.usd0(s.cut),
        { anchor: 'middle', size: 15, weight: 800, fill: '#9A4D18', display: true });
      txt(g, band(idx) + BW / 2, yTop - 8, '−' + Math.round(s.L.pct * 100) + '%',
        { anchor: 'middle', size: 13, weight: 700, fill: C.warn });
      colLabel(idx, s.L.l1, s.L.l2);

      /* dashed connector to the next column's top */
      var conn = svg.append('line')
        .attr('x1', band(idx) + BW).attr('x2', band(idx + 1))
        .attr('y1', yBot).attr('y2', yBot)
        .attr('stroke', C.inkMute).attr('stroke-dasharray', '4 4').attr('opacity', 0);

      cols.push({ g: g, grow: function (on) {
        ease(T(r, 700, on ? 60 : 0)).attr('height', on ? (yBot - yTop) : 0);
        T(conn, 300, on ? 500 : 0, 'c').attr('opacity', on ? .55 : 0);
      } });
    });

    /* column 6 — what's left */
    (function () {
      var g = svg.append('g').attr('opacity', 0);
      var r = g.append('rect').attr('x', band(6)).attr('width', BW).attr('rx', 8)
        .attr('y', BASE).attr('height', 0)
        .attr('fill', linGrad(svg, '#2FBFC8', '#59DBDE', false));
      var v = txt(g, band(6) + BW / 2, top(FINAL) - 12, F.usd0(FINAL),
        { anchor: 'middle', size: 21, weight: 800, fill: C.tealInk, display: true });
      colLabel(6, 'Achievable', '');
      cols.push({ g: g, grow: function (on) {
        ease(T(r, 800, on ? 80 : 0)).attr('y', on ? top(FINAL) : BASE).attr('height', on ? y(FINAL) : 0);
        T(v, 300, 0, 'v').attr('opacity', on ? 1 : 0);
      } });
    })();

    /* summary card, appears with the final column */
    var sum = svg.append('g').attr('opacity', 0);
    sum.append('rect').attr('x', 700).attr('y', 8).attr('width', 436).attr('height', 92).attr('rx', 16)
      .attr('fill', 'rgba(47,191,200,.08)').attr('stroke', 'rgba(47,191,200,.30)');
    txt(sum, 722, 40, F.usd0(START) + '  →  ' + F.usd0(FINAL),
      { size: 27, weight: 800, fill: C.tealInk, display: true });
    txt(sum, 722, 72, (START / FINAL).toFixed(1) + '× cheaper · same capability, nothing taken away',
      { size: 14.5, weight: 700, fill: C.tealInk });
    txt(sum, 722, 90, 'Each cut applies to what is left, not the original total.',
      { size: 12, weight: 600, fill: C.inkMute });

    function step(k) {
      cols.forEach(function (c, i) {
        var on = k >= i;                 // column 0 ("Today") is up from the start
        T(c.g, 300, 0, 'fade').attr('opacity', on ? 1 : 0);
        c.grow(on);
      });
      T(sum, 400, k >= 6 ? 400 : 0, 'fade').attr('opacity', k >= 6 ? 1 : 0);
    }

    return { step: step };
  };

  /* --- 14 · lever 1 · right-size the model -------------------------------- */
  VIZ.rightsize = function (container) {
    var W = 1152, H = 476;
    var svg = svgIn(container, W, H);

    /* ---------- left: the quality gap ---------- */
    var L = svg.append('g').attr('opacity', 0);
    cap(L, 0, 14, 'BENCHMARK SCORE — BEST PAID vs BEST OPEN-WEIGHT');
    var SW = 400;
    [{ l: 'Best paid model', s: 'premium per-token pricing', v: 100, c: linGrad(svg, '#4B3BB0', '#6A57DB', true), fg: C.indigo },
     { l: 'Best open-weight model', s: 'run it at a fraction of the cost', v: 98.3, c: C.teal, fg: C.tealInk }
    ].forEach(function (b, i) {
      var y0 = 64 + i * 96;
      txt(L, 0, y0, b.l, { size: 17, weight: 700, fill: b.fg, display: true });
      txt(L, 0, y0 + 20, b.s, { size: 13.5, weight: 600, fill: C.inkSoft });
      L.append('rect').attr('x', 0).attr('y', y0 + 30).attr('width', SW * b.v / 100)
        .attr('height', 26).attr('rx', 13).attr('fill', b.c);
      txt(L, SW * b.v / 100 + 12, y0 + 49, String(b.v),
        { size: 18, weight: 800, fill: b.fg, display: true });
    });
    txt(L, 0, 296, '8%  →  1.7%', { size: 40, weight: 800, fill: C.indigo, display: true });
    txt(L, 0, 324, 'performance gap, closed in a single year', { size: 15, weight: 600, fill: C.inkSoft });

    /* ---------- middle: 100 tasks ---------- */
    var M = svg.append('g').attr('opacity', 0);
    cap(M, 516, 14, 'OF 100 TASKS…');
    var SP = 22, dotG = M.append('g').attr('transform', 'translate(524,44)');
    var dots = dotG.selectAll('circle').data(d3.range(100)).join('circle')
      .attr('cx', function (d) { return (d % 10) * SP; })
      .attr('cy', function (d) { return Math.floor(d / 10) * SP; })
      .attr('r', 7.5).attr('fill', C.violet);
    var mLegend = M.append('g').attr('opacity', 0);
    mLegend.append('circle').attr('cx', 530).attr('cy', 288).attr('r', 6.5).attr('fill', C.teal);
    txt(mLegend, 546, 293, '80 routine — cheap tier', { size: 14, weight: 700, fill: C.tealInk });
    mLegend.append('circle').attr('cx', 530).attr('cy', 316).attr('r', 6.5).attr('fill', C.violet);
    txt(mLegend, 546, 321, '20 genuinely hard — frontier', { size: 14, weight: 700, fill: C.violet });

    /* ---------- right: what that costs ---------- */
    var R = svg.append('g').attr('opacity', 0);
    cap(R, 800, 14, 'RELATIVE SPEND ON THE SAME 100 TASKS');
    var RW = 336;
    txt(R, 800, 58, 'Everything on the frontier model', { size: 14.5, weight: 700, fill: C.inkSoft });
    R.append('rect').attr('x', 800).attr('y', 68).attr('width', RW).attr('height', 30).attr('rx', 15)
      .attr('fill', linGrad(svg, '#4B3BB0', '#6A57DB', true));
    txt(R, 800 + RW - 14, 89, '100', { anchor: 'end', size: 18, weight: 800, fill: '#fff', display: true });

    txt(R, 800, 140, 'Routed — 80 cheap / 20 frontier', { size: 14.5, weight: 700, fill: C.tealInk });
    R.append('rect').attr('x', 800).attr('y', 150).attr('width', RW * .28).attr('height', 30).attr('rx', 15)
      .attr('fill', C.teal);
    txt(R, 800 + RW * .28 + 12, 171, '28', { size: 18, weight: 800, fill: C.tealInk, display: true });

    txt(R, 800, 216, '(20 × 1.0)  +  (80 × 0.1)  =  28', { size: 16, weight: 700, fill: C.inkSoft });
    txt(R, 800, 300, '−72%', { size: 68, weight: 800, fill: C.tealInk, display: true });
    txt(R, 800, 328, 'on the same work, from a routing rule', { size: 15, weight: 600, fill: C.inkSoft });

    /* ---------- punchline ---------- */
    var P = svg.append('g').attr('opacity', 0);
    P.append('rect').attr('x', 0).attr('y', 404).attr('width', W).attr('height', 58).attr('rx', 15)
      .attr('fill', 'rgba(94,79,233,.07)').attr('stroke', 'rgba(94,79,233,.24)');
    txt(P, 24, 440, 'Defaulting to the premium model for every task is a tax on habit — not a quality decision.',
      { size: 18.5, weight: 700, fill: C.violet, display: true });

    function step(k) {
      T(L, 400, 0, 'fade').attr('opacity', k >= 1 ? 1 : 0);
      /* the split and what it costs land together — one idea, one beat */
      var b2 = k >= 2;
      T(M, 400, 0, 'fade').attr('opacity', b2 ? 1 : 0);
      dots.each(function (d, i) {
        var routine = b2 && i < 80;
        T(d3.select(this), 400, b2 && !window.__deckPrint ? i * 9 : 0, 'col')
          .attr('fill', routine ? C.teal : C.violet);
      });
      T(mLegend, 340, b2 ? 900 : 0, 'fade').attr('opacity', b2 ? 1 : 0);
      T(R, 400, b2 && !window.__deckPrint ? 1000 : 0, 'fade').attr('opacity', b2 ? 1 : 0);
      T(P, 400, 0, 'fade').attr('opacity', k >= 3 ? 1 : 0);
    }
    return { step: step };
  };

  /* --- 15 · lever 2 · script the deterministic steps ---------------------- */
  VIZ.script = function (container) {
    var W = 1152, H = 486;
    var svg = svgIn(container, W, H);

    /* One recurring task, run once a working day by 600 people = 150,000 runs/yr.
       Agent run: reads ~100K tokens, writes ~5K -> $0.125 + $0.05 = ~$0.18.
       Script:    one analyst-day to build (~$700) + ~8 h/yr upkeep (~$650). */
    var PER_RUN = 0.18, BUILD = 700, MAINT = 650, SCRIPT_TOTAL = BUILD + MAINT;
    var MAXRUNS = 150000;
    var x = d3.scaleLinear().domain([0, MAXRUNS]).range([104, 1060]);
    var yy = d3.scaleLinear().domain([0, 32000]).range([352, 26]);

    /* axes */
    [0, 10000, 20000, 30000].forEach(function (t) {
      svg.append('line').attr('x1', 104).attr('x2', 1060).attr('y1', yy(t)).attr('y2', yy(t))
        .attr('stroke', C.line).attr('stroke-dasharray', t ? '3 4' : null);
      txt(svg, 92, yy(t) + 5, t ? '$' + (t / 1000) + 'K' : '$0',
        { anchor: 'end', size: 12.5, weight: 700, fill: C.inkMute });
    });
    [0, 50000, 100000, 150000].forEach(function (t) {
      txt(svg, x(t), 378, F.int(t), { anchor: 'middle', size: 12.5, weight: 700, fill: C.inkMute });
    });
    cap(svg, 104, 404, 'RUNS PER YEAR  ·  ONE RECURRING TASK ACROSS THE COMPANY');
    cap(svg, 0, 14, 'ANNUAL COST');

    var lineGen = d3.line().x(function (d) { return x(d[0]); }).y(function (d) { return yy(d[1]); });

    var modelPts = d3.range(0, MAXRUNS + 1, 2500).map(function (r) { return [r, r * PER_RUN]; });
    var scriptPts = [[0, SCRIPT_TOTAL], [MAXRUNS, SCRIPT_TOTAL]];

    function mkLine(pts, color, width) {
      var p = svg.append('path').attr('d', lineGen(pts))
        .attr('fill', 'none').attr('stroke', color).attr('stroke-width', width || 3.5)
        .attr('stroke-linecap', 'round');
      var len = 2400;
      try { len = p.node().getTotalLength() || 2400; } catch (e) {}
      p.attr('stroke-dasharray', len).attr('stroke-dashoffset', len);
      return { p: p, len: len };
    }
    var mLine = mkLine(modelPts, C.alarm);
    var sLine = mkLine(scriptPts, C.good);

    var MODEL_TOTAL = PER_RUN * MAXRUNS;
    var mEnd = svg.append('g').attr('opacity', 0);
    txt(mEnd, 1060, yy(MODEL_TOTAL) - 44, F.usd0(MODEL_TOTAL), { anchor: 'end', size: 26, weight: 800, fill: C.alarm, display: true });
    txt(mEnd, 1060, yy(MODEL_TOTAL) - 22, 'a model call, every single run', { anchor: 'end', size: 14, weight: 700, fill: C.alarm });

    var sEnd = svg.append('g').attr('opacity', 0);
    txt(sEnd, 1052, yy(SCRIPT_TOTAL) - 34, F.usd0(SCRIPT_TOTAL), { anchor: 'end', size: 25, weight: 800, fill: C.good, display: true });
    txt(sEnd, 1052, yy(SCRIPT_TOTAL) - 13, 'build it once, then maintain it', { anchor: 'end', size: 14, weight: 700, fill: C.good });

    /* crossover */
    var cx = SCRIPT_TOTAL / PER_RUN;   // 3,200 runs
    var xo = svg.append('g').attr('opacity', 0);
    xo.append('line').attr('x1', x(cx)).attr('x2', x(cx)).attr('y1', yy(0)).attr('y2', yy(SCRIPT_TOTAL))
      .attr('stroke', C.indigo).attr('stroke-dasharray', '4 4');
    xo.append('circle').attr('cx', x(cx)).attr('cy', yy(SCRIPT_TOTAL)).attr('r', 6.5)
      .attr('fill', '#fff').attr('stroke', C.indigo).attr('stroke-width', 3);
    xo.append('path')
      .attr('d', 'M' + (x(cx) + 8) + ',' + (yy(SCRIPT_TOTAL) - 8) + ' C' + (x(cx) + 40) + ',' +
                 (yy(SCRIPT_TOTAL) - 30) + ' ' + 176 + ',' + 300 + ' ' + 194 + ',' + 290)
      .attr('fill', 'none').attr('stroke', C.indigo).attr('stroke-width', 1.4).attr('opacity', .55);
    txt(xo, 200, 258, 'break-even ≈ ' + F.int(cx) + ' runs a year',
      { size: 15.5, weight: 800, fill: C.indigo, display: true });
    txt(xo, 200, 280, 'about 30 a working day — one recurring report',
      { size: 13.5, weight: 600, fill: C.inkSoft });

    var caveat = svg.append('g').attr('opacity', 0);
    caveat.append('rect').attr('x', 0).attr('y', 414).attr('width', W).attr('height', 62).attr('rx', 13)
      .attr('fill', 'rgba(94,79,233,.06)').attr('stroke', 'rgba(94,79,233,.22)');
    txt(caveat, 22, 442, 'The test is simple: if you can write the rule down, you do not need to rent judgment to follow it.',
      { size: 17, weight: 800, fill: C.violet, display: true });
    txt(caveat, 22, 462, 'Where the task genuinely needs judgment or language, the model earns its price. Spend it there.',
      { size: 14.5, weight: 600, fill: C.inkSoft });

    function drawLine(o, on, delay) {
      ease(T(o.p, 1100, on ? delay : 0)).attr('stroke-dashoffset', on ? 0 : o.len);
    }

    function step(k) {
      drawLine(mLine, k >= 1, 0);
      T(mEnd, 340, k >= 1 ? 900 : 0, 'fade').attr('opacity', k >= 1 ? 1 : 0);
      drawLine(sLine, k >= 2, 0);
      T(sEnd, 340, k >= 2 ? 700 : 0, 'fade').attr('opacity', k >= 2 ? 1 : 0);
      T(xo, 380, 0, 'fade').attr('opacity', k >= 3 ? 1 : 0);
      T(caveat, 380, 0, 'fade').attr('opacity', k >= 4 ? 1 : 0);
    }
    return { step: step };
  };

  /* --- 16 · lever 3 · engineer the context -------------------------------- */
  VIZ.context = function (container) {
    var W = 1152, H = 484;
    var svg = svgIn(container, W, H);

    var TURNS = 20, PER_TURN = 2000, WINDOW = 6000;
    var naive = [], eng = [], cn = 0, ce = 0;
    for (var n = 1; n <= TURNS; n++) {
      cn += PER_TURN * n;
      ce += Math.min(PER_TURN * n, WINDOW);
      naive.push([n, cn]); eng.push([n, ce]);
    }
    var NAIVE_TOTAL = cn, ENG_TOTAL = ce;

    var x = d3.scaleLinear().domain([1, TURNS]).range([112, 1020]);
    var y = d3.scaleLinear().domain([0, 440000]).range([348, 28]);

    [0, 100000, 200000, 300000, 400000].forEach(function (t) {
      svg.append('line').attr('x1', 112).attr('x2', 1020).attr('y1', y(t)).attr('y2', y(t))
        .attr('stroke', C.line).attr('stroke-dasharray', t ? '3 4' : null);
      txt(svg, 100, y(t) + 5, t ? (t / 1000) + 'K' : '0',
        { anchor: 'end', size: 12.5, weight: 700, fill: C.inkMute });
    });
    [1, 5, 10, 15, 20].forEach(function (t) {
      txt(svg, x(t), 374, String(t), { anchor: 'middle', size: 12.5, weight: 700, fill: C.inkMute });
    });
    cap(svg, 112, 400, 'STEPS IN ONE AGENT TASK');
    cap(svg, 0, 14, 'TOTAL READING THE AGENT HAS PAID FOR, IN TOKENS');

    var area = d3.area().x(function (d) { return x(d[0]); })
      .y0(y(0)).y1(function (d) { return y(d[1]); }).curve(d3.curveMonotoneX);
    var line = d3.line().x(function (d) { return x(d[0]); })
      .y(function (d) { return y(d[1]); }).curve(d3.curveMonotoneX);

    var naiveG = svg.append('g').attr('opacity', 0);
    naiveG.append('path').attr('d', area(naive))
      .attr('fill', linGrad(svg, 'rgba(91,63,214,.05)', 'rgba(91,63,214,.32)', false));
    naiveG.append('path').attr('d', line(naive))
      .attr('fill', 'none').attr('stroke', C.violet).attr('stroke-width', 3.5).attr('stroke-linecap', 'round');
    naiveG.selectAll('circle.n').data(naive).join('circle').attr('class', 'n')
      .attr('cx', function (d) { return x(d[0]); }).attr('cy', function (d) { return y(d[1]); })
      .attr('r', 3.2).attr('fill', C.violet);

    var naiveLbl = svg.append('g').attr('opacity', 0);
    txt(naiveLbl, 1012, y(NAIVE_TOTAL) - 40, F.int(NAIVE_TOTAL) + ' tokens',
      { anchor: 'end', size: 25, weight: 800, fill: C.violet, display: true });
    txt(naiveLbl, 1012, y(NAIVE_TOTAL) - 18, 'it sends everything again, every single step',
      { anchor: 'end', size: 14, weight: 700, fill: C.violet });

    var engG = svg.append('g').attr('opacity', 0);
    engG.append('path').attr('d', line(eng))
      .attr('fill', 'none').attr('stroke', C.teal).attr('stroke-width', 3.5).attr('stroke-linecap', 'round');
    var engLbl = svg.append('g').attr('opacity', 0);
    txt(engLbl, 1012, y(ENG_TOTAL) - 34, F.int(ENG_TOTAL) + ' tokens',
      { anchor: 'end', size: 25, weight: 800, fill: C.tealInk, display: true });
    txt(engLbl, 1012, y(ENG_TOTAL) - 12, 'capped: it keeps a short memory instead',
      { anchor: 'end', size: 14, weight: 700, fill: C.tealInk });

    var ratio = svg.append('g').attr('opacity', 0);
    ratio.append('rect').attr('x', 0).attr('y', 410).attr('width', W).attr('height', 64).attr('rx', 13)
      .attr('fill', 'rgba(47,191,200,.09)').attr('stroke', 'rgba(47,191,200,.28)');
    txt(ratio, 22, 438, 'Cap what the agent re-reads and the same work costs about a quarter as much.*',
      { size: 18, weight: 800, fill: C.tealInk, display: true });
    txt(ratio, 22, 460, '* Assuming two-thirds of tokens never reach the finished answer.',
      { size: 14.5, weight: 600, fill: C.inkSoft });

    function step(k) {
      T(naiveG, 480, 0, 'fade').attr('opacity', k >= 3 ? .5 : (k >= 1 ? 1 : 0));
      T(naiveLbl, 380, k >= 2 ? 120 : 0, 'fade').attr('opacity', k >= 2 ? 1 : 0);
      T(engG, 520, 0, 'fade').attr('opacity', k >= 3 ? 1 : 0);
      T(engLbl, 380, k >= 3 ? 300 : 0, 'fade').attr('opacity', k >= 3 ? 1 : 0);
      T(ratio, 380, 0, 'fade').attr('opacity', k >= 4 ? 1 : 0);
    }
    return { step: step };
  };

  /* --- 17 · lever 5 · run commodity work locally -------------------------- */
  VIZ.local = function (container) {
    var W = 1152, H = 478;
    var svg = svgIn(container, W, H);

    /* ---------- left: quantization ---------- */
    var L = svg.append('g').attr('opacity', 0);
    cap(L, 0, 14, 'AN OPEN-WEIGHT 8B MODEL FROM HUGGING FACE, IN MEMORY');
    var QS = [
      { l: 'FP16', s: 'full precision', gb: 16, c: linGrad(svg, '#4B3BB0', '#6A57DB', true), fg: C.indigo },
      { l: 'INT8', s: 'effectively lossless', gb: 8, c: linGrad(svg, '#5B4BC8', '#4F8FD0', true), fg: C.indigo },
      { l: 'INT4', s: 'quantized further', gb: 4, c: C.teal, fg: C.tealInk }
    ];
    var QW = 380;
    QS.forEach(function (q, i) {
      var y0 = 62 + i * 92;
      txt(L, 0, y0, q.l, { size: 18, weight: 800, fill: q.fg, display: true });
      txt(L, 52, y0, q.s, { size: 14, weight: 600, fill: C.inkSoft });
      L.append('rect').attr('x', 0).attr('y', y0 + 14).attr('width', QW * q.gb / 16)
        .attr('height', 30).attr('rx', 15).attr('fill', q.c);
      txt(L, QW * q.gb / 16 + 12, y0 + 36, q.gb + ' GB',
        { size: 18, weight: 800, fill: q.fg, display: true });
    });
    var laptop = svg.append('g').attr('opacity', 0);
    txt(laptop, 0, 366, '4 GB runs on a laptop.', { size: 24, weight: 800, fill: C.tealInk, display: true });
    txt(laptop, 0, 390, 'Not a data center. Not a contract. A laptop.', { size: 15, weight: 600, fill: C.inkSoft });
    txt(laptop, 0, 414, 'Small enough that two or three specialists share one GPU:', { size: 14.5, weight: 600, fill: C.inkSoft });
    txt(laptop, 0, 434, 'one for extraction, one for summarization, one for drafting.', { size: 14.5, weight: 600, fill: C.inkSoft });

    /* ---------- right: break-even ---------- */
    var R = svg.append('g').attr('opacity', 0);
    cap(R, 600, 14, 'CUMULATIVE COST — API vs YOUR OWN HARDWARE');
    txt(R, 600, 32, 'at ~43,000 premium-tier runs a month', { size: 12.5, weight: 600, fill: C.inkMute });
    var API_MO = 3000, HW = 6000, RUN_MO = 150, MONTHS = 12;
    var x = d3.scaleLinear().domain([0, MONTHS]).range([648, 1120]);
    var y = d3.scaleLinear().domain([0, 38000]).range([330, 46]);

    [0, 10000, 20000, 30000].forEach(function (t) {
      R.append('line').attr('x1', 648).attr('x2', 1120).attr('y1', y(t)).attr('y2', y(t))
        .attr('stroke', C.line).attr('stroke-dasharray', t ? '3 4' : null);
      txt(R, 638, y(t) + 5, t ? '$' + (t / 1000) + 'K' : '$0',
        { anchor: 'end', size: 12, weight: 700, fill: C.inkMute });
    });
    [0, 3, 6, 9, 12].forEach(function (m) {
      txt(R, x(m), 356, 'M' + m, { anchor: 'middle', size: 12, weight: 700, fill: C.inkMute });
    });

    var ln = d3.line().x(function (d) { return x(d[0]); }).y(function (d) { return y(d[1]); });
    var apiPts = d3.range(0, MONTHS + 1).map(function (m) { return [m, API_MO * m]; });
    var locPts = d3.range(0, MONTHS + 1).map(function (m) { return [m, HW + RUN_MO * m]; });
    R.append('path').attr('d', ln(apiPts)).attr('fill', 'none')
      .attr('stroke', C.alarm).attr('stroke-width', 3.2).attr('stroke-linecap', 'round');
    R.append('path').attr('d', ln(locPts)).attr('fill', 'none')
      .attr('stroke', C.good).attr('stroke-width', 3.2).attr('stroke-linecap', 'round');
    txt(R, 1114, y(API_MO * MONTHS) - 16, 'API, every month', { anchor: 'end', size: 13.5, weight: 700, fill: C.alarm });
    txt(R, 1114, y(HW + RUN_MO * MONTHS) - 12, 'bought once, then run it', { anchor: 'end', size: 13.5, weight: 700, fill: C.good });

    var bem = HW / (API_MO - RUN_MO);
    R.append('circle').attr('cx', x(bem)).attr('cy', y(API_MO * bem)).attr('r', 6)
      .attr('fill', '#fff').attr('stroke', C.indigo).attr('stroke-width', 3);
    txt(R, x(bem) + 14, y(API_MO * bem) - 34, 'break-even ≈ month ' + bem.toFixed(1),
      { size: 14.5, weight: 800, fill: C.indigo, display: true });

    /* ---------- the part that isn't about money ---------- */
    var P = svg.append('g').attr('opacity', 0);
    P.append('rect').attr('x', 596).attr('y', 392).attr('width', W - 596).attr('height', 46).attr('rx', 12)
      .attr('fill', 'rgba(47,191,200,.09)').attr('stroke', 'rgba(47,191,200,.28)');
    txt(P, 618, 422, 'And nothing leaves the building.',
      { size: 19, weight: 800, fill: C.tealInk, display: true });
    txt(P, 596, 464, '* Local wins on volume — at commodity cloud pricing, electricity alone can cost more.',
      { size: 12.5, weight: 600, fill: C.inkMute });

    function step(k) {
      T(L, 400, 0, 'fade').attr('opacity', k >= 1 ? 1 : 0);
      T(laptop, 400, 0, 'fade').attr('opacity', k >= 2 ? 1 : 0);
      T(R, 400, 0, 'fade').attr('opacity', k >= 3 ? 1 : 0);
      T(P, 400, 0, 'fade').attr('opacity', k >= 4 ? 1 : 0);
    }
    return { step: step };
  };

  /* --- 18 · lever 4 · stop redoing work ----------------------------------- */
  VIZ.artifacts = function (container) {
    var W = 1152, H = 452;
    var svg = svgIn(container, W, H);

    var COLS = 10, ROWS = 6, N = COLS * ROWS, SP = 46, REWORK = 0.30;
    cap(svg, 0, 14, '60 CHAT SESSIONS THIS MONTH');
    var g = svg.append('g').attr('transform', 'translate(20,52)');
    var dots = g.selectAll('circle').data(d3.range(N)).join('circle')
      .attr('cx', function (d) { return (d % COLS) * SP; })
      .attr('cy', function (d) { return Math.floor(d / COLS) * SP; })
      .attr('r', 14).attr('fill', C.violet).attr('opacity', 0);

    var legend = svg.append('g').attr('opacity', 0);
    legend.append('circle').attr('cx', 26).attr('cy', 372).attr('r', 9).attr('fill', C.alarm);
    txt(legend, 46, 378, '18 of them re-answered something already answered',
      { size: 15.5, weight: 700, fill: C.alarm });
    legend.append('circle').attr('cx', 26).attr('cy', 402).attr('r', 9).attr('fill', C.violet);
    txt(legend, 46, 408, 'and none of the answers were saved anywhere',
      { size: 15.5, weight: 700, fill: C.inkSoft });

    var R = svg.append('g').attr('opacity', 0);
    cap(R, 620, 60, 'AT 30% REWORK, ON A $525,000 BILL');
    var big = txt(R, 620, 142, '$0', { size: 66, weight: 800, fill: C.alarm, display: true });
    txt(R, 620, 174, 'a year, re-answering answered questions', { size: 16, weight: 600, fill: C.inkSoft });
    txt(R, 620, 194, '— before you count anyone’s salary time', { size: 14, weight: 600, fill: C.inkMute });

    R.append('rect').attr('x', 620).attr('y', 226).attr('width', 532).attr('height', 158).attr('rx', 16)
      .attr('fill', 'rgba(47,191,200,.07)').attr('stroke', 'rgba(47,191,200,.28)');
    cap(R, 642, 258, 'THE FIX IS FREE').attr('fill', C.tealInk);
    txt(R, 642, 292, 'Put the prompt and the output in version control.',
      { size: 18, weight: 800, fill: C.tealInk, display: true });
    txt(R, 642, 322, 'A prompt someone tuned for four hours is an asset.',
      { size: 15.5, weight: 600, fill: C.inkSoft });
    txt(R, 642, 346, 'So is the finished piece of work it produced.',
      { size: 15.5, weight: 600, fill: C.inkSoft });
    txt(R, 642, 368, 'Both are worth keeping where the team can find them.',
      { size: 15.5, weight: 600, fill: C.inkSoft });

    function step(k) {
      dots.each(function (d, i) {
        var sel = d3.select(this);
        T(sel, 220, k >= 1 && !window.__deckPrint ? i * 16 : 0, 'fade').attr('opacity', k >= 1 ? 1 : 0);
        /* 18 of 60, scattered rather than clumped into a block */
        var flagged = k >= 2 && (i * 7) % 10 < 3;
        T(sel, 380, k >= 2 && !window.__deckPrint ? (i % 10) * 40 : 0, 'col')
          .attr('fill', flagged ? C.alarm : C.violet);
      });
      T(legend, 380, 0, 'fade').attr('opacity', k >= 2 ? 1 : 0);
      T(R, 400, 0, 'fade').attr('opacity', k >= 3 ? 1 : 0);
      if (k >= 3) countUp(big, 0, 525000 * REWORK, F.usd0, 1100, 200);
      else big.interrupt().text('$0');
    }
    return { step: step };
  };

  /* --- 19 · what you don't put in the prompt ------------------------------ */
  VIZ.promptfilter = function (container) {
    var W = 1152, H = 352;
    var svg = svgIn(container, W, H);

    var CHIPS = [
      { t: 'The deck you’re summarizing', ok: true },
      { t: 'API keys and passwords', ok: false },
      { t: 'The meeting transcript', ok: true },
      { t: 'Customer names, emails, card data', ok: false },
      { t: 'Last quarter’s public summary', ok: true },
      { t: 'Client contracts and their IP', ok: false },
      { t: 'Your own draft email', ok: true },
      { t: 'Unreleased financials', ok: false }
    ];
    var CW = 430, CH = 38;

    var startX = (W - CW) / 2;
    var chips = CHIPS.map(function (c, i) {
      var g = svg.append('g').attr('opacity', 0)
        .attr('transform', 'translate(' + startX + ',' + (6 + i * 42) + ')');
      var r = g.append('rect').attr('width', CW).attr('height', CH).attr('rx', 12)
        .attr('fill', '#fff').attr('stroke', C.line).attr('stroke-width', 1.5);
      var t = txt(g, 18, 27, c.t, { size: 16, weight: 700, fill: C.ink });
      return { g: g, r: r, t: t, ok: c.ok };
    });

    var heads = svg.append('g').attr('opacity', 0);
    cap(heads, 24, 0, 'NEVER GOES IN').attr('fill', C.alarm).attr('font-size', 13);
    cap(heads, 620, 0, 'FINE TO SEND').attr('fill', C.tealInk).attr('font-size', 13);

    var punch = svg.append('g').attr('opacity', 0);
    punch.append('rect').attr('x', 0).attr('y', 272).attr('width', W).attr('height', 68).attr('rx', 15)
      .attr('fill', 'rgba(196,68,63,.06)').attr('stroke', 'rgba(196,68,63,.26)');
    txt(punch, 24, 305, 'It costs nothing to strip it out. It costs a great deal to explain it.',
      { size: 19, weight: 800, fill: '#A5322D', display: true });
    txt(punch, 24, 328, 'Fewer tokens in the prompt is also, literally, a smaller bill. Hygiene and thrift point the same way here.',
      { size: 14.5, weight: 600, fill: C.inkSoft });

    function step(k) {
      chips.forEach(function (c, i) {
        T(c.g, 300, k >= 1 && !window.__deckPrint ? i * 70 : 0, 'fade').attr('opacity', k >= 1 ? 1 : 0);
      });
      T(heads, 340, 0, 'fade').attr('opacity', k >= 2 ? 1 : 0);

      var nOk = 0, nBad = 0;
      chips.forEach(function (c, i) {
        var tx = startX, ty = 6 + i * 42;
        if (k >= 2) {
          if (c.ok) { tx = 620; ty = 18 + (nOk++) * 52; }
          else { tx = 24; ty = 18 + (nBad++) * 52; }
        }
        ease(T(c.g, 700, k >= 2 && !window.__deckPrint ? 120 : 0, 'move'))
          .attr('transform', 'translate(' + tx + ',' + ty + ')');
        var bad = k >= 3 && !c.ok;
        T(c.r, 380, 0, 'col')
          .attr('fill', bad ? 'rgba(196,68,63,.07)' : '#fff')
          .attr('stroke', bad ? 'rgba(196,68,63,.55)' : C.line);
        T(c.t, 380, 0, 'col').attr('fill', bad ? '#A5322D' : C.ink);
      });
      T(punch, 400, 0, 'fade').attr('opacity', k >= 4 ? 1 : 0);
    }
    return { step: step };
  };

  /* --- 20 · what you depend on ------------------------------------------- */
  VIZ.supply = function (container) {
    var W = 1152, H = 412;
    var svg = svgIn(container, W, H);

    var LINE = 'rgba(255,255,255,.22)';
    var APP  = { x: 16,  y: 122, w: 152, h: 76, label: 'Your app' };
    var GATE = { x: 244, y: 122, w: 186, h: 76, label: 'LLM gateway' };
    var TIER = [
      { label: 'Model SDK' }, { label: 'Vector DB' },
      { label: 'Agent framework' }, { label: 'Auth / secrets' }
    ];
    var TX = 508, TW = 168, TH = 54;
    TIER.forEach(function (t, i) { t.x = TX; t.y = 16 + i * 78; t.w = TW; t.h = TH; });

    function cx(b) { return b.x + b.w / 2; }
    function cy(b) { return b.y + b.h / 2; }

    /* transitive packages — 8 per tier box */
    var DEPS = [];
    TIER.forEach(function (t, i) {
      for (var j = 0; j < 8; j++) {
        DEPS.push({
          tier: i,
          x: 754 + (j % 4) * 66 + (j >= 4 ? 33 : 0),
          y: cy(t) - 16 + Math.floor(j / 4) * 32
        });
      }
    });

    /* ---- links (drawn first, under the boxes) ---- */
    var linkG = svg.append('g');
    var lAppGate = linkG.append('line')
      .attr('x1', APP.x + APP.w).attr('y1', cy(APP))
      .attr('x2', GATE.x).attr('y2', cy(GATE))
      .attr('stroke', LINE).attr('stroke-width', 2.4);

    var lGateTier = TIER.map(function (t) {
      return linkG.append('path')
        .attr('d', 'M' + (GATE.x + GATE.w) + ',' + cy(GATE) +
                   ' C' + (GATE.x + GATE.w + 40) + ',' + cy(GATE) +
                   ' ' + (t.x - 40) + ',' + cy(t) + ' ' + t.x + ',' + cy(t))
        .attr('fill', 'none').attr('stroke', LINE).attr('stroke-width', 1.8);
    });

    var lTierDep = DEPS.map(function (d) {
      var t = TIER[d.tier];
      return linkG.append('line')
        .attr('x1', t.x + t.w).attr('y1', cy(t))
        .attr('x2', d.x).attr('y2', d.y)
        .attr('stroke', 'rgba(255,255,255,.13)').attr('stroke-width', 1);
    });

    /* ---- boxes ---- */
    function box(b, opts) {
      opts = opts || {};
      var g = svg.append('g');
      var r = g.append('rect').attr('x', b.x).attr('y', b.y).attr('width', b.w).attr('height', b.h)
        .attr('rx', 14)
        .attr('fill', opts.fill || 'rgba(255,255,255,.07)')
        .attr('stroke', opts.stroke || 'rgba(255,255,255,.28)')
        .attr('stroke-width', opts.sw || 1.6);
      var t = txt(g, cx(b), cy(b) + (opts.size || 16) / 3, b.label, {
        anchor: 'middle', size: opts.size || 16, weight: 700,
        fill: opts.fg || '#fff', display: true
      });
      return { g: g, r: r, t: t };
    }

    var appBox = box(APP, { size: 18, fill: 'rgba(185,169,255,.16)', stroke: 'rgba(185,169,255,.5)' });
    var gateBox = box(GATE, { size: 18, fill: 'rgba(89,219,222,.13)', stroke: 'rgba(89,219,222,.55)' });
    var tierBox = TIER.map(function (t) { return box(t, { size: 14.5 }); });

    var depSel = svg.append('g').selectAll('circle').data(DEPS).join('circle')
      .attr('cx', function (d) { return d.x; }).attr('cy', function (d) { return d.y; })
      .attr('r', 7).attr('fill', 'rgba(255,255,255,.34)');

    txt(svg, 928, 366, '32 transitive packages nobody chose', {
      anchor: 'middle', size: 13.5, weight: 700, fill: C.onDarkMute
    });

    /* the gateway's real job, spelled out */
    var gateNote = svg.append('g').attr('opacity', 0);
    txt(gateNote, cx(GATE), GATE.y + GATE.h + 26, 'sits in the path of every model call —', {
      anchor: 'middle', size: 13.5, weight: 700, fill: C.tealB
    });
    txt(gateNote, cx(GATE), GATE.y + GATE.h + 45, 'it sees every prompt and every response', {
      anchor: 'middle', size: 13.5, weight: 700, fill: C.tealB
    });

    /* one bad package, and the blast radius back to you */
    var VICTIM = 9;                       /* a dep of tier box 1 */
    var victimTier = DEPS[VICTIM].tier;

    var punch = svg.append('g').attr('opacity', 0);
    punch.append('rect').attr('x', 0).attr('y', 336).attr('width', 700).attr('height', 68).attr('rx', 14)
      .attr('fill', 'rgba(255,255,255,.07)').attr('stroke', 'rgba(255,255,255,.20)');
    txt(punch, 22, 366, 'Not a security slide — a cost-of-ownership slide.',
      { size: 17, weight: 800, fill: '#fff', display: true });
    txt(punch, 22, 391, 'Every layer is an availability risk, an upgrade treadmill and an audit surface.',
      { size: 14.5, weight: 600, fill: C.onDarkSoft });

    function step(k) {
      var hot2 = k >= 2, hot3 = k >= 3;

      depSel.each(function (d, i) {
        var on = hot2 && i === VICTIM;
        T(d3.select(this), 400, 0, 'col')
          .attr('fill', on ? C.alarm : 'rgba(255,255,255,.34)')
          .attr('r', on ? 11 : 7);
      });
      lTierDep.forEach(function (l, i) {
        var on = hot3 && i === VICTIM;
        T(l, 380, 0, 'col')
          .attr('stroke', on ? C.alarm : 'rgba(255,255,255,.13)')
          .attr('stroke-width', on ? 2.6 : 1);
      });
      tierBox.forEach(function (b, i) {
        var on = hot3 && i === victimTier;
        T(b.r, 380, on && !window.__deckPrint ? 160 : 0, 'col')
          .attr('stroke', on ? C.alarm : 'rgba(255,255,255,.28)')
          .attr('fill', on ? 'rgba(196,68,63,.22)' : 'rgba(255,255,255,.07)');
      });
      lGateTier.forEach(function (l, i) {
        var on = hot3 && i === victimTier;
        T(l, 380, on && !window.__deckPrint ? 300 : 0, 'col')
          .attr('stroke', on ? C.alarm : LINE).attr('stroke-width', on ? 3 : 1.8);
      });
      T(gateBox.r, 380, hot3 && !window.__deckPrint ? 440 : 0, 'col')
        .attr('stroke', hot3 ? C.alarm : 'rgba(89,219,222,.55)')
        .attr('fill', hot3 ? 'rgba(196,68,63,.22)' : 'rgba(89,219,222,.13)');
      T(lAppGate, 380, hot3 && !window.__deckPrint ? 580 : 0, 'col')
        .attr('stroke', hot3 ? C.alarm : LINE).attr('stroke-width', hot3 ? 3.4 : 2.4);
      T(appBox.r, 380, hot3 && !window.__deckPrint ? 700 : 0, 'col')
        .attr('stroke', hot3 ? C.alarm : 'rgba(185,169,255,.5)')
        .attr('fill', hot3 ? 'rgba(196,68,63,.26)' : 'rgba(185,169,255,.16)');

      T(gateNote, 380, 0, 'fade').attr('opacity', hot3 ? 1 : 0);
      T(punch, 380, 0, 'fade').attr('opacity', k >= 4 ? 1 : 0);
    }
    return { step: step };
  };

  /* --- 21 · the cost of standing still ------------------------------------ */
  VIZ.notusing = function (container) {
    var W = 1152, H = 480;
    var svg = svgIn(container, W, H);

    /* ---------- left: the compounding gap ---------- */
    var L = svg.append('g').attr('opacity', 0);
    cap(L, 0, 14, 'HOURS FREED PER PERSON, CUMULATIVE');
    var x = d3.scaleLinear().domain([0, 12]).range([56, 520]);
    var y = d3.scaleLinear().domain([0, 260]).range([322, 44]);
    [0, 100, 200].forEach(function (t) {
      L.append('line').attr('x1', 56).attr('x2', 520).attr('y1', y(t)).attr('y2', y(t))
        .attr('stroke', C.line).attr('stroke-dasharray', t ? '3 4' : null);
      txt(L, 46, y(t) + 5, String(t), { anchor: 'end', size: 12, weight: 700, fill: C.inkMute });
    });
    [0, 3, 6, 9, 12].forEach(function (m) {
      txt(L, x(m), 348, 'M' + m, { anchor: 'middle', size: 12, weight: 700, fill: C.inkMute });
    });

    var ln = d3.line().x(function (d) { return x(d[0]); }).y(function (d) { return y(d[1]); });
    var fast = d3.range(0, 13).map(function (m) { return [m, m * 250 / 12]; });
    var slow = d3.range(0, 13).map(function (m) { return [m, m * 60 / 12]; });
    var gap = d3.area().x(function (d) { return x(d[0]); })
      .y0(function (d, i) { return y(slow[i][1]); })
      .y1(function (d) { return y(d[1]); });

    L.append('path').attr('d', gap(fast)).attr('fill', 'rgba(94,79,233,.13)');
    L.append('path').attr('d', ln(fast)).attr('fill', 'none').attr('stroke', C.violet).attr('stroke-width', 3.4);
    L.append('path').attr('d', ln(slow)).attr('fill', 'none').attr('stroke', C.inkMute).attr('stroke-width', 2.6).attr('stroke-dasharray', '5 4');
    txt(L, 520, y(250) - 32, '250 hrs', { anchor: 'end', size: 19, weight: 800, fill: C.violet, display: true });
    txt(L, 520, y(250) - 12, 'teams that automate', { anchor: 'end', size: 13.5, weight: 700, fill: C.violet });
    txt(L, 520, y(60) + 46, '60 hrs · everyone else', { anchor: 'end', size: 13.5, weight: 700, fill: C.inkMute });
    txt(L, 0, 388, 'The distance compounds.',
      { size: 15.5, weight: 700, fill: C.inkSoft });

    /* ---------- right: the gap moved, it did not close ---------- */
    /* Pew Research Center, 5,119 U.S. adults, fielded Feb 17-23 2026. */
    var R = svg.append('g').attr('opacity', 0);
    cap(R, 620, 14, 'SHARE OF U.S. ADULTS \u2014 MEN vs WOMEN');

    var MEN = '#8E86B8', WOMEN = C.teal;
    var lg = R.append('g');
    lg.append('rect').attr('x', 1000).attr('y', 6).attr('width', 16).attr('height', 9).attr('rx', 4.5).attr('fill', MEN);
    txt(lg, 1022, 14, 'men', { size: 12, weight: 700, fill: C.inkSoft });
    lg.append('rect').attr('x', 1064).attr('y', 6).attr('width', 16).attr('height', 9).attr('rx', 4.5).attr('fill', WOMEN);
    txt(lg, 1086, 14, 'women', { size: 12, weight: 700, fill: C.tealInk });

    var ROWS = [
      { l: 'Have used an AI chatbot',      m: 50, w: 47, open: true },
      { l: 'Use one every day',            m: 27, w: 20 },
      { l: 'Use one for work',             m: 40, w: 35 },
      { l: 'Say it makes them more productive', m: 35, w: 25 }
    ];
    var BX = 620, BW2 = 340;
    var xs2 = d3.scaleLinear().domain([0, 55]).range([0, BW2]);

    ROWS.forEach(function (r, i) {
      var y0 = 52 + i * 78;
      var g = R.append('g');
      txt(g, BX, y0, r.l, {
        size: 14.5, weight: r.open ? 700 : 600,
        fill: r.open ? C.ink : C.inkSoft
      });
      [['m', MEN, C.inkSoft], ['w', WOMEN, C.tealInk]].forEach(function (pair, j) {
        var v = r[pair[0]];
        var yy2 = y0 + 12 + j * 17;
        g.append('rect').attr('x', BX).attr('y', yy2).attr('width', xs2(v))
          .attr('height', 12).attr('rx', 6).attr('fill', pair[1]);
        txt(g, BX + xs2(v) + 9, yy2 + 11, v + '%', {
          size: 13.5, weight: 800, fill: pair[2], display: true
        });
      });
    });

    /* ---------- the callback ---------- */
    var Q = svg.append('g').attr('opacity', 0);
    Q.append('rect').attr('x', 0).attr('y', 400).attr('width', W).attr('height', 68).attr('rx', 14)
      .attr('fill', 'rgba(94,79,233,.07)').attr('stroke', 'rgba(94,79,233,.24)');
    Q.append('rect').attr('x', 0).attr('y', 400).attr('width', 4).attr('height', 68)
      .attr('rx', 2).attr('fill', C.violet);
    txt(Q, 24, 428, '\u201cThe women who get ahead will be the ones using AI to multiply',
      { size: 17, weight: 800, fill: C.violet, display: true });
    txt(Q, 24, 452, 'their output, not just speed up their typing.\u201d',
      { size: 17, weight: 800, fill: C.violet, display: true });
    txt(Q, 470, 452, '\u2014 Ashika Schroll',
      { size: 15, weight: 700, fill: C.inkSoft, display: true });

    function step(k) {
      T(L, 420, 0, 'fade').attr('opacity', k >= 1 ? 1 : 0);
      T(R, 420, 0, 'fade').attr('opacity', k >= 2 ? 1 : 0);
      T(Q, 420, 0, 'fade').attr('opacity', k >= 3 ? 1 : 0);
    }
    return { step: step };
  };

  /* ======================================================================
     LEVERAGE — one shared model so the three slides can never disagree
     ===================================================================== */
  var LEV = {
    tacHours: 3.0,          // what a skilled practitioner would need
    quality: 8.0,           // WIGGUM score out of 10
    runtimeS: 714,          // actual wall-clock machine time
    localCost: 0.01,        // $ of inference + energy, local hardware
    pricyCost: 0.50,        // $ of inference on a metered API — the expensive case
    hwCapex: 4000, hwYears: 3, hwHoursPerDay: 8,
    kwhPerRun: 0.08,        // ~400 W under load for ~12 min
    socalRate: 0.30         // $/kWh, Southern California commercial
  };
  LEV.tacS = LEV.tacHours * 3600;
  LEV.qNorm = LEV.quality / 10;
  /* leverage = (tac_s x quality_norm) / max(runtime_s + cost_s, 1) */
  function leverageAt(dollarCost, hourlyRate) {
    var costS = (dollarCost / hourlyRate) * 3600;
    return (LEV.tacS * LEV.qNorm) / Math.max(LEV.runtimeS + costS, 1);
  }
  /* $4,000 over 3 years at 8 h/day, charged against a 714 s run */
  LEV.hwPerRun = (LEV.hwCapex / (LEV.hwYears * 365 * LEV.hwHoursPerDay * 3600)) * LEV.runtimeS;
  LEV.trueLocal = LEV.localCost + LEV.hwPerRun;

  /* --- 21 · the leverage ratio -------------------------------------------- */
  VIZ.leverage = function (container) {
    var lev = leverageAt(LEV.localCost, 75);

    container.innerHTML =
      '<div class="lev-wrap">' +
        '<div class="lev">' +
          '<div class="lev-frac">' +
            '<div class="lev-row" data-row="num"></div>' +
            '<div class="lev-bar"></div>' +
            '<div class="lev-row" data-row="den"></div>' +
          '</div>' +
          '<div class="lev-eq">=</div>' +
          '<div class="lev-result">' +
            '<div class="v">0.0×</div>' +
            '<div class="l">leverage</div>' +
          '</div>' +
        '</div>' +
        '<div class="lev-note"></div>' +
      '</div>';

    var numRow = container.querySelector('[data-row="num"]');
    var denRow = container.querySelector('[data-row="den"]');
    var bar = container.querySelector('.lev-bar');
    var eq = container.querySelector('.lev-eq');
    var result = container.querySelector('.lev-result');
    var resultV = container.querySelector('.lev-result .v');
    var note = container.querySelector('.lev-note');

    function term(row, v, u, l) {
      var d = document.createElement('div');
      d.className = 'lev-term';
      d.innerHTML = '<div class="v">' + v + '</div><div class="u">' + u + '</div><div class="l">' + l + '</div>';
      row.appendChild(d);
      return d;
    }
    function op(row, sym) {
      var d = document.createElement('div');
      d.className = 'lev-op'; d.textContent = sym;
      row.appendChild(d);
      return d;
    }

    var tTac  = term(numRow, LEV.tacHours.toFixed(1) + ' h', F.int(LEV.tacS) + ' seconds', 'what a skilled<br>human would need');
    var oMul  = op(numRow, '×');
    var tQual = term(numRow, LEV.quality.toFixed(1) + ' / 10', '= ' + LEV.qNorm.toFixed(1), 'quality of what<br>came back');
    var tRun  = term(denRow, '12 min', F.int(LEV.runtimeS) + ' seconds', 'actual machine<br>time');
    var oAdd  = op(denRow, '+');
    var tCost = term(denRow, '≈ $0.01', 'under 1 second<br>of human time', 'machine cost, in<br>the same units');

    note.innerHTML = 'Across <b>1,500+ logged runs</b> this sits at <b>10–20×</b> on cognitively demanding work. ' +
      'It is a <b>conservative</b> figure: roughly half the tokens in a run are overhead — search, retrieval, compression — ' +
      'and the formula charges the finished output for all of them.';

    [tTac, oMul, tQual, bar, tRun, oAdd, tCost, eq, result, note].forEach(function (el) {
      el.style.opacity = 0;
      el.style.transform = 'translateY(14px)';
      el.style.transition = 'opacity .42s ease, transform .42s cubic-bezier(.22,.7,.3,1)';
    });
    bar.style.transform = 'scaleX(.2)';

    function set(el, on, ty) {
      el.style.opacity = on ? 1 : 0;
      el.style.transform = on ? 'none' : (ty || 'translateY(14px)');
    }

    function step(k) {
      set(tTac, k >= 1);
      set(oMul, k >= 2); set(tQual, k >= 2);
      set(bar, k >= 3, 'scaleX(.2)');
      set(tRun, k >= 3); set(oAdd, k >= 3); set(tCost, k >= 3);
      set(eq, k >= 4); set(result, k >= 4);
      if (k >= 4) countUp(d3.select(resultV), 0, lev, function (v) { return v.toFixed(1) + '×'; }, 1200, 160);
      else d3.select(resultV).interrupt().text('0.0×');
      set(note, k >= 5);
    }
    return { step: step };
  };

  /* --- 22 · three ledgers ------------------------------------------------- */
  VIZ.ledgers = function (container) {
    var W = 1152, H = 476;
    var svg = svgIn(container, W, H);

    var CW = 352, GAP = 48, CH = 340, CY = 16;
    var cols = [
      { x: 0,            tone: C.violet,  cap: 'LEDGER ONE · YOUR INVOICE',  soft: 'rgba(94,79,233,.06)',  edge: 'rgba(94,79,233,.24)' },
      { x: CW + GAP,     tone: C.indigo,  cap: 'LEDGER TWO · THE PERSON',    soft: 'rgba(46,35,111,.05)',  edge: 'rgba(46,35,111,.18)' },
      { x: 2 * (CW + GAP), tone: C.tealInk, cap: 'LEDGER THREE · SHARED',    soft: 'rgba(47,191,200,.08)', edge: 'rgba(47,191,200,.30)' }
    ];

    var G = cols.map(function (c) {
      var g = svg.append('g').attr('opacity', 0);
      g.append('rect').attr('x', c.x).attr('y', CY).attr('width', CW).attr('height', CH).attr('rx', 18)
        .attr('fill', c.soft).attr('stroke', c.edge);
      cap(g, c.x + 24, CY + 34, c.cap).attr('fill', c.tone);
      return g;
    });

    /* ---- ledger one: what you actually pay ---- */
    var oneVal = txt(G[0], cols[0].x + 24, CY + 116, '$0.00', {
      size: 62, weight: 800, fill: C.violet, display: true
    });
    txt(G[0], cols[0].x + 24, CY + 144, 'per run, all in', { size: 14.5, weight: 700, fill: C.inkSoft });
    [ { l: 'Cloud, premium tier', v: '$0.07' },
      { l: 'Local, electricity only', v: '$0.01' }
    ].forEach(function (r, i) {
      var y = CY + 186 + i * 30;
      txt(G[0], cols[0].x + 24, y, r.l, { size: 14.5, weight: 600, fill: C.inkSoft });
      txt(G[0], cols[0].x + CW - 24, y, r.v, { anchor: 'end', size: 15, weight: 800, fill: C.indigo, display: true });
    });
    var capexRow = G[0].append('g').attr('opacity', 0);
    capexRow.append('line').attr('x1', cols[0].x + 24).attr('x2', cols[0].x + CW - 24)
      .attr('y1', CY + 228).attr('y2', CY + 228).attr('stroke', 'rgba(212,118,58,.4)');
    txt(capexRow, cols[0].x + 24, CY + 252, '+ hardware, amortized', { size: 14.5, weight: 700, fill: '#9A4D18' });
    txt(capexRow, cols[0].x + CW - 24, CY + 252, '+$' + LEV.hwPerRun.toFixed(2),
      { anchor: 'end', size: 15, weight: 800, fill: '#9A4D18', display: true });
    txt(capexRow, cols[0].x + 24, CY + 276, '$4,000 machine · 3 years · 8 h a day',
      { size: 13, weight: 600, fill: C.inkMute });
    txt(capexRow, cols[0].x + 24, CY + 296, '= ~40 runs a day. Counting it',
      { size: 13.5, weight: 700, fill: '#9A4D18' });
    txt(capexRow, cols[0].x + 24, CY + 314, 'reversed my own ranking.',
      { size: 13.5, weight: 800, fill: '#9A4D18' });

    /* ---- ledger two: hours handed back ---- */
    txt(G[1], cols[1].x + 24, CY + 116, LEV.tacHours.toFixed(1) + ' hrs', {
      size: 62, weight: 800, fill: C.indigo, display: true
    });
    txt(G[1], cols[1].x + 24, CY + 144, 'returned to whoever ran it', { size: 14.5, weight: 700, fill: C.inkSoft });
    [ 'Skilled work the machine stood in for.',
      'At 12× leverage this is the product —',
      'nobody is buying the ten cents.',
      '',
      'This ledger never appears on an invoice,',
      'and it is the only one you can sell.'
    ].forEach(function (line, i) {
      if (!line) return;
      txt(G[1], cols[1].x + 24, CY + 190 + i * 24, line, { size: 14.5, weight: 600, fill: C.inkSoft });
    });

    /* ---- ledger three: everyone else's ---- */
    txt(G[2], cols[2].x + 24, CY + 116, LEV.kwhPerRun.toFixed(2) + ' kWh', {
      size: 56, weight: 800, fill: C.tealInk, display: true
    });
    txt(G[2], cols[2].x + 24, CY + 144, 'drawn from the grid, per run', { size: 14.5, weight: 700, fill: C.inkSoft });
    [ '≈ ' + (LEV.kwhPerRun * LEV.socalRate * 100).toFixed(1) + '¢ at Southern California rates —',
      'more than the national figure I had logged.',
      '',
      '1,000 runs ≈ ' + Math.round(LEV.kwhPerRun * 1000) + ' kWh: about four days',
      'of a typical California household.',
      '',
      'Nobody puts this line in a budget.'
    ].forEach(function (line, i) {
      if (!line) return;
      txt(G[2], cols[2].x + 24, CY + 190 + i * 22, line, {
        size: 14.5, weight: i >= 6 ? 800 : 600, fill: i >= 6 ? C.tealInk : C.inkSoft
      });
    });

    /* ---- the punchline ---- */
    var punch = svg.append('g').attr('opacity', 0);
    punch.append('rect').attr('x', 0).attr('y', 400).attr('width', W).attr('height', 58).attr('rx', 15)
      .attr('fill', 'rgba(47,191,200,.09)').attr('stroke', 'rgba(47,191,200,.28)');
    txt(punch, 24, 435, 'You optimize the first. You sell the second. You share the third — whether or not you ever count it.',
      { size: 18.5, weight: 700, fill: C.tealInk, display: true });

    function step(k) {
      T(G[0], 400, 0, 'fade').attr('opacity', k >= 1 ? 1 : 0);
      if (k >= 1) countUp(oneVal, 0, k >= 2 ? LEV.trueLocal : LEV.localCost,
                          function (v) { return '$' + v.toFixed(2); }, 900, 100);
      else oneVal.interrupt().text('$0.00');
      T(capexRow, 400, 0, 'fade').attr('opacity', k >= 2 ? 1 : 0);
      T(G[1], 400, 0, 'fade').attr('opacity', k >= 3 ? 1 : 0);
      T(G[2], 400, 0, 'fade').attr('opacity', k >= 4 ? 1 : 0);
      T(punch, 400, 0, 'fade').attr('opacity', k >= 5 ? 1 : 0);
    }
    return { step: step };
  };

  /* --- 23 · the wage term vanishes ---------------------------------------- */
  VIZ.whoruns = function (container) {
    var W = 1152, H = 464;
    var svg = svgIn(container, W, H);

    var RATES = [
      { r: 15,  l: '$15 / hr',  s: 'minimum wage' },
      { r: 75,  l: '$75 / hr',  s: 'harness default' },
      { r: 200, l: '$200 / hr', s: 'senior engineer' }
    ];
    var BASE = 336, MAXH = 258, BW = 116;
    var xs = [104, 268, 432];
    var y = d3.scaleLinear().domain([0, 14]).range([0, MAXH]);

    [0, 4, 8, 12].forEach(function (t) {
      svg.append('line').attr('x1', 40).attr('x2', 560).attr('y1', BASE - y(t)).attr('y2', BASE - y(t))
        .attr('stroke', C.line).attr('stroke-dasharray', t ? '3 4' : null);
      txt(svg, 32, BASE - y(t) + 5, t + '×', { anchor: 'end', size: 12, weight: 700, fill: C.inkMute });
    });

    var scenarioCap = cap(svg, 40, 14, 'AT $0.50 A RUN — A METERED API');

    var bars = RATES.map(function (R, i) {
      var g = svg.append('g').attr('opacity', 0);
      var rect = g.append('rect').attr('x', xs[i]).attr('width', BW).attr('rx', 10)
        .attr('y', BASE).attr('height', 0)
        .attr('fill', linGrad(svg, '#4B3BB0', '#6A57DB', false));
      var val = txt(g, xs[i] + BW / 2, BASE - 12, '0.0×', {
        anchor: 'middle', size: 25, weight: 800, fill: C.indigo, display: true
      });
      txt(g, xs[i] + BW / 2, BASE + 28, R.l, {
        anchor: 'middle', size: 16, weight: 800, fill: C.ink, display: true
      });
      txt(g, xs[i] + BW / 2, BASE + 50, R.s, {
        anchor: 'middle', size: 13, weight: 600, fill: C.inkMute
      });
      return { g: g, rect: rect, val: val, R: R };
    });

    var spread = svg.append('g').attr('opacity', 0);
    txt(spread, 40, BASE + 96, '', { size: 15.5, weight: 800, fill: C.violet, display: true });
    var spreadTxt = spread.select('text');

    /* ---- right: what that means ---- */
    var RX = 636;
    var R1 = svg.append('g').attr('opacity', 0);
    cap(R1, RX, 14, 'ACROSS 145 RECALCULATED RUNS');
    txt(R1, RX, 58, 'The distributions at $15, $75 and', { size: 17, weight: 600, fill: C.inkSoft });
    txt(R1, RX, 82, '$200 an hour are statistically', { size: 17, weight: 600, fill: C.inkSoft });
    txt(R1, RX, 106, 'indistinguishable.', { size: 17, weight: 800, fill: C.indigo, display: true });

    var R2 = svg.append('g').attr('opacity', 0);
    R2.append('rect').attr('x', RX).attr('y', 138).attr('width', W - RX).attr('height', 132).attr('rx', 16)
      .attr('fill', 'rgba(94,79,233,.07)').attr('stroke', 'rgba(94,79,233,.24)');
    txt(R2, RX + 22, 174, 'Leverage is a property of the', { size: 19, weight: 800, fill: C.violet, display: true });
    txt(R2, RX + 22, 200, 'task and the tool —', { size: 19, weight: 800, fill: C.violet, display: true });
    txt(R2, RX + 22, 232, 'not of the person running either.', { size: 19, weight: 800, fill: C.indigo, display: true });
    txt(R2, RX + 22, 256, '“Lower-value” describes a task allocation, not a person.',
      { size: 13.5, weight: 600, fill: C.inkSoft });

    var R3 = svg.append('g').attr('opacity', 0);
    R3.append('rect').attr('x', RX).attr('y', 292).attr('width', W - RX).attr('height', 104).attr('rx', 16)
      .attr('fill', 'rgba(47,191,200,.10)').attr('stroke', 'rgba(47,191,200,.32)');
    txt(R3, RX + 22, 328, 'So the question stops being', { size: 17, weight: 600, fill: C.tealInk });
    txt(R3, RX + 22, 356, 'who gets displaced.', { size: 21, weight: 800, fill: C.tealInk, display: true });
    txt(R3, RX + 22, 382, 'It becomes who gets access.', { size: 21, weight: 800, fill: C.tealInk, display: true });

    function step(k) {
      var cheap = k >= 2;                      /* local inference cost */
      var dollars = cheap ? LEV.localCost : LEV.pricyCost;

      bars.forEach(function (b, i) {
        var on = k >= 1;
        var v = leverageAt(dollars, b.R.r);
        T(b.g, 320, 0, 'fade').attr('opacity', on ? 1 : 0);
        ease(T(b.rect, 800, on && !window.__deckPrint ? i * 90 : 0))
          .attr('height', on ? y(v) : 0).attr('y', on ? BASE - y(v) : BASE)
          .attr('fill', cheap ? linGrad(svg, '#2FBFC8', '#59DBDE', false)
                              : linGrad(svg, '#4B3BB0', '#6A57DB', false));
        /* 'pos' keeps this from being cancelled by countUp's own transition */
        ease(T(b.val, 800, on && !window.__deckPrint ? i * 90 : 0, 'pos'))
          .attr('y', on ? BASE - y(v) - 14 : BASE - 14);
        if (on) countUp(b.val, +String(b.val.text()).replace('×', '') || 0, v,
                        function (x) { return x.toFixed(1) + '×'; }, 800, i * 90);
      });

      scenarioCap.text(cheap ? 'AT LOCAL INFERENCE COST — ABOUT $0.01 A RUN'
                             : 'AT $0.50 A RUN — A METERED API')
        .attr('fill', cheap ? C.tealInk : C.inkMute);

      var lo = leverageAt(dollars, 15), hi = leverageAt(dollars, 200);
      spreadTxt.text(cheap
        ? 'The wage term is not reduced. It is gone.'
        : 'Spread from minimum wage to senior engineer: ' + Math.round((hi / lo - 1) * 100) + '%')
        .attr('fill', cheap ? C.tealInk : C.violet);
      T(spread, 340, 0, 'fade').attr('opacity', k >= 1 ? 1 : 0);

      T(R1, 380, 0, 'fade').attr('opacity', k >= 3 ? 1 : 0);
      T(R2, 380, 0, 'fade').attr('opacity', k >= 3 ? 1 : 0);
      T(R3, 380, 0, 'fade').attr('opacity', k >= 4 ? 1 : 0);
    }
    return { step: step };
  };

  /* --- 21 · the re-skilling gap ------------------------------------------- */
  VIZ.reskill = function (container) {
    var W = 1152, H = 462;
    var svg = svgIn(container, W, H);

    /* ---------- left: the demand already exists ---------- */
    var L = svg.append('g').attr('opacity', 0);
    cap(L, 0, 14, 'AI IS THE #1 TOPIC WOMEN SAY THEY WANT TO LEARN');

    var big1 = txt(L, 0, 120, '63%', {
      size: 92, weight: 800, fill: C.indigo, display: true
    });
    big1.attr('fill', linGrad(svg, '#5B3FD6', '#3E8FC9', true));
    txt(L, 0, 156, 'report a lack of skills and access', { size: 19, weight: 700, fill: C.ink, display: true });
    txt(L, 0, 182, 'to training on the job.', { size: 19, weight: 700, fill: C.ink, display: true });

    /* one honest split bar, straight from the cited figure */
    var LBW = 470, HAVE = 37;
    cap(L, 0, 240, 'ACCESS TO AI TRAINING AT WORK');
    L.append('rect').attr('x', 0).attr('y', 256).attr('width', LBW).attr('height', 30)
      .attr('rx', 15).attr('fill', 'rgba(46,35,111,.10)');
    L.append('rect').attr('x', 0).attr('y', 256).attr('width', LBW * HAVE / 100).attr('height', 30)
      .attr('rx', 15).attr('fill', linGrad(svg, '#5B3FD6', '#7B62E8', true));
    txt(L, 10, 276, HAVE + '% have it', { size: 14, weight: 800, fill: '#fff', display: true });
    txt(L, LBW * HAVE / 100 + 14, 276, '63% do not', { size: 14, weight: 800, fill: C.inkSoft, display: true });
    txt(L, 0, 316, 'The constraint is not appetite. It is access.',
      { size: 16.5, weight: 800, fill: C.violet, display: true });

    /* ---------- right: and the scale of the retraining ---------- */
    var RX = 640;
    var R = svg.append('g').attr('opacity', 0);
    cap(R, RX, 14, 'WHAT THE C-SUITE ITSELF EXPECTS, WITHIN THREE YEARS');

    var big2 = txt(R, RX, 120, '46%', {
      size: 92, weight: 800, fill: C.tealInk, display: true
    });
    big2.attr('fill', linGrad(svg, '#2FBFC8', '#3E8FC9', true));
    txt(R, RX, 156, 'of workers will need reskilling', { size: 19, weight: 700, fill: C.ink, display: true });
    txt(R, RX, 182, 'because of AI.', { size: 19, weight: 700, fill: C.ink, display: true });

    /* 100 people, 46 of them highlighted */
    var COLS = 20, ROWS = 5, SP = 24;
    var grid = R.append('g').attr('transform', 'translate(' + RX + ',224)');
    grid.selectAll('circle').data(d3.range(100)).join('circle')
      .attr('cx', function (d) { return (d % COLS) * SP + 7; })
      .attr('cy', function (d) { return Math.floor(d / COLS) * SP + 7; })
      .attr('r', 7.5)
      .attr('fill', function (d) { return d < 46 ? C.teal : 'rgba(46,35,111,.13)'; });
    txt(R, RX, 372, 'Nearly half the people you already employ.',
      { size: 14.5, weight: 700, fill: C.tealInk });

    /* ---------- the tie-back ---------- */
    var P = svg.append('g').attr('opacity', 0);
    P.append('rect').attr('x', 0).attr('y', 400).attr('width', W).attr('height', 58).attr('rx', 15)
      .attr('fill', 'rgba(94,79,233,.07)').attr('stroke', 'rgba(94,79,233,.24)');
    txt(P, 24, 428, 'Every lever in this talk needs somebody who knows to pull it.',
      { size: 18, weight: 800, fill: C.violet, display: true });
    txt(P, 24, 449, 'Routing, context and scripting do not happen because you bought a tool. They happen because someone was taught what to look for.',
      { size: 14, weight: 600, fill: C.inkSoft });

    function step(k) {
      T(L, 420, 0, 'fade').attr('opacity', k >= 1 ? 1 : 0);
      T(R, 420, 0, 'fade').attr('opacity', k >= 2 ? 1 : 0);
      T(P, 420, 0, 'fade').attr('opacity', k >= 3 ? 1 : 0);
    }
    return { step: step };
  };

  /* <<INSERT-VIZ>> */

  /* ========================================================================
     REGISTRATION — slide id -> number of build steps
     ===================================================================== */
  REG = [
    { id: 's-title',     steps: 0 },
    { id: 's-lastime',   steps: 4 },
    { id: 's-close',     steps: 0 },
    { id: 's-token',     steps: 4 },
    { id: 's-convert',   steps: 4 },
    { id: 's-costtable', steps: 3 },
    { id: 's-budget',    steps: 4 },
    { id: 's-pivot',     steps: 5 },
    { id: 's-sc1',       steps: 4 },
    { id: 's-sc2',       steps: 5 },
    { id: 's-sc3',       steps: 5 },
    { id: 's-ramp',      steps: 4 },
    { id: 's-levers',    steps: 6 },
    { id: 's-rightsize', steps: 3 },
    { id: 's-script',    steps: 4 },
    { id: 's-context',   steps: 4 },
    { id: 's-artifacts', steps: 3 },
    { id: 's-local',     steps: 4 },
    { id: 's-prompt',    steps: 4 },
    { id: 's-notusing',  steps: 3 },
    { id: 's-reskill',   steps: 3 }
    /* Archived in _archived-slides.html — builders below are still live, so
       restoring a slide only needs its <section> back plus its line here:
         { id: 's-supply',   steps: 4 },
         { id: 's-leverage', steps: 5 },
         { id: 's-ledgers',  steps: 5 },
         { id: 's-whoruns',  steps: 4 }                                        */
    /* <<INSERT-REG>> */
  ];

  /* ========================================================================
     BOOT
     ===================================================================== */

  function buildersIn(slideEl) {
    return Array.prototype.slice.call(slideEl.querySelectorAll('[data-viz]'))
      .map(function (c) {
        var fn = VIZ[c.getAttribute('data-viz')];
        if (!fn) { console.warn('no viz builder:', c.getAttribute('data-viz')); return null; }
        try { return fn(c, slideEl); } catch (e) { console.error('viz build failed', c.getAttribute('data-viz'), e); return null; }
      })
      .filter(Boolean);
  }

  REG.forEach(function (spec) {
    Deck.on(spec.id, {
      steps: spec.steps,
      enter: function (el) {
        if (el.__viz) el.__viz.forEach(function (v) { v.destroy && v.destroy(); });
        el.__viz = buildersIn(el);
      },
      step: function (k, el) {
        if (!el.__viz) return;
        el.__viz.forEach(function (v) { if (v.step) { try { v.step(k); } catch (e) { console.error(e); } } });
      },
      leave: function (el) {
        if (el.__viz) el.__viz.forEach(function (v) { v.destroy && v.destroy(); });
        el.__viz = null;
      }
    });
  });

  /* Slide footers: one source of truth for the event line. */
  var EVENT_LINE = 'Reducing AI Operating Costs · NextUp SoCal · Aug 21, 2026';
  document.querySelectorAll('.foot-bar').forEach(function (f) {
    var src = f.getAttribute('data-src');
    f.innerHTML =
      '<span class="ev">' + EVENT_LINE + '</span>' +
      '<span class="src">' + (src || '') + '</span>';
  });

})();
