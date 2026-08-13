# AGENTS.md

Flashcard app (Spanish-language codebase). Two independent npm packages — no root scripts, no linter, no typecheck, no CI. Do not invent commands that don't exist.

## Layout

- `backend/` — Node >=18, CommonJS, Express + Mongoose (MongoDB). Entry `src/server.js` (port `8001`, env `PORT`); all routes mount under `/api` there. Controllers in `src/controllers`, pure logic in `src/utils`, AI pipeline in `src/services/aiService.js`.
- `frontend/` — React 18 + Vite 5 + Tailwind 3, ESM. Entry `src/main.jsx`. Dev server runs on port **3000** (strictPort), not 5173 (README is stale). `@` alias → `frontend/src`. `src/components/ui/` are shadcn-style (Radix + cva).
- `docs/platform-limitations/README.md` — **mandatory reading before any mobile UI change** (viewport, keyboard, focus, overlays, scroll): `ScheduleCalendar`, `ManualCardEditorModal`, `ActionSheet`, textareas. It maps each component to the specialist docs to read first.
- Root `*.md` files (`Hola.md`, `cambios.md`, `ideas.md`, ...) are old agent-conversation logs — ignore. `README.md` is only partially current; its "AI generation tuning" section is accurate. `frontend/README.md` is CRA boilerplate — ignore.

## Commands

Backend (`workdir backend/`):

- `npm start` / `npm run dev` (node --watch). Needs `backend/.env` (gitignored; no committed `.env.example`).
- `npm test` = `node --test test/*.test.js` — pure unit tests, **no DB or network needed**. **Currently 87/92 pass; 5 known stale failures** in `test/aiService.test.js` and `test/deckRecovery.test.js` asserting the old `deepseek-chat` / separate generate-then-audit pipeline. Production now pins OpenRouter `deepseek/deepseek-v4-flash-0731` with a combined generate+audit call. Update those tests; they are not regressions.
- Tests colocated under `src/` (e.g. `src/services/semantic/semantic.test.js`) are **not** picked up by `npm test` — run explicitly: `node --test src/services/semantic/semantic.test.js`.
- One-off Mongo migrations: `npm run migrate:materia-share-index`, `npm run migrate:schedule-attendance`.
- `npm run benchmark:ai` / `benchmark:ai-v2` hit the real LLM provider — require env keys and `BENCHMARK_USER_ID`; they cost tokens.

Frontend (`workdir frontend/`):

- `npm run dev` (port 3000), `npm run build` (works; chunk-size warnings are benign), `npm run preview`.
- Unit suites (`node --test`, colocated `*.test.js`) — all currently pass: `npm run test:schedule`, `npm run test:manual-editor:unit`, `npm run test:image-delivery`, `npm run test:pdf-extraction`.
- E2E: `npm run test:manual-editor` (Playwright) — `playwright.config.js` auto-starts a Vite harness on `127.0.0.1:4174` (`tests/manual-editor/`), runs chromium/webkit/firefox at mobile viewports, locale `es-MX`. Browsers already installed (`npx playwright install` if not). `npm run test:manual-editor:all` = unit + e2e.

## Env & auth

- Frontend needs `VITE_GOOGLE_CLIENT_ID` (without it, `App` renders nothing) and `VITE_BACKEND_URL`, from `frontend/.env.local`. `vite.config.js` accepts both `VITE_` and `REACT_APP_` prefixes. **Never hardcode the backend URL or add fallbacks/redirects — it breaks auth** (comment in `vite.config.js`).
- Backend CORS allows only `FRONTEND_URL` entries (comma-separated) plus localhost:3000/5173. Google sign-in requires `GOOGLE_CLIENT_ID` and the dev origin registered in Google Cloud Console.
- Dev auth bypass: with `ALLOW_DEV_USER_ID=true` in backend env, requests authenticate via an `x-user-id` header without any Google token (`authController.js` `protect`). Opt-in only — never in production.
- New accounts need an invite code (`INVITE_REQUIRED` error); `InviteCodeManager` issues them.
- AI generation: OpenRouter, pinned model `deepseek/deepseek-v4-flash-0731` (`backend/src/services/aiService.js`). Tune via `AI_*` env vars (full list and ranges in README "AI generation tuning"). Frontend `VITE_MAX_AI_CARDS` must match backend `AI_MAX_CARDS`; `VITE_AI_GENERATION_MODE=v1` rolls back to the legacy pipeline.

## Conventions & gotchas

- Code comments, docs, and commit messages are predominantly Spanish — match the surrounding language.
- Image delivery payloads (`bgImage` / `coverImageThumb`, `?contract=indexed&cover=thumbnail`) are deliberately frozen and covered by contract tests on both sides (`backend/test/imageDeliveryContracts.test.js`, `frontend/tests/image-delivery/`) — change code and contracts together.
- PDF export uses a Vite web worker (`frontend/src/utils/pdf/pdfExport.worker.js`); keep `worker.format: 'es'` in the vite configs.
- `frontend/vite.config.js` sets HMR to `wss` on port 443 (Cloudflare Pages deploy); local dev works normally but don't "fix" it.
