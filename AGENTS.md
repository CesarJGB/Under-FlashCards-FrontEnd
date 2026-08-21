# Under Flashcards

Spanish-language flashcard application. The repository contains two independent npm packages. There are no root scripts, no configured linter, no TypeScript typecheck, and no CI workflow. Do not invent commands that do not exist.

## Repository layout

- `backend/` — Node.js >=18, CommonJS, Express and Mongoose. Entry point: `src/server.js`. Default port: `8001`, configurable with `PORT`. Routes mount under `/api`.
- `backend/src/controllers/` — HTTP controllers.
- `backend/src/utils/` — reusable and preferably pure logic.
- `backend/src/services/aiService.js` — AI generation pipeline.
- `frontend/` — React 18, Vite 5, Tailwind 3 and ESM.
- `frontend/src/main.jsx` — frontend entry point.
- `frontend/src/components/ui/` — shadcn-style components built with Radix and cva.
- `@` resolves to `frontend/src`.
- The frontend development server uses port `3000` with `strictPort`; references to port 5173 in old documentation may be stale.

## Authoritative documentation

Before modifying mobile UI behavior involving viewport, keyboard, focus, overlays, scrolling, textareas, `ScheduleCalendar`, `ManualCardEditorModal`, or `ActionSheet`, read:

- `docs/platform-limitations/README.md`

Follow the component-specific documents referenced from that index.

Root Markdown files such as `Hola.md`, `cambios.md`, and `ideas.md` are old agent-conversation logs and are not authoritative.

The root `README.md` is only partially current. Its AI generation tuning section remains relevant.

`frontend/README.md` is CRA boilerplate and should not be treated as project documentation.

## Backend commands

Run these commands from `backend/`.

- `npm start`
- `npm run dev`
- `npm test`
- `node --test src/services/semantic/semantic.test.js`
- `npm run migrate:materia-share-index`
- `npm run migrate:schedule-attendance`
- `npm run benchmark:ai`
- `npm run benchmark:ai-v2`

`npm test` runs:

```text
node --test test/*.test.js
```

These are unit tests and should not require MongoDB or network access.

Some tests may still describe the previous `deepseek-chat` model or the separate generate-then-audit pipeline. Never assume a failure is stale. Reproduce it, compare it with current production behavior, and report evidence before modifying either code or tests.

Tests colocated under `backend/src/` are not automatically included by `npm test`. Run the relevant file explicitly.

The benchmark commands contact the real model provider, require credentials and `BENCHMARK_USER_ID`, and consume tokens. Do not run them unless explicitly requested.

## Frontend commands

Run these commands from `frontend/`.

- `npm run dev`
- `npm run build`
- `npm run preview`
- `npm run test:schedule`
- `npm run test:manual-editor:unit`
- `npm run test:image-delivery`
- `npm run test:pdf-extraction`
- `npm run test:manual-editor`
- `npm run test:manual-editor:all`
- `npm run test:playwright:smoke`
- `npm run test:app:smoke`
- `npm run test:app:chromium`
- `npm run test:app:firefox`
- `npm run test:app:webkit`
- `npm run test:app:fullstack`

`npm run build` may produce chunk-size warnings. Do not treat them as build failures without additional evidence.

The focused unit suites use Node's test runner and colocated `*.test.js` files.

`npm run test:manual-editor` runs Playwright using `playwright.config.js`. It starts a Vite harness on `127.0.0.1:4174` and tests mobile viewports in Chromium, WebKit, and Firefox with locale `es-MX`. The supported browser shortcuts are `npm run test:manual-editor:chromium`, `npm run test:manual-editor:webkit`, and `npm run test:manual-editor:firefox`.

Chromium, Firefox, and WebKit are part of the supported Playwright test environment. Run `npm run test:playwright:smoke` before declaring a Playwright infrastructure block. If a new host is missing browser binaries or Linux dependencies, use the approved `npm run setup:playwright` command, which delegates installation to the Playwright version in the lockfile.

`npm run setup:playwright:browsers` installs only the Playwright browser binaries as the normal user. `npm run setup:playwright` also requests Linux system dependencies; package-manager steps may require an interactive administrator session from the user. Never install the browsers under root, do not retry a blocked `sudo` prompt, and do not expect an agent to provide a password.

A functional E2E assertion failure is not a Playwright infrastructure failure. For a browser-specific bug, run the affected project first and expand to the other projects only when useful.

Playwright WebKit on Linux is useful for detecting WebKit incompatibilities, but it is not certification of real Safari or iOS. Issues involving the real iOS keyboard, browser viewport/chrome, physical safe areas, elastic overscroll, native Safari behavior, or device-specific media playback may still require real Apple hardware.

`npm run test:manual-editor:all` runs the manual-editor unit and E2E checks.

## Browser debugging workflow

Run these commands from `frontend/`. Before declaring Playwright blocked, run `npm run test:playwright:smoke`. It validates the browser engines only; it does not start Under Flashcards.

For a generic bug in the real frontend, run `npm run test:app:smoke`. Its Playwright `webServer` owns a real Vite process on `127.0.0.1:3200`, uses the production `index.html` and `App`, and shuts down a process it started. The default mode is frontend-only: it does not start Express, MongoDB, OpenRouter, or other unnecessary services. Backend request failures are recorded as `BACKEND_UNAVAILABLE`, not treated as a Playwright infrastructure failure.

Choose the narrowest mode that matches the bug:

