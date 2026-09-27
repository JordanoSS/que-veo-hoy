import { yearError } from "../src/config/recommendation.js";
import { moods } from "../src/config/moods.js";
import { platforms, regions, defaultRegion } from "../src/config/platforms.js";

export class ApiError extends Error {
  constructor(status, code, message) {
    super(message);
    Object.assign(this, { status, code });
  }
}

export function validate(req, schema) {
  if (req.method !== "GET") throw new ApiError(405, "METHOD_NOT_ALLOWED", "Usa el método GET.");
  const params = new URL(req.url, "http://localhost").searchParams;
  for (const key of params.keys()) {
    if (!Object.hasOwn(schema, key) || params.getAll(key).length !== 1) {
      throw new ApiError(400, "INVALID_PARAMS", "Parámetros no permitidos o repetidos.");
    }
  }
  const result = {};
  for (const [key, rule] of Object.entries(schema)) {
    const value = params.get(key) ?? rule.default;
    if (!rule.check(value)) throw new ApiError(400, "INVALID_PARAMS", `Parámetro inválido: ${key}.`);
    result[key] = value;
  }
  if ("yearFrom" in schema && yearError(result)) throw new ApiError(400, "INVALID_PARAMS", yearError(result));
  return result;
}
const choice = (values, fallback) => ({ default: fallback, check: value => values.includes(value) });
export const discoverSchema = {
  type: choice(["movie", "tv", "series", "any", "anime"], "any"),
  platform: choice(Object.keys(platforms), "any"),
  mood: choice(Object.keys(moods)),
  yearFrom: { check: value => value === undefined || (value !== "" && !yearError({ yearFrom: value })) },
  yearTo: { check: value => value === undefined || (value !== "" && !yearError({ yearTo: value })) },
  time: choice(["30", "60", "120", "any"], "any"),
  region: choice(regions, defaultRegion)
};
export const titleSchema = {
  type: choice(["movie", "tv", "series"]),
  id: { check: value => /^[1-9]\d{0,9}$/.test(value ?? "") },
  region: choice(regions, defaultRegion)
};
export const mediaPath = type => type === "movie" ? "movie" : "tv";

// La credencial solo se lee aquí, nunca se entrega al navegador ni se registra.
export async function tmdb(env, path, params = {}) {
  const token = env?.TMDB_BEARER_TOKEN;
  if (!token) throw new ApiError(503, "NOT_CONFIGURED", "El servicio de recomendaciones todavía no está configurado.");
  const url = new URL(`https://api.themoviedb.org/3/${path}`);
  url.search = new URLSearchParams({ language: "es-ES", ...params });
  try {
    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
      signal: AbortSignal.timeout(8000)
    });
    if (!response.ok) {
      if (response.status === 404) throw new ApiError(404, "NOT_FOUND", "No encontramos este título.");
      if (response.status === 429) throw new ApiError(429, "RATE_LIMITED", "Demasiadas solicitudes. Intenta en unos momentos.");
      throw new ApiError(502, "UPSTREAM_ERROR", "No pudimos consultar el catálogo.");
    }
    return await response.json();
  } catch (error) {
    if (error instanceof ApiError) throw error;
    throw new ApiError(502, "UPSTREAM_ERROR", "No pudimos consultar el catálogo.");
  }
}

export function endpoint(action, cacheSeconds = 300) {
  return async context => {
    const headers = {
      "Content-Type": "application/json; charset=utf-8",
      "X-Content-Type-Options": "nosniff",
      "Referrer-Policy": "strict-origin-when-cross-origin",
      "Strict-Transport-Security": "max-age=31536000",
      "Permissions-Policy": "camera=(), microphone=(), geolocation=(), payment=()",
      "Content-Security-Policy": "default-src 'self'; img-src 'self' https://image.tmdb.org; script-src 'self'; style-src 'self'; connect-src 'self'; base-uri 'self'; frame-ancestors 'none'; form-action 'self'"
    };
    try {
      const data = await action(context);
      headers["Cache-Control"] = `public, max-age=60, s-maxage=${cacheSeconds}, stale-while-revalidate=60`;
      return Response.json({ ok: true, data }, { status: 200, headers });
    } catch (error) {
      const known = error instanceof ApiError;
      const status = known ? error.status : 500;
      headers["Cache-Control"] = "no-store";
      if (status === 405) headers.Allow = "GET";
      if (status === 429) headers["Retry-After"] = "30";
      return Response.json({ ok: false, error: {
        code: known ? error.code : "INTERNAL_ERROR",
        message: known ? error.message : "No pudimos obtener recomendaciones. Intenta nuevamente."
      } }, { status, headers });
    }
  };
}

export function normalizeTitle(item, type) {
  type = mediaPath(type);
  const runtimes = type === "movie" ? [item.runtime] : item.episode_run_time ?? [];
  const duration = runtimes.filter(value => Number.isFinite(value) && value > 0);
  return {
    id: item.id, type: item.media_type ?? type, mediaType: mediaPath(type), adult: Boolean(item.adult),
    genreIds: item.genre_ids ?? (item.genres ?? []).map(genre => genre.id), title: item.title || item.name || "",
    date: (type === "movie" ? item.release_date : item.first_air_date) || "",
    poster: /^\/[\w.-]+$/.test(item.poster_path ?? "") ? `https://image.tmdb.org/t/p/w500${item.poster_path}` : null,
    overview: item.overview?.trim() || "", score: item.vote_average ?? 0,
    votes: item.vote_count ?? 0, genres: (item.genres ?? []).map(genre => genre.name),
    originalTitle: item.original_title || item.original_name || "",
    originalLanguage: item.original_language || "",
    originCountries: item.origin_country ?? (item.production_countries ?? []).map(country => country.iso_3166_1),
    productionCountries: (item.production_countries ?? []).map(country => country.iso_3166_1),
    keywords: (item.keywords?.keywords ?? item.keywords?.results ?? []).map(keyword => keyword.name),
    popularity: item.popularity ?? 0,
    runtime: duration.length ? Math.max(...duration) : null
  };
}

