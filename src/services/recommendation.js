import { discover, details, providers } from "./movies.js";
import { matchesCandidate, fallbackStages, qvhScore, ranking } from "../config/recommendation.js";
import { matchesPlatform } from "../config/platforms.js";
import { titleKey } from "../utils/storage.js";

export async function findTitle(filters, signal, history = {}, api = { discover, details, providers }) {
  const excluded = new Set([...(history.disliked ?? []), ...(history.seen ?? []), ...(history.recent ?? []), history.currentKey]);
  const types = ["any", "anime"].includes(filters.type) ? ["movie", "tv"] : [filters.type];
  const detailCache = new Map();
  const providerCache = new Map();
  let failedDetails = false;
  for (const stage of fallbackStages(filters)) {
    const pool = new Map();
    for (const type of types) {
      const effective = { ...stage, type: filters.type === "anime" ? "anime" : type };
      // Anime discover consulta ambos tipos; no duplicamos esa solicitud.
      if (filters.type === "anime" && type === "tv") continue;
      const data = await api.discover(effective, signal);
      const candidates = [...new Map(data.candidates.map(title => [titleKey(title), title])).values()].filter(title => !excluded.has(titleKey(title)))
        .filter(title => matchesCandidate(title, effective, false, false))
        .sort((a, b) => qvhScore(b, filters) - qvhScore(a, filters)).slice(0, ranking.candidateLimit);
      // Lotes pequeños evitan una ráfaga de hasta 40 peticiones simultáneas.
      for (let offset = 0; offset < candidates.length; offset += 4) {
        await Promise.all(candidates.slice(offset, offset + 4).map(async candidate => {
          const key = titleKey(candidate);
          let title;
          try {
            if (!detailCache.has(key)) detailCache.set(key, await api.details(candidate, filters.region, signal));
            title = detailCache.get(key);
          } catch (error) {
            if (signal?.aborted) throw error;
            if (error.code !== "NOT_FOUND") failedDetails = true;
            return;
          }
          if (titleKey(title) !== key || excluded.has(titleKey(title)) || !matchesCandidate(title, effective)) return;
          let availability = null;
          try {
            if (!providerCache.has(key)) providerCache.set(key, title.availability?.region === filters.region ? title.availability : await api.providers(title, filters.region, signal));
            availability = providerCache.get(key);
          } catch (error) {
            if (signal?.aborted) throw error;
            // Un fallo de disponibilidad no demuestra ausencia de plataforma.
            if (stage.platform !== "any") throw error;
          }
          if (stage.platform !== "any" && !matchesPlatform(availability, stage.platform)) return;
          pool.set(key, { title, availability, effective: { ...effective, type: title.type }, qvhScore: qvhScore(title, filters, availability), relaxed: { time: stage.time !== filters.time, platform: stage.platform !== filters.platform } });
        }));
        // Solo paramos con un grupo excelente y semánticamente validado.
        // El siguiente tipo aún se evalúa para no sesgar "cualquiera" a películas.
        const ranked = [...pool.values()]
          .filter(item => filters.type !== "any" || item.title.type === type)
          .sort((a, b) => b.qvhScore - a.qvhScore);
        if (ranked.filter(item => item.qvhScore >= ranking.excellentScore && item.qvhScore >= ranked[0].qvhScore - ranking.maxGap).length >= ranking.topCount) break;
      }
    }
    if (pool.size) {
      const ranked = [...pool.values()].sort((a, b) => b.qvhScore - a.qvhScore);
      const best = ranked.filter(item => item.qvhScore >= ranked[0].qvhScore - ranking.maxGap).slice(0, ranking.topCount);
      return best[Math.floor(Math.random() * best.length)];
    }
  }
  if (failedDetails) throw new Error("DETAILS_FAILED");
  return null;
}
