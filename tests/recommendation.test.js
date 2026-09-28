import test from "node:test";
import assert from "node:assert/strict";
import { matchesCandidate, fallbackStages, currentYear, yearError } from "../src/config/recommendation.js";
import { findTitle } from "../src/services/recommendation.js";
import { explanation } from "../src/utils/format.js";
import { onRequest as discover } from "../functions/api/discover.js";

const filters = { type: "movie", mood: "action", time: "120", platform: "netflix", region: "EC", yearFrom: 2015, yearTo: currentYear() };
const title = (overrides = {}) => ({ id: 1, type: "movie", title: "Una película", date: "2024-01-01", genreIds: [28], genres: ["Acción"], poster: "/poster.jpg", overview: "Una sinopsis.", score: 7, votes: 200, adult: false, runtime: 100, ...overrides });
for (const [mood, genres] of Object.entries({ action: [28], horror: [27], romance: [10749], think: [9648, 878, 53], funny: [35], relax: [35, 10751, 16] })) {
  test(`${mood}: admite sus géneros y rechaza Reality incompatible`, () => {
    for (const genre of genres) assert.equal(matchesCandidate(title({ genreIds: [genre] }), { ...filters, mood }), true);
    assert.equal(matchesCandidate(title({ genreIds: [10764] }), { ...filters, mood }), false);
  });
}
test("tipo explícito estricto y terror TV sin sustitución por misterio", () => {
  assert.equal(matchesCandidate(title({ type: "tv", genreIds: [10759] }), filters), false);
  assert.equal(matchesCandidate(title(), { ...filters, type: "tv" }), false);
  assert.equal(matchesCandidate(title({ type: "tv", genreIds: [10759], keywords: ["action"] }), { ...filters, type: "tv" }), true);
  assert.equal(matchesCandidate(title({ type: "tv", genreIds: [9648] }), { ...filters, type: "tv", mood: "horror" }), false);
});
test("años actuales, noventa, personalizado, límites y cualquier año", () => {
  for (const [yearFrom, yearTo] of [[2020, currentYear()], [1990, 1999], [2015, 2020]]) {
    const selected = { ...filters, yearFrom, yearTo };
    assert.equal(matchesCandidate(title({ date: `${yearFrom}-01-01` }), selected), true);
    assert.equal(matchesCandidate(title({ date: `${yearTo}-12-31` }), selected), true);
    assert.equal(matchesCandidate(title({ date: `${yearFrom - 1}-12-31` }), selected), false);
    assert.equal(matchesCandidate(title({ date: `${yearTo + 1}-01-01` }), selected), false);
  }
  assert.equal(matchesCandidate(title({ date: "1980-01-01" }), { ...filters, yearFrom: undefined, yearTo: undefined }), true);
  for (const range of [{ yearFrom: 2020, yearTo: 2010 }, { yearFrom: 1899 }, { yearTo: currentYear() + 1 }, { yearFrom: 2000.5 }]) assert.ok(yearError(range));
  assert.ok(yearError({ yearFrom: "", yearTo: 2020 }, true));
  assert.equal(yearError({ yearFrom: 2015, yearTo: 2020 }), "");
});
test("random varía géneros pero mantiene calidad, adulto, tipo y años", () => {
  const selected = { ...filters, mood: "random" };
  for (const genre of [10764, 18, 28]) assert.ok(matchesCandidate(title({ genreIds: [genre] }), selected));
  for (const bad of [{ poster: null }, { overview: "" }, { votes: 2 }, { score: 2 }, { adult: true }, { date: "1990-01-01" }, { type: "tv" }]) assert.equal(matchesCandidate(title(bad), selected), false);
});
test("fallback relaja duración antes que plataforma y conserva filtros duros", async () => {
  const calls = [];
  const api = {
    discover: async used => { calls.push(used); return { candidates: [title()] }; },
    details: async () => title({ runtime: 180 }),
    providers: async () => ({ providers: [] })
  };
  const found = await findTitle(filters, new AbortController().signal, {}, api);
  assert.deepEqual(calls, fallbackStages(filters));
  assert.deepEqual(found.relaxed, { time: true, platform: true });
  for (const used of calls) for (const key of ["mood", "type", "yearFrom", "yearTo", "region"]) assert.equal(used[key], filters[key]);
  assert.match(explanation({ ...filters, ...found }), /ampliamos la búsqueda/);
  assert.match(explanation({ ...filters, ...found }), /ampliamos la duración/);
});
test("detalles incompatibles se descartan; EMPTY al agotar fallback", async () => {
  for (const bad of [{ genreIds: [10751] }, { date: "1999-01-01" }, { type: "tv" }, { adult: true }]) {
    const result = await findTitle(filters, new AbortController().signal, {}, {
      discover: async () => ({ candidates: [title()] }),
      details: async () => title(bad),
      providers: async () => ({ providers: [] })
    });
    assert.equal(result, null);
  }
});
test("prueba otro candidato, excluye vistos y actual; any intenta ambos tipos antes de relajar", async () => {
  const calls = [];
  const found = await findTitle({ ...filters, type: "any", platform: "any" }, new AbortController().signal, { seen: ["movie:2"], currentKey: "movie:3" }, {
    discover: async used => { calls.push(used); return { candidates: used.type === "movie" ? [title({ id: 1 }), title({ id: 2 }), title({ id: 3 }), title({ id: 4 })] : [] }; },
    details: async candidate => title({ id: candidate.id, genreIds: candidate.id === 1 ? [10751] : [28] }),
    providers: async () => ({ providers: [] })
  });
  assert.equal(found.title.id, 4);
  assert.ok(calls.every(used => used.time === "120"));
});

