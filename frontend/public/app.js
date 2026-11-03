(function () {
  'use strict';
  var $app = document.getElementById('app');
  // address of the backend API, set at deploy time in /config.js (empty = same address as this page)
  var API = String((window.SKOLAR_CONFIG && window.SKOLAR_CONFIG.apiBase) || '').replace(/\/+$/, '');
  function token() { try { return sessionStorage.getItem('sk_token'); } catch (e) { return null; } }
  function setToken(t) { try { if (t) sessionStorage.setItem('sk_token', t); else sessionStorage.removeItem('sk_token'); } catch (e) { /* private mode */ } }
  var S = { user: null, titles: {}, charts: [], schools: [], f: { preset: '30', from: '', to: '', school: '', cls: '', platform: '' }, sort: {}, q: '', status: '' };
  var COLORS = { blue: '#2f8fe0', cyan: '#5cc8ff', yellow: '#fcd303', green: '#2fbf7a', red: '#ff6b57', orange: '#ff9f43', violet: '#a78bfa' };
  var PLAT = { windows: 'Windows', android: 'Android', linux: 'Linux', other: 'Other' };

  // ------------------------------------------------------------------ tiny helpers (everything is built with textContent: no HTML from data)
  function h(tag, attrs) {
    var el = document.createElement(tag);
    if (attrs) Object.keys(attrs).forEach(function (k) {
      var v = attrs[k]; if (v == null || v === false) return;
      if (k === 'class') el.className = v; else if (k === 'text') el.textContent = v;
      else if (k.slice(0, 2) === 'on') el.addEventListener(k.slice(2), v);
      else if (k === 'style') el.style.cssText = v; else el.setAttribute(k, v === true ? '' : v);
    });
    for (var i = 2; i < arguments.length; i++) add(el, arguments[i]);
    return el;
  }
  function add(el, c) { if (c == null || c === false) return; if (Array.isArray(c)) c.forEach(function (x) { add(el, x); }); else el.appendChild(c.nodeType ? c : document.createTextNode(String(c))); }
  var ICON = {
    overview: 'M3 13h8V3H3v10zm0 8h8v-6H3v6zm10 0h8V11h-8v10zm0-18v6h8V3h-8z', schools: 'M12 3 1 9l11 6 9-4.9V17h2V9L12 3zM5 13.2v4L12 21l7-3.8v-4L12 17l-7-3.8z',
    devices: 'M4 6h16v10H4V6zm-2 12h20v2H2v-2z', chapters: 'M4 4h11a3 3 0 0 1 3 3v13H7a3 3 0 0 1-3-3V4zm2 2v11a1 1 0 0 0 1 1h9V7a1 1 0 0 0-1-1H6z', users: 'M16 11a4 4 0 1 0-4-4 4 4 0 0 0 4 4zM8 12a3 3 0 1 0-3-3 3 3 0 0 0 3 3zm8 2c-2.7 0-8 1.3-8 4v2h16v-2c0-2.7-5.3-4-8-4zM8 14c-.3 0-.6 0-1 .1C5.2 14.5 2 15.6 2 18v2h5v-2c0-1.2.5-2.3 1.4-3.1A7 7 0 0 0 8 14z' };
  function icon(n) { var s = document.createElementNS('http://www.w3.org/2000/svg', 'svg'); s.setAttribute('viewBox', '0 0 24 24'); s.setAttribute('fill', 'currentColor'); var p = document.createElementNS('http://www.w3.org/2000/svg', 'path'); p.setAttribute('d', ICON[n]); s.appendChild(p); return s; }

  function fmtHours(x) { x = Number(x) || 0; if (x < 1 && x > 0) return Math.max(1, Math.round(x * 60)) + ' min'; return (x >= 100 ? Math.round(x) : Math.round(x * 10) / 10) + ' h'; }
  function fmtInt(x) { return (Number(x) || 0).toLocaleString('en-IN'); }
  function ago(d) {
    if (!d) return 'never'; var s = Math.max(0, (Date.now() - new Date(d).getTime()) / 1000);
    if (s < 90) return 'just now'; if (s < 3600) return Math.round(s / 60) + ' min ago'; if (s < 86400) return Math.round(s / 3600) + ' h ago';
    return Math.round(s / 86400) + ' d ago';
  }
  function dstr(d) { return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); }
  function chapterName(cls, ch) { var t = S.titles && S.titles[cls] && S.titles[cls][ch]; return 'Class ' + cls + ' · Ch ' + ch + (t ? ' · ' + t : ''); }
  function toast(msg) { var t = h('div', { class: 'toast', text: msg }); document.body.appendChild(t); setTimeout(function () { t.remove(); }, 3200); }

  function api(path, opt) {
    opt = opt || {};
    var init = { method: opt.method || 'GET', headers: {} };
    if (token()) init.headers.Authorization = 'Bearer ' + token();
    if (opt.body) { init.headers['Content-Type'] = 'application/json'; init.body = JSON.stringify(opt.body); }
    return fetch(API + '/api' + path, init).then(function (r) {
      return r.json().catch(function () { return {}; }).then(function (j) {
        if (r.status === 401 && path !== '/auth/login') { setToken(null); S.user = null; renderLogin(); throw new Error('signed out'); }
        if (!r.ok) throw new Error(j.error || 'Something went wrong.');
        return j;
      });
    });
  }

  function qs(extra) {
    var f = S.f, p = new URLSearchParams(), r = range();
    p.set('from', r.from); p.set('to', r.to);
    if (f.school) p.set('school', f.school); if (f.cls) p.set('cls', f.cls); if (f.platform) p.set('platform', f.platform);
    Object.keys(extra || {}).forEach(function (k) { p.set(k, extra[k]); });
    return '?' + p.toString();
  }
  function range() {
    var f = S.f; if (f.preset === 'custom' && f.from && f.to) return { from: f.from, to: f.to };
    var n = Number(f.preset) || 30, to = new Date(), from = new Date(); from.setDate(from.getDate() - (n - 1));
    return { from: dstr(from), to: dstr(to) };
  }

  // ------------------------------------------------------------------ charts
  function killCharts() { S.charts.forEach(function (c) { try { c.destroy(); } catch (e) { /* gone */ } }); S.charts = []; }
  function chart(canvas, cfg) {
    Chart.defaults.color = 'rgba(244,248,252,.72)'; Chart.defaults.font.family = "'Poppins', system-ui, sans-serif"; Chart.defaults.font.size = 12;
    Chart.defaults.borderColor = 'rgba(255,255,255,.09)';
    cfg.options = cfg.options || {}; cfg.options.maintainAspectRatio = false; cfg.options.responsive = true;
    var c = new Chart(canvas, cfg); S.charts.push(c); return c;
  }
  function box(title, sub, body, cls) { return h('section', { class: 'panel ' + (cls || '') }, h('h2', { text: title }), sub ? h('div', { class: 'sub', text: sub }) : null, body); }
  function canvasBox(small) { var c = h('canvas'); return { wrap: h('div', { class: 'chart' + (small ? ' sm' : '') }, c), canvas: c }; }

  // ------------------------------------------------------------------ sign in
  function renderLogin(msg) {
    killCharts(); S.user = null;
    var email = h('input', { type: 'email', autocomplete: 'username', required: true, placeholder: 'you@school.org' });
    var pass = h('input', { type: 'password', autocomplete: 'current-password', required: true, placeholder: 'Password' });
    var err = h('p', { class: 'err', text: msg || '' });
    var btn = h('button', { class: 'btn', type: 'submit', text: 'Sign in' });
    var form = h('form', { onsubmit: function (e) {
      e.preventDefault(); btn.disabled = true; err.textContent = '';
      api('/auth/login', { method: 'POST', body: { email: email.value, password: pass.value } }).then(function (j) { setToken(j.token); return start(j.user); })
        .catch(function (x) { err.textContent = (x instanceof TypeError ? 'Cannot reach the server. Check the API address in config.js.' : x.message); btn.disabled = false; });
    } }, h('label', { class: 'field' }, h('span', { text: 'Email' }), email), h('label', { class: 'field' }, h('span', { text: 'Password' }), pass), btn, err);
    $app.replaceChildren(h('div', { class: 'login' }, h('div', { class: 'card' }, h('img', { src: 'logo.png', alt: '' }), h('h1', { text: 'Botclub Labs Analytics' }), h('p', { text: 'Sign in to see how the app is being used.' }), form)));
    email.focus();
  }

  // ------------------------------------------------------------------ shell + filters
  var NAV = [['#/', 'overview', 'Overview'], ['#/schools', 'schools', 'Schools'], ['#/devices', 'devices', 'Screens'], ['#/chapters', 'chapters', 'Chapters']];
  function shell(active, title, subtitle, withFilters) {
    killCharts();
    var side = h('aside', { class: 'side' },
      h('div', { class: 'brand' }, h('img', { src: 'logo.png', alt: '' }), h('div', null, h('b', { text: 'Botclub Labs' }), h('small', { text: 'Usage analytics' }))),
      h('nav', { class: 'nav' }, NAV.concat(S.user.role === 'admin' ? [['#/users', 'users', 'Logins']] : []).map(function (n) {
        return h('a', { href: n[0], class: n[1] === active ? 'on' : '', onclick: function () { side.classList.remove('open'); } }, icon(n[1]), n[2]); })),
      h('div', { class: 'me' }, h('b', { text: S.user.email }), (S.user.role === 'admin' ? 'Admin' : 'Viewer' + (S.user.schools.length ? ' · ' + S.user.schools.length + ' school(s)' : '')), h('br'),
        h('button', { class: 'btn ghost small', style: 'margin-top:8px', text: 'Sign out', onclick: function () { setToken(null); S.user = null; renderLogin(); } })));
    var main = h('main', { class: 'main' },
      h('div', { class: 'top' }, h('div', null, h('button', { class: 'btn ghost small menu', 'aria-label': 'Menu', text: '☰ Menu', style: 'margin-bottom:8px', onclick: function () { side.classList.toggle('open'); } }),
        h('h1', { text: title }), subtitle ? h('p', { text: subtitle }) : null)),
      withFilters ? filterBar(withFilters === true ? {} : withFilters) : null);
    $app.replaceChildren(h('div', { class: 'shell' }, side, main));
    return main;
  }

  function sel(options, value, onchange, label) {
    var s = h('select', { 'aria-label': label, onchange: function () { onchange(s.value); } }, options.map(function (o) { return h('option', { value: o[0], text: o[1] }); }));
    s.value = value; return s;
  }
  function filterBar(opt) {
    opt = opt || {};
    var f = S.f;
    function set(k, v) { f[k] = v; route(); }
    var seg = h('div', { class: 'seg' }, [['7', '7 days'], ['30', '30 days'], ['90', '90 days'], ['custom', 'Custom']].map(function (p) {
      return h('button', { class: f.preset === p[0] ? 'on' : '', text: p[1], onclick: function () { if (p[0] === 'custom') { var r = range(); f.from = f.from || r.from; f.to = f.to || r.to; } f.preset = p[0]; route(); } }); }));
    var bar = h('div', { class: 'bar' }, seg);
    if (f.preset === 'custom') {
      bar.appendChild(h('input', { type: 'date', value: f.from, 'aria-label': 'From', onchange: function (e) { f.from = e.target.value; route(); } }));
      bar.appendChild(h('input', { type: 'date', value: f.to, 'aria-label': 'To', onchange: function (e) { f.to = e.target.value; route(); } }));
    }
    if (!opt.noSchool) bar.appendChild(sel([['', 'All schools']].concat(S.schools.map(function (s) { return [s, s]; })), f.school, function (v) { set('school', v); }, 'School'));
    bar.appendChild(sel([['', 'All classes'], ['6', 'Class 6'], ['7', 'Class 7'], ['8', 'Class 8'], ['9', 'Class 9'], ['10', 'Class 10']], f.cls, function (v) { set('cls', v); }, 'Class'));
    bar.appendChild(sel([['', 'All platforms'], ['windows', 'Windows'], ['android', 'Android'], ['linux', 'Linux']], f.platform, function (v) { set('platform', v); }, 'Platform'));
    bar.appendChild(h('span', { class: 'grow' }));
    bar.appendChild(h('button', { class: 'btn ghost small', text: '⬇ Export CSV', onclick: function (e) {
      var b = e.currentTarget; b.disabled = true;
      fetch(API + '/api/export.csv' + qs(opt.school ? { school: opt.school } : {}), { headers: { Authorization: 'Bearer ' + token() } })
        .then(function (r) { if (!r.ok) throw new Error('Export failed.'); return r.blob(); })
        .then(function (blob) { var a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'botclub-usage.csv'; document.body.appendChild(a); a.click(); a.remove(); setTimeout(function () { URL.revokeObjectURL(a.href); }, 2000); })
        .catch(function (x) { toast(x.message); }).then(function () { b.disabled = false; }); } }));
    return bar;
  }
  function loading(main) { main.appendChild(h('div', { class: 'loading', text: 'Loading…' })); }
  function failed(main, e) { if (e.message === 'signed out') return; main.querySelector('.loading') && main.querySelector('.loading').remove(); main.appendChild(h('div', { class: 'panel empty', text: e.message })); }

  function kpi(label, value, sub, color, unit) {
    return h('div', { class: 'kpi', style: '--c:' + (color || COLORS.cyan) }, h('div', { class: 'l', text: label }), h('div', { class: 'v' }, value, unit ? h('small', { text: unit }) : null), sub ? h('div', { class: 's', text: sub }) : null);
  }

  function table(cols, rows, key) {
    var st = S.sort[key] || {}, data = rows.slice();
    if (st.k != null) { var c = cols[st.k]; data.sort(function (a, b) { var x = c.v(a), y = c.v(b); x = x == null ? -Infinity : x; y = y == null ? -Infinity : y; return (x < y ? -1 : x > y ? 1 : 0) * (st.d || 1); }); }
    var head = h('tr', null, cols.map(function (c, i) {
      return h('th', { class: (c.num ? 'num ' : '') + (c.sort === false ? '' : 'sort'), text: c.h + (st.k === i ? (st.d === 1 ? ' ▲' : ' ▼') : ''), onclick: c.sort === false ? null : function () {
        S.sort[key] = { k: i, d: st.k === i ? -st.d : (c.num ? -1 : 1) }; route(); } }); }));
    var body = data.length ? data.map(function (r) { return h('tr', null, cols.map(function (c) { return h('td', { class: (c.num ? 'num ' : '') + (c.wrap ? 'wrap' : '') }, c.r(r)); })); })
      : [h('tr', null, h('td', { colspan: cols.length, class: 'empty', text: 'Nothing to show for these filters.' }))];
    return h('div', { class: 'tw' }, h('table', null, h('thead', null, head), h('tbody', null, body)));
  }
  function pill(status) { return h('span', { class: 'pill ' + status }, status === 'online' ? h('span', { class: 'dot' }) : null, status); }
  function meter(v, max) { return h('span', { class: 'meter' }, h('i', { style: 'width:' + Math.min(100, max ? (v / max) * 100 : 0) + '%' })); }

  // ------------------------------------------------------------------ views
  function viewOverview() {
    var main = shell('overview', 'Overview', 'How the Botclub Labs app is being used', true); loading(main);
    api('/overview' + qs()).then(function (d) {
      main.querySelector('.loading').remove(); var k = d.kpis || {};
      main.appendChild(h('div', { class: 'kpis' },
        kpi('Total active time', fmtInt(Math.round(k.totalHours || 0)), 'dashboard + lessons', COLORS.blue, 'hours'),
        kpi('Lesson time', fmtInt(Math.round(k.lessonHours || 0)), 'time inside chapters', COLORS.cyan, 'hours'),
        kpi('Active screens', fmtInt(k.activeDevices), 'of ' + fmtInt(k.registeredDevices) + ' registered', COLORS.green),
        kpi('Schools using it', fmtInt(k.activeSchools), 'in this period', COLORS.violet),
        kpi('Learning sessions', fmtInt(k.sessions), 'a class was picked', COLORS.yellow),
        kpi('Online now', fmtInt(k.onlineNow), 'synced in the last 15 min', COLORS.green),
        kpi('Avg per screen per day', String(k.avgMinutesPerActiveDevicePerDay || 0), 'active minutes', COLORS.orange, 'min'),
        kpi('Access ending soon', fmtInt(k.expiringSoon), 'within 30 days', COLORS.red)));

      var c1 = canvasBox();
      main.appendChild(h('div', { class: 'grid g2' }, box('Daily usage', 'Hours of lesson time (area) and number of screens in use (line)', c1.wrap),
        (function () { var c = canvasBox(true); var p = box('Class split', 'Lesson hours per class', c.wrap);
          chart(c.canvas, { type: 'bar', data: { labels: d.byClass.map(function (x) { return 'Class ' + x.cls; }), datasets: [{ label: 'Hours', data: d.byClass.map(function (x) { return x.hours; }), backgroundColor: [COLORS.blue, COLORS.cyan, COLORS.green, COLORS.yellow, COLORS.orange], borderRadius: 8 }] },
            options: { plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true } } } }); return p; })()));
      chart(c1.canvas, { type: 'line', data: { labels: d.daily.map(function (x) { return x.date.slice(5); }), datasets: [
        { label: 'Lesson hours', data: d.daily.map(function (x) { return x.lessonHours; }), borderColor: COLORS.cyan, backgroundColor: 'rgba(92,200,255,.18)', fill: true, tension: .3, pointRadius: 0, yAxisID: 'y' },
        { label: 'Screens in use', data: d.daily.map(function (x) { return x.devices; }), borderColor: COLORS.yellow, tension: .3, pointRadius: 0, borderDash: [5, 4], yAxisID: 'y1' }] },
        options: { interaction: { mode: 'index', intersect: false }, scales: { y: { beginAtZero: true, title: { display: true, text: 'hours' } }, y1: { beginAtZero: true, position: 'right', grid: { drawOnChartArea: false }, title: { display: true, text: 'screens' } },
          x: { ticks: { maxTicksLimit: 12 } } } } });

      var c2 = canvasBox(true), c3 = canvasBox(true);
      main.appendChild(h('div', { class: 'grid g11' },
        box('Most-used chapters', 'Top 10 by time in this period', d.topChapters.length ? c2.wrap : h('div', { class: 'empty', text: 'No lesson time yet.' })),
        box('Platforms', 'Share of active time', d.byPlatform.length ? c3.wrap : h('div', { class: 'empty', text: 'No data yet.' }))));
      if (d.topChapters.length) chart(c2.canvas, { type: 'bar', data: { labels: d.topChapters.map(function (x) { return 'C' + x.cls + ' · Ch ' + x.chapter; }), datasets: [{ label: 'Hours', data: d.topChapters.map(function (x) { return x.hours; }), backgroundColor: COLORS.blue, borderRadius: 6 }] },
        options: { indexAxis: 'y', plugins: { legend: { display: false }, tooltip: { callbacks: { title: function (i) { var x = d.topChapters[i[0].dataIndex]; return chapterName(x.cls, x.chapter); } } } }, scales: { x: { beginAtZero: true } } } });
      if (d.byPlatform.length) chart(c3.canvas, { type: 'doughnut', data: { labels: d.byPlatform.map(function (x) { return PLAT[x.platform] || x.platform; }), datasets: [{ data: d.byPlatform.map(function (x) { return x.hours; }), backgroundColor: [COLORS.blue, COLORS.green, COLORS.yellow, COLORS.violet], borderWidth: 0 }] },
        options: { cutout: '62%', plugins: { legend: { position: 'bottom' } } } });

      var max = d.bySchool.length ? d.bySchool[0].hours : 1;
      main.appendChild(box('Top schools', 'By active time in this period', table([
        { h: 'School', v: function (r) { return r.school; }, r: function (r) { return h('button', { class: 'link', text: r.school, onclick: function () { location.hash = '#/school/' + encodeURIComponent(r.school); } }); } },
        { h: 'Screens active', num: true, v: function (r) { return r.devices; }, r: function (r) { return fmtInt(r.devices); } },
        { h: 'Active time', num: true, v: function (r) { return r.hours; }, r: function (r) { return [fmtHours(r.hours), meter(r.hours, max)]; } }], d.bySchool, 'ov-schools')));
    }).catch(function (e) { failed(main, e); });
  }

  function viewSchools() {
    var main = shell('schools', 'Schools', 'Every school with at least one registered screen', true); loading(main);
    api('/schools' + qs()).then(function (d) {
      main.querySelector('.loading').remove(); var max = d.schools.reduce(function (m, s) { return Math.max(m, s.hours); }, 1);
      main.appendChild(box('Schools', fmtInt(d.schools.length) + ' schools · ' + d.range.from + ' to ' + d.range.to, table([
        { h: 'School', v: function (r) { return r.school; }, wrap: true, r: function (r) { return h('button', { class: 'link', text: r.school, onclick: function () { location.hash = '#/school/' + encodeURIComponent(r.school); } }); } },
        { h: 'Screens', num: true, v: function (r) { return r.devices; }, r: function (r) { return fmtInt(r.devices) + (r.online ? ' (' + r.online + ' online)' : ''); } },
        { h: 'Platforms', v: function (r) { return r.platforms.join(); }, r: function (r) { return r.platforms.map(function (p) { return PLAT[p] || p; }).join(', '); } },
        { h: 'Active time', num: true, v: function (r) { return r.hours; }, r: function (r) { return [fmtHours(r.hours), meter(r.hours, max)]; } },
        { h: 'Lesson time', num: true, v: function (r) { return r.lessonHours; }, r: function (r) { return fmtHours(r.lessonHours); } },
        { h: 'Screens used', num: true, v: function (r) { return r.activeDevices; }, r: function (r) { return fmtInt(r.activeDevices) + ' / ' + fmtInt(r.devices); } },
        { h: 'Last seen', v: function (r) { return r.lastSeen ? new Date(r.lastSeen).getTime() : 0; }, r: function (r) { return ago(r.lastSeen); } },
        { h: 'Access ends', v: function (r) { return r.expiry || ''; }, r: function (r) { return r.expiry || '—'; } }], d.schools, 'schools')));
    }).catch(function (e) { failed(main, e); });
  }

  function viewSchool(name) {
    var main = shell('schools', name, 'All screens of this school added together', { noSchool: true, school: name }); loading(main);
    api('/schools/' + encodeURIComponent(name) + qs({ school: name })).then(function (d) {
      main.querySelector('.loading').remove(); var k = d.kpis;
      main.insertBefore(h('div', { class: 'back' }, h('a', { href: '#/schools', text: '← All schools' })), main.querySelector('.top'));
      main.querySelector('h1').textContent = d.school;
      main.appendChild(h('div', { class: 'kpis' },
        kpi('Total active time', fmtHours(k.totalHours), 'all screens added together', COLORS.blue),
        kpi('Lesson time', fmtHours(k.lessonHours), 'inside chapters', COLORS.cyan),
        kpi('Screens', fmtInt(k.activeScreens) + ' / ' + fmtInt(k.screens), 'used in this period / registered', COLORS.green),
        kpi('Online now', fmtInt(k.onlineNow), 'synced in the last 15 min', COLORS.green),
        kpi('Learning sessions', fmtInt(k.sessions), 'a class was picked', COLORS.yellow),
        kpi('Days used', fmtInt(k.activeDays), k.firstActive ? k.firstActive + ' → ' + k.lastActive : 'no activity', COLORS.violet),
        kpi('Avg per screen per day', String(k.avgMinutesPerScreenPerDay), 'active minutes', COLORS.orange, 'min'),
        kpi('Access ends', k.accessEnds || '—', 'latest end date of its screens', COLORS.red)));

      // curriculum progress: one bar per class for the WHOLE school
      var used = d.byClass.reduce(function (a, c) { return a + c.chaptersUsed; }, 0), total = d.byClass.reduce(function (a, c) { return a + c.chaptersTotal; }, 0);
      var bars = d.byClass.map(function (c) {
        var pc = c.chaptersTotal ? Math.round((c.chaptersUsed / c.chaptersTotal) * 100) : 0;
        return h('div', { class: 'prog' }, h('div', { class: 'pl', text: 'Class ' + c.cls }),
          h('div', { class: 'pt', title: pc + '%' }, h('i', { style: 'width:' + pc + '%' })),
          h('div', { class: 'pv' }, h('b', { text: c.chaptersUsed + ' / ' + c.chaptersTotal }), ' chapters'),
          h('div', { class: 'pm', text: fmtHours(c.hours) + ' · ' + fmtInt(c.sessions) + ' sessions' }));
      });
      main.appendChild(box('Curriculum progress', 'Chapters this school has opened at least once (all time): ' + used + ' of ' + total + ' (' + (total ? Math.round(used / total * 100) : 0) + '%). Time and sessions are for the period above.', h('div', { class: 'progs' }, bars)));

      var c1 = canvasBox();
      main.appendChild(box('Daily usage', 'Hours of lesson time (area) and screens in use (line), all screens combined', c1.wrap));
      chart(c1.canvas, { type: 'line', data: { labels: d.daily.map(function (x) { return x.date.slice(5); }), datasets: [
        { label: 'Lesson hours', data: d.daily.map(function (x) { return x.lessonHours; }), borderColor: COLORS.cyan, backgroundColor: 'rgba(92,200,255,.18)', fill: true, tension: .3, pointRadius: 0, yAxisID: 'y' },
        { label: 'Screens in use', data: d.daily.map(function (x) { return x.screens; }), borderColor: COLORS.yellow, tension: .3, pointRadius: 0, borderDash: [5, 4], yAxisID: 'y1' }] },
        options: { interaction: { mode: 'index', intersect: false }, scales: { y: { beginAtZero: true, title: { display: true, text: 'hours' } }, y1: { beginAtZero: true, position: 'right', grid: { drawOnChartArea: false }, ticks: { precision: 0 }, title: { display: true, text: 'screens' } }, x: { ticks: { maxTicksLimit: 12 } } } } });

      var maxCh = d.chapters.reduce(function (m, x) { return Math.max(m, x.hours); }, 1);
      main.appendChild(box('Chapters used by this school', 'Time in this period, all screens combined', table([
        { h: 'Chapter', v: function (r) { return r.cls * 100 + r.chapter; }, wrap: true, r: function (r) { return chapterName(r.cls, r.chapter); } },
        { h: 'Time', num: true, v: function (r) { return r.hours; }, r: function (r) { return [fmtHours(r.hours), meter(r.hours, maxCh)]; } },
        { h: 'Screens', num: true, v: function (r) { return r.screens; }, r: function (r) { return fmtInt(r.screens); } },
        { h: 'Opens (all time)', num: true, v: function (r) { return r.opens; }, r: function (r) { return fmtInt(r.opens); } }], d.chapters, 'sch-ch')));

      main.appendChild(box('Screens in this school', fmtInt(d.screens.length) + ' screens. Their numbers are already included above.', table([
        { h: 'Screen', v: function (r) { return r.label || r.id; }, wrap: true, r: function (r) { return h('a', { href: '#/device/' + r.id, text: r.label || 'Screen' }); } },
        { h: 'Platform', v: function (r) { return r.platform; }, r: function (r) { return PLAT[r.platform] || r.platform; } },
        { h: 'Status', v: function (r) { return r.status; }, r: function (r) { return pill(r.status); } },
        { h: 'Active time', num: true, v: function (r) { return r.hours; }, r: function (r) { return fmtHours(r.hours); } },
        { h: 'Days used', num: true, v: function (r) { return r.activeDays; }, r: function (r) { return fmtInt(r.activeDays); } },
        { h: 'Last seen', v: function (r) { return r.lastSeen ? new Date(r.lastSeen).getTime() : 0; }, r: function (r) { return ago(r.lastSeen); } },
        { h: 'Access ends', v: function (r) { return r.expiry || ''; }, r: function (r) { return r.expiry || '—'; } }], d.screens, 'sch-sc')));
    }).catch(function (e) { failed(main, e); });
  }

  function viewDevices() {
    var main = shell('devices', 'Screens', 'Every installed screen, phone or PC', true); loading(main);
    api('/devices' + qs()).then(function (d) {
      main.querySelector('.loading').remove();
      var search = h('input', { type: 'search', placeholder: 'Search school or screen…', value: S.q, 'aria-label': 'Search', style: 'max-width:280px;padding:9px 12px;border-radius:11px;border:1px solid rgba(255,255,255,.28);background:rgba(255,255,255,.09)',
        oninput: function () { S.q = search.value; draw(); } });
      var st = sel([['', 'Any status'], ['online', 'Online'], ['offline', 'Offline'], ['expired', 'Expired'], ['revoked', 'Revoked']], S.status, function (v) { S.status = v; draw(); }, 'Status');
      var holder = h('div'), title = h('div', { class: 'sub' });
      function draw() {
        var q = S.q.trim().toLowerCase();
        var rows = d.devices.filter(function (x) { return (!S.status || x.status === S.status) && (!q || (x.school + ' ' + x.label).toLowerCase().indexOf(q) >= 0); });
        title.textContent = fmtInt(rows.length) + ' of ' + fmtInt(d.devices.length) + ' screens · ' + d.range.from + ' to ' + d.range.to;
        holder.replaceChildren(table([
          { h: 'Screen', v: function (r) { return r.label || r.id; }, wrap: true, r: function (r) { return h('a', { href: '#/device/' + r.id, text: (r.label || 'Screen') + (r.kind === 'classroom' && r.classes[0] && String(r.label).indexOf(String(r.classes[0])) < 0 ? ' (Class ' + r.classes[0] + (r.section ? r.section : '') + ')' : '') }); } },
          { h: 'School', v: function (r) { return r.school; }, wrap: true, r: function (r) { return h('a', { href: '#/school/' + encodeURIComponent(r.school), text: r.school }); } },
          { h: 'Platform', v: function (r) { return r.platform; }, r: function (r) { return PLAT[r.platform] || r.platform; } },
          { h: 'Status', v: function (r) { return r.status; }, r: function (r) { return pill(r.status); } },
          { h: 'Active time', num: true, v: function (r) { return r.hours; }, r: function (r) { return fmtHours(r.hours); } },
          { h: 'Lesson time', num: true, v: function (r) { return r.lessonHours; }, r: function (r) { return fmtHours(r.lessonHours); } },
          { h: 'Days used', num: true, v: function (r) { return r.activeDays; }, r: function (r) { return fmtInt(r.activeDays); } },
          { h: 'Last seen', v: function (r) { return r.lastSeen ? new Date(r.lastSeen).getTime() : 0; }, r: function (r) { return ago(r.lastSeen); } },
          { h: 'Access ends', v: function (r) { return r.expiry || ''; }, r: function (r) { return r.expiry || '—'; } }], rows, 'devices'));
      }
      main.appendChild(h('section', { class: 'panel' }, h('div', { class: 'bar', style: 'margin-bottom:12px;background:none;border:none;padding:0' }, search, st), title, holder)); draw();
    }).catch(function (e) { failed(main, e); });
  }

  function viewDevice(id) {
    var main = shell('devices', 'Screen', '', true); loading(main);
    api('/devices/' + encodeURIComponent(id) + qs()).then(function (d) {
      main.querySelector('.loading').remove(); var dv = d.device;
      main.querySelector('h1').textContent = (dv.label || 'Screen') + ' · ' + dv.school;
      main.querySelector('.top p, .top div p') || main.querySelector('.top > div').appendChild(h('p', { text: (PLAT[dv.platform] || dv.platform) + ' · app ' + (dv.appVersion || '?') + ' · registered ' + new Date(dv.registeredAt).toLocaleDateString() }));
      main.insertBefore(h('div', { class: 'back' }, h('a', { href: '#/school/' + encodeURIComponent(dv.school), text: '← ' + dv.school }), '  ·  ', h('a', { href: '#/devices', text: 'All screens' })), main.querySelector('.top'));
      var acts = [];
      if (S.user.role === 'admin') {
        acts.push(h('button', { class: 'btn ghost small', text: dv.status === 'revoked' ? 'Allow again' : 'Block this screen', onclick: function () {
          api('/devices/' + encodeURIComponent(dv.id) + '/revoke', { method: 'POST', body: { revoked: dv.status !== 'revoked' } }).then(function () { toast('Done'); route(); }).catch(function (e) { toast(e.message); }); } }));
        acts.push(h('button', { class: 'btn danger small', text: 'Delete screen + data', onclick: function () {
          if (!confirm('Delete this screen and ALL its usage records? This cannot be undone.')) return;
          api('/devices/' + encodeURIComponent(dv.id), { method: 'DELETE' }).then(function () { toast('Deleted'); location.hash = '#/devices'; }).catch(function (e) { toast(e.message); }); } }));
      }
      main.appendChild(h('div', { class: 'kpis' },
        kpi('Status', pill(dv.status), 'last seen ' + ago(dv.lastSeen), COLORS.green),
        kpi('Active time (period)', fmtHours(d.daily.reduce(function (a, x) { return a + x.hours; }, 0)), d.range.from + ' → ' + d.range.to, COLORS.blue),
        kpi('Lesson time (period)', fmtHours(d.daily.reduce(function (a, x) { return a + x.lessonHours; }, 0)), null, COLORS.cyan),
        kpi('All-time lessons', fmtHours(d.allTime.hours), fmtInt(d.allTime.opens) + ' chapter opens · ' + d.allTime.chapters + ' chapters', COLORS.violet),
        kpi('Access ends', dv.expiry || '—', dv.kind === 'classroom' ? 'One class: ' + (dv.classes[0] || '') + (dv.section || '') : 'Classes ' + (dv.classes || []).join(', '), COLORS.orange)));
      if (acts.length) main.appendChild(h('div', { class: 'bar' }, acts));
      var c = canvasBox();
      main.appendChild(box('Daily usage', 'Hours per day', c.wrap));
      chart(c.canvas, { type: 'bar', data: { labels: d.daily.map(function (x) { return x.date.slice(5); }), datasets: [
        { label: 'Lesson hours', data: d.daily.map(function (x) { return x.lessonHours; }), backgroundColor: COLORS.cyan, borderRadius: 4, stack: 's' },
        { label: 'Other (dashboard)', data: d.daily.map(function (x) { return Math.max(0, Math.round((x.hours - x.lessonHours) * 100) / 100); }), backgroundColor: 'rgba(255,255,255,.28)', borderRadius: 4, stack: 's' }] },
        options: { scales: { x: { stacked: true, ticks: { maxTicksLimit: 14 } }, y: { stacked: true, beginAtZero: true } }, interaction: { mode: 'index', intersect: false } } });
      main.appendChild(h('div', { class: 'grid g11' },
        box('Chapters used', 'Time in this period', table([
          { h: 'Chapter', v: function (r) { return r.cls * 100 + r.chapter; }, wrap: true, r: function (r) { return chapterName(r.cls, r.chapter); } },
          { h: 'Time', num: true, v: function (r) { return r.hours; }, r: function (r) { return fmtHours(r.hours); } },
          { h: 'Opens (all time)', num: true, v: function (r) { return r.opens; }, r: function (r) { return fmtInt(r.opens); } }], d.topChapters, 'dev-ch')),
        box('Recent sessions', 'Each time a class was picked', table([
          { h: 'Started', v: function (r) { return r.start; }, r: function (r) { return new Date(r.start).toLocaleString(); } },
          { h: 'Class', v: function (r) { return r.cls; }, r: function (r) { return 'Class ' + r.cls + (r.section ? ' ' + r.section : ''); } },
          { h: 'Minutes', num: true, v: function (r) { return r.minutes; }, r: function (r) { return String(r.minutes); } }], d.sessions, 'dev-se'))));
    }).catch(function (e) { failed(main, e); });
  }

  function viewChapters() {
    var main = shell('chapters', 'Chapters', 'Which lessons get used the most', true); loading(main);
    api('/chapters' + qs()).then(function (d) {
      main.querySelector('.loading').remove(); var top = d.chapters.slice(0, 15), max = d.chapters.reduce(function (m, s) { return Math.max(m, s.hours); }, 1);
      if (top.length) { var c = canvasBox(); main.appendChild(box('Top 15 chapters', 'Hours of use in this period', c.wrap));
        chart(c.canvas, { type: 'bar', data: { labels: top.map(function (x) { return 'C' + x.cls + ' · Ch ' + x.chapter; }), datasets: [{ label: 'Hours', data: top.map(function (x) { return x.hours; }), backgroundColor: COLORS.blue, borderRadius: 6 }] },
          options: { plugins: { legend: { display: false }, tooltip: { callbacks: { title: function (i) { var x = top[i[0].dataIndex]; return chapterName(x.cls, x.chapter); } } } }, scales: { y: { beginAtZero: true } } } }); }
      main.appendChild(box('All chapters', fmtInt(d.chapters.length) + ' chapters used · ' + d.range.from + ' to ' + d.range.to, table([
        { h: 'Chapter', v: function (r) { return r.cls * 100 + r.chapter; }, wrap: true, r: function (r) { return chapterName(r.cls, r.chapter); } },
        { h: 'Time', num: true, v: function (r) { return r.hours; }, r: function (r) { return [fmtHours(r.hours), meter(r.hours, max)]; } },
        { h: 'Screens', num: true, v: function (r) { return r.devices; }, r: function (r) { return fmtInt(r.devices); } },
        { h: 'Schools', num: true, v: function (r) { return r.schools; }, r: function (r) { return fmtInt(r.schools); } },
        { h: 'Avg min / screen', num: true, v: function (r) { return r.avgMinutesPerDevice; }, r: function (r) { return String(r.avgMinutesPerDevice); } },
        { h: 'Opens (all time)', num: true, v: function (r) { return r.opensAllTime; }, r: function (r) { return fmtInt(r.opensAllTime); } }], d.chapters, 'chapters')));
    }).catch(function (e) { failed(main, e); });
  }

  function viewUsers() {
    if (S.user.role !== 'admin') { location.hash = '#/'; return; }
    var main = shell('users', 'Logins', 'Who can open this dashboard', false); loading(main);
    api('/users').then(function (d) {
      main.querySelector('.loading').remove();
      var email = h('input', { type: 'email', required: true, placeholder: 'name@school.org' }), pw = h('input', { type: 'password', required: true, minlength: '10', placeholder: 'At least 10 characters', autocomplete: 'new-password' });
      var role = sel([['viewer', 'Viewer (read only)'], ['admin', 'Admin']], 'viewer', function () {}, 'Role');
      var schools = h('input', { type: 'text', placeholder: 'Only these schools (optional, comma separated)' }), err = h('p', { class: 'err' });
      var form = h('form', { onsubmit: function (e) {
        e.preventDefault(); err.textContent = '';
        api('/users', { method: 'POST', body: { email: email.value, password: pw.value, role: role.value, schools: schools.value.split(',').map(function (s) { return s.trim(); }).filter(Boolean) } })
          .then(function () { toast('Login created'); route(); }).catch(function (x) { err.textContent = x.message; }); } },
        h('div', { class: 'forms' }, h('label', { class: 'field' }, h('span', { text: 'Email' }), email), h('label', { class: 'field' }, h('span', { text: 'Password' }), pw),
          h('label', { class: 'field' }, h('span', { text: 'Role' }), role), h('label', { class: 'field' }, h('span', { text: 'Schools' }), schools), h('button', { class: 'btn', type: 'submit', text: 'Add login' })), err);
      main.appendChild(box('Add a login', 'Viewers can see the numbers but cannot change anything. A viewer limited to schools only sees those schools.', form));
      main.appendChild(box('Existing logins', null, table([
        { h: 'Email', v: function (r) { return r.email; }, r: function (r) { return r.email; } },
        { h: 'Role', v: function (r) { return r.role; }, r: function (r) { return r.role; } },
        { h: 'Schools', v: function (r) { return r.schools.join(); }, wrap: true, r: function (r) { return r.schools.length ? r.schools.join(', ') : 'all'; } },
        { h: 'Created', v: function (r) { return r.createdAt; }, r: function (r) { return new Date(r.createdAt).toLocaleDateString(); } },
        { h: '', sort: false, v: function () { return ''; }, r: function (r) { return r.email === S.user.email ? '(you)' : h('button', { class: 'btn danger small', text: 'Delete', onclick: function () {
          if (!confirm('Delete the login ' + r.email + '?')) return;
          api('/users/' + encodeURIComponent(r.email), { method: 'DELETE' }).then(function () { toast('Deleted'); route(); }).catch(function (e) { toast(e.message); }); } }); } }], d.users, 'users')));
    }).catch(function (e) { failed(main, e); });
  }

  // ------------------------------------------------------------------ router
  function route() {
    if (!S.user) return renderLogin();
    var hash = location.hash || '#/', m = /^#\/device\/([0-9a-f-]{36})$/.exec(hash);
    if (m) return viewDevice(m[1]);
    var sm = /^#\/school\/(.+)$/.exec(hash);
    if (sm) { var nm; try { nm = decodeURIComponent(sm[1]); } catch (e) { nm = ''; } if (nm) return viewSchool(nm); }
    ({ '#/': viewOverview, '#/schools': viewSchools, '#/devices': viewDevices, '#/chapters': viewChapters, '#/users': viewUsers }[hash] || viewOverview)();
  }
  window.addEventListener('hashchange', function () { if (S.user) route(); });

  function start(user) {
    S.user = user;
    return api('/schools?from=2000-01-01&to=2100-01-01').then(function (s) { S.schools = s.schools.map(function (x) { return x.school; }); }).catch(function () {}).then(route);
  }

  if (!token()) { fetch('/titles.json').then(function (r) { return r.ok ? r.json() : {}; }).catch(function () { return {}; }).then(function (t) { S.titles = t; renderLogin(); }); return; }

  fetch('/titles.json').then(function (r) { return r.ok ? r.json() : {}; }).catch(function () { return {}; }).then(function (t) { S.titles = t; return api('/auth/me'); })
    .then(function (j) { return start(j.user); }).catch(function () { renderLogin(); });
})();
