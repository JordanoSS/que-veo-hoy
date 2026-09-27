# Repository Guidelines

## Project Structure & Module Organization

QVH is a Spanish-language Vite + vanilla JavaScript recommender on Cloudflare Pages + Pages Functions.

- Root HTML pages: index, privacidad, cookies, terminos, acerca-de, contacto, 404.
- `src/`: components, services, config, storage, styles and shared static HTML templates.
- `functions/api/`: discover, details and providers Pages Functions; private helpers in `server/`.
- `public/`: assets, SEO files and security headers.
- `tests/`: offline Node tests with mocked API and DOM.
- `backup-original/`: immutable historical prototype; do not modify.

## Build, Test, and Development Commands

Use Node.js >=22.12.0. `npm ci` installs dependencies. `npm run cf:dev` builds and serves the complete app at localhost:8788. `npm run dev` provides Vite HMR with /api proxied to Wrangler. Opening index.html directly does not run the application.

Run `npm test`, `npm run build` and `.agents/skills/que-veo-hoy-maintainer/scripts/verify.sh` after relevant changes. Public HTML fragments are expanded by Vite, without client JavaScript requirements.

## Coding Style & Naming Conventions

Use two-space indentation, vanilla JavaScript, `const` where possible, double-quoted strings, semicolons and camelCase identifiers. Keep visible copy in Spanish and CSS classes kebab-case. Reuse color variables and the existing cream/black/electric-yellow brutalist design.

Keep data-group values aligned with selection state; data-value provides values. Centralize regions, platforms, moods and quality thresholds in src/config. Use textContent for external data. Do not expose or edit secrets; TMDB credentials remain server-side.

## Testing Guidelines

Maintain semantic tests for mood/type/year/anime, fallback duration then platform, regional providers, quality and history exclusions. Validate public metadata, CSP and privacy controls. Use browser QA when available at 320, 375, 430, 768, 1024 and 1440 px. Verify keyboard navigation, no overflow, error/empty/loading, and no additional scroll or focus movement on Ver otra. Do not claim browser or live TMDB validation from mocked tests.

## Commit & Pull Request Guidelines

Use short imperative commit subjects and keep changes focused. Do not commit, push or deploy without authorization. Describe behavior and validation in PRs; include desktop/mobile screenshots when available, and document validation limits otherwise.

## ¿Qué veo hoy? repository rules

- For changes to recommendation logic, TMDB integration, mood/platform/time filters, result rendering, localStorage recommendation history, or `/api/*`, invoke `$que-veo-hoy-maintainer` before editing.
- Never expose `TMDB_BEARER_TOKEN` to client code or Vite-prefixed environment variables.
- Preserve the existing cream/black/electric-yellow retro-tech brutalist visual language unless the user explicitly asks for a redesign.
- A successful HTTP response is not sufficient: recommendation changes must be semantically tested against the selected mood/type filters.
- After relevant changes, run `npm test` and `npm run build`.
