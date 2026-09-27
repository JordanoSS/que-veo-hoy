import { moods, semanticMatch, isAnime } from "./moods.js";
import { matchesPlatform } from "./platforms.js";

// Mismo umbral para no penalizar catálogos anime pequeños; la confianza se pondera en QVH.
export const quality = { minVotes: 30, minScore: 6.5, requirePoster: true, requireOverview: true };
export const ranking = { mood: 35, rating: 25, confidence: 18, popularity: 2, filters: 10, metadata: 10, priorRating: 6, priorVotes: 100, topCount: 5, maxGap: 5, candidateLimit: 40, excellentScore: 85 };
const clamp = value => Math.max(0, Math.min(1, value));
export function qvhScore(title, filters, availability = null) {
  const votes = Math.max(0, Number(title.votes) || 0);
  const rating = (votes * (Number(title.score) || 0) + ranking.priorVotes * ranking.priorRating) / (votes + ranking.priorVotes);
  const time = filters.time === "any" || (title.runtime > 0 && title.runtime < Number(filters.time));
  const platform = filters.platform === "any" || matchesPlatform(availability, filters.platform);
  const metadata = [title.poster, title.overview?.trim(), title.date, title.runtime > 0, title.genres?.length].filter(Boolean).length / 5;
  const components = {
    mood: semanticMatch(title, filters.mood),
    rating: clamp(rating / 10),
    confidence: clamp(Math.log1p(votes) / Math.log1p(5000)),
    popularity: clamp(Math.log1p(Math.max(0, title.popularity || 0)) / Math.log1p(100)),
    filters: (2 + Number(time) + Number(platform)) / 4,
    metadata
  };
  const total = Object.entries(components).reduce((sum, [key, value]) => sum + ranking[key] * value, 0);
  return Math.round(total * 100) / 100;
}
export const currentYear = () => new Date().getFullYear();
export const canonicalType = type => type === "series" ? "tv" : type;
export const moodGenres = (mood, type) => moods[mood]?.[canonicalType(type)] ?? [];

export function yearError({ yearFrom, yearTo }, requireRange = false) {
  const values = [yearFrom, yearTo];
  const absent = value => value === undefined || value === null || value === "";
  if (requireRange && values.some(absent)) return "Completa DESDE y HASTA para personalizar el rango.";
  if (values.some(value => !absent(value) && (!/^\d{4}$/.test(String(value)) || Number(value) < 1900 || Number(value) > currentYear()))) {
    return `Usa años enteros entre 1900 y ${currentYear()}.`;
  }
  if (!values.some(absent) && Number(yearFrom) > Number(yearTo)) return "El año DESDE no puede ser mayor que HASTA.";
  return "";
}

export function matchesCandidate(title, filters, checkRuntime = true, checkSemantics = true) {
  const type = canonicalType(title.type);
  const year = Number(title.date?.slice(0, 4));
  if (!["movie", "tv"].includes(type) || (!["any", "anime"].includes(filters.type) && canonicalType(filters.type) !== type)) return false;
  if (!Number.isSafeInteger(title.id) || title.id <= 0 || !title.genreIds?.length) return false;
  if (!Number.isFinite(title.score) || title.score > 10 || !Number.isSafeInteger(title.votes)) return false;
  if (title.adult || !title.title || !year || year > currentYear()) return false;
  if (quality.requirePoster && !title.poster) return false;
  if (quality.requireOverview && !title.overview?.trim()) return false;
  if (!(title.score >= quality.minScore) || !(title.votes >= quality.minVotes)) return false;
  if (checkSemantics && !semanticMatch(title, filters.mood)) return false;
  if (checkSemantics && filters.type === "anime" && !isAnime(title)) return false;
  if ((filters.yearFrom && year < Number(filters.yearFrom)) || (filters.yearTo && year > Number(filters.yearTo))) return false;
  if (checkRuntime && filters.time !== "any" && (!(title.runtime > 0) || title.runtime >= Number(filters.time))) return false;
  return true;
}

export function fallbackStages(filters) {
  const stages = [{ ...filters }];
  if (filters.time !== "any") stages.push({ ...filters, time: "any" });
  if (filters.platform !== "any") stages.push({ ...filters, time: "any", platform: "any" });
  return stages;
}
