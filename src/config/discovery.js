// Presupuesto compartido por fuentes, cliente y servidor.
export const discovery = {
  sourceCandidateLimit: 40, pagesPerSource: 2, maxWindows: 20,
  windowsPerSearch: 3, sourceRequestLimit: 6, sourcePageBudget: 24, endpointPageBudget: 12, cursorLimit: 40,
  exhaustionProbeLimit: 2, recentLimit: 100, historyLimit: 1000, newMonths: 24,
  safeVotes: 300, hiddenVotes: 80, hiddenScore: 7, hiddenMaxVotes: 3000,
  hiddenPopularity: 40
};
export const recommendationModes = ["safe", "trending", "new", "hidden", "mix"];
export const sourcesFor = mode => mode === "mix" ? ["safe", "trending", "new", "hidden"] : [mode];
export function sourceParams(mode, type, filters, now = new Date()) {
  const field = type === "movie" ? "primary_release_date" : "first_air_date";
  if (mode === "safe") return { sort_by: "vote_average.desc", "vote_count.gte": String(discovery.safeVotes) };
  if (mode === "hidden") return { sort_by: "vote_average.desc", "vote_count.gte": String(discovery.hiddenVotes), "vote_count.lte": String(discovery.hiddenMaxVotes), "vote_average.gte": String(discovery.hiddenScore) };
  if (mode === "new") {
    const since = new Date(now);
    since.setUTCMonth(since.getUTCMonth() - discovery.newMonths);
    return { sort_by: `${field}.desc`, ...(!filters.yearFrom && !filters.yearTo ? { [`${field}.gte`]: since.toISOString().slice(0, 10) } : {}) };
  }
  return {};
}
export function modeQuality(title, mode) {
  if (mode === "safe") return title.votes >= discovery.safeVotes;
  if (mode === "hidden") return title.votes >= discovery.hiddenVotes && title.votes <= discovery.hiddenMaxVotes && title.score >= discovery.hiddenScore && title.popularity <= discovery.hiddenPopularity;
  return true;
}
export function modeScore(title, mode, base, filters = {}) {
  if (mode === "hidden") return base - Math.min(15, Math.max(0, title.popularity || 0) / 4);
  if (mode === "new") {
    const end = Number(filters.yearTo) || new Date().getFullYear();
    const start = Number(filters.yearFrom) || end - discovery.newMonths / 12;
    const year = Number(title.date?.slice(0, 4));
    return base + 10 * Math.max(0, Math.min(1, (year - start) / Math.max(1, end - start)));
  }
  return base;
}
