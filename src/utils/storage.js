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
export const getRecent = () => validKeys("recent").slice(-30);
export const getSeen = () => validKeys("seen").slice(-1000);
export function addRecent(title) {
  const key = titleKey(title);
  write("recent", [...getRecent().filter(item => item !== key), key].slice(-30));
}
export function addSeen(title) {
  write("seen", [...new Set([...getSeen(), titleKey(title)])].slice(-1000));
}
