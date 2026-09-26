// TMDB utiliza catálogos de géneros distintos para películas y televisión.
// TV no tiene Horror/Thriller: no sustituimos terror por misterio.
// Un array vacío para un mood explícito indica que no hay género compatible.
export const moods = {
  funny: { label: "reírme", movie: [35], tv: [35] },
  horror: { label: "pasar miedo", movie: [27, 53], tv: [] },
  think: { label: "algo que me haga pensar", movie: [9648, 878, 53], tv: [9648, 10765] },
  romance: { label: "romance", movie: [10749, 18], tv: [18] },
  action: { label: "acción", movie: [28, 12], tv: [10759] },
  relax: { label: "algo tranquilo", movie: [35, 10751, 16], tv: [35, 10751, 16] },
  random: { label: "sorpréndeme", movie: [], tv: [] }
};
