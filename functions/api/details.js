import { endpoint, validate, titleSchema, mediaPath, tmdb, normalizeTitle, ApiError } from "../../server/tmdb.js";
export const onRequest = endpoint(async ({ request, env }) => {
  const { type, id } = validate(request, titleSchema);
  const item = await tmdb(env, `${mediaPath(type)}/${id}`, { append_to_response: "keywords" });
  if (item.adult) throw new ApiError(404, "NOT_FOUND", "No encontramos este título.");
  return normalizeTitle(item, type);
}, 3600);
