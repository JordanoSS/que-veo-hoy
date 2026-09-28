import test from "node:test";
import assert from "node:assert/strict";
import { matchesCandidate, qvhScore, fallbackStages } from "../src/config/recommendation.js";
import { isAnime, isAnimeCandidate } from "../src/config/moods.js";
import { findTitle } from "../src/services/recommendation.js";
import { onRequest as discover } from "../functions/api/discover.js";
import { onRequest as details } from "../functions/api/details.js";
import { matchesPlatform } from "../src/config/platforms.js";

const filters = { type: "movie", mood: "romance", time: "any", platform: "any", region: "EC", yearFrom: 2000, yearTo: 2025 };
const title = (extra = {}) => ({ id: 1, type: "movie", title: "Fixture", date: "2020-01-01", genreIds: [10749], genres: ["Romance"], poster: "/p.jpg", overview: "Una sinopsis", score: 7.8, votes: 3000, popularity: 25, runtime: 90, keywords: [], ...extra });
const signal = () => new AbortController().signal;

test("A–C: géneros adyacentes no sustituyen el mood explícito", () => {
  for (const [mood, genreIds] of [["romance", [27, 18]], ["romance", [18]], ["horror", [53]], ["action", [12]], ["romance", [10749, 27]]]) {
    assert.equal(matchesCandidate(title({ genreIds }), { ...filters, mood }), false);
  }
  assert.equal(matchesCandidate(title(), filters), true);
});
test("TV: Romance/Horror requieren keywords fuertes; ni Drama, ni texto ambiguo bastan", () => {
  for (const [mood, keywords] of [["romance", ["romantic comedy"]], ["horror", ["psychological horror"]]]) {
    const selected = { ...filters, type: "tv", mood };
    assert.equal(matchesCandidate(title({ type: "tv", genreIds: [18], keywords }), selected), true);
    assert.equal(matchesCandidate(title({ type: "tv", genreIds: [18], overview: "Una historia de amor y terror", keywords: ["thriller"] }), selected), false);
  }
  assert.equal(matchesCandidate(title({ type: "tv", genreIds: [10765] }), { ...filters, type: "tv", mood: "think" }), false);
  assert.equal(matchesCandidate(title({ type: "tv", genreIds: [10765], keywords: ["science fiction"] }), { ...filters, type: "tv", mood: "think" }), true);
  for (const genreIds of [[35, 27], [16, 53], [35, 28]]) assert.equal(matchesCandidate(title({ genreIds }), { ...filters, mood: "relax" }), false);
});
test("D/E: todos los fallbacks conservan mood, años y Anime; incompatible termina vacío", async () => {
  const selected = { ...filters, type: "anime", time: "30", platform: "crunchyroll" };
  const calls = [];
  const result = await findTitle(selected, signal(), {}, {
    discover: async used => { calls.push(used); return { candidates: [title({ genreIds: [16, 18], originalLanguage: "ja" }), title({ id: 2, genreIds: [16, 10749], originalLanguage: "ja", date: "1999-01-01" })] }; },
    details: async value => value,
    providers: async () => ({ providers: [] })
  });
  assert.equal(result, null);
  assert.deepEqual(calls, fallbackStages(selected));
  assert.ok(calls.every(used => used.mood === "romance" && used.yearFrom === 2000 && used.yearTo === 2025 && used.type === "anime"));
});
test("F: QVH favorece evidencia estadística, queda en 0–100 y solo selecciona el grupo superior", async t => {
  const solid = title();
  const sparse = title({ id: 2, score: 9.9, votes: 8 });
  assert.ok(qvhScore(solid, filters) > qvhScore(sparse, filters));
  assert.equal(matchesCandidate(sparse, filters), false);
  const mediocre = title({ id: 3, score: 6, votes: 30, popularity: 0 });
  assert.ok(qvhScore(solid, filters) - qvhScore(mediocre, filters) > 5);
  assert.ok(qvhScore(solid, filters) <= 100);
  t.mock.method(Math, "random", () => 0.999);
  const found = await findTitle(filters, signal(), {}, { discover: async () => ({ candidates: [mediocre, solid] }), details: async value => value, providers: async () => ({ providers: [] }) });
  assert.equal(found.title.id, 1);
});
test("G: Ver otra excluye recientes, actual y vistos sin reciclarlos tras fallback", async () => {
  const api = { discover: async () => ({ candidates: [1, 2, 3, 4].map(id => title({ id })) }), details: async value => value, providers: async () => ({ providers: [] }) };
  const found = await findTitle(filters, signal(), { recent: ["movie:1"], currentKey: "movie:2", seen: ["movie:3"] }, api);
  assert.equal(found.title.id, 4);
  assert.deepEqual(await findTitle(filters, signal(), { recent: ["movie:1", "movie:4"], currentKey: "movie:2", seen: ["movie:3"] }, api), { status: "exhausted" });
});
test("I/J: Anime exige Animation y evidencia japonesa/anime, además del mood", () => {
  assert.equal(isAnime(title({ genreIds: [16], originalLanguage: "en", originCountries: ["US"] })), false);
  assert.equal(isAnime(title({ genreIds: [18], originalLanguage: "ja" })), false);
  for (const evidence of [{ originalLanguage: "ja" }, { originCountries: ["JP"] }, { keywords: ["anime"] }]) {
    assert.equal(matchesCandidate(title({ genreIds: [16, 10749], ...evidence }), { ...filters, type: "anime" }), true);
    assert.equal(matchesCandidate(title({ genreIds: [16, 18], ...evidence }), { ...filters, type: "anime" }), false);
  }
  for (const [mood, genreIds, keywords] of [["romance", [16, 18], ["romance"]], ["horror", [16], ["horror"]], ["action", [16, 10759], ["action"]], ["funny", [16, 35], []]]) {
    assert.equal(matchesCandidate(title({ type: "tv", genreIds, keywords, originalLanguage: "ja" }), { ...filters, type: "anime", mood }), true);
  }
});
test("H: Crunchyroll dinámico exacto por movie/TV + EC, caché, keywords TV y details", async t => {
  const urls = [];
  t.mock.method(globalThis, "fetch", async url => {
    urls.push(url);
    if (url.pathname.includes("watch/providers")) return Response.json({ results: [{ provider_name: "Crunchyroll Amazon Channel", provider_id: 777 }, { provider_name: "Crunchyroll", provider_id: url.pathname.endsWith("tv") ? 888 : 999 }] });
    if (url.pathname.includes("search/keyword")) return Response.json({ results: [{ id: 321, name: url.searchParams.get("query") }] });
    if (/\/tv\/1$/.test(url.pathname)) return Response.json({ id: 1, name: "Anime", first_air_date: "2020-01-01", genres: [{ id: 16, name: "Animation" }], keywords: { results: [{ name: "romance" }] }, original_language: "ja" });
    return Response.json({ total_pages: 1, results: [] });
  });
  const env = { TMDB_BEARER_TOKEN: "test-only" };
  for (let iteration = 0; iteration < 2; iteration++) {
    const response = await discover({ request: new Request("http://localhost/api/discover?type=anime&mood=romance&platform=crunchyroll&region=EC"), env });
    assert.equal(response.status, 200);
  }
  assert.equal(urls.filter(url => url.pathname.includes("watch/providers")).length, 2);
  for (const url of urls.filter(url => url.pathname.includes("discover/"))) {
    assert.equal(url.searchParams.get("watch_region"), "EC");
    assert.equal(url.searchParams.get("with_watch_providers"), url.pathname.endsWith("tv") ? "888" : "999");
    assert.equal(url.searchParams.get("with_genres"), url.pathname.endsWith("tv") ? "16" : "16,10749");
    assert.equal(url.searchParams.get("with_original_language"), "ja");
    if (url.pathname.endsWith("tv")) assert.equal(url.searchParams.get("with_keywords"), "321");
  }
  const response = await details({ request: new Request("http://localhost/api/details?type=tv&id=1"), env });
  assert.deepEqual((await response.json()).data.keywords, ["romance"]);
  assert.equal(urls.at(-1).searchParams.get("append_to_response"), "keywords,watch/providers");
  assert.equal(matchesPlatform({ providers: [{ kind: "flatrate", name: "Crunchyroll Amazon Channel" }] }, "crunchyroll"), false);
});
test("plataforma no confirmada solo permite resultado tras fallback explícito", async () => {
  const found = await findTitle({ ...filters, platform: "crunchyroll", time: "30" }, signal(), {}, {
    discover: async () => ({ candidates: [title()] }), details: async value => value,
    providers: async () => ({ providers: [{ name: "Crunchyroll Amazon Channel", kind: "flatrate" }] })
  });
  assert.deepEqual(found.relaxed, { time: true, platform: true });
});


