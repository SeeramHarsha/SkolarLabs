/* The student's app: home, class and chapter lists, plans and checkout, profile. Hash routes: #/ #/class/8 #/plans #/profile */
(function () {
  'use strict';
  var h = BL.h, view = document.getElementById('view');
  var S = { me: null, cat: null, plans: null, cfg: null };

  function render(a) { view.replaceChildren.apply(view, a.filter(Boolean)); }
  function go(hash) { if (location.hash === hash) route(); else location.hash = hash; }
  function fail(e) { view.replaceChildren(h('div', { class: 'empty', text: e.message || 'Something went wrong.' })); }

  function load(force) {
    return Promise.all([BL.api('/me'), BL.api('/catalog'), BL.api('/config'), BL.api('/plans')]).then(function (r) {
      S.me = r[0]; S.cat = r[1]; S.cfg = r[2]; S.plans = r[3].plans;
    });
  }

  function head(active, title, sub) {
    var tabs = [['#/', 'Home'], ['#/plans', 'Plans'], ['#/profile', 'Profile']];
    return [
      h('div', { class: 'app-top' }, h('div', null, h('h1', { text: title }), sub ? h('div', { class: 'micro', text: sub }) : null)),
      h('div', { class: 'subnav' }, tabs.map(function (t) { return h('a', { href: t[0], class: t[0] === active ? 'on' : '', text: t[1] }); }),
        S.me.user.role === 'admin' ? h('a', { href: '/admin', text: 'Admin' }) : null),
    ];
  }

  function stat(label, value, sub, color) { return h('div', { class: 'stat', style: '--c:' + (color || 'var(--cyan)') }, h('div', { class: 'l', text: label }), h('div', { class: 'v', text: value }), sub ? h('div', { class: 's', text: sub }) : null); }
  function accessLine() {
    var full = S.me.access.fullClasses;
    if (!full.length) return h('div', { class: 'card', style: 'margin-bottom:18px;display:flex;gap:14px;align-items:center;flex-wrap:wrap' },
      h('span', { class: 'badge blue', text: 'FREE TRIAL' }), h('div', { style: 'flex:1;min-width:220px', text: 'You can open Chapter 1 of every class. Get a plan to unlock all the chapters.' }), h('a', { class: 'btn primary small', href: '#/plans', text: 'See plans' }));
    return h('div', { class: 'card', style: 'margin-bottom:18px' }, h('div', { style: 'display:flex;gap:8px;flex-wrap:wrap;align-items:center' }, h('span', { class: 'badge green', text: 'ACTIVE' }),
      full.map(function (f) { return h('span', { class: 'badge blue', text: 'Class ' + f.cls + ' until ' + BL.fmtDate(f.endsAt) }); })));
  }

  // ------------------------------------------------------------------ home
  function viewHome() {
    var st = S.cat.stats, u = S.me.user;
    var cont = S.cat.continue ? S.cat.classes.find(function (c) { return c.cls === S.cat.continue.cls; }).chapters.find(function (x) { return x.chapter === S.cat.continue.chapter; }) : null;
    render(head('#/', 'Hi ' + u.name.split(' ')[0] + ' 👋', 'Class ' + (u.cls || '') + ' · pick up where you left off').concat([
      accessLine(),
      h('div', { class: 'stats' }, stat('Time learning', BL.fmtTime(st.totalSec), 'all time', 'var(--blue)'), stat('Today', BL.fmtTime(st.todaySec), null, 'var(--cyan)'), stat('Streak', st.streak + (st.streak === 1 ? ' day' : ' days'), 'a day counts after 1 minute', 'var(--yellow)'), stat('Chapters done', String(st.chaptersDone), st.chaptersStarted + ' started', 'var(--green)')),
      cont && cont.access ? h('div', { class: 'card', style: 'margin-bottom:18px;display:flex;gap:14px;align-items:center;flex-wrap:wrap' }, h('div', { style: 'flex:1;min-width:220px' }, h('div', { class: 'tag', text: 'Continue' }), h('div', { style: 'font-weight:600;font-size:16px', text: 'Class ' + S.cat.continue.cls + ' · ' + cont.title })),
        h('a', { class: 'btn primary', href: lessonUrl(S.cat.continue.cls, S.cat.continue.chapter), text: 'Continue' })) : null,
      h('h2', { style: 'font-size:18px;margin:6px 0 12px', text: 'Your classes' }),
      h('div', { class: 'class-grid' }, S.cat.classes.map(function (c) {
        var open = c.chapters.filter(function (x) { return x.access; }).length, done = c.chapters.filter(function (x) { return x.done; }).length;
        return h('a', { class: 'cls', href: '#/class/' + c.cls }, h('h3', { text: 'Class ' + c.cls }), h('div', { class: 'm', text: c.chapters.length + ' chapters · ' + open + ' open to you' }),
          h('div', { class: 'bar' }, h('i', { style: 'width:' + (c.chapters.length ? Math.round(done / c.chapters.length * 100) : 0) + '%' })), h('div', { class: 'micro', style: 'margin-top:6px', text: done + ' of ' + c.chapters.length + ' done' }));
      })),
    ]));
  }
  function lessonUrl(c, n) { return '/learn/' + encodeURI('Class - ' + c + '/Chapter - ' + n + '/index.html'); }

  // ------------------------------------------------------------------ one class
  function viewClass(c) {
    var cl = S.cat.classes.find(function (x) { return x.cls === c; });
    if (!cl) return go('#/');
    render(head('#/', 'Class ' + c, cl.chapters.length + ' chapters').concat([
      h('div', { class: 'crumbs' }, h('a', { href: '#/', text: '← All classes' })),
      h('div', { class: 'chapters' }, cl.chapters.map(function (x) {
        return h('div', { class: 'ch' + (x.access ? '' : ' locked') }, h('span', { class: 'n', text: x.access ? x.chapter : '🔒' }),
          h('div', null, h('div', { class: 't', text: x.title }), h('div', { class: 'meta', text: x.access ? (x.sec ? BL.fmtTime(x.sec) + ' spent · opened ' + x.opens + '×' : 'Not started yet') : 'Part of a plan' })),
          h('div', { style: 'display:flex;gap:10px;align-items:center' }, x.done ? h('span', { class: 'badge green', text: 'Done' }) : null,
            x.access ? h('a', { class: 'btn primary small', href: lessonUrl(c, x.chapter), text: x.sec ? 'Continue' : 'Start' }) : h('a', { class: 'btn ghost small', href: '#/plans?need=' + c + '/' + x.chapter, text: 'Unlock' })));
      })),
    ]));
  }

  // ------------------------------------------------------------------ plans + checkout
  function viewPlans(q) {
    var need = q.get('need'), pick = q.get('plan');
    var defCls = need ? Number(need.split('/')[0]) : S.me.user.cls || 8;
    var cards = S.plans.map(function (p) {
      var sel = null;
      if (p.scope === 'one-class') sel = h('select', { 'aria-label': 'Class', style: 'width:100%;padding:10px;border-radius:10px;border:1px solid var(--line-2);background:var(--field);color:var(--text);margin-bottom:12px' },
        [6, 7, 8, 9, 10].map(function (n) { var o = h('option', { value: n, text: 'Class ' + n }); if (n === defCls) o.selected = true; return o; }));
      var btn = h('button', { class: 'btn primary', type: 'button', text: 'Buy for ' + BL.fmtInr(p.priceInr), onclick: function () { buy(p, sel ? Number(sel.value) : null, btn); } });
      return h('div', { class: 'price' + (p.badge ? ' best' : ''), id: 'plan-' + p.id }, p.badge ? h('span', { class: 'badge gold', text: p.badge }) : null, h('h3', { text: p.name }), h('div', { class: 'tg', text: p.tagline }),
        h('div', { class: 'amt' }, BL.fmtInr(p.priceInr), h('small', { text: ' / ' + (p.durationDays % 365 === 0 ? 'year' : p.durationDays + ' days') })),
        h('ul', null, p.features.map(function (t) { return h('li', { text: t }); })), sel, btn);
    });
    var ordersBox = h('div');
    render(head('#/plans', 'Plans', 'One payment, a full year, no auto-renewal').concat([
      S.cfg.paymentMode === 'demo' ? h('div', { class: 'demo-banner', text: 'Demo mode: payments on this site are FAKE. Nobody is charged.' }) : null,
      S.cfg.paymentMode === 'off' ? h('div', { class: 'demo-banner', text: 'Online payments are not switched on yet. Please check back soon.' }) : null,
      need ? h('div', { class: 'card', style: 'margin-bottom:16px', text: 'That chapter (Class ' + need.replace('/', ', Chapter ') + ') is part of a paid plan. Choose a plan to open it.' }) : null,
      h('div', { class: 'plans' }, cards), h('h2', { style: 'font-size:18px;margin:30px 0 12px', text: 'Your payments' }), ordersBox,
    ]));
    if (pick && document.getElementById('plan-' + pick)) document.getElementById('plan-' + pick).scrollIntoView({ block: 'center' });
    BL.api('/billing/orders').then(function (r) {
      ordersBox.replaceChildren(r.orders.length ? h('div', { class: 'tw' }, h('table', { class: 'tbl' }, h('thead', null, h('tr', null, ['Date', 'Plan', 'Amount', 'Status', 'Payment id'].map(function (t) { return h('th', { text: t }); }))),
        h('tbody', null, r.orders.map(function (o) { return h('tr', null, h('td', { text: BL.fmtDate(o.paidAt || o.createdAt) }), h('td', { text: o.planName + (o.cls ? ' · Class ' + o.cls : '') }), h('td', { text: BL.fmtInr(o.amountInr) }),
          h('td', null, h('span', { class: 'badge ' + (o.status === 'paid' ? 'green' : o.status === 'failed' ? 'red' : 'grey'), text: o.status === 'created' ? 'not completed' : o.status })), h('td', { style: 'font-size:12px;color:var(--muted)', text: o.paymentId || '—' })); })))) : h('div', { class: 'empty', text: 'No payments yet.' }));
    }, function () {});
  }

  function paid() { BL.toast('Payment done. Your plan is active!'); BL._me = null; return load().then(function () { go('#/'); }); }

  function buy(plan, cls, btn) {
    btn.disabled = true;
    BL.api('/billing/checkout', { method: 'POST', body: { planId: plan.id, cls: cls } }).then(function (o) {
      if (o.provider === 'demo') return demoCheckout(o, btn);
      return razorpay(o, btn);
    }).catch(function (e) { BL.toast(e.message); btn.disabled = false; });
  }
  function demoCheckout(o, btn) {
    var m = h('div', { class: 'modal' }, h('div', { class: 'box' }, h('div', { class: 'demo-banner', text: 'DEMO CHECKOUT: no real payment' }), h('h2', { style: 'font-size:20px', text: o.description }),
      h('p', { style: 'color:var(--muted);margin:6px 0 16px', text: 'Amount: ' + BL.fmtInr(o.amountPaise / 100) }),
      h('div', { style: 'display:flex;gap:10px' }, h('button', { class: 'btn primary', type: 'button', text: 'Pay (fake)', onclick: function () {
        BL.api('/billing/demo-pay', { method: 'POST', body: { orderId: o.orderId } }).then(function () { m.remove(); return paid(); }).catch(function (e) { BL.toast(e.message); });
      } }), h('button', { class: 'btn ghost', type: 'button', text: 'Cancel', onclick: function () { m.remove(); btn.disabled = false; } }))));
    document.body.appendChild(m);
  }
  function razorpay(o, btn) {
    return new Promise(function (resolve, reject) {
      if (window.Razorpay) return resolve();
      var sc = document.createElement('script'); sc.src = 'https://checkout.razorpay.com/v1/checkout.js'; sc.onload = resolve; sc.onerror = function () { reject(new Error('Could not load the payment window. Check your internet and try again.')); };
      document.head.appendChild(sc);
    }).then(function () {
      var rz = new window.Razorpay({ key: o.keyId, amount: o.amountPaise, currency: o.currency, order_id: o.providerOrderId, name: 'Botclub Labs', description: o.description, prefill: o.prefill, theme: { color: '#2f8fe0' },
        handler: function (r) {
          BL.api('/billing/verify', { method: 'POST', body: { orderId: o.orderId, razorpay_order_id: r.razorpay_order_id, razorpay_payment_id: r.razorpay_payment_id, razorpay_signature: r.razorpay_signature } }).then(paid)
            .catch(function (e) { BL.toast(e.message); btn.disabled = false; });
        },
        modal: { ondismiss: function () { btn.disabled = false; } } });
      rz.on('payment.failed', function () { BL.toast('The payment did not go through. You have not been charged, or it will be refunded.'); btn.disabled = false; });
      rz.open();
    });
  }

  // ------------------------------------------------------------------ profile
  function viewProfile() {
    var u = S.me.user, err = h('p', { class: 'err' }), ok = h('p', { class: 'okmsg' });
    var f = h('form', { onsubmit: function (e) {
      e.preventDefault(); err.textContent = ''; ok.textContent = '';
      BL.api('/me', { method: 'PATCH', body: { name: f.name.value, cls: f.cls.value, school: f.school.value, phone: f.phone.value } }).then(function () { BL._me = null; return load().then(function () { ok.textContent = 'Saved.'; }); }).catch(function (x) { err.textContent = x.message; });
    } },
      h('label', { class: 'f' }, h('span', { text: 'Name' }), h('input', { name: 'name', value: u.name, maxlength: 80, required: true })),
      h('label', { class: 'f' }, h('span', { text: 'Email' }), h('input', { value: u.email, disabled: true })),
      h('div', { class: 'two' }, h('label', { class: 'f' }, h('span', { text: 'Class' }), h('select', { name: 'cls' }, [6, 7, 8, 9, 10].map(function (n) { var o = h('option', { value: n, text: String(n) }); if (n === u.cls) o.selected = true; return o; }))),
        h('label', { class: 'f' }, h('span', { text: 'Phone' }), h('input', { name: 'phone', value: u.phone, maxlength: 20 }))),
      h('label', { class: 'f' }, h('span', { text: 'School' }), h('input', { name: 'school', value: u.school, maxlength: 100 })), err, ok,
      h('button', { class: 'btn primary', type: 'submit', style: 'margin-top:16px', text: 'Save changes' }));
    var perr = h('p', { class: 'err' }), pok = h('p', { class: 'okmsg' });
    var pf = h('form', { onsubmit: function (e) {
      e.preventDefault(); perr.textContent = ''; pok.textContent = '';
      BL.api('/password', { method: 'POST', body: { current: pf.current.value, password: pf.password.value } }).then(function () { pf.reset(); pok.textContent = 'Password changed. Other devices were signed out.'; }).catch(function (x) { perr.textContent = x.message; });
    } },
      h('label', { class: 'f' }, h('span', { text: 'Current password' }), h('input', { name: 'current', type: 'password', autocomplete: 'current-password', required: true })),
      h('label', { class: 'f' }, h('span', { text: 'New password (8+ characters)' }), h('input', { name: 'password', type: 'password', autocomplete: 'new-password', minlength: 8, required: true })), perr, pok,
      h('button', { class: 'btn ghost', type: 'submit', style: 'margin-top:16px', text: 'Change password' }));
    render(head('#/profile', 'Profile', u.email).concat([
      h('div', { style: 'display:grid;grid-template-columns:repeat(auto-fit,minmax(320px,1fr));gap:18px;max-width:860px' }, h('div', { class: 'card' }, h('h2', { style: 'font-size:17px;margin-bottom:4px', text: 'Your details' }), f),
        h('div', { class: 'card' }, h('h2', { style: 'font-size:17px;margin-bottom:4px', text: 'Password' }), pf)),
      h('div', { style: 'margin-top:20px' }, h('button', { class: 'btn ghost', type: 'button', text: 'Log out', onclick: function () { BL.api('/auth/logout', { method: 'POST', body: {} }).then(function () { location.href = '/'; }); } })),
    ]));
  }

  // ------------------------------------------------------------------ router
  function route() {
    var raw = location.hash.slice(1) || '/', qi = raw.indexOf('?'), path = qi < 0 ? raw : raw.slice(0, qi), q = new URLSearchParams(qi < 0 ? '' : raw.slice(qi + 1));
    window.scrollTo(0, 0);
    if (path === '/welcome') { BL.toast('Welcome! Chapter 1 of every class is open for you.'); return go('#/'); }
    var m = /^\/class\/(\d+)$/.exec(path);
    if (m) return viewClass(Number(m[1]));
    if (path === '/plans') return viewPlans(q);
    if (path === '/profile') return viewProfile();
    viewHome();
  }
  window.addEventListener('hashchange', route);

  BL.me().then(function (m) {
    if (!m || !m.user) { location.href = '/login.html?next=' + encodeURIComponent('/app' + location.hash); return; }
    return load().then(route);
  }).catch(fail);
})();
