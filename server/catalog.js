import { tmdb } from "./tmdb.js";
import { platforms } from "../src/config/platforms.js";

// Catálogos públicos únicamente. Caché acotada por isolate de Pages, sin credenciales.
const cache = new Map();
async function cached(key, fetchData) {
  const hit = cache.get(key);
  if (hit?.expires > Date.now()) return hit.value;
  const value = await fetchData();
  if (cache.size >= 100) cache.delete(cache.keys().next().value);
  cache.set(key, { value, expires: Date.now() + 3600000 });
  return value;
}
export async function providerIds(env, type, region, platform) {
  const catalog = await cached(`providers:${type}:${region}`, () => tmdb(env, `watch/providers/${type}`, { watch_region: region }));
  const names = platforms[platform].names.map(name => name.toLowerCase());
  return (catalog.results ?? []).filter(item => names.includes(item.provider_name?.toLowerCase())).map(item => item.provider_id);
}
export async function keywordIds(env, names) {
  const matches = await Promise.all(names.map(name => cached(`keyword:${name}`, async () => {
    const data = await tmdb(env, "search/keyword", { query: name });
    return (data.results ?? []).filter(item => item.name?.toLowerCase() === name).map(item => item.id);
  })));
  return [...new Set(matches.flat())];
}
