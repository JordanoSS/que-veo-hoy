import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { initRecommender } from "../src/components/recommender.js";

// DOM mínimo para ejercitar los eventos reales del controlador sin dependencias.
// Las opciones se extraen del HTML de producción; la comprobación visual usa navegador.
function node(tag = "div") {
  const classes = new Set();
  return {
    tag, children: [], style: {}, scrollCalls: 0, focusCalls: 0,
    dataset: {}, attributes: {}, listeners: {}, value: "", textContent: "",
    classList: { add: value => classes.add(value), remove: value => classes.delete(value), contains: value => classes.has(value), toggle: (value, selected) => selected ? classes.add(value) : classes.delete(value) },
    setAttribute(key, value) { this.attributes[key] = value; },
    addEventListener(event, handler) { this.listeners[event] = handler; },
    click() { if (!this.disabled) return this.listeners.click?.(); },
    append(...nodes) { this.children.push(...nodes); },
    replaceChildren(...nodes) { this.children = nodes; },
    contains(target) { return this === target || this.children.some(child => child.contains(target)); },
    descendants() { return this.children.flatMap(child => [child, ...child.descendants()]); },
    querySelectorAll(selector) { return this.descendants().filter(child => selector === ".result-actions button" && child.tag === "button"); },
    getBoundingClientRect() { return { height: 800 }; },
    scrollIntoView() { this.scrollCalls++; }, focus() { this.focusCalls++; }
  };
}
function fixture(t, finder) {
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
  initRecommender(finder);
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

test("Crunchyroll y Anime mantienen selección visual y filtros en cada fallback", async t => {
  const ui = fixture(t);
  ui.click("mood", "romance"); ui.click("platform", "crunchyroll"); ui.click("type", "anime");
  await ui.ids.recommendButton.click();
  assert.equal(ui.requests[0].searchParams.get("platform"), "crunchyroll");
  assert.ok(ui.requests.every(url => url.searchParams.get("type") === "anime" && url.searchParams.get("mood") === "romance"));
  for (const [group, value] of [["type", "anime"], ["platform", "crunchyroll"]]) {
    assert.equal(ui.groups.find(item => item.dataset.group === group).buttons.find(item => item.dataset.value === value).attributes["aria-pressed"], "true");
  }
});

const recommendation = (id, filters) => ({
  title: { id, type: "tv", title: `Anime ${id}`, date: "2020-01-01", score: 8, poster: "/p.jpg", genres: ["Animation"], overview: "Sinopsis", runtime: 24 },
  availability: { providers: [] }, effective: { ...filters, type: "tv" }, relaxed: { time: false, platform: false }
});
const anotherButton = ui => ui.ids.result.descendants().find(item => item.textContent === "VER OTRA");
const statusNode = ui => ui.ids.result.descendants().find(item => item.className === "share-status");

test("I/J: Ver otra preserva filtros, región, DOM y foco; bloquea duplicados durante loading", async t => {
  const calls = [];
  let resolveNext;
  const ui = fixture(t, async (filters, signal, history) => {
    calls.push({ filters: { ...filters }, history });
    if (calls.length === 1) return recommendation(8101, filters);
    return new Promise(resolve => { resolveNext = () => resolve(recommendation(8102, filters)); });
  });
  ui.click("mood", "romance"); ui.click("platform", "crunchyroll"); ui.click("type", "anime");
  ui.click("time", "30"); ui.click("yearPreset", "custom"); ui.input("yearFrom", "2015"); ui.input("yearTo", "2025");
  await ui.ids.recommendButton.click();
  const article = ui.ids.result.children[0];
  const another = anotherButton(ui);
  assert.equal(another.type, "button");
  const pending = another.click();
  assert.equal(another.disabled, true);
  assert.match(statusNode(ui).textContent, /Buscando otra/);
  assert.equal(ui.ids.result.children[0], article);
  await another.click();
  assert.equal(calls.length, 2);
  assert.deepEqual(calls[1].filters, calls[0].filters);
  assert.equal(calls[1].history.currentKey, "series:8101");
  assert.ok(calls[1].history.recent.includes("series:8101"));
  resolveNext(); await pending;
  assert.equal(ui.ids.result.children[0], article);
  assert.equal(anotherButton(ui), another);
  assert.equal(another.disabled, false);
  assert.equal(ui.ids.result.scrollCalls, 1);
  assert.equal(ui.ids.result.focusCalls, 1);
  assert.equal(ui.ids.result.style.minHeight, "800px");
});

test("L/M: empty/error de refresh conserva tarjeta, permite reintentar y no mueve foco/scroll", async t => {
  let call = 0;
  const ui = fixture(t, async filters => {
    call++;
    if (call === 2) throw new Error("raw stack/secret must not be rendered");
    if (call === 3) return null;
    return recommendation(8200 + call, filters);
  });
  ui.click("mood", "romance");
  await ui.ids.recommendButton.click();
  const article = ui.ids.result.children[0];
  const another = anotherButton(ui);
  await another.click();
  assert.equal(ui.ids.result.dataset.state, "error");
  assert.match(statusNode(ui).textContent, /reintentar/);
  assert.doesNotMatch(statusNode(ui).textContent, /raw stack|secret/);
  assert.equal(ui.ids.result.children[0], article);
  await another.click();
  assert.equal(ui.ids.result.dataset.state, "empty");
  assert.match(statusNode(ui).textContent, /cumpla todos esos filtros/);
  await another.click();
  assert.equal(ui.ids.result.dataset.state, "success");
  assert.equal(ui.ids.result.scrollCalls, 1);
  assert.equal(ui.ids.result.focusCalls, 1);
});

test("empty inicial y error inicial muestran mensaje; reintento vuelve a success", async t => {
  let call = 0;
  const ui = fixture(t, async filters => {
    call++;
    if (call === 1) return null;
    if (call === 2) throw new Error("API failed");
    return recommendation(8301, filters);
  });
  ui.click("mood", "romance");
  await ui.ids.recommendButton.click();
  assert.equal(ui.ids.result.dataset.state, "empty");
  assert.ok(ui.ids.result.children.some(item => item.textContent.includes("cumpla todos esos filtros")));
  await ui.ids.recommendButton.click();
  assert.equal(ui.ids.result.dataset.state, "error");
  await ui.ids.result.children.find(item => item.tag === "button").click();
  assert.equal(ui.ids.result.dataset.state, "success");
});