async function invoke(query) {
  const response = await discover({ request: new Request(`http://localhost/api/discover?${query}`), env: { TMDB_BEARER_TOKEN: "test-only" } });
  assert.ok(response instanceof Response);
  return { status: response.status, body: await response.json() };
}
test("API valida mood obligatorio y rangos inválidos", async () => {
  for (const query of ["", "mood=action&yearFrom=2020&yearTo=1990", "mood=action&yearFrom=", "mood=action&yearFrom=1800", `mood=random&yearTo=${currentYear() + 1}`]) assert.equal((await invoke(query)).status, 400);
});
test("API envía fechas movie/TV y descarta géneros, tipos y años incompatibles", async t => {
  const calls = [];
  t.mock.method(globalThis, "fetch", async url => {
    calls.push(url);
    const tv = url.pathname.endsWith("tv");
    const item = { id: 1, title: "Película", name: "Serie", release_date: "1995-01-01", first_air_date: "1995-01-01", poster_path: "/p.jpg", overview: "Sinopsis", vote_count: 200, vote_average: 7, genre_ids: tv ? [10759] : [28] };
    return Response.json({ total_pages: 1, results: [item, { ...item, id: 2, genre_ids: [10751] }, { ...item, id: 3, release_date: "2000-01-01", first_air_date: "2000-01-01" }, { ...item, id: 4, media_type: tv ? "movie" : "tv" }] });
  });
  for (const type of ["movie", "tv"]) {
    const result = await invoke(`mood=action&type=${type}&yearFrom=1990&yearTo=1999`);
    assert.deepEqual(result.body.data.candidates.map(item => item.id), [1]);
    const prefix = type === "movie" ? "primary_release_date" : "first_air_date";
    assert.equal(calls.at(-1).searchParams.get(`${prefix}.gte`), "1990-01-01");
    assert.equal(calls.at(-1).searchParams.get(`${prefix}.lte`), "1999-12-31");
  }
  await invoke("mood=random&type=movie");
  assert.equal(calls.at(-1).searchParams.has("primary_release_date.gte"), false);
  assert.equal(calls.at(-1).searchParams.has("with_genres"), false);
});
