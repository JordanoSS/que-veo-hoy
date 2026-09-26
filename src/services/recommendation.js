import { discover, details, providers } from "./movies.js";
import { matchesCandidate, fallbackStages } from "../config/recommendation.js";
import { platforms } from "../config/platforms.js";
import { shuffle } from "../utils/random.js";
import { titleKey } from "../utils/storage.js";

export async function findTitle(filters, signal, history = {}, api = { discover, details, providers }) {
  const seen = new Set(history.seen ?? []);
  const recent = new Set(history.recent ?? []);
  const types = filters.type === "any" ? shuffle(["movie", "tv"]) : [filters.type];
  let failedDetails = false;
  for (const stage of fallbackStages(filters)) {
    for (const type of types) {
      const effective = { ...stage, type };
      const data = await api.discover(effective, signal);
      const unseen = shuffle(data.candidates).filter(title => !seen.has(titleKey(title)) && titleKey(title) !== history.currentKey);
      const ordered = [...unseen.filter(title => !recent.has(titleKey(title))), ...unseen.filter(title => recent.has(titleKey(title)))];
      for (const candidate of ordered.slice(0, 10)) {
        if (!matchesCandidate(candidate, effective, false)) continue;
        let title;
        try { title = await api.details(candidate, filters.region, signal); }
        catch (error) {
          if (signal.aborted) throw error;
          if (error.code !== "NOT_FOUND") failedDetails = true;
          continue;
        }
        if (!matchesCandidate(title, effective)) continue;
        let availability = null;
        try { availability = await api.providers(title, filters.region, signal); }
        catch (error) { if (signal.aborted) throw error; }
        if (stage.platform !== "any") {
          const names = platforms[stage.platform].names.map(name => name.toLowerCase());
          if (!availability?.providers.some(provider => provider.kind === "flatrate" && names.includes(provider.name.toLowerCase()))) continue;
        }
        return { title, availability, effective, relaxed: { time: stage.time !== filters.time, platform: stage.platform !== filters.platform } };
      }
    }
  }
  if (failedDetails) throw new Error("DETAILS_FAILED");
  return null;
}
