import { endpoint, validate, titleSchema, mediaPath, tmdb, normalizeTitle, ApiError } from "../../server/tmdb.js";
import { normalizeProviders } from "../../server/providers.js";
export const onRequest = endpoint(async ({ request, env }) => {
  const { type, id, region } = validate(request, titleSchema);
  const item = await tmdb(env, `${mediaPath(type)}/${id}`, { append_to_response: "keywords,watch/providers" });
  if (item.adult) throw new ApiError(404, "NOT_FOUND", "No encontramos este título.");
  return { ...normalizeTitle(item, type), availability: normalizeProviders(item["watch/providers"], region) };
}, 3600);
