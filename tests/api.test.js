import test from "node:test";
import assert from "node:assert/strict";
import { onRequest as discover } from "../functions/api/discover.js";
import { onRequest as details } from "../functions/api/details.js";
import { onRequest as providers } from "../functions/api/providers.js";

async function call(handler, url, method = "GET", env = { TMDB_BEARER_TOKEN: "test-only" }) {
  const response = await handler({ request: new Request(new URL(url, "http://localhost"), { method }), env });
  assert.ok(response instanceof Response);
  const body = await response.json();
  const headers = Object.fromEntries(response.headers);
  return { status: response.status, body, headers };
}

const movie = (id, overrides = {}) => ({ id, title: `Título ${id}`, release_date: "2024-01-01", poster_path: "/poster.jpg", overview: "Una sinopsis en español.", vote_count: 200, vote_average: 7, adult: false, genre_ids: [27], ...overrides });

// Ninguna prueba realiza solicitudes externas ni necesita una credencial real.
test("rechaza parámetros desconocidos, repetidos, regiones y métodos", async () => {
  for (const query of ["page=2", "mood=unknown", "region=US", "type=movie&type=series", "time=0", "include_adult=true"]) {
    const result = await call(discover, `/api/discover?${query}`);
    assert.equal(result.status, 400);
    assert.equal(result.body.ok, false);
  }
  assert.equal((await call(discover, "/api/discover?mood=random", "POST")).status, 405);
  assert.equal((await call(details, "/api/details?type=movie&id=../secret")).status, 400);
  assert.equal((await call(providers, "/api/providers?type=any&id=12")).status, 400);
});

test("sin context.env devuelve 503 sin exponer errores internos", async () => {
  const result = await call(discover, "/api/discover?mood=random", "GET", {});
  assert.equal(result.status, 503);
  assert.equal(result.body.error.code, "NOT_CONFIGURED");
  assert.equal(result.body.error.stack, undefined);
});

test("descubrimiento filtra calidad y traduce filtros controlados", async t => {
  const urls = [];
  t.mock.method(globalThis, "fetch", async url => {
    urls.push(url);
    if (url.pathname.includes("watch/providers")) return Response.json({ results: [{ provider_name: "Netflix", provider_id: 8 }] });
    return Response.json({ total_pages: 1, results: [movie(1), movie(2, { adult: true }), movie(3, { poster_path: null }), movie(4, { vote_count: 2 }), movie(5, { overview: "" }), movie(6, { vote_average: 3 })] });
  });
  const result = await call(discover, "/api/discover?type=movie&platform=netflix&mood=horror&time=120&region=EC");
  assert.equal(result.status, 200);
  assert.deepEqual(result.body.data.candidates.map(item => item.id), [1]);
  const query = urls.at(-1).searchParams;
  assert.equal(query.get("with_runtime.lte"), "119");
  assert.equal(query.get("include_adult"), "false");
  assert.equal(query.get("with_genres"), "27");
  assert.equal(query.get("watch_region"), "EC");
  assert.equal(query.get("with_watch_providers"), "8");
});

test("any prueba el otro tipo si el primero no tiene candidatos", async t => {
  t.mock.method(Math, "random", () => 0);
  t.mock.method(globalThis, "fetch", async url => Response.json({ total_pages: 1, results: url.pathname.endsWith("movie") ? [] : [movie(8, { name: "Serie", first_air_date: "2024-01-01" })] }));
  const result = await call(discover, "/api/discover?mood=random");
  assert.equal(result.body.data.type, "tv");
  assert.equal(result.body.data.candidates.length, 1);
});

test("detalles normaliza duración por episodio y rechaza adultos", async t => {
  t.mock.method(globalThis, "fetch", async () => Response.json(movie(1, { episode_run_time: [22, 24], genres: [{ name: "Comedia" }] })));
  const result = await call(details, "/api/details?type=series&id=1");
  assert.equal(result.body.data.runtime, 24);
  assert.deepEqual(result.body.data.genres, ["Comedia"]);
  globalThis.fetch = async () => Response.json(movie(1, { adult: true }));
  assert.equal((await call(details, "/api/details?type=movie&id=1")).status, 404);
});

test("proveedores distingue alquiler de suscripción y ausencia regional", async t => {
  t.mock.method(globalThis, "fetch", async () => Response.json({ results: { EC: { link: "https://www.themoviedb.org/movie/1/watch", flatrate: [{ provider_id: 8, provider_name: "Netflix" }], rent: [{ provider_id: 9, provider_name: "Alquiler" }] } } }));
  const result = await call(providers, "/api/providers?type=movie&id=1&region=EC");
  assert.deepEqual(result.body.data.providers.map(item => item.kind), ["flatrate", "rent"]);
  const empty = await call(providers, "/api/providers?type=movie&id=1&region=PE");
  assert.deepEqual(empty.body.data.providers, []);
});

test("errores externos usan respuestas seguras y no se cachean", async t => {
  t.mock.method(globalThis, "fetch", async () => new Response("private upstream data", { status: 401 }));
  const result = await call(details, "/api/details?type=movie&id=1");
  assert.equal(result.status, 502);
  assert.equal(result.headers["cache-control"], "no-store");
  assert.equal(JSON.stringify(result.body).includes("private"), false);
  globalThis.fetch = async () => new Response("rate limit", { status: 429 });
  assert.equal((await call(details, "/api/details?type=movie&id=1")).status, 429);
});

test("cada petición toma el token de context.env sin estado global", async t => {
  const authorizations = [];
  t.mock.method(globalThis, "fetch", async (_url, options) => {
    authorizations.push(options.headers.Authorization);
    return Response.json(movie(1));
  });
  for (const token of ["fixture-first", "fixture-second"]) {
    const result = await call(details, "/api/details?type=movie&id=1", "GET", { TMDB_BEARER_TOKEN: token });
    assert.equal(result.status, 200);
    assert.equal(result.body.ok, true);
    assert.equal(result.body.data.id, 1);
    assert.equal(JSON.stringify(result.body).includes(token), false);
  }
  assert.deepEqual(authorizations, ["Bearer fixture-first", "Bearer fixture-second"]);
});

test("las tres rutas conservan Response, contrato de error y métodos", async () => {
  for (const [handler, path] of [[discover, "discover?mood=random"], [details, "details?type=movie&id=1"], [providers, "providers?type=tv&id=1"]]) {
    const result = await call(handler, `/api/${path}`, "GET", {});
    assert.equal(result.status, 503);
    assert.deepEqual(Object.keys(result.body), ["ok", "error"]);
    assert.equal(result.body.error.code, "NOT_CONFIGURED");
    assert.equal(result.headers["cache-control"], "no-store");
    const method = await call(handler, `/api/${path}`, "POST");
    assert.equal(method.status, 405);
    assert.equal(method.headers.allow, "GET");
    assert.equal(method.body.error.code, "METHOD_NOT_ALLOWED");
  }
});
