# SkolAR Analytics frontend

The web dashboard. No build step and no npm packages: `server.js` is a small static server for the files in `public/`.

Deploy with `bash ../deploy/deploy-frontend.sh` (see the root README).

## Settings
| Setting | What it is |
|---|---|
| `API_URL` | the backend's web address (required in production). The server hands it to the page through `/config.js`, so one image works for any backend |
| `PORT` | set by Cloud Run |

Run locally: `API_URL=http://localhost:8081 PORT=8080 npm start`, then open http://localhost:8080 (start the backend on 8081 first, with `FRONTEND_ORIGINS=http://localhost:8080`).

## Files
`public/index.html`, `app.js` (all the pages), `app.css`, `titles.json` (chapter names from the learning site), `vendor/chart.umd.js` and `fonts/` (bundled, so the page loads nothing from other websites).

To refresh the chapter names after the learning site changes, rebuild `public/titles.json` from the `chapterTitles` block in the learning site's `index.html`.
