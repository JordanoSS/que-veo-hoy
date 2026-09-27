import { explanation, runtimeLabel, typeLabels } from "../utils/format.js";

// Los textos externos se insertan con textContent, nunca como HTML.
function element(tag, className, text) {
  const node = document.createElement(tag);
  node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}
const cards = new WeakMap();
export function resultCard(container, title, availability, filters, actions) {
  let view = cards.get(container);
  if (!view || !container.contains(view.article)) {
    view = createCard(container);
    cards.set(container, view);
  }
  view.actions = actions;
  const { poster, heading, meta, genres, overview, reasonText, providerArea, status } = view;
  poster.hidden = false;
  view.posterFallback.hidden = true;
  poster.src = title.poster;
  poster.alt = `Póster de ${title.title}`;
  heading.textContent = title.title;
  meta.textContent = `${typeLabels[title.type].toUpperCase()} · ${title.date.slice(0, 4)} · ★ ${Number(title.score).toFixed(1)} / 10 TMDB`;
  genres.textContent = `${title.genres.join(" / ")} · ${runtimeLabel(title)}`;
  overview.textContent = title.overview;
  reasonText.textContent = explanation(filters);
  status.textContent = "";
  renderProviders(providerArea, availability, filters.region);
  return status;
}
function createCard(container) {
  const view = {};
  const article = element("article", "result-card");
  const poster = element("img", "result-poster");
  poster.width = 500;
  poster.height = 750;
  poster.loading = "lazy";
  const posterFallback = element("div", "poster-fallback", "Póster no disponible");
  posterFallback.hidden = true;
  poster.addEventListener("error", () => {
    poster.hidden = true;
    posterFallback.hidden = false;
  });
  const content = element("div", "result-content");
  const body = element("div", "result-body");
  const heading = element("h2", "");
  const meta = element("p", "result-meta");
  const genres = element("p", "result-genres");
  const overview = element("p", "result-overview");
  body.append(element("span", "result-label", "TU ELECCIÓN"), heading, meta, genres, overview);
  const reason = element("section", "result-reason");
  const reasonText = element("p", "");
  reason.append(element("h3", "result-reason-heading", "POR QUÉ TE LA RECOMENDAMOS"), reasonText);
  const providerArea = element("div", "result-providers");
  body.append(reason, providerArea);
  content.append(body);
  const buttons = element("div", "result-actions");
  for (const [label, action] of [["VER OTRA", "another"], ["YA LA VI", "seen"], ["NO ME INTERESA", "disliked"], ["COMPARTIR", "share"]]) {
    const button = element("button", "result-button", label);
    button.type = "button";
    if (label === "VER OTRA") {
      const arrow = element("span", "", " →");
      arrow.setAttribute("aria-hidden", "true");
      button.append(arrow);
    }
    button.addEventListener("click", () => view.actions[action](button));
    buttons.append(button);
  }
  const status = element("p", "share-status");
  status.setAttribute("role", "status");
  content.append(buttons, status);
  article.append(poster, posterFallback, content);
  container.replaceChildren(article);
  return Object.assign(view, { article, poster, posterFallback, heading, meta, genres, overview, reasonText, providerArea, status });
}

function renderProviders(container, availability, region) {
  container.replaceChildren();
  if (availability?.providers.length) {
    const labels = { flatrate: "Suscripción", free: "Gratis", ads: "Con anuncios", rent: "Alquiler", buy: "Compra" };
    container.append(element("p", "result-label", `DÓNDE VER · ${region}`));
    const list = element("ul", "provider-list");
    for (const provider of availability.providers) {
      list.append(element("li", "", `${provider.name} · ${labels[provider.kind]}`));
    }
    container.append(list);
    if (availability.link) {
      const link = element("a", "provider-link", "Consultar disponibilidad en TMDB / JustWatch ↗");
      link.href = availability.link;
      link.target = "_blank";
      link.rel = "noopener noreferrer";
      container.append(link);
    }
  } else {
    container.append(element("p", "provider-note", availability
      ? `Sin información de plataformas para ${region}. La disponibilidad puede cambiar.`
      : "No pudimos comprobar las plataformas disponibles en este momento."));
  }
}
