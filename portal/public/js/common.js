/* Shared by every page: the API helper, the top bar, the footer and small helpers. No inline scripts anywhere (the site's security policy forbids them). */
(function () {
  'use strict';
  var BL = window.BL = {};

  BL.api = function (path, opt) {
    opt = opt || {};
    var init = { method: opt.method || 'GET', credentials: 'same-origin', headers: { 'X-Requested-With': 'botclub' } };
    if (opt.body !== undefined) { init.headers['Content-Type'] = 'application/json'; init.body = JSON.stringify(opt.body); }
    return fetch('/api' + path, init).then(function (r) {
      return r.json().catch(function () { return {}; }).then(function (j) {
        if (!r.ok) { var e = new Error(j.error || 'Something went wrong. Please try again.'); e.status = r.status; throw e; }
        return j;
      });
    });
  };

  BL.h = function (tag, attrs) {
    var el = document.createElement(tag);
    if (attrs) Object.keys(attrs).forEach(function (k) {
      var v = attrs[k]; if (v == null || v === false) return;
      if (k === 'class') el.className = v; else if (k === 'text') el.textContent = v;
      else if (k.slice(0, 2) === 'on') el.addEventListener(k.slice(2), v);
      else el.setAttribute(k, v === true ? '' : v);
    });
    for (var i = 2; i < arguments.length; i++) add(el, arguments[i]);
    return el;
  };
  function add(el, c) { if (c == null || c === false) return; if (Array.isArray(c)) c.forEach(function (x) { add(el, x); }); else el.appendChild(c.nodeType ? c : document.createTextNode(String(c))); }

  BL.toast = function (msg) { var t = BL.h('div', { class: 'toast', text: msg }); document.body.appendChild(t); setTimeout(function () { t.remove(); }, 3600); };
  BL.fmtInr = function (n) { return '₹' + Number(n).toLocaleString('en-IN'); };
  BL.fmtTime = function (sec) { sec = Math.round(sec || 0); if (sec < 60) return sec + ' s'; if (sec < 3600) return Math.round(sec / 60) + ' min'; return (Math.round(sec / 360) / 10) + ' h'; };
  BL.fmtDate = function (d) { return d ? new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'; };
  BL.me = function () { return BL._me || (BL._me = BL.api('/me').then(function (j) { return j; }, function () { return null; })); };

  /** the top bar. `active` highlights a link on the landing page. */
  BL.nav = function (mount, opts) {
    opts = opts || {};
    var links = opts.landing ? [['#how', 'How it works'], ['#features', 'Features'], ['#try', 'Try it'], ['#pricing', 'Pricing'], ['#faq', 'FAQ']] : [];
    var linkBox = BL.h('div', { class: 'links' }, links.map(function (l) { return BL.h('a', { href: (opts.landing ? '' : '/') + l[0], text: l[1], onclick: function () { linkBox.classList.remove('open'); } }); }));
    var right = BL.h('span', { class: 'sp' });
    var login = BL.h('a', { class: 'login', href: '/login.html', text: 'Log in' });
    var sign = BL.h('a', { class: 'btn primary', href: '/register.html', text: 'Sign up' });
    var bar = BL.h('div', { class: 'nav' }, BL.h('div', { class: 'wrap' },
      BL.h('a', { class: 'brand', href: '/' }, BL.h('img', { src: '/assets/logo.png', alt: '' }), BL.h('b', { text: 'Botclub Labs' })),
      linkBox, right, login, sign,
      BL.h('button', { class: 'menu-btn', 'aria-label': 'Menu', text: '☰', onclick: function () { linkBox.classList.toggle('open'); } })));
    mount.replaceWith(bar);
    BL.me().then(function (m) {
      if (!m || !m.user) return;
      login.textContent = m.user.name.split(' ')[0]; login.href = '/app';
      sign.textContent = m.user.role === 'admin' ? 'Admin' : 'Open app'; sign.href = m.user.role === 'admin' ? '/admin' : '/app';
    });
  };

  BL.footer = function (mount) {
    mount.replaceWith(BL.h('footer', null, BL.h('div', { class: 'wrap' },
      BL.h('div', null, BL.h('b', { text: 'Botclub Labs' }), BL.h('div', { text: 'NCERT science, as hands-on simulations. Classes 6 to 10.' })),
      BL.h('nav', null, BL.h('a', { href: '/privacy.html', text: 'Privacy' }), BL.h('a', { href: '/terms.html', text: 'Terms' }), BL.h('a', { href: '/refund.html', text: 'Refunds' })),
      BL.h('div', { text: '© ' + new Date().getFullYear() + ' Botclub Labs' }))));
  };

  /** which element (if any) is the page's mount point */
  document.addEventListener('DOMContentLoaded', function () {
    var n = document.getElementById('nav'); if (n) BL.nav(n, { landing: n.dataset.landing === '1' });
    var f = document.getElementById('foot'); if (f) BL.footer(f);
  });
})();
