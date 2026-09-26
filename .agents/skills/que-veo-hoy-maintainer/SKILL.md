---
name: que-veo-hoy-maintainer
description: Maintain and extend the "¿Qué veo hoy?" Vite + vanilla JavaScript recommender app. Use this skill whenever changing recommendation logic, TMDB integration, mood/platform/time filters, API endpoints, result cards, localStorage history, responsive UI, or tests in this repository. Preserve the existing cream/black/electric-yellow retro-tech brutalist design and never expose TMDB secrets.
---

# ¿Qué veo hoy? — maintainer skill

Use this skill for any change that touches the recommendation experience, the TMDB-backed API, the current visual language, filtering, state synchronization, localStorage, result rendering, or deployment-sensitive code.

## Core product contract

The product is a Spanish-language web app that recommends one movie or TV show based on:

- platform
- type: movie / TV / any
- mood
- time available
- region

The recommendation must feel intentional. Do not degrade to arbitrary catalog randomness unless the user explicitly selected **Sorpréndeme**.

Read `references/recommendation-contract.md` before changing recommendation behavior.

## Non-negotiable rules

1. **Preserve the visual identity**
   - cream background
   - near-black text/surfaces
   - electric yellow accent
   - hard black borders
   - light retro-tech / brutalist feel
   - monospace accents
   - subtle glitch details
   - no generic SaaS redesign
   - no Bootstrap, Tailwind, glassmorphism, or unnecessary design-system rewrites

2. **Never expose secrets**
   - `TMDB_BEARER_TOKEN` stays server-side only.
   - Never create `VITE_TMDB_TOKEN`.
   - Never print tokens.
   - Never embed credentials in client JavaScript, HTML, source maps, tests, or README examples.
   - `.env` must remain ignored by Git.

3. **Keep user selections and internal state synchronized**
   - visual `.selected` state must match JavaScript state.
   - there must be one source of truth for current selections.
   - do not infer current selection from CSS classes in one place and state objects in another.
   - when changing controls, update both rendering and tests.

4. **Mood is a semantic constraint**
   - When mood != `random`, preserve its genre intent.
   - Never silently remove mood to obtain a result.
   - If filters are too strict, relax constraints in the fallback order defined below.
   - If no valid result remains, show an empty state rather than returning unrelated content.

5. **Type is strict**
   - `movie` must return a movie.
   - `tv` must return a TV result.
   - `any` may choose either.
   - Do not label a TV show as a movie or vice versa.

6. **Time must be meaningful**
   - For movies, use runtime constraints where the provider supports them.
   - For TV, interpret time using available episode-runtime metadata conservatively.
   - If runtime data is missing, do not fabricate it.
   - Do not eliminate the mood before relaxing time.

7. **Platform filtering must not break other constraints**
   - `any` means no provider restriction.
   - Specific platforms should be resolved centrally from provider configuration / watch-provider data.
   - Do not hard-code unverified provider IDs in multiple files.
   - A platform fallback may be relaxed only after mood and type are preserved.

8. **Region**
   - Default region: `EC`.
   - Keep region handling centralized.
   - Architecture must remain ready for MX, CO, AR, CL, PE, ES.
   - Do not invent provider availability for a region.

## Fallback strategy

When no recommendation is available:

1. Start with the user's full filter set.
2. Keep **type** fixed when the user explicitly chose movie or TV.
3. Keep **mood/genre intent** fixed when mood != random.
4. Relax **time** first.
5. Relax **platform** second if a specific provider caused the empty result.
6. Keep region.
7. If no result remains, return an empty state.

Never:
- drop the mood silently
- return a family/reality result for an action request unless it is genuinely compatible with the selected mood mapping
- return TV for `movie`
- return movie for `tv`

For `type=any`, try one type and then the other if needed while preserving mood.

For `mood=random`, apply quality constraints but genre may vary.

## Quality filters

Prefer candidates with:

- poster
- overview/description
- enough vote count to avoid near-empty records
- reasonable rating
- basic release metadata

Exclude adult content.

Avoid over-filtering to the point that common combinations regularly produce no results.

Quality thresholds belong in one central location and must be easy to tune.

## Mood mapping

Mood-to-genre mapping must be centralized, ideally in `src/config/moods.js`.

Do not duplicate TMDB genre IDs across API handlers and frontend code.

Movie and TV genre IDs may differ. Verify the mapping used for each media type.

Conceptual intent:

- `funny` → Comedy
- `horror` → Horror / Thriller
- `think` → Mystery / Science Fiction / Thriller
- `romance` → Romance / Drama
- `action` → Action / Adventure
- `relax` → Comedy / Family / Animation
- `random` → no genre constraint

