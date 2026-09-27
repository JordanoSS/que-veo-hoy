import { moods } from "../config/moods.js";
import { platforms } from "../config/platforms.js";
export const timeLabels = { "30": "menos de 30 minutos", "60": "menos de 1 hora", "120": "menos de 2 horas", any: "sin límite de tiempo" };
export const typeLabels = { anime: "anime", movie: "película", series: "serie", tv: "serie", any: "película o serie" };
export function explanation(filters) {
  const used = filters.effective ?? filters;
  const years = used.yearFrom && used.yearTo ? `entre ${used.yearFrom} y ${used.yearTo}` : used.yearFrom ? `desde ${used.yearFrom}` : used.yearTo ? `hasta ${used.yearTo}` : "de cualquier año";
  const base = `${filters.type === "anime" ? "anime, " : ""}${moods[used.mood].label}, ${typeLabels[used.type]} y ${years}`;
  const duration = `${timeLabels[used.time]}${used.type !== "movie" && used.time !== "any" ? " por episodio" : ""}`;
  if (filters.relaxed?.platform) return `Mantuvimos ${base}. No encontramos una opción adecuada confirmada en ${platforms[filters.platform].label}, así que ampliamos la búsqueda a otras plataformas.${filters.relaxed.time ? " También ampliamos la duración." : ""}`;
  const confirmed = used.platform !== "any" ? ` TMDB confirma ${platforms[used.platform].label} para ${filters.region}.` : "";
  if (filters.relaxed?.time) return `Mantuvimos ${base} y ${platforms[used.platform].label}, pero ampliamos la duración para encontrar una opción.${confirmed}`;
  return `Coincide con ${base}, supera nuestros filtros de valoración y encaja con ${duration} y ${platforms[used.platform].label}.${confirmed}`;
}
export function runtimeLabel(title) {
  if (!title.runtime) return "Duración no disponible";
  return `${title.runtime} min${title.type !== "movie" ? " por episodio (aprox.)" : ""}`;
}
export function shareText(title, filters) {
  const url = new URL(window.location.href);
  url.hash = "";
  url.search = "";
  return `🎬 ¿Qué veo hoy?\n\nHoy me recomendaron:\n${title.title}\n\nMood: ${moods[filters.mood].label}\n\n¿Qué te recomienda a ti?\n\n${url.href}`;
}
