// Resolvemos IDs desde el catálogo regional de TMDB para admitir cambios de marca.
export const platforms = {
  netflix: { label: "Netflix", names: ["Netflix", "Netflix Standard with Ads"] },
  disney: { label: "Disney+", names: ["Disney Plus"] },
  max: { label: "Max", names: ["Max", "HBO Max"] },
  prime: { label: "Prime Video", names: ["Amazon Prime Video", "Amazon Prime Video with Ads", "Prime Video"] },
  crunchyroll: { label: "Crunchyroll", names: ["Crunchyroll"] },
  any: { label: "cualquier plataforma", names: [] }
};
export const regions = ["EC", "MX", "CO", "AR", "PE", "CL", "ES"];
export const defaultRegion = "EC";

export function matchesPlatform(availability, platform) {
  const names = platforms[platform]?.names ?? [];
  return availability?.providers?.some(provider => provider.kind === "flatrate" && names.some(name => name.toLowerCase() === provider.name?.toLowerCase())) ?? false;
}
