import { moods } from "./moods.js";

export const quality = { minVotes: 100, minScore: 6, requirePoster: true, requireOverview: true };
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

export function matchesCandidate(title, filters, checkRuntime = true) {
  const type = canonicalType(title.type);
  const year = Number(title.date?.slice(0, 4));
  if (!["movie", "tv"].includes(type) || (filters.type !== "any" && canonicalType(filters.type) !== type)) return false;
  if (title.adult || !title.title || !year || year > currentYear()) return false;
  if (quality.requirePoster && !title.poster) return false;
  if (quality.requireOverview && !title.overview?.trim()) return false;
  if (!(title.score >= quality.minScore) || !(title.votes >= quality.minVotes)) return false;
  if (filters.mood !== "random" && !title.genreIds?.some(id => moodGenres(filters.mood, type).includes(id))) return false;
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
