# SkolAR Labs Analytics

How the SkolAR Labs apps (Windows, Android, Linux) are used: hours of learning, schools, screens, classes and chapters, curriculum progress per school, who is online, and whose access is about to end.

Two services, deployed **separately** on Google Cloud Run, with **MongoDB Atlas** as the database:

| Folder | What it is | Needs |
|---|---|---|
| `backend/`  | the API (Node.js + Express). The apps send usage here; the dashboard reads from here | MongoDB, 3 secrets |
| `frontend/` | the web dashboard (static pages served by a tiny Node server, no npm packages) | the backend's address |

```
 apps (Windows / Android / Linux) ──▶  backend (Cloud Run) ──▶ MongoDB Atlas
 you (browser) ──▶ frontend (Cloud Run) ──▶ calls the backend with a sign-in token
```

**One school = one progress.** A school with five panels shows one set of numbers (all screens added together), a progress bar per class (chapters opened out of total), and its screens listed underneath.

## Deploy in 4 steps

You need: a Google Cloud project (with billing on), a MongoDB Atlas cluster, and this repository.

### 1. MongoDB Atlas
- **Database Access:** a database user with *Read and write to any database*. Use a long random password.
- **Network Access:** allow `0.0.0.0/0` (Cloud Run has no fixed IP; the database is still protected by TLS and the user's password).
- Connection string: `mongodb+srv://USER:PASSWORD@CLUSTER.mongodb.net/?retryWrites=true&w=majority`
  **If the password contains characters like `@ : / ? # %`, write them as `%40 %3A %2F %3F %23 %25`** (for example `p@ss` becomes `p%40ss`), or the link will not parse.

### 2. Backend (do this first)
Open **Cloud Shell** in the Google Cloud console, get this repository there (`git clone <your repo url>`), `cd` into it, then:

```bash
export PROJECT_ID="your-project-id"
export MONGODB_URI='mongodb+srv://USER:ENCODED_PASSWORD@CLUSTER.mongodb.net/?retryWrites=true&w=majority'
export ADMIN_EMAIL="you@yourschool.org"
export ADMIN_PASSWORD='a long password of your own (10+ characters)'
bash deploy/deploy-backend.sh
```
It prints the backend address, for example `https://skolar-backend-xxxxx-el.a.run.app`. Check `<address>/healthz` shows `{"ok":true}`.

### 3. Frontend
```bash
export PROJECT_ID="your-project-id"
bash deploy/deploy-frontend.sh          # finds the backend by itself; or:  API_URL=https://skolar-backend-xxxxx-el.a.run.app
```
It prints the dashboard address (`https://skolar-frontend-xxxxx-el.a.run.app`) and automatically tells the backend that this address may use it (`FRONTEND_ORIGINS`).

### 4. Sign in
Open the dashboard address and sign in with the admin email and password from step 2. There is no data until the apps send some (see `backend/README.md`, "How the apps send data"). Add more logins under **Logins** (viewers can be limited to certain schools).

Get the enrollment key the apps need:
```bash
gcloud secrets versions access latest --secret=skolar-enroll-key
```

### Instead of scripts: deploy from your Git repository
Cloud Run → **Create service** → **Continuously deploy from a repository** → pick the repo →
- backend: build type **Dockerfile**, source location `/backend/Dockerfile`; add the environment variables and secrets listed in `backend/.env.example`.
- frontend: build type **Dockerfile**, source location `/frontend/Dockerfile`; environment variable `API_URL` = the backend address.
- then set the backend's `FRONTEND_ORIGINS` to the frontend's address. Every push to the branch redeploys.

### Custom address (optional)
Cloud Run → service → **Manage custom domains**. If you put the dashboard on `https://analytics.yourschool.org`, redeploy the frontend script with `EXTRA_ORIGINS=https://analytics.yourschool.org` so the backend allows it.

## Run on your own computer
```bash
cd backend  && npm install && npm test        # 7 end-to-end checks against a temporary MongoDB
# real run (needs a MongoDB):  MONGODB_URI=... JWT_SECRET=... ENROLL_KEY=... ADMIN_EMAIL=... ADMIN_PASSWORD=... FRONTEND_ORIGINS=http://localhost:8080 PORT=8081 npm start
cd frontend && API_URL=http://localhost:8081 PORT=8080 npm start        # then open http://localhost:8080
```

## Security summary
- Sign-in uses a signed token (8 hours) sent in a header; passwords are bcrypt-hashed; sign-in attempts are rate limited and take the same time for unknown emails.
- The backend only accepts browser calls from the addresses in `FRONTEND_ORIGINS`. The apps' endpoints (`/api/v1/...`) are open to any origin because they use the device's own token, never a browser session.
- The enrollment key only lets a device **register**. Each device then has its own token (stored hashed); a lost or misbehaving screen can be blocked from its page in the dashboard.
- The frontend sends a strict Content-Security-Policy (it may only talk to itself and the backend), and shows all data as text, never as HTML.
- Secrets live in Secret Manager. Never commit `.env` files (they are git-ignored).
