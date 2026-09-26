import { endpoint, validate, titleSchema, mediaPath, tmdb } from "../../server/tmdb.js";
export const onRequest = endpoint(async ({ request, env }) => {
  const { type, id, region } = validate(request, titleSchema);
  const data = await tmdb(env, `${mediaPath(type)}/${id}/watch/providers`);
  const local = data.results?.[region];
  const groups = ["flatrate", "free", "ads", "rent", "buy"];
  return {
    region,
    link: local?.link?.startsWith("https://www.themoviedb.org/") ? local.link : null,
    providers: groups.flatMap(kind => (local?.[kind] ?? []).map(item => ({ id: item.provider_id, name: item.provider_name, kind })))
  };
}, 3600);