test("Anime: rechazo por mood independiente de Crunchyroll en todos los fallbacks", async () => {
  for (const [mood, genreIds, keywords] of [
    ["romance", [16, 18, 35], []], ["horror", [16, 9648], ["thriller"]],
    ["action", [16, 12], ["adventure"]], ["funny", [16, 18], []]
  ]) {
    const selected = { ...filters, type: "anime", mood, platform: "crunchyroll", time: "30" };
    const used = [];
    assert.equal(await findTitle(selected, signal(), {}, {
      discover: async stage => { used.push(stage); return { candidates: [title({ type: "tv", genreIds, keywords, originalLanguage: "ja" })] }; },
      details: async candidate => candidate,
      providers: async () => ({ providers: [{ name: "Crunchyroll", kind: "flatrate" }] })
    }), null);
    assert.deepEqual(used, fallbackStages(selected));
  }
});

test("isAnimeCandidate combina details y keywords sin equiparar manga a anime", () => {
  const animation = title({ genreIds: [16], originalLanguage: "en", originCountries: ["US"] });
  assert.equal(isAnimeCandidate(animation, animation, ["based on manga"]), false);
  assert.equal(isAnimeCandidate(animation, { ...animation, productionCountries: ["JP"] }), true);
  assert.equal(isAnimeCandidate(animation, animation, ["Anime"]), true);
  assert.equal(isAnimeCandidate(title({ genreIds: [18] }), undefined, ["anime"]), false);
});

