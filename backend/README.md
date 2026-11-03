# Botclub Labs Analytics backend

Express + MongoDB API. Deploy with `bash ../deploy/deploy-backend.sh` (see the root README).

## Settings (environment variables)

| Setting | What it is |
|---|---|
| `MONGODB_URI` | Atlas connection string (secret). Percent-encode special characters in the password (`@` is `%40`) |
| `MONGODB_DB` | database name, default `skolar` |
| `JWT_SECRET` | signs dashboard sign-in tokens (secret, random, 32+ bytes) |
| `ENROLL_KEY` | the one key apps use to register a new screen (secret). Without it, registering is switched off |
| `FRONTEND_ORIGINS` | the dashboard's web address(es), comma separated, e.g. `https://skolar-frontend-xxxx.run.app` |
| `ADMIN_EMAIL`, `ADMIN_PASSWORD` | the first admin, created only when there are no logins yet |
| `ONLINE_MINUTES` | a screen is "online" if it synced within this many minutes (default 15) |
| `PORT` | set by Cloud Run |

Create more logins from a terminal: `MONGODB_URI=... node scripts/make-user.js name@school.org "a long password" viewer "Sunrise Public School"` (viewers only see the schools listed).

Collections: `devices`, `usage_daily`, `chapters`, `sessions`, `users` (indexes are created on start).

## How the apps send data

Every screen registers once, then sends its totals every few minutes. The totals are cumulative (what the app's own usage file holds), so sending the same data twice, or after a week offline, never double counts: the server keeps the larger value.

**Register** (once per installed screen):
```
POST /api/v1/devices/register
X-Enroll-Key: <ENROLL_KEY>
{ "school": "Sunrise Public School", "label": "Smart class 8B", "platform": "android",
  "appVersion": "2.1.0", "kind": "classroom", "section": "B", "classes": [8], "expiry": "2027-06-30" }
→ 201 { "deviceId": "…", "token": "…" }        (the app stores both; the token is shown once)
```

**Send usage** (about every 5 minutes while online):
```
POST /api/v1/ingest
Authorization: Bearer <deviceId>.<token>
{ "device":   { …only what changed… },
  "days":     { "2026-10-13": { "sec": 5400, "pages": { "8/2": 4200, "dash": 1200 } } },
  "chapters": { "8/2": { "sec": 4200, "opens": 6, "first": "2026-10-01T08:00:00Z", "last": "2026-10-13T09:10:00Z" } },
  "sessions": [ { "start": "2026-10-13T08:00:00Z", "end": "2026-10-13T08:40:00Z", "cls": 8, "section": "B", "sec": 2400 } ] }
→ 200 { "ok": true, … }
```
`pages` keys are `"<class>/<chapter>"` (e.g. `8/2`) or `"dash"` for the menus. School names are matched ignoring capital letters, so "Sunrise School" and "sunrise school" are one school.

Checks: 1 MB per request, 400 days, dates within the last year, values capped at one day of seconds, junk keys ignored. A blocked ("revoked") screen is refused at once.

## Dashboard API (needs `Authorization: Bearer <token>` from `POST /api/auth/login`)
`GET /api/overview`, `/api/schools`, `/api/schools/:name`, `/api/devices`, `/api/devices/:id`, `/api/chapters`, `/api/export.csv` with `?from=YYYY-MM-DD&to=…&school=…&cls=8&platform=android`. Admin only: `GET/POST/DELETE /api/users`, `POST /api/devices/:id/revoke`, `DELETE /api/devices/:id`.
