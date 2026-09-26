# Optional AGENTS.md snippet

Add near the top of the repository's existing `AGENTS.md`:

```md
## ¿Qué veo hoy? repository rules

- For changes to recommendation logic, TMDB integration, mood/platform/time filters, result rendering, localStorage recommendation history, or `/api/*`, invoke `$que-veo-hoy-maintainer` before editing.
- Never expose `TMDB_BEARER_TOKEN` to client code or Vite-prefixed environment variables.
- Preserve the existing cream/black/electric-yellow retro-tech brutalist visual language unless the user explicitly asks for a redesign.
- A successful HTTP response is not sufficient: recommendation changes must be semantically tested against the selected mood/type filters.
- After relevant changes, run `npm test` and `npm run build`.
```
