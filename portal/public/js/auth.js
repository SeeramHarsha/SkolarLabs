/* Sign up, sign in, forgot password, reset password. One script for the four pages (each page has its own form id). */
(function () {
  'use strict';
  var $ = function (id) { return document.getElementById(id); };
  var params = new URLSearchParams(location.search);

  function safeNext() {           // only ever go to a page on this same site
    var n = params.get('next') || '';
    return /^\/(app|learn|admin)[\/#?]?/.test(n) && n.indexOf('//') < 0 ? n : '/app';
  }
  function busy(btn, on) { btn.disabled = on; btn.dataset.t = btn.dataset.t || btn.textContent; btn.textContent = on ? 'Please wait…' : btn.dataset.t; }
  function submit(formId, fn) {
    var f = $(formId); if (!f) return;
    var err = f.querySelector('.err'), btn = f.querySelector('button[type=submit]');
    f.addEventListener('submit', function (e) {
      e.preventDefault(); err.textContent = ''; busy(btn, true);
      Promise.resolve(fn(f, err)).catch(function (x) { err.textContent = x.message; }).then(function () { busy(btn, false); });
    });
  }

  // ---------------------------------------------------------------- sign in
  submit('loginForm', function (f) {
    return BL.api('/auth/login', { method: 'POST', body: { email: f.email.value, password: f.password.value } }).then(function (j) {
      location.href = j.user.role === 'admin' && !params.get('next') ? '/admin' : safeNext();
    });
  });

  // ---------------------------------------------------------------- sign up
  var plan = params.get('plan');
  submit('registerForm', function (f) {
    return BL.api('/auth/register', { method: 'POST', body: { name: f.name.value, email: f.email.value, password: f.password.value, cls: f.cls.value, school: f.school.value, phone: f.phone.value, consent: f.consent.checked } }).then(function () {
      location.href = plan ? '/app#/plans?plan=' + encodeURIComponent(plan) : '/app#/welcome';
    });
  });
  var pw = document.querySelector('#registerForm [name=password]'), meter = $('pwMeter');
  if (pw && meter) pw.addEventListener('input', function () {
    var v = pw.value, score = (v.length >= 8) + (v.length >= 12) + (/[A-Z]/.test(v) && /[a-z]/.test(v)) + (/\d/.test(v)) + (/[^A-Za-z0-9]/.test(v));
    meter.textContent = !v ? '' : score <= 1 ? 'Weak password' : score <= 3 ? 'Okay password' : 'Strong password';
    meter.style.color = score <= 1 ? '#ff9d8f' : score <= 3 ? '#ffd6a6' : '#a8efcb';
  });
  if (plan && $('planNote')) $('planNote').textContent = 'After you sign up you can finish choosing your plan.';

  // ---------------------------------------------------------------- forgot
  submit('forgotForm', function (f, err) {
    return BL.api('/auth/forgot', { method: 'POST', body: { email: f.email.value } }).then(function () {
      f.replaceWith(BL.h('div', { class: 'okmsg', text: 'If that email has an account, we have sent a link to reset the password. It works for one hour. Please check your inbox (and spam).' }));
    });
  });

  // ---------------------------------------------------------------- reset
  submit('resetForm', function (f) {
    if (f.password.value !== f.again.value) throw new Error('The two passwords are not the same.');
    return BL.api('/auth/reset', { method: 'POST', body: { token: params.get('token') || '', password: f.password.value } }).then(function () { location.href = '/app'; });
  });
})();
