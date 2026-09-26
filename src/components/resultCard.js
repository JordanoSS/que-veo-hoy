import { explanation, runtimeLabel, typeLabels } from "../utils/format.js";

// Los textos externos se insertan con textContent, nunca como HTML.
function element(tag, className, text) {
  const node = document.createElement(tag);
  node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}
export function resultCard(container, title, availability, filters, actions) {
  const article = element("article", "result-card");
  const poster = element("img", "result-poster");
  poster.src = title.poster;
  poster.alt = `Póster de ${title.title}`;
  poster.width = 500;
  poster.height = 750;
  poster.loading = "lazy";
  poster.addEventListener("error", () => {
    poster.replaceWith(element("div", "poster-fallback", "Póster no disponible"));
  }, { once: true });
  const content = element("div", "result-content");
  content.append(element("span", "result-label", "TU ELECCIÓN"), element("h2", "", title.title));
  content.append(element("p", "result-meta", `${typeLabels[title.type].toUpperCase()} · ${title.date.slice(0, 4)} · ★ ${Number(title.score).toFixed(1)} / 10 TMDB`));
  content.append(element("p", "result-genres", `${title.genres.join(" / ")} · ${runtimeLabel(title)}`));
  content.append(element("p", "result-overview", title.overview));
  const reason = element("section", "result-reason");
  reason.append(element("h3", "result-reason-heading", "POR QUÉ TE LA RECOMENDAMOS"));
  reason.append(element("p", "", explanation(filters)));
  content.append(reason);
  const region = filters.region;
  if (availability?.providers.length) {
    const labels = { flatrate: "Suscripción", free: "Gratis", ads: "Con anuncios", rent: "Alquiler", buy: "Compra" };
    content.append(element("p", "result-label", `DÓNDE VER · ${region}`));
    const list = element("ul", "provider-list");
    for (const provider of availability.providers) {
      list.append(element("li", "", `${provider.name} · ${labels[provider.kind]}`));
    }
    content.append(list);
    if (availability.link) {
      const link = element("a", "provider-link", "Consultar disponibilidad en TMDB / JustWatch ↗");
      link.href = availability.link;
      link.target = "_blank";
      link.rel = "noopener noreferrer";
      content.append(link);
    }
  } else {
    content.append(element("p", "provider-note", availability
      ? `Sin información de plataformas para ${region}. La disponibilidad puede cambiar.`
      : "No pudimos comprobar las plataformas disponibles en este momento."));
  }
  const buttons = element("div", "result-actions");
  for (const [label, action] of [["VER OTRA", actions.another], ["YA LA VI", actions.seen], ["COMPARTIR", actions.share]]) {
    const button = element("button", "result-button", label);
    button.type = "button";
    if (label === "VER OTRA") {
      const arrow = element("span", "", " →");
      arrow.setAttribute("aria-hidden", "true");
      button.append(arrow);
    }
    button.addEventListener("click", () => action(button));
    buttons.append(button);
  }
  const status = element("p", "share-status");
  status.setAttribute("role", "status");
  content.append(buttons, status);
  article.append(poster, content);
  container.replaceChildren(article);
  return status;
}
