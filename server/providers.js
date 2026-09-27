// Mismo contrato para el subrecurso anexado y /api/providers.
const isRecord = value => value !== null && typeof value === "object" && !Array.isArray(value);
export function normalizeProviders(data, region) {
  if (!isRecord(data?.results)) return null;
  const local = data.results[region];
  const groups = ["flatrate", "free", "ads", "rent", "buy"];
  // Datos malformados significan disponibilidad desconocida, no catálogo vacío.
  if (Object.hasOwn(data.results, region) && !isRecord(local)) return null;
  for (const kind of groups) {
    if (!local || !Object.hasOwn(local, kind)) continue;
    if (!Array.isArray(local[kind]) || local[kind].some(item => !isRecord(item)
      || !Number.isSafeInteger(item.provider_id) || item.provider_id <= 0
      || typeof item.provider_name !== "string" || !item.provider_name.trim())) return null;
  }
  return {
    region,
    link: typeof local?.link === "string" && local.link.startsWith("https://www.themoviedb.org/") ? local.link : null,
    providers: groups.flatMap(kind => (local?.[kind] ?? [])
      .map(item => ({ id: item.provider_id, name: item.provider_name, kind })))
  };
}
