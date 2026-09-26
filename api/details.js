import { endpoint, validate, titleSchema, mediaPath, tmdb, normalizeTitle, ApiError } from "./_lib/tmdb.js";
export default endpoint(async req => {
  const { type, id } = validate(req, titleSchema);
  const item = await tmdb(`${mediaPath(type)}/${id}`);
  if (item.adult) throw new ApiError(404, "NOT_FOUND", "No encontramos este título.");
  return normalizeTitle(item, type);
}, 3600);
