import test from "node:test";
import assert from "node:assert/strict";
import { findTitle } from "../src/services/recommendation.js";
import { discovery, sourceParams, modeScore, modeQuality } from "../src/config/discovery.js";
import { matchesCandidate, ranking } from "../src/config/recommendation.js";
import { onRequest } from "../functions/api/discover.js";

const filters = { type: "movie", mood: "romance", time: "any", platform: "any", region: "EC", recommendationMode: "mix" };
const title = (id, extra = {}) => ({ id, type: "movie", title: `Título ${id}`, date: "2026-01-01", score: 8, votes: 1000, poster: "/p.jpg", overview: "Sinopsis", genreIds: [10749], genres: ["Romance"], runtime: 90, popularity: 10, ...extra });
const raw = (id, extra = {}) => ({ id, title: `Título ${id}`, release_date: "2026-01-01", vote_average: 8, vote_count: 1000, poster_path: "/p.jpg", overview: "Sinopsis", genre_ids: [10749], popularity: 10, ...extra });
const availability = { region: "EC", providers: [] };
const apiFor = candidates => ({ discover: async () => ({ candidates }), details: async candidate => ({ ...candidate, availability }) });
async function endpoint(mode, query = "") {
  const response = await onRequest({ request: new Request(`https://qvh.test/api/discover?type=movie&mood=romance&recommendationMode=${mode}${query}`), env: { TMDB_BEARER_TOKEN: "test-only" } });
  return { status: response.status, ...(await response.json()) };
}
for (const mode of ["safe", "trending", "new", "hidden", "mix"]) {
  test(`${mode}: fuente correcta, requests acotados y deduplicación`, async t => {
    const urls = [];
    t.mock.method(globalThis, "fetch", async url => { urls.push(url); return Response.json({ results: [raw(1), raw(1)], total_pages: 50 }); });
    const result = await endpoint(mode);
    assert.equal(result.status, 200);
    assert.equal(result.data.candidates.length, 1);
    assert.ok(urls.length <= (mode === "mix" ? 5 : 2));
    const sources = result.data.candidates[0].sources;
    assert.deepEqual(sources, mode === "mix" ? ["safe", "trending", "new", "hidden"] : [mode]);
    if (mode === "trending") assert.deepEqual(urls.map(url => url.pathname), ["/3/trending/movie/day", "/3/trending/movie/week"]);
    if (mode === "safe") { assert.equal(urls[0].searchParams.get("sort_by"), "vote_average.desc"); assert.equal(urls[0].searchParams.get("vote_count.gte"), "300"); }
    if (mode === "new") assert.equal(urls[0].searchParams.get("sort_by"), "primary_release_date.desc");
    if (mode === "hidden") assert.equal(urls[0].searchParams.get("vote_count.lte"), "3000");
  });
}
test("New: ventana de 24 meses y prioridad reciente dentro de 1990–1999", () => {
  assert.equal(sourceParams("new", "movie", {}, new Date("2026-09-01"))["primary_release_date.gte"], "2024-09-01");
  assert.equal(sourceParams("new", "tv", { yearFrom: 1990, yearTo: 1999 })["first_air_date.gte"], undefined);
  assert.ok(modeScore(title(1, { date: "1999-01-01" }), "new", 80, { yearFrom: 1990, yearTo: 1999 }) > modeScore(title(2, { date: "1990-01-01" }), "new", 80, { yearFrom: 1990, yearTo: 1999 }));
});
test("Hidden exige respaldo y penaliza mega popularidad", () => {
  assert.equal(modeQuality(title(1, { votes: 7 }), "hidden"), false);
  assert.equal(modeQuality(title(1, { popularity: 500 }), "hidden"), false);
  assert.equal(modeQuality(title(1, { score: 6.8 }), "hidden"), false);
  assert.ok(modeScore(title(1), "hidden", 80) > modeScore(title(2, { popularity: 40 }), "hidden", 80));
});
for (const mode of ["safe", "trending", "new", "hidden", "mix"]) {
  test(`${mode}: constraints después de Details y disponibilidad regional`, async () => {
    const selected = { ...filters, recommendationMode: mode, platform: "netflix", yearFrom: 2020, yearTo: 2026 };
    const candidates = [title(1), title(2), title(3), title(4), title(5), title(6)];
    const found = await findTitle(selected, undefined, {}, {
      discover: async () => ({ candidates }),
      details: async candidate => ({ ...candidate, ...(candidate.id === 1 ? { genreIds: [18] } : candidate.id === 2 ? { type: "tv" } : candidate.id === 3 ? { date: "1999-01-01" } : candidate.id === 4 ? { votes: 7 } : {}), availability: { region: candidate.id === 5 ? "MX" : "EC", providers: candidate.id >= 5 ? [{ name: "Netflix", kind: "flatrate" }] : [] } }),
      providers: async () => availability
    });
    assert.equal(found.title.id, 6);
    assert.equal(found.effective.region, "EC");
    assert.equal(found.relaxed.platform, false);
    assert.ok(matchesCandidate(found.title, selected));
  });
}
test("diversidad: 100 recomendaciones sin repetir, seen/disliked/current excluidos", async () => {
  const recent = [];
  const api = apiFor(Array.from({ length: 104 }, (_, i) => title(i + 1)));
  for (let count = 0; count < 100; count++) {
    const found = await findTitle(filters, undefined, { recent, seen: ["movie:101"], disliked: ["movie:102"], currentKey: "movie:103" }, api);
    const key = `movie:${found.title.id}`;
    assert.ok(!recent.includes(key));
    assert.ok(![101, 102, 103].includes(found.title.id));
    recent.push(key);
  }
  assert.equal(recent.length, discovery.recentLimit);
});
test("agotado se distingue de vacío y no borra recent ni relaja filtros", async () => {
  const recent = ["movie:1"];
  let calls = 0;
  const api = { ...apiFor([title(1)]), details: async candidate => ({ ...candidate, availability: { region: "EC", providers: [{ name: "Netflix", kind: "flatrate" }] } }), discover: async () => { calls++; return { candidates: [title(1)] }; } };
  assert.deepEqual(await findTitle({ ...filters, time: "120", platform: "netflix" }, undefined, { recent }, api), { status: "exhausted" });
  assert.equal(calls, 1);
  assert.deepEqual(recent, ["movie:1"]);
  assert.equal(await findTitle(filters, undefined, {}, apiFor([])), null);
});
test("paginación avanza más allá de excluidos y conserva región/modo", async () => {
  const windows = [];
  const selected = { ...filters, region: "CO", recommendationMode: "safe" };
  const found = await findTitle(selected, undefined, { recent: ["movie:1"] }, {
    discover: async used => { windows.push(used.window ?? 0); assert.equal(used.region, "CO"); assert.equal(used.recommendationMode, "safe"); return { candidates: [title(used.window ? 2 : 1)], hasMore: true }; },
    details: async candidate => ({ ...candidate, availability: { region: "CO", providers: [] } })
  });
  assert.deepEqual(windows, [0, 1]);
  assert.equal(found.title.id, 2);
});
test("Mix intercala fuentes antes de early-stop y no duplica enrichment", async t => {
  t.mock.method(Math, "random", () => 0.3);
  const enriched = [];
  const candidates = ["safe", "trending", "new", "hidden"].flatMap((source, group) => Array.from({ length: 20 }, (_, i) => title(group * 20 + i + 1, { sources: [source], votes: 15000, score: 8.7 })));
  const found = await findTitle(filters, undefined, {}, {
    discover: async () => ({ candidates: [...candidates, ...candidates] }),
    details: async candidate => { enriched.push(candidate); return { ...candidate, availability }; }
  });
  assert.ok(found.title);
  assert.equal(enriched.length, ranking.targetQualifiedCandidates);
  assert.equal(new Set(enriched.map(item => item.id)).size, enriched.length);
  assert.equal(new Set(enriched.flatMap(item => item.sources)).size, 4);
});
test("presupuesto global de enrichment incluye todos los fallbacks", async () => {
  let calls = 0;
  let request = 0;
  await findTitle({ ...filters, time: "30", platform: "netflix" }, undefined, {}, {
    discover: async () => ({ candidates: Array.from({ length: 80 }, (_, i) => title(++request * 100 + i)), hasMore: true, sourceRequests: 12 }),
    details: async candidate => { calls++; return { ...candidate, genreIds: [18] }; }
  });
  assert.ok(calls <= ranking.enrichmentLimit);
});
test("API limita ventanas/presupuesto y conserva rango explícito de New", async t => {
  const urls = [];
  t.mock.method(globalThis, "fetch", async url => { urls.push(url); return Response.json({ results: [], total_pages: 100 }); });
  assert.equal((await endpoint("invalid")).status, 400);
  assert.equal((await endpoint("mix", "&window=20")).status, 400);
  assert.equal((await endpoint("mix", "&sourceBudget=13")).status, 400);
  await endpoint("new", "&yearFrom=1990&yearTo=1999&window=6");
  assert.equal(urls[0].searchParams.get("primary_release_date.gte"), "1990-01-01");
  assert.equal(urls[0].searchParams.get("primary_release_date.lte"), "1999-12-31");
  assert.equal(urls[0].searchParams.get("page"), "13");
  urls.length = 0;
  const result = await endpoint("mix", "&sourceBudget=2");
  assert.equal(urls.length, 2);
  assert.equal(result.data.sourceRequests, 2);
});

