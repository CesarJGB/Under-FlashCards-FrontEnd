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

## Implemented (2026-06-21) — Dashboard + MongoDB
- Mongoose connected (MONGO_URL, dbName=DB_NAME). Models: User (googleId, email, name, picture, aiApiKey) and Flashcard (userId ref, question, answer, easeFactor default 2.5).
- Auth now upserts the user and returns Mongo `_id` as `userId`; frontend passes it on every request.
- Routes: GET /api/flashcards/:userId, POST /api/flashcards, PUT /api/user/settings, GET /api/user/:userId (settings state, masked key). All validated via curl.
- DashboardScreen replaces ProfileScreen: sidebar (Study/Settings), Study = create form + responsive card grid, Settings = AI API key input (PUT). aiApiKey stored plain (masked in responses; encryption TODO).

## Implemented (2026-06-21) — Biblioteca de Mazos (Decks)
- New **Deck** model (userId, title, coverColor default #ffffff, coverImage base64 optional). **Flashcard** now requires `deckId` (ref Deck).
- Deck CRUD: GET /api/decks/:userId (with cardCount), POST /api/decks, PUT /api/decks/:id, DELETE /api/decks/:id (cascade-deletes its flashcards).
- Flashcard routes: GET /api/flashcards/deck/:deckId, POST (requires deckId), PUT /api/flashcards/:id, DELETE /api/flashcards/:id. All validated via curl.
- Frontend: 'Study' tab renamed to **Biblioteca**. Library = deck grid (cover color/image + title + count) + create/edit modal (title, color swatches/custom, file→base64). Deck interior view (currentDeck state) with physical study-card aesthetic, create/edit/delete flashcards, and "Volver a la Biblioteca".
- Respected: Google auth logic, .env and CORS allow-list unchanged. Only additive change: 'DELETE' added to CORS allowed methods so the new DELETE routes work cross-origin in production.

## Implemented (2026-06-21) — Refinamiento UX/UI
- Flashcard schema: nuevos campos `bgImage` (base64 opcional), `textAlign` (enum left/center/right, default center), `fontSize` (default text-base). POST/PUT y serializeFlashcard actualizados (textAlign inválido cae a default). Verificado por curl.
- Frontend traducido al español (Biblioteca, Ajustes, Cerrar sesión, etc.).
- Editor de tarjeta: `<textarea>` expansibles (min-h-[100px] resize-y) + controles de Tamaño de letra (text-sm/base/lg/xl), Alineación (izq/centro/der) e imagen de Fondo (file→base64, límite 700KB, botón quitar).
- Grid de tarjetas: aplica bgImage con cover/center + overlay oscuro (bg-black/55) para legibilidad, y aplica textAlign/fontSize a pregunta y respuesta.
- Auth de Google y CORS intactos. Fix menor: orden de @import en index.css.

## Backlog (P1/P2)
- Flashcard CRUD (create/list/study), persistence (DB), spaced-repetition, decks, session JWT for the app, sign-out token revocation.
