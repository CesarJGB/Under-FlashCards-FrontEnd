# Flashcards MVP — PRD

## Problem statement
Full-stack Flashcards MVP. Scope chosen by user: **Google Sign-In only** (no flashcard CRUD yet), in-memory (no DB). Frontend deploy target: Cloudflare Pages. Backend: Render.

## Stack
- Frontend: React 18 + Vite + Tailwind CSS (`/app/frontend`, served on port 3000 via `yarn start` → vite).
- Backend: Node.js + Express (`/app/backend/server.js`, port 8001 via supervisor `node-backend`). The default Python backend program is stopped.

## Auth flow (implemented)
@react-oauth/google `GoogleLogin` → credential (idToken) → jwt-decode shows name/picture instantly → POST `/api/auth/google` → backend `OAuth2Client.verifyIdToken` (audience = GOOGLE_CLIENT_ID, email_verified check) → returns `{id,email,name,picture}`.

## Implemented (2026-06-20)
- Secure Express endpoint POST `/api/auth/google` + `/api/health`, helmet, explicit CORS allow-list (FRONTEND_URL + localhost).
- Minimalist responsive login + profile UI with verification badge.
- `.env.example` for both projects; README with folder structure + Render/Cloudflare deploy + CORS prod instructions.
- Real Google Client ID configured (687427948394-...). Backend rejects invalid/expired tokens (verified via curl).

## Notes / limitations
- Live preview backend runs on Node/Express (port 8001) via an added supervisor program `node-backend`; the Python `backend` program is stopped.
- Full OAuth popup completion needs a real Google account (not automatable); backend verification validated independently.

## Backlog (P1/P2)
- Flashcard CRUD (create/list/study), persistence (DB), spaced-repetition, decks, session JWT for the app, sign-out token revocation.
