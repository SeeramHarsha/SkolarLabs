'use strict';
/** Writes the small static pages (sign in, sign up, password reset, policies, 404). Run: node scripts/make-pages.js */
const fs = require('fs');
const path = require('path');
const OUT = path.join(__dirname, '..', 'public');

const head = (t) => `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${t} - Botclub Labs</title>
<meta name="theme-color" content="#0f2640">
<link rel="icon" href="/favicon.png">
<link rel="stylesheet" href="/fonts/fonts.css">
<link rel="stylesheet" href="/css/site.css">
</head>
<body>
<div id="nav"></div>
`;
const tail = (auth) => `
<div id="foot"></div>
<script src="/js/common.js"></script>
${auth ? '<script src="/js/auth.js"></script>\n' : ''}</body>
</html>
`;
const page = (file, title, body, auth = true) => fs.writeFileSync(path.join(OUT, file), head(title) + body + tail(auth));

page('login.html', 'Log in', `<main class="auth"><div class="box">
  <h1>Welcome back</h1><p class="sub">Log in to continue learning.</p>
  <form id="loginForm" novalidate>
    <label class="f"><span>Email</span><input name="email" type="email" autocomplete="username" required></label>
    <label class="f"><span>Password</span><input name="password" type="password" autocomplete="current-password" required></label>
    <p class="err" role="alert"></p>
    <button class="btn primary" type="submit">Log in</button>
  </form>
  <p class="alt"><a href="/forgot.html">Forgot your password?</a></p>
  <p class="alt">New here? <a href="/register.html">Create a free account</a></p>
</div></main>`);

page('register.html', 'Create your account', `<main class="auth"><div class="box">
  <h1>Create your free account</h1><p class="sub">Chapter 1 of every class is free. No card needed. <span id="planNote"></span></p>
  <form id="registerForm" novalidate>
    <label class="f"><span>Student's name</span><input name="name" type="text" autocomplete="name" maxlength="80" required></label>
    <label class="f"><span>Email</span><input name="email" type="email" autocomplete="email" required></label>
    <label class="f"><span>Password (8+ characters)</span><input name="password" type="password" autocomplete="new-password" minlength="8" required></label>
    <div id="pwMeter" class="micro" style="margin-top:6px"></div>
    <div class="two">
      <label class="f"><span>Class</span><select name="cls" required><option value="">Choose…</option><option>6</option><option>7</option><option>8</option><option>9</option><option>10</option></select></label>
      <label class="f"><span>Phone (optional)</span><input name="phone" type="tel" autocomplete="tel" maxlength="20"></label>
    </div>
    <label class="f"><span>School (optional)</span><input name="school" type="text" maxlength="100"></label>
    <label class="check"><input name="consent" type="checkbox" required><span>I am a parent or guardian, or I have a parent or guardian's permission to make this account. I agree to the <a href="/terms.html" target="_blank" rel="noopener">Terms</a> and the <a href="/privacy.html" target="_blank" rel="noopener">Privacy Policy</a>.</span></label>
    <p class="err" role="alert"></p>
    <button class="btn primary" type="submit">Create account</button>
  </form>
  <p class="alt">Already have an account? <a href="/login.html">Log in</a></p>
</div></main>`);

page('forgot.html', 'Reset your password', `<main class="auth"><div class="box">
  <h1>Forgot your password?</h1><p class="sub">Enter your email and we will send you a link to choose a new one.</p>
  <form id="forgotForm" novalidate>
    <label class="f"><span>Email</span><input name="email" type="email" autocomplete="email" required></label>
    <p class="err" role="alert"></p>
    <button class="btn primary" type="submit">Send the link</button>
  </form>
  <p class="alt"><a href="/login.html">Back to log in</a></p>
</div></main>`);

page('reset.html', 'Choose a new password', `<main class="auth"><div class="box">
  <h1>Choose a new password</h1><p class="sub">At least 8 characters.</p>
  <form id="resetForm" novalidate>
    <label class="f"><span>New password</span><input name="password" type="password" autocomplete="new-password" minlength="8" required></label>
    <label class="f"><span>Type it again</span><input name="again" type="password" autocomplete="new-password" minlength="8" required></label>
    <p class="err" role="alert"></p>
    <button class="btn primary" type="submit">Save and log in</button>
  </form>
</div></main>`);

