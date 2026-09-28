import { discovery, modeQuality, modeScore, sourcesFor } from "../config/discovery.js";
import { discover, details, providers } from "./movies.js";
import { matchesCandidate, matchesDiscoverCandidate, fallbackStages, qvhScore, ranking } from "../config/recommendation.js";
import { matchesPlatform } from "../config/platforms.js";
import { titleKey } from "../utils/storage.js";

const cursors = new Map();
export function resetRecommendationCursors() { cursors.clear(); }

export async function findTitle(filters, signal, history = {}, api = { discover, details, providers }) {
  signal?.throwIfAborted();
  const excluded = new Set([...(history.disliked ?? []), ...(history.seen ?? []), ...(history.recent ?? []), history.currentKey]);
  const types = ["any", "anime"].includes(filters.type) ? ["movie", "tv"] : [filters.type];
  const detailCache = new Map();
  const providerCache = new Map();
  let failedDetails = false;
  let exhausted = false;
  let enriched = 0;
  let sourceRequests = 0;
  let sourcePages = 0;
  const mode = filters.recommendationMode ?? "mix";
  const score = (title, availability) => modeScore(title, mode, qvhScore(title, filters, availability), filters);

  async function qualify(candidate, effective) {
    const key = titleKey(candidate);
    let title;
    if (!detailCache.has(key) && enriched >= ranking.enrichmentLimit) return;
    try {
      if (!detailCache.has(key)) {
        enriched++;
        detailCache.set(key, await api.details(candidate, filters.region, signal));
      }
      title = detailCache.get(key);
    } catch (error) {
      if (signal?.aborted) throw error;
      if (error.code !== "NOT_FOUND") failedDetails = true;
      return;
    }
    if (titleKey(title) !== key || !matchesCandidate(title, effective) || !modeQuality(title, mode)) return;
    let availability = null;
    try {
      if (!providerCache.has(key)) providerCache.set(key, title.availability?.region === filters.region ? title.availability : await api.providers(title, filters.region, signal));
      availability = providerCache.get(key);
    } catch (error) {
      if (signal?.aborted) throw error;
      // Un fallo de disponibilidad no demuestra ausencia de plataforma.
      if (effective.platform !== "any") throw error;
    }
    if (effective.platform !== "any" && !matchesPlatform(availability, effective.platform)) return;
    return { title: { ...title, sources: candidate.sources ?? [] }, availability };
  }

  for (const stage of fallbackStages(filters)) {
    const recentCandidates = new Map();
    const pool = new Map();
    for (const type of types) {
      const effective = { ...stage, type: filters.type === "anime" ? "anime" : type };
      // Anime discover consulta ambos tipos; no duplicamos esa solicitud.
      if (filters.type === "anime" && type === "tv") continue;
      const cursorKey = JSON.stringify(effective);
      let window = cursors.get(cursorKey) ?? 0;
      for (let attempt = 0; attempt < discovery.windowsPerSearch; attempt++) {
        if (sourceRequests >= discovery.sourceRequestLimit || sourcePages >= discovery.sourcePageBudget) break;
        sourceRequests++;
        const requestFilters = window ? { ...effective, window } : { ...effective };
        const remainingPages = discovery.sourcePageBudget - sourcePages;
        if (remainingPages < discovery.endpointPageBudget) requestFilters.sourceBudget = remainingPages;
        const data = await api.discover(requestFilters, signal);
        sourcePages += data.sourceRequests ?? 0;
        for (const candidate of data.candidates) {
          if ((history.recent ?? []).includes(titleKey(candidate)) && matchesDiscoverCandidate(candidate, effective)) {
            recentCandidates.set(titleKey(candidate), { candidate, effective });
          }
        }
        const candidates = [...new Map(data.candidates.map(title => [titleKey(title), title])).values()].filter(title => !excluded.has(titleKey(title)))
          .filter(title => matchesDiscoverCandidate(title, effective) && modeQuality(title, mode))
          .sort((a, b) => score(b) - score(a));
        // Intercalar las fuentes evita que Safe monopolice el enrichment de Mix.
        if (mode === "mix" && candidates.some(title => title.sources?.length)) {
          const ordered = [];
          const remaining = new Set(candidates);
          const sources = sourcesFor(mode);
          const rotation = Math.floor(Math.random() * sources.length);
          const rotated = [...sources.slice(rotation), ...sources.slice(0, rotation)];
          while (remaining.size) {
            const before = remaining.size;
            for (const source of rotated) {
              const next = [...remaining].find(title => title.sources?.includes(source));
              if (next) { ordered.push(next); remaining.delete(next); }
            }
            if (remaining.size === before) { ordered.push(...remaining); break; }
          }
          candidates.splice(0, candidates.length, ...ordered);
        }
        candidates.splice(ranking.discoverCandidateLimit);
        // Lotes pequeños evitan una ráfaga de hasta 40 peticiones simultáneas.
        for (let offset = 0; offset < Math.min(candidates.length, ranking.enrichmentLimit); offset += ranking.batchSize) {
          await Promise.all(candidates.slice(offset, Math.min(offset + ranking.batchSize, ranking.enrichmentLimit)).map(async candidate => {
            const key = titleKey(candidate);
            const qualified = await qualify(candidate, effective);
            if (!qualified) return;
            const { title, availability } = qualified;
            pool.set(key, { title: { ...title, sources: candidate.sources ?? [] }, availability, effective: { ...effective, type: title.type }, qvhScore: qvhScore(title, filters, availability), selectionScore: score(title, availability), relaxed: { time: stage.time !== filters.time, platform: stage.platform !== filters.platform } });
          }));
          // Solo paramos con un grupo excelente y semánticamente validado.
          // El siguiente tipo aún se evalúa para no sesgar "cualquiera" a películas.
          const ranked = [...pool.values()]
            .filter(item => filters.type !== "any" || item.title.type === type)
            .sort((a, b) => b.qvhScore - a.qvhScore);
          if (ranked.filter(item => item.qvhScore >= ranking.excellentScore && item.qvhScore >= ranked[0].qvhScore - ranking.maxGap).length >= ranking.targetQualifiedCandidates) break;
        }
        if (pool.size || !data.hasMore || enriched >= ranking.enrichmentLimit) break;
        window++;
        if (cursors.size >= discovery.cursorLimit) cursors.delete(cursors.keys().next().value);
        signal?.throwIfAborted();
        cursors.set(cursorKey, window);
      }
    }
    if (pool.size) {
      const eligible = mode === "mix" ? (() => {
        const represented = sourcesFor(mode).filter(source => [...pool.values()].some(item => item.title.sources.includes(source)));
        const source = represented[Math.floor(Math.random() * represented.length)];
        return source ? [...pool.values()].filter(item => item.title.sources.includes(source)) : [...pool.values()];
      })() : [...pool.values()];
      const ranked = eligible.sort((a, b) => b.selectionScore - a.selectionScore);
      const best = ranked.filter(item => item.selectionScore >= ranked[0].selectionScore - ranking.maxGap).slice(0, ranking.topCount);
      signal?.throwIfAborted();
      return best[Math.floor(Math.random() * best.length)];
    }
    // Comprobar evidencia semántica y disponibilidad antes de llamar agotado
    // a un resultado excluido. Recent puede proceder de otros filtros/países.
    for (const { candidate, effective } of [...recentCandidates.values()].slice(0, discovery.exhaustionProbeLimit)) {
      if (await qualify(candidate, effective)) { exhausted = true; break; }
    }
    if (exhausted) break;
  }
  if (failedDetails) throw new Error("DETAILS_FAILED");
  return exhausted ? { status: "exhausted" } : null;
}
