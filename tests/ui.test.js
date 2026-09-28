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
    scrollIntoView() { this.scrollCalls++; }, focus() { this.focusCalls++; }, select() { this.selected = true; }
  };
}
function fixture(t, finder) {
  const html = readFileSync(new URL("../index.html", import.meta.url), "utf8") + readFileSync(new URL("../src/templates/privacy-controls.html", import.meta.url), "utf8");
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
  const typeLinks = ["movie", "tv", "anime"].map(type => {
    const link = node("a"); link.dataset.type = type; return link;
  });
  const previous = globalThis.document;
  globalThis.document = { getElementById: id => ids[id], querySelectorAll: selector => selector === ".options" ? groups : selector === "[data-type]" ? typeLinks : [], querySelector: () => groups.find(group => group.dataset.group === "type"), createElement: node };
  t.after(() => { globalThis.document = previous; });
  t.mock.method(globalThis, "fetch", async url => { requests.push(new URL(url, "http://localhost")); return Response.json({ ok: true, data: { candidates: [] } }); });
  const originalMatch = globalThis.matchMedia;
  globalThis.matchMedia = () => ({ matches: true });
  t.after(() => { globalThis.matchMedia = originalMatch; });
  const requests = [];
  initRecommender(finder);
  const click = (name, value) => groups.find(group => group.dataset.group === name).buttons.find(button => button.dataset.value === value).click();
  const input = (id, value) => { ids[id].value = value; ids[id].listeners.input(); };
  return { ids, groups, click, input, requests, typeLinks };
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

test("país invalida disponibilidad anterior y se conserva durante Ver otra", async t => {
  const calls = [];
  const ui = fixture(t, async filters => { calls.push({ ...filters }); return recommendation(9000 + calls.length, filters); });
  ui.click("mood", "action");
  await ui.ids.recommendButton.click();
  ui.ids.region.value = "ES";
  ui.ids.region.listeners.change();
  assert.equal(ui.ids.result.classList.contains("hidden"), true);
  await ui.ids.recommendButton.click();
  await anotherButton(ui).click();
  assert.equal(calls.at(-1).region, "ES");
  assert.equal(calls.at(-2).region, "ES");
});

test("No me interesa excluye el título, conserva filtros y no mueve scroll", async t => {
  const calls = [];
  const ui = fixture(t, async (filters, signal, history) => { calls.push({ filters: { ...filters }, history }); return recommendation(9200 + calls.length, filters); });
  ui.click("mood", "romance");
  await ui.ids.recommendButton.click();
  await ui.ids.result.descendants().find(item => item.textContent === "NO ME INTERESA").click();
  assert.ok(calls.at(-1).history.disliked.includes("series:9201"));
  assert.deepEqual(calls[0].filters, calls[1].filters);
  assert.equal(ui.ids.result.scrollCalls, 1);
  assert.equal(ui.ids.result.focusCalls, 1);
});

test("borrar historial conserva país; borrar todos reinicia filtros y selección visual", async t => {
  const ui = fixture(t, async filters => recommendation(9401, filters));
  ui.ids.region.value = "MX"; ui.ids.region.listeners.change();
  ui.click("mood", "action"); ui.click("type", "movie");
  await ui.ids.recommendButton.click();
  ui.ids.clearHistory.click();
  assert.equal(ui.ids.region.value, "MX");
  assert.equal(ui.ids.result.classList.contains("hidden"), true);
  assert.ok(ui.ids.privacyStatus.textContent);
  ui.ids.clearData.click();
  assert.equal(ui.ids.region.value, "EC");
  assert.equal(ui.ids.recommendButton.disabled, true);
  assert.equal(ui.groups.find(group => group.dataset.group === "mood").buttons.some(button => button.attributes["aria-pressed"] === "true"), false);
  assert.equal(ui.groups.find(group => group.dataset.group === "type").buttons.find(button => button.dataset.value === "any").attributes["aria-pressed"], "true");
});

test("cambio de país cancela resultado tardío de la región anterior", async t => {
  let release;
  const ui = fixture(t, async filters => new Promise(resolve => { release = () => resolve(recommendation(9601, filters)); }));
  ui.click("mood", "romance");
  const pending = ui.ids.recommendButton.click();
  ui.ids.region.value = "PE"; ui.ids.region.listeners.change();
  release(); await pending;
  assert.equal(ui.ids.result.classList.contains("hidden"), true);
  assert.equal(ui.ids.recommendButton.disabled, false);
  assert.equal(ui.ids.result.attributes["aria-busy"], "false");
});

test("compartir usa portapapeles y anuncia confirmación sin revelar preferencias locales", async t => {
  const previousWindow = globalThis.window;
  globalThis.window = { location: { href: "https://que-veo-hoy.pages.dev/?tipo=tv#recomendador" } };
  t.after(() => { globalThis.window = previousWindow; });
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, "navigator");
  let copied;
  Object.defineProperty(globalThis, "navigator", { configurable: true, value: { clipboard: { writeText: async text => { copied = text; } } } });
  t.after(() => { if (descriptor) Object.defineProperty(globalThis, "navigator", descriptor); else delete globalThis.navigator; });
  const ui = fixture(t, async filters => recommendation(9701, filters));
  ui.click("mood", "romance");
  await ui.ids.recommendButton.click();
  await ui.ids.result.descendants().find(item => item.textContent === "COMPARTIR").click();
  assert.match(copied, /Anime 9701/);
  assert.ok(copied.endsWith("https://que-veo-hoy.pages.dev/"));
  assert.doesNotMatch(copied, /tipo=|qvh:|disliked/);
  assert.match(statusNode(ui).textContent, /copiada/);
});