test("quality gate central: 9.3/7 no supera 7.8/15000; ni popularidad salva rating malo", () => {
  const reliable = title({ score: 7.8, votes: 15000, popularity: 0 });
  const inflated = title({ score: 9.3, votes: 7, popularity: 1000000 });
  assert.ok(qvhScore(reliable, filters) > qvhScore(inflated, filters));
  assert.equal(matchesCandidate(inflated, filters), false);
  assert.equal(matchesCandidate(title({ score: 6.4, votes: 50000, popularity: 1000000 }), filters), false);
});

test("top cualificado varía; candidatos duplicados no duplican details", async t => {
  let random = 0;
  t.mock.method(Math, "random", () => random);
  const calls = [];
  const api = {
    discover: async () => ({ candidates: [title(), title(), title({ id: 2 })] }),
    details: async candidate => { calls.push(candidate.id); return candidate; },
    providers: async () => ({ providers: [] })
  };
  assert.equal((await findTitle(filters, signal(), {}, api)).title.id, 1);
  assert.deepEqual(calls, [1, 2]);
  random = 0.999;
  assert.equal((await findTitle(filters, signal(), {}, api)).title.id, 2);
});


test("Discover Anime compone Animation AND mood, también cuando el mood tiene alternativas", async t => {
  const urls = [];
  t.mock.method(globalThis, "fetch", async url => {
    urls.push(url);
    if (url.pathname.includes("search/keyword")) return Response.json({ results: [{ id: 987, name: url.searchParams.get("query") }] });
    return Response.json({ total_pages: 1, results: [] });
  });
  for (const [mood, expected] of [["action", ["16,28"]], ["horror", ["16,27"]], ["romance", ["16,10749"]], ["funny", ["16,35"]], ["think", ["16,9648", "16,878", "16,53"]]]) {
    urls.length = 0;
    const response = await discover({ request: new Request(`http://localhost/api/discover?type=anime&mood=${mood}&yearFrom=2010&yearTo=2025`), env: { TMDB_BEARER_TOKEN: "test-only" } });
    assert.equal(response.status, 200);
    const queries = urls.filter(url => url.pathname.endsWith("discover/movie"));
    assert.deepEqual([...new Set(queries.map(url => url.searchParams.get("with_genres")))], expected);
    for (const url of queries) {
      assert.equal(url.searchParams.get("primary_release_date.gte"), "2010-01-01");
      assert.equal(url.searchParams.get("primary_release_date.lte"), "2025-12-31");
      assert.equal(url.searchParams.get("with_original_language"), "ja");
    }
  }
});

