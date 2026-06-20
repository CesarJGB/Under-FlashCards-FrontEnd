# Flashcards MVP — Google Sign-In (React + Vite · Node + Express)

A minimal, secure Google Sign-In MVP. The frontend obtains a Google credential
(JWT idToken) and the backend verifies it with `google-auth-library` before
trusting any user data.

## Folder structure

```
.
├── backend/                 # Node.js + Express API (deploy to Render)
│   ├── server.js            # Express server + POST /api/auth/google
│   ├── package.json
│   ├── .env                 # real env (not committed)
│   └── .env.example         # GOOGLE_CLIENT_ID, PORT, FRONTEND_URL
│
└── frontend/                # React + Vite + Tailwind (deploy to Cloudflare Pages)
    ├── index.html
    ├── vite.config.js
    ├── tailwind.config.js
    ├── postcss.config.js
    ├── package.json
    ├── .env                 # real env (not committed)
    ├── .env.example         # REACT_APP_BACKEND_URL, VITE_GOOGLE_CLIENT_ID
    └── src/
        ├── main.jsx
        ├── App.jsx          # GoogleLogin + jwt-decode + backend verification
        └── index.css
```

## How it works (auth flow)

1. User clicks **Continue with Google** (`@react-oauth/google` → `GoogleLogin`).
2. On success, the frontend receives `credential` (a JWT idToken).
3. `jwt-decode` reads the token locally to show name + picture **immediately**.
4. The frontend `POST`s `{ credential }` to `POST /api/auth/google`.
5. The backend calls `OAuth2Client.verifyIdToken({ idToken, audience: GOOGLE_CLIENT_ID })`,
   validating the signature, expiry and **audience (clientId)**, then returns the
   trusted `{ id, email, name, picture }`.

The backend is the source of truth — the locally decoded token is only used for
instant UI feedback.

## Local development

```bash
# Backend
cd backend
cp .env.example .env        # fill GOOGLE_CLIENT_ID
npm install
npm start                   # http://localhost:8001

# Frontend
cd frontend
cp .env.example .env        # set REACT_APP_BACKEND_URL=http://localhost:8001 and VITE_GOOGLE_CLIENT_ID
npm install
npm run dev                 # http://localhost:5173
```

In Google Cloud Console → Credentials → your OAuth Client, add the dev origin to
**Authorized JavaScript origins**: `http://localhost:5173`.

## Production deployment

### Backend on Render
1. New → **Web Service** → connect the repo, root directory `backend`.
2. Build command: `npm install` · Start command: `npm start`.
3. Environment variables:
   - `GOOGLE_CLIENT_ID` = your client id
   - `FRONTEND_URL` = your Cloudflare Pages URL (comma-separated for multiple)
   - `PORT` is provided automatically by Render — the code reads `process.env.PORT`.

### Frontend on Cloudflare Pages
1. Create a Pages project from the repo, root directory `frontend`.
2. Build command: `npm run build` · Output directory: `dist`.
3. Environment variables:
   - `REACT_APP_BACKEND_URL` = your Render service URL (e.g. `https://your-api.onrender.com`)
   - `VITE_GOOGLE_CLIENT_ID` = your client id

### Configuring CORS for production
The backend allows only the origins listed in `FRONTEND_URL` (plus localhost).
After your Cloudflare Pages domain is live:

1. Set `FRONTEND_URL` on Render to the exact Pages URL, e.g.
   `FRONTEND_URL=https://flashcards.pages.dev`
   For multiple domains use commas:
   `FRONTEND_URL=https://flashcards.pages.dev,https://flashcards.com`
2. Redeploy the Render service so the new value is picked up.
3. Requests from any other origin are rejected by the CORS middleware.

### Google Cloud Console (production)
Add to **Authorized JavaScript origins**:
- Your Cloudflare Pages URL (e.g. `https://flashcards.pages.dev`)
- Any custom domain you attach

> Security notes: the idToken is verified server-side on every login, the audience
> is asserted against `GOOGLE_CLIENT_ID`, unverified emails are rejected, `helmet`
> sets safe HTTP headers, and no secrets are hardcoded — everything comes from env.
