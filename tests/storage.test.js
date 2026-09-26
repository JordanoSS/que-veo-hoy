import test from "node:test";
import assert from "node:assert/strict";

function fakeStorage() {
  const values = new Map();
  return { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value) };
}

test("historial acotado, claves por tipo y vistos persistentes", async () => {
  globalThis.localStorage = fakeStorage();
  const storage = await import("../src/utils/storage.js?normal");
  for (let id = 1; id <= 35; id++) storage.addRecent({ id, type: "movie" });
  assert.equal(storage.getRecent().length, 30);
  assert.equal(storage.getRecent()[0], "movie:6");
  storage.addSeen({ type: "movie", id: 1 });
  storage.addSeen({ type: "series", id: 1 });
  storage.addSeen({ type: "tv", id: 1 });
  assert.equal(storage.titleKey({ type: "tv", id: 1 }), "series:1");
  storage.addSeen({ type: "movie", id: 1 });
  assert.deepEqual(storage.getSeen(), ["movie:1", "series:1"]);
  storage.setRegion("MX");
  assert.equal(storage.getRegion(), "MX");
  storage.setRegion("invalid");
  assert.equal(storage.getRegion(), "MX");
});

test("localStorage bloqueado conserva una sesión en memoria", async () => {
  globalThis.localStorage = { getItem() { throw new Error("blocked"); }, setItem() { throw new Error("quota"); } };
  const storage = await import("../src/utils/storage.js?blocked");
  assert.equal(storage.getRegion(), "EC");
  storage.addRecent({ type: "movie", id: 12 });
  assert.deepEqual(storage.getRecent(), ["movie:12"]);
  storage.addSeen({ type: "series", id: 5 });
  assert.deepEqual(storage.getSeen(), ["series:5"]);
});

test("datos dañados no rompen el sitio", async () => {
  globalThis.localStorage = { getItem: () => "{broken", setItem() {} };
  const storage = await import("../src/utils/storage.js?invalid");
  assert.deepEqual(storage.getRecent(), []);
  assert.equal(storage.getRegion(), "EC");
});

test("cuota agotada no restaura datos antiguos al volver a leer", async () => {
  globalThis.localStorage = { getItem: () => '["movie:1"]', setItem() { throw new Error("quota"); } };
  const storage = await import("../src/utils/storage.js?quota");
  storage.addRecent({ type: "movie", id: 2 });
  assert.deepEqual(storage.getRecent(), ["movie:1", "movie:2"]);
});
