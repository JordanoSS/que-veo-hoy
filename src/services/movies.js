// Caché corta por sesión. Las peticiones canceladas o fallidas nunca se guardan.
const cache = new Map();
async function request(route, params, signal) {
  const url = `/api/${route}?${new URLSearchParams(Object.entries(params).filter(([, value]) => value !== undefined && value !== null && value !== ""))}`;
  const cached = cache.get(url);
  if (cached && cached.expires > Date.now()) return cached.data;
  const response = await fetch(url, { signal, headers: { Accept: "application/json" } });
  let body;
  try { body = await response.json(); } catch { throw new Error("INVALID_RESPONSE"); }
  if (!response.ok || !body.ok) {
    const error = new Error("No pudimos obtener recomendaciones. Intenta nuevamente.");
    error.code = body.error?.code ?? "REQUEST_FAILED";
    throw error;
  }
  if (cache.size >= 80) cache.delete(cache.keys().next().value);
  cache.set(url, { data: body.data, expires: Date.now() + 60000 });
  return body.data;
}
export const discover = (filters, signal) => request("discover", filters, signal);
export const details = (title, region, signal) => request("details", { type: title.type, id: title.id, region }, signal);
export const providers = (title, region, signal) => request("providers", { type: title.type, id: title.id, region }, signal);