test("recent de otro mood/país no demuestra agotamiento semántico", async () => {
  const api = { ...apiFor([title(1)]), details: async candidate => ({ ...candidate, genreIds: [18], availability }) };
  assert.equal(await findTitle(filters, undefined, { recent: ["movie:1"] }, api), null);
});

for (const mode of ["safe", "trending", "new", "hidden", "mix"]) {
  test(`${mode}: Crunchyroll AND Anime AND Romance, jamás animación occidental`, async () => {
    const selected = { ...filters, recommendationMode: mode, type: "anime", platform: "crunchyroll" };
    const candidates = [title(11, { genreIds: [16, 10749], originalLanguage: "en" }), title(12, { genreIds: [16, 18], originalLanguage: "ja" }), title(13, { genreIds: [16, 10749], originalLanguage: "ja" })];
    const found = await findTitle(selected, undefined, {}, {
      discover: async () => ({ candidates }),
      details: async candidate => ({ ...candidate, availability: { region: "EC", providers: [{ name: "Crunchyroll", kind: "flatrate" }] } })
    });
    assert.equal(found.title.id, 13);
    assert.equal(found.relaxed.platform, false);
  });
}

test("caché de fuentes reutiliza requests y separa modo, página, tipo y país", async t => {
  const { discover } = await import("../src/services/movies.js");
  let calls = 0;
  t.mock.method(globalThis, "fetch", async () => { calls++; return Response.json({ ok: true, data: { candidates: [] } }); });
  for (const recommendationMode of ["safe", "trending", "new", "hidden", "mix"]) {
    for (const region of ["EC", "MX"]) for (const type of ["movie", "tv"]) for (const window of [0, 1]) {
      const selected = { ...filters, recommendationMode, region, type, window };
      await discover(selected);
      await discover(selected);
    }
  }
  assert.equal(calls, 40);
});
