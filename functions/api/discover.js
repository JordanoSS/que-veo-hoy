import { discovery, sourcesFor, sourceParams, modeQuality } from "../../src/config/discovery.js";
import { moodGenres, matchesCandidate, matchesDiscoverCandidate, quality } from "../../src/config/recommendation.js";
import { semanticKeywords } from "../../src/config/moods.js";
import { providerIds, keywordIds } from "../../server/catalog.js";
import { endpoint, validate, discoverSchema, mediaPath, tmdb, normalizeTitle } from "../../server/tmdb.js";

async function discoverType(filters, type, env, source, budget) {
  type = mediaPath(type);
  const path = type;
  const genres = moodGenres(filters.mood, type);
  if (source === "trending") {
    if (Number(filters.window) > 0) return { candidates: [], hasMore: false };
    const results = [];
    for (const period of ["day", "week"]) {
      if (!budget.remaining) break;
      budget.remaining--;
      results.push(await tmdb(env, `trending/${type}/${period}`));
    }
    return { candidates: results.flatMap(data => data.results ?? []).slice(0, discovery.sourceCandidateLimit)
      .map(item => ({ ...normalizeTitle(item, type), sources: [source] }))
      .filter(title => matchesDiscoverCandidate(title, filters)), hasMore: false };
  }

  const params = {
    include_adult: "false", "vote_count.gte": String(quality.minVotes), "vote_average.gte": String(quality.minScore),
    sort_by: "popularity.desc", watch_region: filters.region,
    ...sourceParams(source, type, filters),
    [type === "movie" ? "primary_release_date.lte" : "first_air_date.lte"]: new Date().toISOString().slice(0, 10)
  };
  const dateField = type === "movie" ? "primary_release_date" : "first_air_date";
  if (filters.yearFrom) params[`${dateField}.gte`] = `${filters.yearFrom}-01-01`;
  if (filters.yearTo) params[`${dateField}.lte`] = [`${filters.yearTo}-12-31`, params[`${dateField}.lte`]].sort()[0];
  if (genres.length) params.with_genres = genres.join("|");
  if (type === "tv" && ["romance", "horror"].includes(filters.mood)) {
    const ids = await keywordIds(env, semanticKeywords[filters.mood]);
    if (!ids.length) return { candidates: [], hasMore: false };
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
    if (!ids.length) return { candidates: [], hasMore: false };
    params.with_watch_providers = ids.join("|");
    params.with_watch_monetization_types = "flatrate";
  }
  // Cada rama es Animation AND un género del mood: nunca 16|mood.
  // Para TV semántico las keywords + details conservan la intersección.
  const genreQueries = filters.type === "anime" && genres.length && !(type === "tv" && filters.mood === "think")
    ? [...new Set(genres.map(genre => [...new Set([16, genre])].join(",")))]
    : [params.with_genres];
  const results = [];
  let hasMore = false;
  const pages = filters.recommendationMode === "mix" || genreQueries.length > 1 ? 1 : discovery.pagesPerSource;
  const start = Number(filters.window) * pages + 1;
  for (const withGenres of genreQueries) {
    const query = { ...params, ...(withGenres ? { with_genres: withGenres } : {}) };
    for (let page = start; page < start + pages; page++) {
      if (!budget.remaining) { hasMore = true; break; }
      budget.remaining--;
      const data = await tmdb(env, `discover/${path}`, { ...query, page: String(page) });
      results.push(...(data.results ?? []));
      hasMore ||= (data.total_pages ?? 1) >= start + pages;
      if (page >= (data.total_pages ?? 1)) break;
    }
  }
  return { candidates: [...new Map(results.map(item => ({ ...normalizeTitle(item, type), sources: [source] }))
    .filter(title => modeQuality(title, source) && matchesDiscoverCandidate(title, filters)
      && matchesCandidate(title, { ...filters, type }, false, !(type === "tv" && ["romance", "horror", "think", "action"].includes(filters.mood))))
    .map(title => [title.id, title])).values()].slice(0, discovery.sourceCandidateLimit), hasMore };
}

export const onRequest = endpoint(async ({ request, env }) => {
  const filters = validate(request, discoverSchema);
  const types = ["any", "anime"].includes(filters.type)
    ? (Math.random() < 0.5 ? ["movie", "tv"] : ["tv", "movie"])
    : [filters.type];
  const budget = { remaining: Number(filters.sourceBudget) };
  const all = new Map();
  let hasMore = false;
  for (const source of sourcesFor(filters.recommendationMode)) {
    for (const type of types) {
      const data = await discoverType(filters, type, env, source, budget);
      hasMore ||= data.hasMore;
      for (const title of data.candidates) {
        const key = `${title.type}:${title.id}`;
        const previous = all.get(key);
        all.set(key, { ...title, sources: [...new Set([...(previous?.sources ?? []), ...title.sources])] });
      }
    }
  }
  return { candidates: [...all.values()], type: all.values().next().value?.type ?? filters.type, region: filters.region,
    sourceRequests: Number(filters.sourceBudget) - budget.remaining,
    hasMore: hasMore && Number(filters.window) + 1 < discovery.maxWindows };
});
