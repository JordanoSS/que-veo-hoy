// Resolvemos IDs desde el catálogo regional de TMDB para admitir cambios de marca.
export const platforms = {
  netflix: { label: "Netflix", names: ["Netflix", "Netflix Standard with Ads"] },
  disney: { label: "Disney+", names: ["Disney Plus"] },
  max: { label: "Max", names: ["Max", "HBO Max"] },
  prime: { label: "Prime Video", names: ["Amazon Prime Video", "Amazon Prime Video with Ads", "Prime Video"] },
  any: { label: "cualquier plataforma", names: [] }
};
export const regions = ["EC", "MX", "CO", "AR", "PE", "CL", "ES"];
export const defaultRegion = "EC";