If a genre does not exist for a media type, do not substitute an unrelated genre. Handle it explicitly.

## API boundary

Client code calls only project endpoints such as:

- `/api/discover`
- `/api/details`
- `/api/providers`

Server-side functions call TMDB.

Validate all accepted query parameters against allowlists.

Return stable JSON shapes:

Success:
```json
{
  "ok": true,
  "data": {}
}
```

Error:
```json
{
  "ok": false,
  "error": {
    "code": "SOME_CODE",
    "message": "Human-readable message"
  }
}
```

Do not return raw stack traces to the browser.

Use appropriate HTTP status codes.

## Recommendation result contract

A successful result should expose enough normalized data for the UI:

- id
- mediaType
- title
- originalTitle when useful
- year
- poster URL/path
- rating
- genres
- overview
- runtime or episode runtime when known
- watch providers when known
- explanation of why the result matched

The client should not need to understand raw TMDB response structures.

## "Ver otra"

- Avoid repeating the same title immediately.
- Use recent result IDs from localStorage.
- Keep roughly the last 30.
- If exhausted, prune intelligently rather than disabling the app.

## "Ya la vi"

- Store watched IDs in localStorage.
- Exclude watched titles when possible.
- If filtering watched titles leaves zero candidates, prefer an explicit fallback/empty state rather than ignoring watched state silently.

## Sharing

Use Web Share API when available.
Fallback to clipboard.

Do not include spoilers.

Example:
```text
🎬 ¿Qué veo hoy?

Hoy me recomendaron:
[TÍTULO]

Mood: [MOOD]

¿Qué te recomienda a ti?

[URL]
```

## UI states

Always implement:

- loading
- success
- empty
- error

Examples:

Loading: `Buscando algo bueno...`

Empty: `No encontramos algo que encaje exactamente. Prueba cambiando algún filtro.`

Error: `No pudimos obtener recomendaciones. Intenta nuevamente.`

Never leave the main button looking frozen.

## Responsive and accessibility

Verify at least:

- 320 px
- 375 px
- 768 px
- 1024 px
- 1440 px

No accidental horizontal scrolling.

Use actual `<button>` elements for actions.
Keep visible focus states.
Maintain sufficient contrast.
Use ARIA labels only where they add clarity.

## Performance

- Lazy-load posters.
- Avoid duplicate requests.
- Use HTTP cache headers server-side when appropriate.
- Use AbortController for superseded client requests where useful.
- Avoid large libraries for simple logic.

## Before editing

1. Read repository `AGENTS.md`.
2. Inspect current relevant files.
3. Read this skill fully.
4. Read `references/recommendation-contract.md` for recommendation/API changes.
5. Identify whether the task affects UI, state, API, data normalization, or more than one layer.
6. Preserve the current architecture unless the change clearly requires otherwise.

## Verification workflow

After recommendation/API/UI changes:

1. Run tests.
2. Run build.
3. Verify no secret appears in tracked files or built assets.
4. If local dev server is available, test at least:
   - action + movie
   - horror + movie
   - romance + movie or TV
   - random
   - type movie
   - type TV
   - `Ver otra`
   - `Ya la vi`
   - loading / empty / error
5. Verify responsive layout.

You may use `scripts/verify.sh` from this skill as a baseline.

## Required behavioral tests

At minimum maintain tests proving:

- `action + movie` preserves action intent
- `horror + movie` does not fall back to unrelated reality/family content
- `romance` preserves the intended mood mapping
- movie request yields movie
- TV request yields TV
- random can vary genres but still applies quality checks
- fallback does not silently remove mood
- selected UI state and request params agree
- API rejects unsupported parameter values
- secrets are not exposed client-side

## Development logs

Temporary development logs may show safe normalized values such as:

```js
{
  type: "movie",
  mood: "action",
  time: "120",
  platform: "any",
  region: "EC"
}
```

and derived filters such as:

```js
{
  withGenres: "...",
  runtimeLte: 120
}
```

Never log tokens, authorization headers, `.env` contents, or raw secrets.

Remove noisy debugging logs when the bug is resolved.

## Finishing a task

Report:

1. root cause when fixing a bug
2. files changed
3. behavior changed
4. fallback behavior
5. tests added/updated
6. `npm test` result
7. `npm run build` result
8. any known limitation or data-source constraint

Do not claim a recommendation bug is fixed solely because an API request returns HTTP 200. Validate semantic correctness against the user's selected filters.
