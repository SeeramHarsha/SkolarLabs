/* Loaded inside every lesson page (added by the server). Counts the time the student is really looking at the lesson,
   reports it every ~15 s, and shows a small bar to go back or mark the chapter done. window.__BL = {cls, chapter}. */
(function () {
  'use strict';
  var meta = window.__BL; if (!meta) return;
  var PING_MS = 15000, IDLE_MS = 60000, pending = 0, lastTick = Date.now(), lastAct = Date.now(), timer = null;

  function call(path, body, beacon) {
    var data = JSON.stringify(body);
    if (beacon && navigator.sendBeacon) { /* beacon cannot set headers, so fall through to keepalive fetch */ }
    return fetch('/api' + path, { method: 'POST', credentials: 'same-origin', keepalive: !!beacon, headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'botclub' }, body: data }).then(function (r) { return r.json().catch(function () { return {}; }); });
  }
  function active() { return !document.hidden && Date.now() - lastAct < IDLE_MS; }
  function tick() { var now = Date.now(); if (active()) pending += Math.min(now - lastTick, 2000) / 1000; lastTick = now; }
  function flush(final) {
    tick();
    var sec = Math.round(pending); if (sec < 1 && !meta.first) return;
    var body = { cls: meta.cls, chapter: meta.chapter, sec: Math.min(sec, 30), open: !!meta.first };
    pending = Math.max(0, pending - body.sec); meta.first = false;
    call('/progress/ping', body, final).catch(function () { pending += body.sec; });
  }
  ['pointerdown', 'pointermove', 'keydown', 'scroll', 'touchstart'].forEach(function (e) { window.addEventListener(e, function () { lastAct = Date.now(); }, { passive: true, capture: true }); });
  meta.first = true;
  setInterval(tick, 1000); timer = setInterval(function () { flush(false); }, PING_MS);
  document.addEventListener('visibilitychange', function () { if (document.hidden) flush(true); });
  window.addEventListener('pagehide', function () { flush(true); });

  // the little bar
  var css = document.createElement('style');
  css.textContent = '#bl-bar{position:fixed;left:50%;bottom:14px;transform:translateX(-50%);z-index:2147483000;display:flex;gap:8px;align-items:center;padding:6px;border-radius:99px;background:rgba(15,38,64,.94);border:1px solid rgba(92,200,255,.35);box-shadow:0 8px 28px rgba(0,0,0,.4);font:600 13px Poppins,system-ui,sans-serif}#bl-bar a,#bl-bar button{all:unset;cursor:pointer;color:#fff;padding:8px 16px;border-radius:99px;font:600 13px Poppins,system-ui,sans-serif}#bl-bar a:hover{background:rgba(255,255,255,.1)}#bl-bar button{background:#1f9d55;color:#fff}#bl-bar button[disabled]{background:rgba(31,157,85,.35);color:#d6f5e3;cursor:default}@media print{#bl-bar{display:none}}';
  document.head.appendChild(css);
  var bar = document.createElement('div'); bar.id = 'bl-bar';
  var back = document.createElement('a'); back.href = '/app#/class/' + meta.cls; back.textContent = '← Class ' + meta.cls;
  var done = document.createElement('button'); done.type = 'button'; done.textContent = 'Mark as done';
  done.addEventListener('click', function () {
    done.disabled = true; done.textContent = 'Saving…'; flush(false);
    call('/progress/done', { cls: meta.cls, chapter: meta.chapter, done: true }).then(function (r) { if (r && r.error) throw new Error(r.error); done.textContent = '✓ Done'; }).catch(function () { done.disabled = false; done.textContent = 'Mark as done'; });
  });
  bar.appendChild(back); bar.appendChild(done); (document.body || document.documentElement).appendChild(bar);
})();
