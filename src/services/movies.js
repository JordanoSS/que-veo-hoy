// Caché corta por sesión. Las peticiones canceladas o fallidas nunca se guardan.
const cache = new Map();
// Compartir solo dentro del mismo ciclo de cancelación: abortar una búsqueda
// nunca cancela la petición de una búsqueda nueva con otra señal.
const pendingBySignal = new WeakMap();
const pendingWithoutSignal = new Map();
async function request(route, params, signal) {
  const url = `/api/${route}?${new URLSearchParams(Object.entries(params).filter(([, value]) => value !== undefined && value !== null && value !== ""))}`;
  signal?.throwIfAborted();
  const cached = cache.get(url);
  if (cached && cached.expires > Date.now()) return cached.data;
  let pending = pendingWithoutSignal;
  if (signal) {
    if (!pendingBySignal.has(signal)) pendingBySignal.set(signal, new Map());
    pending = pendingBySignal.get(signal);
  }
  if (pending.has(url)) return pending.get(url);
  const promise = fetchData(url, signal);
  if (pending.size >= 80) pending.delete(pending.keys().next().value);
  pending.set(url, promise);
  try {
    return await promise;
  } finally {
    if (pending.get(url) === promise) pending.delete(url);
  }
}
async function fetchData(url, signal) {
  const response = await fetch(url, { signal, headers: { Accept: "application/json" } });
  let body;
  try { body = await response.json(); } catch { throw new Error("INVALID_RESPONSE"); }
  if (!response.ok || !body.ok) {
    const error = new Error("No pudimos obtener recomendaciones. Intenta nuevamente.");
    error.code = body.error?.code ?? "REQUEST_FAILED";
    throw error;
  }
  signal?.throwIfAborted();
  if (cache.size >= 80) cache.delete(cache.keys().next().value);
  cache.set(url, { data: body.data, expires: Date.now() + 60000 });
  return body.data;
}
export const discover = (filters, signal) => request("discover", filters, signal);
export const details = (title, region, signal) => request("details", { type: title.type, id: title.id, region }, signal);
export const providers = (title, region, signal) => request("providers", { type: title.type, id: title.id, region }, signal);