test("Anime think: Mystery o keywords sci-fi/psychological, nunca Fantasy sola", () => {
  for (const extra of [{ genreIds: [16, 9648] }, { genreIds: [16, 10765], keywords: ["science fiction"] }, { genreIds: [16, 18], keywords: ["psychological drama"] }]) {
    assert.equal(matchesCandidate(title({ type: "tv", originalLanguage: "ja", ...extra }), { ...filters, type: "anime", mood: "think" }), true);
  }
  assert.equal(matchesCandidate(title({ type: "tv", originalLanguage: "ja", genreIds: [16, 10765], keywords: ["fantasy"] }), { ...filters, type: "anime", mood: "think" }), false);
});

test("disliked permanece excluido en todos los fallbacks", async () => {
  const calls = [];
  const selected = { ...filters, time: "30", platform: "netflix" };
  const found = await findTitle(selected, signal(), { disliked: ["movie:1"] }, {
    discover: async stage => { calls.push(stage); return { candidates: [title()] }; },
    details: async () => { throw new Error("No debe enriquecer descartados"); }
  });
  assert.equal(found, null);
  assert.deepEqual(calls, fallbackStages(selected));
});

test("early-stop con seis excelentes evita enriquecer todo el catálogo", async () => {
  let requests = 0;
  const found = await findTitle(filters, signal(), {}, {
    discover: async () => ({ candidates: Array.from({ length: 40 }, (_, id) => title({ id: id + 1, votes: 15000, score: 8.7 })) }),
    details: async candidate => { requests++; return { ...candidate, availability: { region: "EC", providers: [] } }; },
    providers: async () => { throw new Error("No duplicar disponibilidad anexada"); }
  });
  assert.ok(found.qvhScore >= 85);
  assert.equal(requests, 6);
  assert.ok(matchesCandidate(found.title, filters));
});

test("early-stop no se activa con candidatos sin semántica ni plataforma válida", async () => {
  let count = 0;
  const found = await findTitle({ ...filters, platform: "netflix" }, signal(), {}, {
    discover: async () => ({ candidates: Array.from({ length: 12 }, (_, id) => title({ id: id + 1 })) }),
    details: async candidate => { count++; return { ...candidate, genreIds: candidate.id === 12 ? [10749] : [18], availability: { region: "EC", providers: [{ name: "Netflix", kind: "flatrate" }] } }; }
  });
  assert.equal(found.title.id, 12);
  assert.equal(count, 12);
  assert.deepEqual(found.relaxed, { time: false, platform: false });
});

test("any: los excelentes de película no cortan prematuramente el lote de TV", async () => {
  const enrichedTV = [];
  const found = await findTitle({ ...filters, type: "any", mood: "action" }, signal(), {}, {
    discover: async selected => ({ candidates: Array.from({ length: 12 }, (_, id) => title({
      id: id + 1, type: selected.type, genreIds: [selected.type === "movie" ? 28 : 10759], votes: 15000, score: 8.7
    })) }),
    details: async candidate => {
      if (candidate.type === "tv") enrichedTV.push(candidate.id);
      return { ...candidate, genreIds: candidate.type === "tv" && candidate.id <= 4 ? [18] : candidate.genreIds,
        keywords: ["action"], availability: { region: "EC", providers: [] } };
    }
  });
  assert.ok(found);
  assert.deepEqual(enrichedTV, Array.from({ length: 10 }, (_, id) => id + 1));
});
