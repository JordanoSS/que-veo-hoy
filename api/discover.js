import { moodGenres, matchesCandidate, quality } from "../src/config/recommendation.js";
import { platforms } from "../src/config/platforms.js";
import { endpoint, validate, discoverSchema, mediaPath, tmdb, normalizeTitle } from "./_lib/tmdb.js";

async function discoverType(filters, type) {
  const path = mediaPath(type);
  const genres = moodGenres(filters.mood, type);
  if (filters.mood !== "random" && !genres.length) return [];
  const params = {
    include_adult: "false", "vote_count.gte": String(quality.minVotes), "vote_average.gte": String(quality.minScore),
    sort_by: "popularity.desc", watch_region: filters.region,
    [type === "movie" ? "primary_release_date.lte" : "first_air_date.lte"]: new Date().toISOString().slice(0, 10)
  };
  const dateField = type === "movie" ? "primary_release_date" : "first_air_date";
  if (filters.yearFrom) params[`${dateField}.gte`] = `${filters.yearFrom}-01-01`;
  if (filters.yearTo) params[`${dateField}.lte`] = `${filters.yearTo}-12-31`;
  if (genres.length) params.with_genres = genres.join("|");
  if (filters.time !== "any") {
    params["with_runtime.gte"] = "1";
    params["with_runtime.lte"] = String(Number(filters.time) - 1);
  }
  if (filters.platform !== "any") {
    const catalog = await tmdb(`watch/providers/${path}`, { watch_region: filters.region });
    const names = platforms[filters.platform].names.map(name => name.toLowerCase());
    const ids = (catalog.results ?? []).filter(provider => names.includes(provider.provider_name.toLowerCase())).map(provider => provider.provider_id);
    if (!ids.length) return [];
    params.with_watch_providers = ids.join("|");
    params.with_watch_monetization_types = "flatrate";
  }
  // Dos páginas acotadas dan variedad sin permitir paginación arbitraria desde el cliente.
  const first = await tmdb(`discover/${path}`, params);
  const extraPage = Math.min(first.total_pages ?? 1, 5);
  const second = extraPage > 1 ? await tmdb(`discover/${path}`, { ...params, page: String(2 + Math.floor(Math.random() * (extraPage - 1))) }) : { results: [] };
  return [...new Map([...(first.results ?? []), ...(second.results ?? [])]
    .filter(item => matchesCandidate(normalizeTitle(item, type), { ...filters, type }, false))
    .map(item => [item.id, normalizeTitle(item, type)])).values()];
}

export default endpoint(async req => {
  const filters = validate(req, discoverSchema);
  const types = filters.type === "any"
    ? (Math.random() < 0.5 ? ["movie", "tv"] : ["tv", "movie"])
    : [filters.type];
  for (const type of types) {
    const candidates = await discoverType(filters, type);
    if (candidates.length) return { candidates, type, region: filters.region };
  }
  return { candidates: [], type: filters.type, region: filters.region };
});
