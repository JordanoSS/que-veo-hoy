import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { initRecommender } from "../src/components/recommender.js";

// DOM mínimo para ejercitar los eventos reales del controlador sin dependencias.
// Las opciones se extraen del HTML de producción; la comprobación visual usa navegador.
function node() {
  const classes = new Set();
  return {
    dataset: {}, attributes: {}, listeners: {}, value: "", textContent: "",
    classList: { add: value => classes.add(value), remove: value => classes.delete(value), contains: value => classes.has(value), toggle: (value, selected) => selected ? classes.add(value) : classes.delete(value) },
    setAttribute(key, value) { this.attributes[key] = value; },
    addEventListener(event, handler) { this.listeners[event] = handler; },
    click() { if (!this.disabled) return this.listeners.click?.(); },
    append() {}, replaceChildren() {}, scrollIntoView() {}, focus() {}
  };
}
function fixture(t) {
  const html = readFileSync(new URL("../index.html", import.meta.url), "utf8");
  const ids = Object.fromEntries([...html.matchAll(/id="([^"]+)"/g)].map(([, id]) => [id, Object.assign(node(), { id })]));
  const groups = [...html.matchAll(/<div\s+class="options[^"]*"\s+data-group="([^"]+)"\s*>([\s\S]*?)<\/div>/g)].map(([, name, content]) => {
    const group = node();
    group.dataset.group = name;
    group.buttons = [...content.matchAll(/<button\s+class="([^"]+)"\s+data-value="([^"]+)"/g)].map(([, classes, value]) => {
      const button = node(); button.dataset.value = value;
      for (const item of classes.split(" ")) button.classList.add(item);
      return button;
    });
    group.querySelectorAll = () => group.buttons;
    group.parentElement = { querySelector: () => node() };
    return group;
  });
  const previous = globalThis.document;
  globalThis.document = { getElementById: id => ids[id], querySelectorAll: selector => selector === ".options" ? groups : [], createElement: node };
  t.after(() => { globalThis.document = previous; });
  t.mock.method(globalThis, "fetch", async url => { requests.push(new URL(url, "http://localhost")); return Response.json({ ok: true, data: { candidates: [] } }); });
  const originalMatch = globalThis.matchMedia;
  globalThis.matchMedia = () => ({ matches: true });
  t.after(() => { globalThis.matchMedia = originalMatch; });
  const requests = [];
  initRecommender();
  const click = (name, value) => groups.find(group => group.dataset.group === name).buttons.find(button => button.dataset.value === value).click();
  const input = (id, value) => { ids[id].value = value; ids[id].listeners.input(); };
  return { ids, groups, click, input, requests };
}
test("mood vacío deshabilita; action habilita y selección visual coincide con API", async t => {
  const ui = fixture(t);
  assert.equal(ui.ids.recommendButton.disabled, true);
  assert.equal(ui.groups.find(group => group.dataset.group === "mood").buttons.some(button => button.classList.contains("selected")), false);
  ui.click("mood", "action");
  assert.equal(ui.ids.recommendButton.disabled, false);
  ui.click("mood", "think");
  ui.click("type", "movie");
  await ui.ids.recommendButton.click();
  assert.equal(ui.requests.at(-1).searchParams.get("mood"), "think");
  assert.equal(ui.requests.at(-1).searchParams.get("type"), "movie");
  const selected = ui.groups.find(group => group.dataset.group === "mood").buttons.filter(button => button.classList.contains("selected"));
  assert.equal(selected.length, 1);
  assert.equal(selected[0].dataset.value, "think");
  assert.equal(selected[0].attributes["aria-pressed"], "true");
});
test("presets, personalizar, validación, limpieza y petición de años", async t => {
  const ui = fixture(t);
  ui.click("mood", "action"); ui.click("type", "movie");
  ui.click("yearPreset", "2020");
  await ui.ids.recommendButton.click();
  assert.equal(ui.requests.at(-1).searchParams.get("yearFrom"), "2020");
  assert.equal(ui.requests.at(-1).searchParams.get("yearTo"), String(new Date().getFullYear()));
  ui.click("yearPreset", "custom");
  assert.equal(ui.ids.customYears.hidden, false);
  assert.equal(ui.ids.recommendButton.disabled, true);
  ui.input("yearFrom", "2020"); ui.input("yearTo", "2010");
  assert.equal(ui.ids.recommendButton.disabled, true);
  assert.match(ui.ids.yearError.textContent, /mayor/);
  const count = ui.requests.length;
  await ui.ids.recommendButton.click();
  assert.equal(ui.requests.length, count);
  ui.input("yearFrom", "2015"); ui.input("yearTo", "2020");
  assert.equal(ui.ids.recommendButton.disabled, false);
  await ui.ids.recommendButton.click();
  assert.equal(ui.requests.at(-1).searchParams.get("yearFrom"), "2015");
  assert.equal(ui.requests.at(-1).searchParams.get("yearTo"), "2020");
  ui.click("yearPreset", "1990");
  assert.equal(ui.ids.customYears.hidden, true);
  assert.equal(ui.ids.yearFrom.disabled, true);
  ui.input("yearFrom", "2015");
  await ui.ids.recommendButton.click();
  assert.equal(ui.requests.at(-1).searchParams.get("yearFrom"), "1990");
  assert.equal(ui.requests.at(-1).searchParams.get("yearTo"), "1999");
  ui.click("yearPreset", "any");
  await ui.ids.recommendButton.click();
  assert.equal(ui.requests.at(-1).searchParams.has("yearFrom"), false);
  assert.equal(ui.requests.at(-1).searchParams.has("yearTo"), false);
});
