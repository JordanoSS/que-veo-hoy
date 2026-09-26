# Recommendation contract

## Input model

```js
{
  platform: "any" | "netflix" | "disney" | "max" | "prime",
  type: "any" | "movie" | "tv",
  mood: "funny" | "horror" | "think" | "romance" | "action" | "relax" | "random",
  time: "any" | "30" | "60" | "120",
  region: "EC"
}
```

Only allowlisted values are accepted.

## Semantic priorities

1. explicit media type
2. explicit mood
3. region
4. duration
5. provider/platform
6. quality/ranking refinements

`mood=random` carries no genre constraint.

## Fallback matrix

### Explicit type + explicit mood

Example: `movie + action + 120 + netflix`

Try:
1. movie + action + <=120 + Netflix
2. movie + action + Netflix
3. movie + action
4. empty

Never return TV or an unrelated genre due to fallback.

### Any type + explicit mood

Example: `any + horror + 120 + any`

Try:
1. randomly choose movie or TV with horror intent
2. if no valid candidate, try the other media type
3. relax time if needed
4. empty

Keep horror intent throughout.

### Random mood

For `random`:
- genre may vary
- quality thresholds remain
- adult content remains excluded
- media type remains strict if explicitly selected
- platform/time may be relaxed using the normal order

## Candidate validation

A final candidate must satisfy all remaining hard constraints after fallback.
Validate semantic compatibility before returning it.
Do not assume TMDB's first result is appropriate.

## Explanations

The explanation shown to the user must reflect the filters actually honored.

Do not say `Elegiste Netflix + acción + menos de 2 horas` if fallback removed Netflix or duration.
Instead explain the fallback honestly.

## Provider availability

Provider metadata is region-specific.
If provider data is missing:
- say availability could not be confirmed
- do not claim the title is on a service
- do not fabricate provider names

## Runtime

Movies: runtime may be used as a hard/soft filter.
TV: episode runtime may be incomplete; never present it as total series runtime.

## Test fixtures

Tests may mock TMDB responses and should include fixtures for:
- matching action movie
- unrelated reality TV
- horror movie
- romance item
- missing poster
- low-vote title
- duplicate/recent title
- watched title

Tests must prove semantic compatibility, not just HTTP success.
