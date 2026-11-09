/* The landing page: live circuit, "how it works" tabs, features, the try-it question, pricing from the server, FAQ. */
(function () {
  'use strict';
  var h = BL.h, NS = 'http://www.w3.org/2000/svg';
  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // ------------------------------------------------------------------ the circuit: charges move faster when the current is bigger
  function s(tag, attrs, parent) { var e = document.createElementNS(NS, tag); Object.keys(attrs).forEach(function (k) { e.setAttribute(k, attrs[k]); }); if (parent) parent.appendChild(e); return e; }

  function circuit(svg, get) {
    var X0 = 40, X1 = 380, Y0 = 40, Y1 = 160, W = X1 - X0, H = Y1 - Y0, P = 2 * (W + H), N = 18;
    s('rect', { x: 0, y: 0, width: 420, height: 200, fill: 'transparent' }, svg);
    s('path', { d: 'M' + X0 + ',' + Y0 + ' H' + X1 + ' V' + Y1 + ' H' + X0 + ' Z', fill: 'none', stroke: '#2f8fe0', 'stroke-width': 3, 'stroke-linejoin': 'round' }, svg);
    // battery on the left wire
    s('rect', { x: X0 - 14, y: 84, width: 28, height: 34, fill: '#081726' }, svg);
    s('line', { x1: X0 - 14, y1: 90, x2: X0 + 14, y2: 90, stroke: '#d9a017', 'stroke-width': 4, 'stroke-linecap': 'round' }, svg);
    s('line', { x1: X0 - 8, y1: 106, x2: X0 + 8, y2: 106, stroke: '#5cc8ff', 'stroke-width': 4, 'stroke-linecap': 'round' }, svg);
    var t1 = s('text', { x: X0 + 22, y: 94, fill: '#d9a017', 'font-size': 13, 'font-weight': 700 }, svg); t1.textContent = '+';
    var t2 = s('text', { x: X0 + 22, y: 112, fill: '#5cc8ff', 'font-size': 14, 'font-weight': 700 }, svg); t2.textContent = '−';
    var vt = s('text', { x: X0 - 12, y: 140, fill: '#cfe3f5', 'font-size': 12 }, svg);
    // resistor on the top wire
    s('rect', { x: 150, y: Y0 - 8, width: 120, height: 16, fill: '#081726' }, svg);
    s('path', { d: 'M150,40 l8,-12 l12,24 l12,-24 l12,24 l12,-24 l12,24 l12,-24 l12,24 l8,-12', fill: 'none', stroke: '#d9a017', 'stroke-width': 3, 'stroke-linejoin': 'round' }, svg);
    var rt = s('text', { x: 210, y: 22, fill: '#ffd09a', 'font-size': 12, 'text-anchor': 'middle' }, svg);
    // ammeter on the bottom wire
    s('circle', { cx: 210, cy: Y1, r: 22, fill: '#0a1d31', stroke: '#1f9d55', 'stroke-width': 3 }, svg);
    var at = s('text', { x: 210, y: Y1 + 5, fill: '#bdf0d6', 'font-size': 14, 'font-weight': 700, 'text-anchor': 'middle' }, svg);
    var cap = s('text', { x: 210, y: 194, fill: '#7fe3b0', 'font-size': 11, 'text-anchor': 'middle' }, svg); cap.textContent = 'ammeter';
    var dots = [];
    for (var i = 0; i < N; i++) dots.push(s('circle', { r: 4.2, fill: '#5cc8ff', opacity: 0.95 }, svg));
    var phase = 0, last = 0;
    function pos(d) {                          // distance d along the loop (clockwise from the top-left corner)
      d = ((d % P) + P) % P;
      if (d < W) return [X0 + d, Y0];
      if (d < W + H) return [X1, Y0 + (d - W)];
      if (d < 2 * W + H) return [X1 - (d - W - H), Y1];
      return [X0, Y1 - (d - 2 * W - H)];
    }
    function draw() {
      var v = get(), I = v.V / v.R;
      vt.textContent = v.V + ' V'; rt.textContent = v.R + ' Ω'; at.textContent = I.toFixed(1);
      for (var i = 0; i < N; i++) { var p = pos(phase + i * (P / N)); dots[i].setAttribute('cx', p[0]); dots[i].setAttribute('cy', p[1]); dots[i].setAttribute('r', 3.4 + Math.min(2.2, I * 0.5)); }
    }
    function tick(t) {
      var v = get(), I = v.V / v.R, dt = last ? Math.min(0.05, (t - last) / 1000) : 0; last = t;
      if (!reduce) phase += dt * Math.max(14, Math.min(230, 38 * I));
      draw(); requestAnimationFrame(tick);
    }
    draw(); requestAnimationFrame(tick);
    return { draw: draw };
  }

  var heroC = document.getElementById('heroCircuit');
  if (heroC) circuit(heroC, function () { return { V: 6, R: 3 }; });

  // ------------------------------------------------------------------ the try-it lab + question
  var tV = document.getElementById('tV'), tR = document.getElementById('tR');
  if (tV) {
    var c = circuit(document.getElementById('tryCircuit'), function () { return { V: +tV.value, R: +tR.value }; });
    function upd() {
      var I = +tV.value / +tR.value;
      document.getElementById('tVv').textContent = tV.value + ' V'; document.getElementById('tRv').textContent = tR.value + ' Ω';
      document.getElementById('tI').textContent = I.toFixed(1) + ' A';
      document.getElementById('tS').textContent = I < 0.8 ? 'slow' : I < 2.5 ? 'medium' : 'fast';
    }
    tV.addEventListener('input', upd); tR.addEventListener('input', upd); upd();

    var answers = [['A', 'The current doubles', false], ['B', 'The current halves', true], ['C', 'The current stays the same', false], ['D', 'The current becomes four times', false]];
    var optBox = document.getElementById('tryOpts'), note = document.getElementById('tryNote');
    function reset() {
      note.replaceChildren(); optBox.replaceChildren();
      answers.forEach(function (a) {
        var b = h('button', { class: 'opt', type: 'button', text: a[0] + '.  ' + a[1], onclick: function () { pick(a, b); } }); optBox.appendChild(b);
      });
    }
    function pick(a, btn) {
      var all = optBox.querySelectorAll('.opt');
      all.forEach(function (o, i) { o.disabled = true; if (answers[i][2]) o.classList.add('right'); });
      if (!a[2]) btn.classList.add('wrong');
      note.replaceChildren(h('div', { class: 'note ' + (a[2] ? 'ok' : 'no'), text: (a[2] ? 'Right! ' : 'Not quite. ') + 'Current = voltage ÷ resistance. With the same voltage, double the resistance means half the current. Try it above: set the resistance to 3 Ω, then to 6 Ω, and watch the charges slow down.' }),
        h('button', { class: 'btn ghost small', type: 'button', style: 'margin-top:10px', text: 'Try again', onclick: reset }));
    }
    reset();
  }

  // ------------------------------------------------------------------ how it works (tabs)
  var HOW = [
    { tab: 'Pick', n: '01', title: 'Choose your class and chapter', text: 'Open the class you study in and pick a chapter from your NCERT book. Every chapter is a set of small labs, one for each idea.',
      ticks: ['Classes 6, 7, 8, 9 and 10', 'Chapters named exactly like your book', 'Start where your class is today'],
      mock: function () { return h('div', { class: 'glow-card' }, h('div', { class: 'tag', text: 'Your class', style: 'margin-bottom:10px' }),
        h('div', { style: 'display:flex;gap:8px;flex-wrap:wrap;margin-bottom:16px' }, [6, 7, 8, 9, 10].map(function (c) { return h('span', { class: 'tab' + (c === 8 ? ' on' : ''), text: 'Class ' + c }); })),
        ['Exploring the Investigative World of Science', 'The Invisible Living World', 'Health: The Ultimate Treasure'].map(function (t, i) { return h('div', { class: 'ch', style: 'margin-bottom:8px' }, h('span', { class: 'n', text: i + 1 }), h('div', null, h('div', { class: 't', text: t }), h('div', { class: 'meta', text: 'Interactive chapter' })), h('span', { class: 'badge ' + (i === 0 ? 'green' : 'grey'), text: i === 0 ? 'Free' : 'Plan' })); })); } },
    { tab: 'Explore', n: '02', title: 'Change things and watch what happens', text: 'Each lab has sliders and buttons. Change a value and the picture responds at once, so the idea becomes something you can see.',
      ticks: ['Drag, tune and compare', 'Real formulas, worked live', 'No reading walls of text'],
      mock: function () { return h('div', { class: 'glow-card' }, h('div', { class: 'tag', text: 'Lab', style: 'margin-bottom:10px' }),
        h('div', { class: 'sketch', style: 'padding:26px 16px;text-align:center;color:var(--muted)' }, h('div', { style: 'font-size:34px', text: '🔬' }), h('div', { text: 'Magnifying lens · move the lens, watch the image grow' })),
        h('div', { class: 'sliders', style: 'margin-top:12px' }, h('div', { class: 'sl' }, h('label', null, 'Lens to object', h('b', { text: '3 cm' })), h('input', { type: 'range', value: 30, disabled: true })), h('div', { class: 'sl' }, h('label', null, 'Magnification', h('b', { text: '×2.5' })), h('input', { type: 'range', value: 55, disabled: true })))); } },
    { tab: 'Test', n: '03', title: 'Check yourself as you go', text: 'After each idea there is a quick question. You get an answer straight away, with the reason, so mistakes turn into learning.',
      ticks: ['Instant feedback', 'The reason behind every answer', 'Try again as often as you like'],
      mock: function () { return h('div', { class: 'glow-card' }, h('div', { class: 'qtext', text: 'A ball is dropped from rest. After 2 seconds its speed is about… (g = 10 m/s²)' }),
        h('div', { class: 'opts' }, [['A. 5 m/s', ''], ['B. 10 m/s', ''], ['C. 20 m/s', ' right'], ['D. 40 m/s', '']].map(function (o) { return h('div', { class: 'opt' + o[1], text: o[0] }); })),
        h('div', { class: 'note ok', text: 'Right! v = g × t = 10 × 2 = 20 m/s.' })); } },
    { tab: 'Track', n: '04', title: 'See your progress grow', text: 'Your time, your streak and the chapters you have finished are saved for you, so you always know where to continue.',
      ticks: ['Time spent in every chapter', 'Daily streak', 'Pick up exactly where you left off'],
      mock: function () { return h('div', { class: 'glow-card' }, h('div', { style: 'display:flex;gap:10px;margin-bottom:16px' }, [['This week', '3 h 20 min'], ['Streak', '5 days'], ['Chapters done', '7']].map(function (x) { return h('div', { class: 'stat', style: 'flex:1;padding:11px 13px' }, h('div', { class: 'l', text: x[0] }), h('div', { class: 'v', style: 'font-size:19px', text: x[1] })); })),
        [['Class 8', 70], ['Class 9', 35], ['Class 10', 12]].map(function (r) { return h('div', { style: 'margin-bottom:12px' }, h('div', { style: 'display:flex;justify-content:space-between;font-size:13px;margin-bottom:5px' }, h('span', { text: r[0] }), h('span', { style: 'color:var(--muted)', text: r[1] + '%' })), h('div', { class: 'bar' }, h('i', { style: 'width:' + r[1] + '%' }))); })); } },
  ];
  var tabsEl = document.getElementById('howTabs'), panel = document.getElementById('howPanel');
  function showHow(i) {
    [].forEach.call(tabsEl.children, function (b, k) { b.classList.toggle('on', k === i); b.setAttribute('aria-selected', k === i); });
    var x = HOW[i];
    panel.replaceChildren(h('div', null, h('div', { class: 'step-n', text: x.n }), h('h3', { text: x.title }), h('p', { text: x.text }), h('ul', { class: 'ticks' }, x.ticks.map(function (t) { return h('li', { text: t }); }))), x.mock());
  }
  if (tabsEl) { HOW.forEach(function (x, i) { tabsEl.appendChild(h('button', { class: 'tab', role: 'tab', type: 'button', text: x.tab, onclick: function () { showHow(i); } })); }); showHow(0); }

  // ------------------------------------------------------------------ features
  var ICONS = {
    flask: 'M9 3h6M10 3v6l-5 9a2 2 0 0 0 2 3h10a2 2 0 0 0 2-3l-5-9V3', book: 'M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2V5zM4 19a2 2 0 0 1 2-2h13', sigma: 'M18 5H6l7 7-7 7h12',
    bolt: 'M13 2 4 14h7l-1 8 9-12h-7l1-8z', chart: 'M4 20V10M10 20V4M16 20v-7M22 20H2', device: 'M5 4h14v12H5zM2 20h20', shield: 'M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6l8-3zM9 12l2 2 4-4', gift: 'M3 9h18v4H3zM5 13v8h14v-8M12 9v12M12 9c-3 0-4-4-1-4 2 0 1 4 1 4zm0 0c3 0 4-4 1-4-2 0-1 4-1 4z',
  };
  var FEATS = [['flask', 'Hands-on simulations', 'Every chapter is a set of labs you control, not a page to read.'], ['book', 'All 61 NCERT chapters', 'Classes 6 to 10, following the textbook chapter by chapter.'], ['sigma', 'Real formulas', 'Each result is worked out with the actual science, checked against the book.'], ['bolt', 'Instant feedback', 'Quick questions tell you at once what is right and why.'],
    ['chart', 'Progress you can see', 'Time spent, streaks and finished chapters, saved for you.'], ['device', 'Any device', 'Phone, tablet or computer. Nothing to install: just open the website.'], ['shield', 'Safe for children', 'No ads, no chat with strangers. Only the lessons.'], ['gift', 'Free to start', 'Chapter 1 of every class is free, with no card needed.']];
  var fg = document.getElementById('featGrid');
  if (fg) FEATS.forEach(function (f) {
    var ic = s('svg', { viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', 'stroke-width': 2, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }); s('path', { d: ICONS[f[0]] }, ic);
    fg.appendChild(h('div', { class: 'feat' }, h('div', { class: 'ic' }, ic), h('h4', { text: f[1] }), h('p', { text: f[2] })));
  });

  // ------------------------------------------------------------------ pricing (live from the server, so prices can be changed in the admin area)
  var box = document.getElementById('prices');
  if (box) Promise.all([BL.api('/plans'), BL.me()]).then(function (r) {
    var plans = r[0].plans, signedIn = r[1] && r[1].user;
    var span = function (d) { return d % 365 === 0 ? 'year' : d % 30 === 0 ? (d / 30) + ' months' : d + ' days'; };
    var cards = [h('div', { class: 'price' }, h('h3', { text: 'Free trial' }), h('div', { class: 'tg', text: 'Taste every class, no card needed' }),
      h('div', { class: 'amt' }, '₹0', h('small', { text: ' forever' })),
      h('ul', null, ['Chapter 1 of every class (6 to 10)', 'Every simulation in those chapters', 'Progress tracking'].map(function (t) { return h('li', { text: t }); })),
      h('a', { class: 'btn ghost', href: signedIn ? '/app' : '/register.html', text: signedIn ? 'Open the app' : 'Start free' }))];
    plans.forEach(function (p) {
      cards.push(h('div', { class: 'price' + (p.badge ? ' best' : '') }, p.badge ? h('span', { class: 'badge gold', text: p.badge }) : null, h('h3', { text: p.name }), h('div', { class: 'tg', text: p.tagline }),
        h('div', { class: 'amt' }, BL.fmtInr(p.priceInr), h('small', { text: ' / ' + span(p.durationDays) })),
        h('ul', null, p.features.map(function (t) { return h('li', { text: t }); })),
        h('a', { class: 'btn primary', href: signedIn ? '/app#/plans' : '/register.html?plan=' + encodeURIComponent(p.id), text: 'Get ' + p.name })));
    });
    box.replaceChildren.apply(box, cards);
  }, function () { box.replaceChildren(h('div', { class: 'empty', text: 'Plans could not be loaded. Please refresh the page.' })); });

  // ------------------------------------------------------------------ faq
  var FAQ = [
    ['What is Botclub Labs?', 'It is NCERT science for Classes 6 to 10, turned into interactive simulations. Instead of only reading, you change values, watch the result and check yourself with quick questions.'],
    ['Which classes and chapters are covered?', 'Classes 6, 7, 8, 9 and 10: 61 chapters in all, following the NCERT textbooks.'],
    ['What is free?', 'Chapter 1 of every class is free once you make an account. No card is needed.'],
    ['How do the plans work?', 'You pay once for a full year: either one class of your choice, or all five classes. There is no auto-renewal. When the year ends, you can renew if you want to.'],
    ['How do I pay?', 'Securely online with UPI, cards or net banking. We never see or store your card details.'],
    ['Can I get a refund?', 'Our refund rules are on the Refunds page. If something does not work for you, write to us and we will look into it.'],
    ['Which devices does it work on?', 'Any phone, tablet or computer with a modern browser. Nothing to install.'],
    ['Is my child\'s information safe?', 'We ask only for what we need (name, email, class). There are no ads and no chat. Read the Privacy page for details. Accounts should be made by a parent or guardian, or with their permission.'],
    ['Is there a version for schools?', 'Yes. Botclub Labs also comes as apps for school smart-class screens (Windows, Android and Linux). Contact us to set up your school.'],
  ];
  var fl = document.getElementById('faqList');
  if (fl) FAQ.forEach(function (q) {
    var item = h('div', { class: 'qa' }, h('button', { type: 'button', text: q[0], onclick: function () { item.classList.toggle('open'); } }), h('div', { class: 'a', text: q[1] }));
    fl.appendChild(item);
  });
})();
