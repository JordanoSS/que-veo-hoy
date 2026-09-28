import test from "node:test";
import assert from "node:assert/strict";
import { matchesCandidate } from "../src/config/recommendation.js";
import { findTitle } from "../src/services/recommendation.js";
import { details, providers } from "../src/services/movies.js";
import { providerIds, keywordIds } from "../server/catalog.js";
import { regions } from "../src/config/platforms.js";
import { onRequest as detailsEndpoint } from "../functions/api/details.js";

const filters = { type: "movie", mood: "romance", time: "any", platform: "any", region: "EC" };
const title = (id, extra = {}) => ({ id, type: "movie", title: "Fixture", date: "2020-01-01", genreIds: [10749], genres: ["Romance"], poster: "/p.jpg", overview: "Sinopsis", score: 8.7, votes: 15000, popularity: 25, runtime: 90, ...extra });

test("prefiltro barato descarta antes de Details sin exigir keywords TV", async () => {
  const calls = [];
  const bad = [{ adult: true }, { poster: null }, { overview: "" }, { date: "" }, { score: 3 }, { votes: 5 }, { genreIds: [18] }, { type: "tv" }, { date: "1990-01-01" }];
  await findTitle({ ...filters, yearFrom: 2000 }, undefined, {}, {
    discover: async () => ({ candidates: [...bad.map((extra, id) => title(id + 1, extra)), title(100)] }),
    details: async candidate => { calls.push(candidate.id); return { ...candidate, availability: { region: "EC", providers: [] } }; }
  });
  assert.deepEqual(calls, [100]);
  const found = await findTitle({ ...filters, type: "tv" }, undefined, {}, {
    discover: async () => ({ candidates: [title(101, { type: "tv", genreIds: [18] })] }),
    details: async candidate => ({ ...candidate, keywords: ["romance"], availability: { region: "EC", providers: [] } })
  });
  assert.equal(found.title.id, 101);
});

test("fallback duración y plataforma reutiliza Details y Providers ya resueltos", async () => {
  const calls = { discover: 0, details: 0, providers: 0 };
  const found = await findTitle({ ...filters, time: "30", platform: "netflix" }, undefined, {}, {
    discover: async () => { calls.discover++; return { candidates: [title(1)] }; },
    details: async candidate => { calls.details++; return candidate; },
    providers: async () => { calls.providers++; return { region: "EC", providers: [] }; }
  });
  assert.deepEqual(calls, { discover: 3, details: 1, providers: 1 });
  assert.deepEqual(found.relaxed, { time: true, platform: true });
});

test("cache cliente deduplica concurrentes y separa las siete regiones", async t => {
  let calls = 0;
  t.mock.method(globalThis, "fetch", async url => {
    calls++;
    await Promise.resolve();
    return Response.json({ ok: true, data: { region: new URL(url, "https://qvh.test").searchParams.get("region") } });
  });
  const signal = new AbortController().signal;
  for (const region of regions) {
    const results = await Promise.all([details(title(8001), region, signal), details(title(8001), region, signal)]);
    assert.equal(results[0].region, region);
    assert.deepEqual(results[0], results[1]);
    await details(title(8001), region, signal);
    await Promise.all([providers(title(8001), region), providers(title(8001), region)]);
  }
  assert.equal(calls, regions.length * 2);
});

test("errors y Abort no envenenan cache; una señal nueva es independiente", async t => {
  let calls = 0;
  const controller = new AbortController();
  t.mock.method(globalThis, "fetch", async () => {
    calls++;
    if (calls === 1) return Response.json({ ok: false }, { status: 502 });
    if (calls === 2) controller.abort();
    return Response.json({ ok: true, data: { id: 8101 } });
  });
  await assert.rejects(details(title(8101), "EC"));
  await assert.rejects(details(title(8101), "EC", controller.signal), { name: "AbortError" });
  assert.equal((await details(title(8101), "EC", new AbortController().signal)).id, 8101);
  assert.equal(calls, 3);
  await assert.rejects(details(title(8101), "EC", controller.signal), { name: "AbortError" });
  assert.equal(calls, 3);
});

test("cache cliente acotada expulsa entradas antiguas", async t => {
  let calls = 0;
  t.mock.method(globalThis, "fetch", async () => { calls++; return Response.json({ ok: true, data: {} }); });
  for (let id = 9000; id < 9081; id++) await details(title(id), "EC");
  await details(title(9000), "EC");
  assert.equal(calls, 82);
});

test("catálogos deduplican concurrentes, separan países y permiten reintentar error", async t => {
  let calls = 0;
  let fail = true;
  t.mock.method(globalThis, "fetch", async url => {
    calls++;
    if (url.pathname.includes("search/keyword")) {
      if (fail) return Response.json({}, { status: 502 });
      return Response.json({ results: [{ id: 42, name: "count-fixture" }] });
    }
    return Response.json({ results: [{ provider_id: url.searchParams.get("watch_region") === "EC" ? 1 : 2, provider_name: "Netflix" }] });
  });
  const env = { TMDB_BEARER_TOKEN: "test-only" };
  for (const region of ["EC", "MX"]) {
    const result = await Promise.all([providerIds(env, "movie", region, "netflix"), providerIds(env, "movie", region, "netflix")]);
    assert.deepEqual(result, region === "EC" ? [[1], [1]] : [[2], [2]]);
  }
  assert.equal(calls, 2);
  await assert.rejects(keywordIds(env, ["count-fixture"]));
  fail = false;
  assert.deepEqual(await keywordIds(env, ["count-fixture"]), [42]);
  assert.equal(calls, 4);
});

test("append normaliza las siete regiones para movie/TV sin llamadas extra", async t => {
  let calls = 0;
  t.mock.method(globalThis, "fetch", async url => {
    calls++;
    assert.equal(url.searchParams.get("append_to_response"), "keywords,watch/providers");
    return Response.json({ id: 1, "watch/providers": { results: Object.fromEntries(regions.map((region, index) => [region, { flatrate: [{ provider_id: index + 1, provider_name: region }] }])) } });
  });
  for (const type of ["movie", "tv"]) for (const region of regions) {
    const response = await detailsEndpoint({ request: new Request(`https://qvh.test/api/details?type=${type}&id=1&region=${region}`), env: { TMDB_BEARER_TOKEN: "test-only" } });
    const { data } = await response.json();
    assert.equal(data.availability.region, region);
    assert.equal(data.availability.providers[0].name, region);
  }
  assert.equal(calls, 14);
});


test("TV Action & Adventure exige acción real después de Details", () => {
  const selected = { ...filters, type: "tv", mood: "action" };
  const adventure = title(1, { type: "tv", genreIds: [10759], keywords: ["adventure"] });
  assert.equal(matchesCandidate(adventure, selected), false);
  assert.equal(matchesCandidate({ ...adventure, keywords: ["martial arts"] }, selected), true);
});
