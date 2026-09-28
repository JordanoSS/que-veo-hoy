import { tmdb } from "./tmdb.js";
import { platforms } from "../src/config/platforms.js";

// Catálogos públicos únicamente. Caché acotada por isolate de Pages, sin credenciales.
const cache = new Map();
async function cached(key, fetchData) {
  const hit = cache.get(key);
  if (hit?.expires > Date.now()) return hit.value;
  // Guardar la promesa también deduplica búsquedas de catálogo simultáneas.
  const entry = { value: null, expires: Infinity };
  if (cache.size >= 100) cache.delete(cache.keys().next().value);
  entry.value = Promise.resolve().then(fetchData);
  cache.set(key, entry);
  try {
    const value = await entry.value;
    entry.value = value;
    entry.expires = Date.now() + 3600000;
    return value;
  } catch (error) {
    if (cache.get(key) === entry) cache.delete(key);
    throw error;
  }
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
