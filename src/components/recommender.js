import { findTitle, resetRecommendationCursors } from "../services/recommendation.js";
import { moods } from "../config/moods.js";
import { currentYear, yearError } from "../config/recommendation.js";
import { getRegion, setRegion, getRecent, getSeen, addRecent, addSeen, getDisliked, addDisliked, resetStorageMemory, titleKey } from "../utils/storage.js";
import { initPrivacyControls } from "./privacyControls.js";
import { regions } from "../config/platforms.js";
import { shareText } from "../utils/format.js";
import { loadingState } from "./loadingState.js";
import { errorState } from "./errorState.js";
import { resultCard } from "./resultCard.js";

export function initRecommender(findRecommendation = findTitle) {
  const selections = { recommendationMode: "mix", platform: "any", type: "any", mood: null, time: "any", yearPreset: "any", yearFrom: undefined, yearTo: undefined };
  const result = document.getElementById("result");
  const recommend = document.getElementById("recommendButton");
  let controller;
  let cycleFilters;
  let cardStatus;
  let currentKey = getRecent().at(-1);
  const region = document.getElementById("region");
  region.value = getRegion();

  const customYears = document.getElementById("customYears");
  const yearInputs = [document.getElementById("yearFrom"), document.getElementById("yearTo")];
  const validation = document.getElementById("yearError");
  const moodHint = document.getElementById("moodHint");
  let loading = false;
  function sync() {
    for (const group of document.querySelectorAll(".options")) {
      for (const button of group.querySelectorAll(".option")) {
        const selected = button.dataset.value === selections[group.dataset.group];
        button.classList.toggle("selected", selected);
        button.setAttribute("aria-pressed", String(selected));
      }
    }
    const custom = selections.yearPreset === "custom";
    customYears.hidden = !custom;
    const error = yearError(selections, custom);
    for (const input of yearInputs) {
      input.disabled = !custom;
      input.max = currentYear();
      input.setAttribute("aria-invalid", String(Boolean(error)));
    }
    validation.textContent = error;
    moodHint.textContent = selections.mood ? "Mood elegido. Puedes cambiarlo cuando quieras." : "Elige un mood para activar DIME QUÉ VER.";
    recommend.disabled = loading || !Object.hasOwn(moods, selections.mood) || Boolean(error);
    recommend.setAttribute("aria-busy", String(loading));
  }
  function invalidate() {
    controller?.abort();
    controller = undefined;
    loading = false;
    cycleFilters = undefined;
    cardStatus = undefined;
    result.style.minHeight = "";
    result.setAttribute("aria-busy", "false");
    result.classList.add("hidden");
    sync();
  }
  function select(group, value) {
    selections[group.dataset.group] = value;
    if (group.dataset.group === "yearPreset") {
      const bounds = { any: [], "2020": [2020, currentYear()], "2010": [2010, 2019], "2000": [2000, 2009], "1990": [1990, 1999], custom: ["", ""] };
      [selections.yearFrom, selections.yearTo] = bounds[value];
      for (const input of yearInputs) input.value = selections[input.id] ?? "";
    }
    invalidate();
  }
  region.addEventListener("change", () => {
    if (!regions.includes(region.value)) return;
    setRegion(region.value);
    invalidate();
  });
  initPrivacyControls(all => {
    resetRecommendationCursors();
    currentKey = undefined;
    if (all) {
      Object.assign(selections, { recommendationMode: "mix", platform: "any", type: "any", mood: null, time: "any", yearPreset: "any", yearFrom: undefined, yearTo: undefined });
      region.value = getRegion();
      for (const input of yearInputs) input.value = "";
    }
    invalidate();
  });
  globalThis.addEventListener?.("storage", event => {
    if (event.key === null || event.key.startsWith("qvh:")) {
      resetStorageMemory();
      currentKey = undefined;
      region.value = getRegion();
      invalidate();
    }
  });
  for (const input of yearInputs) {
    input.addEventListener("input", () => {
      if (selections.yearPreset !== "custom") return;
      selections[input.id] = input.value === "" ? "" : Number(input.value);
      invalidate();
    });
  }
  for (const group of document.querySelectorAll(".options")) {
    const heading = group.parentElement.querySelector("h3");
    heading.id = `question-${group.dataset.group}`;
    group.setAttribute("role", "group");
    group.setAttribute("aria-labelledby", heading.id);
    for (const button of group.querySelectorAll(".option")) {
      button.type = "button";
      button.setAttribute("aria-pressed", String(button.classList.contains("selected")));
      button.addEventListener("click", () => select(group, button.dataset.value));
    }
  }
  for (const link of document.querySelectorAll("[data-type]")) {
    link.addEventListener("click", event => {
      if (event.ctrlKey || event.metaKey || event.shiftKey || event.altKey || event.button > 0) return;
      event.preventDefault();
      select(document.querySelector('[data-group="type"]'), link.dataset.type);
      document.getElementById("recomendador").focus({ preventScroll: true });
      document.getElementById("recomendador").scrollIntoView({ behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth" });
    });
  }

  const linkedType = new URLSearchParams(globalThis.location?.search).get("tipo");
  if (["movie", "tv", "anime"].includes(linkedType)) selections.type = linkedType;
  sync();

  async function run(refresh = false) {
    if (loading || !Object.hasOwn(moods, selections.mood) || yearError(selections, selections.yearPreset === "custom")) return;
    controller?.abort();
    const active = new AbortController();
    controller = active;
    const { yearPreset, ...selectedFilters } = selections;
    const filters = refresh && cycleFilters ? { ...cycleFilters } : { ...selectedFilters, region: getRegion() };
    cycleFilters = { ...filters };
    const preserveCard = refresh && Boolean(cardStatus);
    if (!refresh) result.style.minHeight = "";
    // Reserva la altura ya ocupada para que un título más corto no reduzca
    // el documento bajo el viewport. No hay scroll forzado en un refresh.
    if (preserveCard) {
      result.style.minHeight = `${result.getBoundingClientRect().height}px`;
      for (const body of result.querySelectorAll(".result-body")) {
        body.style.minHeight = `${body.getBoundingClientRect().height}px`;
      }
    }
    const timeout = setTimeout(() => active.abort("timeout"), 45000);
    loading = true;
    sync();
    result.classList.remove("hidden");
    result.dataset.state = "loading";
    result.setAttribute("aria-busy", "true");
    if (preserveCard) {
      cardStatus.textContent = "Buscando otra...";
      for (const button of result.querySelectorAll(".result-actions button")) button.disabled = true;
    } else loadingState(result);
    if (!refresh) result.scrollIntoView({ behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth", block: "start" });
    try {
      const found = await findRecommendation(filters, active.signal, { seen: getSeen(), disliked: getDisliked(), recent: getRecent(), currentKey });
      if (active.signal.aborted) return;
      if (!found || found.status === "exhausted") {
        const state = found?.status ?? "empty";
        result.dataset.state = state;
        if (preserveCard) cardStatus.textContent = state === "exhausted" ? "Ya te mostramos las mejores opciones de esta búsqueda. Prueba otro estilo, mood, año, duración o plataforma. Conservamos tu última recomendación." : "No encontramos otra recomendación que cumpla todos esos filtros. Puedes probar otra plataforma o ampliar la duración. Conservamos tu última recomendación.";
        else errorState(result, state, () => run(true));
      } else {
        const { title, availability } = found;
        currentKey = titleKey(title);
        addRecent(title);
        result.dataset.state = "success";
        const status = resultCard(result, title, availability, { ...filters, sources: title.sources, effective: found.effective, relaxed: found.relaxed }, {
          another: () => run(true),
          seen: () => { addSeen(title); return run(true); },
          disliked: () => { addDisliked(title); return run(true); },
          share: async button => {
            button.disabled = true;
            const text = shareText(title, filters);
            try {
              if (navigator.share) await navigator.share({ title: "¿Qué veo hoy?", text });
              else {
                await navigator.clipboard.writeText(text);
                status.textContent = "Recomendación copiada al portapapeles.";
              }
            } catch (error) {
              if (error.name !== "AbortError") {
                status.textContent = "No pudimos compartir automáticamente. Copia este texto:";
                const field = document.createElement("textarea");
                field.readOnly = true;
                field.value = text;
                field.setAttribute("aria-label", "Texto para compartir");
                status.append(field);
                field.select();
              }
            } finally { button.disabled = false; }
          }
        });
        cardStatus = status;
      }
      if (!refresh) result.focus({ preventScroll: true });
    } catch (error) {
      if (active.signal.aborted && active.signal.reason !== "timeout") return;
      result.dataset.state = "error";
      if (preserveCard) cardStatus.textContent = "No pudimos obtener otra recomendación. Pulsa VER OTRA para reintentar. Conservamos tu última recomendación.";
      else errorState(result, "error", () => run(true));
      if (!refresh) result.focus({ preventScroll: true });
    } finally {
      clearTimeout(timeout);
      if (controller === active) {
        loading = false;
        for (const button of result.querySelectorAll(".result-actions button")) button.disabled = false;
        sync();
        result.setAttribute("aria-busy", "false");
      }
    }
  }
  recommend.addEventListener("click", () => run());
}
