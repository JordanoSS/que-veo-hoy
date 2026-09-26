import { findTitle } from "../services/recommendation.js";
import { moods } from "../config/moods.js";
import { currentYear, yearError } from "../config/recommendation.js";
import { getRegion, setRegion, getRecent, getSeen, addRecent, addSeen, titleKey } from "../utils/storage.js";
import { shareText } from "../utils/format.js";
import { loadingState } from "./loadingState.js";
import { errorState } from "./errorState.js";
import { resultCard } from "./resultCard.js";

export function initRecommender() {
  const selections = { platform: "any", type: "any", mood: null, time: "any", yearPreset: "any", yearFrom: undefined, yearTo: undefined };
  const result = document.getElementById("result");
  const recommend = document.getElementById("recommendButton");
  let controller;
  let currentKey = getRecent().at(-1);
  setRegion(getRegion());

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
    link.addEventListener("click", () => select(document.querySelector('[data-group="type"]'), link.dataset.type));
  }

  sync();

  async function run() {
    if (loading || !Object.hasOwn(moods, selections.mood) || yearError(selections, selections.yearPreset === "custom")) return;
    controller?.abort();
    const active = new AbortController();
    controller = active;
    const { yearPreset, ...selectedFilters } = selections;
    const filters = { ...selectedFilters, region: getRegion() };
    const timeout = setTimeout(() => active.abort("timeout"), 45000);
    loading = true;
    sync();
    result.classList.remove("hidden");
    result.dataset.state = "loading";
    result.setAttribute("aria-busy", "true");
    loadingState(result);
    result.scrollIntoView({ behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth", block: "start" });
    try {
      const found = await findTitle(filters, active.signal, { seen: getSeen(), recent: getRecent(), currentKey });
      if (active.signal.aborted) return;
      if (!found) {
        result.dataset.state = "empty";
        errorState(result, "empty", run);
      } else {
        const { title, availability } = found;
        currentKey = titleKey(title);
        addRecent(title);
        result.dataset.state = "success";
        const status = resultCard(result, title, availability, { ...filters, effective: found.effective, relaxed: found.relaxed }, {
          another: run,
          seen: () => { addSeen(title); run(); },
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
      }
      result.focus({ preventScroll: true });
    } catch (error) {
      if (active.signal.aborted && active.signal.reason !== "timeout") return;
      result.dataset.state = "error";
      errorState(result, "error", run);
      result.focus({ preventScroll: true });
    } finally {
      clearTimeout(timeout);
      if (controller === active) {
        loading = false;
        sync();
        result.setAttribute("aria-busy", "false");
      }
    }
  }
  recommend.addEventListener("click", run);
}
