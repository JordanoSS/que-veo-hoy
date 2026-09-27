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


test("vistos también está acotado y conserva los 1000 más recientes", async () => {
  globalThis.localStorage = fakeStorage();
  const storage = await import("../src/utils/storage.js?bounded-seen");
  for (let id = 1; id <= 1005; id++) storage.addSeen({ id, type: "tv" });
  assert.equal(storage.getSeen().length, 1000);
  assert.equal(storage.getSeen()[0], "series:6");
  assert.equal(storage.getSeen().at(-1), "series:1005");
});

test("borrado selectivo, región persistente y eliminación de claves QVH sin afectar ajenas", async () => {
  const values = new Map();
  globalThis.localStorage = { get length() { return values.size; }, key: index => [...values.keys()][index], getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value), removeItem: key => values.delete(key) };
  const storage = await import("../src/utils/storage.js?privacy");
  storage.setRegion("CO");
  storage.addRecent({ type: "movie", id: 1 });
  storage.addSeen({ type: "movie", id: 2 });
  for (let id = 1; id <= 1005; id++) storage.addDisliked({ type: "tv", id });
  assert.equal(storage.getDisliked().length, 1000);
  assert.equal(storage.getDisliked()[0], "series:6");
  assert.equal(storage.clearHistory(), true);
  assert.deepEqual(storage.getRecent(), []);
  assert.deepEqual(storage.getSeen(), []);
  assert.deepEqual(storage.getDisliked(), []);
  assert.equal(storage.getRegion(), "CO");
  values.set("another-app", "keep"); values.set("qvh:future", "remove");
  assert.equal(storage.clearAllData(), true);
  assert.deepEqual([...values], [["another-app", "keep"]]);
  assert.equal(storage.getRegion(), "EC");
  const reloaded = await import("../src/utils/storage.js?privacy-reload");
  assert.deepEqual(reloaded.getDisliked(), []);
  assert.equal(reloaded.getRegion(), "EC");
});

test("borrado bloqueado informa fallo persistente sin resucitar historial en memoria", async () => {
  globalThis.localStorage = { getItem: () => '["movie:1"]', removeItem() { throw new Error("blocked"); } };
  const storage = await import("../src/utils/storage.js?delete-blocked");
  assert.deepEqual(storage.getSeen(), ["movie:1"]);
  assert.equal(storage.clearHistory(), false);
  assert.deepEqual(storage.getSeen(), []);
});
