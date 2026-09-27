// Discover usa estos géneros; details + keywords deciden la aceptación final.
export const moods = {
  funny: { label: "reírme", movie: [35], tv: [35] },
  horror: { label: "pasar miedo", movie: [27], tv: [] },
  think: { label: "algo que me haga pensar", movie: [9648, 878, 53], tv: [9648, 10765] },
  romance: { label: "romance", movie: [10749], tv: [] },
  action: { label: "acción", movie: [28], tv: [10759] },
  relax: { label: "algo tranquilo", movie: [35, 10751, 16], tv: [35, 10751, 16] },
  random: { label: "sorpréndeme", movie: [], tv: [] }
};
export const semanticKeywords = {
  romance: ["romance", "romantic comedy", "romantic drama", "love story"],
  horror: ["horror", "supernatural horror", "psychological horror", "slasher"],
  scienceFiction: ["science fiction", "time travel", "artificial intelligence", "dystopia"],
  thriller: ["thriller", "psychological thriller"],
  anime: ["anime"],
  psychological: ["psychological", "psychological drama", "psychological thriller"]
};
export const hasKeyword = (title, names) => title.keywords?.some(word => names.includes(word.toLowerCase().trim())) ?? false;
// Animation es necesaria; país/idioma japonés o clasificación explícita anime
// constituyen evidencia. Una adaptación de manga occidental por sí sola no basta.
export function isAnimeCandidate(candidate, details = candidate, keywords = details.keywords ?? []) {
  const title = { ...candidate, ...details, keywords };
  return Boolean(title.genreIds?.includes(16) && (
    title.originalLanguage === "ja" || title.originCountries?.includes("JP") ||
    title.productionCountries?.includes("JP") || hasKeyword(title, semanticKeywords.anime)
  ));
}
export const isAnime = isAnimeCandidate;
export function semanticMatch(title, mood) {
  const genres = title.genreIds ?? [];
  const has = id => genres.includes(id);
  const horror = has(27) || hasKeyword(title, semanticKeywords.horror);
  const thriller = has(53) || hasKeyword(title, semanticKeywords.thriller);
  const romance = hasKeyword(title, semanticKeywords.romance);
  const tv = title.type === "tv" || title.type === "series";
  switch (mood) {
    case "random": return 1;
    // Política conservadora: incluso Romance + Horror se descarta.
    case "romance": return !horror && (tv ? romance : has(10749)) ? (romance ? 1 : 0.95) : 0;
    case "horror": return (tv ? hasKeyword(title, semanticKeywords.horror) : has(27)) ? 1 : 0;
    case "action": return has(tv ? 10759 : 28) ? 1 : 0;
    case "funny": return has(35) ? 1 : 0;
    case "think": return (tv ? has(9648) || hasKeyword(title, semanticKeywords.scienceFiction) || hasKeyword(title, semanticKeywords.thriller) || hasKeyword(title, semanticKeywords.psychological) : has(9648) || has(878) || has(53)) ? 1 : 0;
    case "relax": return !horror && !thriller && !has(tv ? 10759 : 28) && [35, 10751, 16].some(has) ? 1 : 0;
    default: return 0;
  }
}
