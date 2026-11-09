/**
 * back-button.js — adds a "Dashboard" back button to a chapter page.
 *
 * Include on any chapter page with:
 *   <script src="../../nav/back-button.js"></script>
 *
 * - Goes back to the dashboard with the chapter's class list already open
 *   (<root>/index.html?openClass=N, N read from the "Class - N" folder in the URL).
 * - Rendered in a shadow root so chapter CSS can't affect it and it can't affect the chapter.
 * - Skips itself if the page already has its own #claude-back-btn.
 * - Small icon pill (top-left) that expands to "Dashboard" on hover/focus.
 */
(function () {
  "use strict";
  if (window.__dashBackBtn || document.getElementById("claude-back-btn")) return;
  window.__dashBackBtn = true;

  var script = document.currentScript;
  var root = script && script.src ? script.src.replace(/nav\/back-button\.js(\?.*)?$/, "") : "../../";
  var m = decodeURIComponent(location.pathname).match(/Class\s*-\s*(\d+)/i);
  var href = root + "index.html" + (m ? "?openClass=" + m[1] : "");

  // Phones in landscape: keep the desktop side-by-side layout but give the canvas more height
  // by slimming the title bar (the legend in it is the first thing to go).
  var st = document.createElement("style");
  st.textContent =
    "@media (orientation:landscape) and (max-height:520px){" +
    ".topbar{padding-top:4px!important;padding-bottom:4px!important;gap:10px!important}" +
    ".topbar h1{font-size:13px!important;line-height:1.15!important}" +
    ".topbar .legend{display:none!important}" +
    ".topbar{padding-left:52px!important}" + /* room for the back button */
    ".topbar .brand-badge{display:none!important}" +
    ".topbar .chip{font-size:9px!important;padding:1px 7px!important;margin-bottom:1px!important}" +
    ".panel-head{padding-top:6px!important;padding-bottom:6px!important}" +
    "}";
  (document.head || document.documentElement).appendChild(st);

  function mount() {
    var host = document.createElement("div");
    host.id = "dash-back-host";
    host.style.cssText = "position:fixed;top:10px;left:10px;z-index:2147483000;";
    var sh = host.attachShadow({ mode: "open" });
    sh.innerHTML =
      "<style>" +
      "a{display:inline-flex;align-items:center;gap:8px;height:36px;padding:0 11px;border-radius:999px;" +
      "background:rgba(13,17,23,.88);color:#fff;border:1px solid rgba(0,212,255,.55);" +
      "font:600 13px/1 'Poppins',system-ui,sans-serif;text-decoration:none;cursor:pointer;" +
      "backdrop-filter:blur(6px);box-shadow:0 2px 10px rgba(0,0,0,.35);transition:background .2s,border-color .2s}" +
      "a:hover,a:focus-visible{background:#00d4ff;color:#0d1117;border-color:#00d4ff;outline:none}" +
      "svg{width:14px;height:14px;flex:none}" +
      "span{max-width:0;overflow:hidden;white-space:nowrap;transition:max-width .25s ease}" +
      "a:hover span,a:focus-visible span{max-width:120px}" +
      "@media (max-width:600px){a{height:32px}}" +
      "</style>" +
      '<a href="' + href + '" title="Back to Dashboard" aria-label="Back to Dashboard">' +
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>' +
      "<span>Dashboard</span></a>";
    document.body.appendChild(host);
  }

  if (document.body) mount();
  else document.addEventListener("DOMContentLoaded", mount);
})();
