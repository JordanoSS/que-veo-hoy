import { moodGenres, matchesCandidate, quality } from "../../src/config/recommendation.js";
import { semanticKeywords } from "../../src/config/moods.js";
import { providerIds, keywordIds } from "../../server/catalog.js";
import { endpoint, validate, discoverSchema, mediaPath, tmdb, normalizeTitle } from "../../server/tmdb.js";

async function discoverType(filters, type, env) {
  type = mediaPath(type);
  const path = type;
  const genres = moodGenres(filters.mood, type);

  const params = {
    include_adult: "false", "vote_count.gte": String(quality.minVotes), "vote_average.gte": String(quality.minScore),
    sort_by: "popularity.desc", watch_region: filters.region,
    [type === "movie" ? "primary_release_date.lte" : "first_air_date.lte"]: new Date().toISOString().slice(0, 10)
  };
  const dateField = type === "movie" ? "primary_release_date" : "first_air_date";
  if (filters.yearFrom) params[`${dateField}.gte`] = `${filters.yearFrom}-01-01`;
  if (filters.yearTo) params[`${dateField}.lte`] = `${filters.yearTo}-12-31`;
  if (genres.length) params.with_genres = genres.join("|");
  if (type === "tv" && ["romance", "horror"].includes(filters.mood)) {
    const ids = await keywordIds(env, semanticKeywords[filters.mood]);
    if (!ids.length) return [];
    params.with_keywords = ids.join("|");
  }
  // TV mezcla Sci-Fi con Fantasy. La validación final necesita keywords.
  if (type === "tv" && filters.mood === "think") delete params.with_genres;
  if (filters.type === "anime") {
    params.with_genres = "16";
    params.with_original_language = "ja";
  }
  if (filters.time !== "any") {
    params["with_runtime.gte"] = "1";
    params["with_runtime.lte"] = String(Number(filters.time) - 1);
  }
  if (filters.platform !== "any") {
    const ids = await providerIds(env, path, filters.region, filters.platform);
    if (!ids.length) return [];
    params.with_watch_providers = ids.join("|");
    params.with_watch_monetization_types = "flatrate";
  }
  // Cada rama es Animation AND un género del mood: nunca 16|mood.
  // Para TV semántico las keywords + details conservan la intersección.
  const genreQueries = filters.type === "anime" && genres.length && !(type === "tv" && filters.mood === "think")
    ? [...new Set(genres.map(genre => [...new Set([16, genre])].join(",")))]
    : [params.with_genres];
  const results = [];
  for (const withGenres of genreQueries) {
    const query = { ...params, ...(withGenres ? { with_genres: withGenres } : {}) };
    // Dos páginas acotadas dan variedad sin permitir paginación arbitraria desde el cliente.
    const first = await tmdb(env, `discover/${path}`, query);
    const extraPage = genreQueries.length > 1 ? 1 : Math.min(first.total_pages ?? 1, 5);
    const second = extraPage > 1 ? await tmdb(env, `discover/${path}`, { ...query, page: String(2 + Math.floor(Math.random() * (extraPage - 1))) }) : { results: [] };
    results.push(...(first.results ?? []), ...(second.results ?? []));
  }
  return [...new Map(results
    .filter(item => matchesCandidate(normalizeTitle(item, type), { ...filters, type }, false, !(type === "tv" && ["romance", "horror", "think"].includes(filters.mood))))
    .map(item => [item.id, normalizeTitle(item, type)])).values()];
}

export const onRequest = endpoint(async ({ request, env }) => {
  const filters = validate(request, discoverSchema);
  const types = ["any", "anime"].includes(filters.type)
    ? (Math.random() < 0.5 ? ["movie", "tv"] : ["tv", "movie"])
    : [filters.type];
  const all = [];
  for (const type of types) {
    const candidates = await discoverType(filters, type, env);
    all.push(...candidates);
  }
  return { candidates: all, type: all[0]?.type ?? filters.type, region: filters.region };
});
