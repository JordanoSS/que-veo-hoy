import { endpoint, validate, titleSchema, mediaPath, tmdb, ApiError } from "../../server/tmdb.js";
import { normalizeProviders } from "../../server/providers.js";
export const onRequest = endpoint(async ({ request, env }) => {
  const { type, id, region } = validate(request, titleSchema);
  const data = await tmdb(env, `${mediaPath(type)}/${id}/watch/providers`);
  const providers = normalizeProviders(data, region);
  if (!providers) throw new ApiError(502, "UPSTREAM_ERROR", "No pudimos comprobar la disponibilidad.");
  return providers;
}, 3600);