page('404.html', 'Page not found', `<main class="auth"><div class="box" style="text-align:center"><h1>Page not found</h1><p class="sub">That page does not exist.</p><a class="btn primary" href="/" style="max-width:220px;margin:0 auto">Go to the home page</a></div></main>`, false);

const review = `<div class="review"><b>For the site owner:</b> this is a starting draft, not legal advice. Please have it checked (keeping the Digital Personal Data Protection Act, 2023 and your payment provider's rules in mind) and fill in your company name, address and contact email before you rely on it. Then delete this box.</div>`;

page('privacy.html', 'Privacy Policy', `<main class="prose">${review}<h1>Privacy Policy</h1><p class="micro">Last updated: November 2026</p>
<p>Botclub Labs ("we") runs this website. This page explains what we collect from students and families, why, and what choices you have.</p>
<h2>Who should create an account</h2><p>Our students are children. An account should be created by a parent or guardian, or by the student with a parent or guardian's permission. When you create an account you confirm this.</p>
<h2>What we collect</h2><ul><li>The student's name, email address and class, and (optionally) school and phone number.</li><li>The password, stored only in scrambled (hashed) form. We cannot read it.</li><li>What the student does in the lessons: which chapters were opened, for how long, and which were marked done, so we can show progress.</li><li>Payment records (plan, amount, date, payment id). Card, UPI or bank details are handled by our payment provider and are never seen or stored by us.</li></ul>
<h2>What we do not do</h2><ul><li>No advertising, and we do not sell personal information.</li><li>No tracking of children for advertising or behavioural profiling.</li><li>No chat or messages between users.</li></ul>
<h2>How we use it</h2><p>To run the account, show progress, process payments, send password-reset and receipt emails, keep the service safe, and improve the lessons.</p>
<h2>Who sees it</h2><p>Our staff who need it to run the service, and service providers that help us (for example hosting, email and payments) under their own privacy terms.</p>
<h2>Your choices</h2><p>You can ask us to show, correct or delete a student's data, or to close the account, by writing to us. Closing an account removes the student's learning records; we keep payment records for as long as the law requires.</p>
<h2>Security</h2><p>The site uses encrypted connections, hashed passwords and limits on sign-in attempts. No system is perfectly safe, so please keep your password private.</p>
<h2>Contact</h2><p>Botclub Labs. Contact: [add your support email and address].</p></main>`, false);

page('terms.html', 'Terms of Use', `<main class="prose">${review}<h1>Terms of Use</h1><p class="micro">Last updated: November 2026</p>
<h2>The service</h2><p>Botclub Labs gives access to interactive science lessons for Classes 6 to 10. Some chapters are free; others need a paid plan.</p>
<h2>Accounts</h2><p>An account is for one student. Please do not share your password. A parent or guardian must agree to these terms on behalf of a child.</p>
<h2>Plans and payment</h2><p>A plan gives access, for the period shown when you buy it (for example one year), to the classes you chose. Plans do not renew by themselves. Prices are shown in Indian rupees. Payments are processed by our payment provider.</p>
<h2>Using the lessons</h2><p>The lessons are for personal study. Please do not copy, resell, scrape or share them, or try to get around the plan limits.</p>
<h2>Changes and availability</h2><p>We may improve or change the lessons and the site. We try to keep the service running but cannot promise it will always be available.</p>
<h2>Ending an account</h2><p>You may stop using the service at any time. We may suspend an account that breaks these terms.</p>
<h2>Contact</h2><p>Botclub Labs. Contact: [add your support email and address].</p></main>`, false);

page('refund.html', 'Refund Policy', `<main class="prose">${review}<h1>Refund and Cancellation Policy</h1><p class="micro">Last updated: November 2026</p>
<p>[Decide your policy and write it here. A common simple version is below: change the numbers to what you want to offer.]</p>
<h2>Trial first</h2><p>Chapter 1 of every class is free, so you can try Botclub Labs before you pay.</p>
<h2>Refund window</h2><p>If a paid plan does not work for you, write to us within [7] days of buying it and we will refund the plan price, as long as [less than a quarter of the chapters have been used].</p>
<h2>Double payments and failed payments</h2><p>If money is taken but access does not start, or you are charged twice by mistake, write to us with the payment id and we will fix it or refund it.</p>
<h2>How refunds are paid</h2><p>Refunds go back to the original payment method and usually reach you within [5 to 7] working days.</p>
<h2>Contact</h2><p>Botclub Labs. Contact: [add your support email and address].</p></main>`, false);

console.log('pages written');
