import { discovery } from "../config/discovery.js";
import { defaultRegion, regions } from "../config/platforms.js";
const memory = new Map();
const prefix = "qvh:";

function read(key, fallback) {
  if (memory.has(key)) return memory.get(key);
  try {
    const raw = localStorage.getItem(prefix + key);
    if (raw !== null) {
      const value = JSON.parse(raw);
      memory.set(key, value);
      return value;
    }
  } catch { /* Modo privado, JSON dañado o almacenamiento bloqueado. */ }
  return memory.get(key) ?? fallback;
}
function write(key, value) {
  memory.set(key, value);
  try { localStorage.setItem(prefix + key, JSON.stringify(value)); } catch { /* Sesión en memoria. */ }
}
export const titleKey = title => `${title.type === "tv" ? "series" : title.type}:${title.id}`;
function validKeys(key) {
  const values = read(key, []);
  return Array.isArray(values) ? values.filter(value => /^(movie|series):[1-9]\d*$/.test(value)) : [];
}
export function getRegion() {
  const region = read("region", defaultRegion);
  return regions.includes(region) ? region : defaultRegion;
}
export function setRegion(region) {
  if (regions.includes(region)) write("region", region);
}
export const getRecent = () => validKeys("recent").slice(-discovery.recentLimit);
export const getSeen = () => validKeys("seen").slice(-discovery.historyLimit);
export function addRecent(title) {
  const key = titleKey(title);
  write("recent", [...getRecent().filter(item => item !== key), key].slice(-discovery.recentLimit));
}
export function addSeen(title) {
  write("seen", [...new Set([...getSeen(), titleKey(title)])].slice(-discovery.historyLimit));
}
export const getDisliked = () => validKeys("disliked").slice(-discovery.historyLimit);
export function addDisliked(title) {
  write("disliked", [...new Set([...getDisliked(), titleKey(title)])].slice(-discovery.historyLimit));
}
function removeKeys(keys) {
  let persisted = true;
  for (const key of keys) {
    memory.delete(key);
    try { localStorage.removeItem(prefix + key); }
    catch { persisted = false; }
    // Evita resucitar datos antiguos si el navegador bloquea la eliminación.
    memory.set(key, key === "region" ? defaultRegion : []);
  }
  return persisted;
}
export function clearHistory() {
  return removeKeys(["recent", "seen", "disliked"]);
}
export function clearAllData() {
  const keys = new Set(["region", "recent", "seen", "disliked", ...memory.keys()]);
  let accessible = true;
  try {
    for (let index = 0; index < localStorage.length; index++) {
      const key = localStorage.key(index);
      if (key?.startsWith(prefix)) keys.add(key.slice(prefix.length));
    }
  } catch { accessible = false; }
  const persisted = removeKeys(keys);
  return persisted && accessible;
}
// Los cambios en otras pestañas deben invalidar la caché de lectura de sesión.
export function resetStorageMemory() { memory.clear(); }