- `UNIT`: pure logic and deterministic contracts.
- `HARNESS`: behavior already covered by a specialized harness such as Manual Editor or Login.
- `REAL APP`: real navigation, component integration, layout, visible behavior, and render errors.
- `FULL STACK`: API calls, persisted data, real library/calendar operations, or flows that require Express. Use `npm run test:app:fullstack` only when `backend/.env` is available and it is safe to connect to its configured database; it uses the real backend and does not start MongoDB or call AI generation automatically.

For visual or interaction bugs, reproduce before editing, capture the relevant screenshot/trace/video, inspect console, page errors, and network, identify the affected browser, form a supported hypothesis, then repeat the exact reproduction after the change. Use the configuration with `webServer`; do not report a missing Vite server as a test blocker.

The app smoke classifies `APP_BOOT_OK`, `FRONTEND_RUNTIME_ERROR`, `APP_NOT_MOUNTED`, `BACKEND_UNAVAILABLE`, `BACKEND_HTTP_ERROR`, `EXTERNAL_RESOURCE_FAILURE`, and `OTHER`. Known backend and third-party failures remain evidence instead of automatic smoke failures. Diagnostics omit authorization headers, cookies, request bodies, and credentials.

The app Playwright config keeps screenshot, trace, and video on failure and writes HTML reports under `frontend/playwright-report/`; test output remains under `frontend/test-results/`. These paths are ignored by Git.

The public/login screen is the `PUBLIC` surface and can be booted without a Google session when the required frontend environment is present. Post-login dashboard flows are `AUTHENTICATED`: they require a real session or a later explicit test strategy. `ALLOW_DEV_USER_ID=true` is an existing local-only backend authorization mechanism for a real existing user ID; it is opt-in, never enabled by these scripts, does not create a UI session, and must never be enabled in production.

## Environment and authentication

The backend requires `backend/.env`. It is gitignored and there is no committed `.env.example`.

The frontend uses `frontend/.env.local` and requires:

- `VITE_GOOGLE_CLIENT_ID`
- `VITE_BACKEND_URL`

Without `VITE_GOOGLE_CLIENT_ID`, `App` may render nothing.

`vite.config.js` accepts both `VITE_` and `REACT_APP_` prefixes.

Never hardcode a backend URL or introduce URL fallbacks or redirects. This can break authentication.

Backend CORS accepts origins from `FRONTEND_URL`, separated by commas, in addition to the configured localhost origins.

Google sign-in requires `GOOGLE_CLIENT_ID` and the development origin registered in Google Cloud Console.

For development only, `ALLOW_DEV_USER_ID=true` allows authentication through the `x-user-id` header. Never enable or recommend this for production.

New accounts may require an invitation code and return `INVITE_REQUIRED`. The frontend `InviteCodeManager` manages them through backend `generateInviteCode` in `backend/src/controllers/authController.js`, backed by the `InviteCode` model in `backend/src/models/InviteCode.js`.

## AI generation

AI generation uses OpenRouter. The production model is configured in:

```text
backend/src/services/aiService.js
```

The expected model is:

```text
deepseek/deepseek-v4-flash-0731
```

AI behavior is configured through `AI_*` environment variables documented in the root README under AI generation tuning.

`VITE_MAX_AI_CARDS` must remain compatible with backend `AI_MAX_CARDS`.

`VITE_AI_GENERATION_MODE=v1` enables the legacy pipeline.

Do not change the model, generation pipeline, token limits, auditing behavior, or provider settings as part of an unrelated task.

## Project conventions and protected contracts

Comments, documentation, and commit messages are predominantly Spanish. Match the language used by the surrounding code.

Image delivery payloads involving `bgImage`, `coverImageThumb`, `contract=indexed`, and `cover=thumbnail` are protected by contract tests on both frontend and backend.

Relevant tests include:

- `backend/test/imageDeliveryContracts.test.js`
- `frontend/tests/image-delivery/`

When intentionally modifying an image-delivery contract, update production code and the corresponding contract tests together. Do not change these contracts incidentally.

PDF export uses a Vite web worker:

```text
frontend/src/utils/pdf/pdfExport.worker.js
```

Keep `worker.format: "es"` in the relevant Vite configurations.

`frontend/vite.config.js` configures HMR with `wss` on port `443` for deployment behind Cloudflare. Do not change it as an unrelated local-development fix.

## Working protocol

Before editing:

- Run `git status --short`.
- Preserve unrelated changes already present in the worktree.
- Identify the objective, scope, exclusions, and acceptance criteria.
- Read the relevant implementation, consumers, tests, and authoritative documentation.
- Treat assumptions as hypotheses until verified through code, tests, logs, or authoritative documentation.
- For multi-step tasks, establish a compact plan before implementation.

During implementation:

- Make the smallest cohesive change that satisfies the request.
- Stay within the explicitly authorized scope.
- Avoid unrelated refactors, dependencies, abstractions, migrations, and compatibility layers.
- Read a file before modifying it.
- Search for consumers before moving, renaming, or deleting code.
- Preserve existing behavior unless the requested change explicitly modifies it.
- Do not repeat an identical failed command. Read the error and adjust the approach.
- After three failures caused by the same blocker, stop and report the evidence.
- Do not modify tests merely to make an implementation pass.

Verification:

- Run the narrowest relevant tests first.
- Run broader suites or builds only when justified by the affected area.
- Do not run network-dependent, credential-dependent, or token-consuming commands unless explicitly requested.
- Run `git diff --check`.
- Inspect `git status --short`.
- Review the complete relevant diff before finishing.
- Never claim that a check passed unless the command actually completed successfully.
- Distinguish verified behavior, inferred behavior, and unverified behavior.

Delivery:

- Explain what changed and why.
- List every modified file.
- Report the exact verification commands and their results.
- Disclose blockers, remaining risks, and unverified behavior.
- Do not commit or push unless explicitly requested.