test("timeout muestra error humano y permite reintentar", async t => {
  let expire;
  t.mock.method(globalThis, "setTimeout", callback => { expire = callback; return 1; });
  t.mock.method(globalThis, "clearTimeout", () => {});
  const ui = fixture(t, async (filters, signal) => new Promise((resolve, reject) => {
    signal.addEventListener("abort", () => reject(new Error("private timeout detail")));
  }));
  ui.click("mood", "action");
  const pending = ui.ids.recommendButton.click();
  expire(); await pending;
  assert.equal(ui.ids.result.dataset.state, "error");
  assert.equal(ui.ids.recommendButton.disabled, false);
  assert.doesNotMatch(ui.ids.result.descendants().map(item => item.textContent).join(" "), /private timeout/);
});

test("compartir fallido ofrece texto seleccionable y recupera el botón", async t => {
  const previousWindow = globalThis.window;
  globalThis.window = { location: { href: "https://que-veo-hoy.pages.dev/" } };
  t.after(() => { globalThis.window = previousWindow; });
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, "navigator");
  Object.defineProperty(globalThis, "navigator", { configurable: true, value: { share: async () => { throw new Error("private message"); } } });
  t.after(() => { if (descriptor) Object.defineProperty(globalThis, "navigator", descriptor); else delete globalThis.navigator; });
  const ui = fixture(t, async filters => recommendation(9801, filters));
  ui.click("mood", "romance");
  await ui.ids.recommendButton.click();
  const button = ui.ids.result.descendants().find(item => item.textContent === "COMPARTIR");
  await button.click();
  assert.equal(button.disabled, false);
  assert.match(statusNode(ui).textContent, /Copia este texto/);
  assert.doesNotMatch(statusNode(ui).textContent, /private message/);
  const field = statusNode(ui).children.find(item => item.tag === "textarea");
  assert.equal(field.readOnly, true);
  assert.equal(field.selected, true);
  assert.match(field.value, /Anime 9801/);
});

test("enlaces de tipo respetan clic modificado y sincronizan selección con clic normal", async t => {
  const ui = fixture(t);
  const link = ui.typeLinks.find(link => link.dataset.type === "anime");
  let prevented = false;
  const preventDefault = () => { prevented = true; };
  link.listeners.click({ ctrlKey: true, preventDefault });
  assert.equal(prevented, false);
  assert.equal(ui.ids.recomendador.focusCalls, 0);
  link.listeners.click({ button: 0, preventDefault });
  assert.equal(prevented, true);
  assert.equal(ui.ids.recomendador.focusCalls, 1);
  ui.click("mood", "romance");
  await ui.ids.recommendButton.click();
  assert.equal(ui.requests[0].searchParams.get("type"), "anime");
});

test("V3: mode default, Ver otra/seen/disliked lo conservan y cambiarlo cancela ciclo", async t => {
  const calls = [];
  let release;
  const ui = fixture(t, async (filters, signal) => {
    calls.push({ ...filters });
    if (calls.length === 5) return new Promise(resolve => { release = () => resolve(recommendation(9905, filters)); });
    return recommendation(9900 + calls.length, filters);
  });
  ui.click("mood", "romance");
  await ui.ids.recommendButton.click();
  assert.equal(calls[0].recommendationMode, "mix");
  ui.click("recommendationMode", "hidden");
  await ui.ids.recommendButton.click();
  for (const label of ["YA LA VI", "NO ME INTERESA"]) await ui.ids.result.descendants().find(item => item.textContent === label).click();
  assert.ok(calls.slice(1).every(item => item.recommendationMode === "hidden"));
  const pending = anotherButton(ui).click();
  ui.click("recommendationMode", "trending");
  release(); await pending;
  assert.equal(ui.ids.result.classList.contains("hidden"), true);
  await ui.ids.recommendButton.click();
  assert.equal(calls.at(-1).recommendationMode, "trending");
});

test("V3: agotado in-place mantiene tarjeta, scroll y foco", async t => {
  let calls = 0;
  const ui = fixture(t, async filters => ++calls === 1 ? recommendation(9991, filters) : { status: "exhausted" });
  ui.click("mood", "romance");
  await ui.ids.recommendButton.click();
  const card = ui.ids.result.children[0];
  await anotherButton(ui).click();
  assert.equal(ui.ids.result.dataset.state, "exhausted");
  assert.match(statusNode(ui).textContent, /Ya te mostramos/);
  assert.equal(ui.ids.result.children[0], card);
  assert.equal(ui.ids.result.scrollCalls, 1);
  assert.equal(ui.ids.result.focusCalls, 1);
});
