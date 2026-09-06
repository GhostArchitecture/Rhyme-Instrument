/* Regression coverage for STORE.migrate() (store_core.js, extracted from tome-src/10_engine.js).
 * Exercises the one-time legacy-key migration MIGRATION.md flagged for idempotency review. */
const test = require("node:test");
const assert = require("node:assert/strict");

function freshLocalStorage() {
  const mem = new Map();
  return {
    getItem: k => (mem.has(k) ? mem.get(k) : null),
    setItem: (k, v) => mem.set(k, String(v)),
    _mem: mem,
  };
}

function freshStore() {
  delete require.cache[require.resolve("../store_core.js")];
  return require("../store_core.js").STORE;
}

test("migrate(): fresh install with no legacy keys is a harmless no-op", () => {
  global.localStorage = freshLocalStorage();
  const STORE = freshStore();
  assert.equal(STORE.migrate(), false);
  assert.equal(global.localStorage.getItem("tome:migrated"), "1", "must still set the flag so it never re-scans");
});

test("migrate(): carries bank/draft/overrides from the metro-generation keys exactly once", () => {
  global.localStorage = freshLocalStorage();
  global.localStorage.setItem("ghostcodex:bank", JSON.stringify(["swagger", "money"]));
  global.localStorage.setItem("ghostcodex:draft", JSON.stringify("first verse text"));
  global.localStorage.setItem("ghostcodex:overrides", JSON.stringify({ jewels: { vowels: ["UW"], stress: [1], coda: "LZ" } }));
  const STORE = freshStore();

  const first = STORE.migrate();
  assert.equal(first, true, "migration found real legacy data and should report success");
  assert.deepEqual(STORE.get("bank", null), ["swagger", "money"]);
  assert.equal(STORE.get("shelf", null)[0].text, "first verse text");
  assert.deepEqual(STORE.get("overrides", null), { jewels: { vowels: ["UW"], stress: [1], coda: "LZ" } });

  const second = STORE.migrate();
  assert.equal(second, false, "a second call must be a no-op — the whole point of the tome:migrated flag");
});

test("migrate(): a corrupt legacy value doesn't throw or brick the app", () => {
  global.localStorage = freshLocalStorage();
  global.localStorage.setItem("ghostcodex:bank", "{not valid json");
  const STORE = freshStore();
  assert.doesNotThrow(() => STORE.migrate());
});

test("get()/set() round-trip through JSON and survive a missing key", () => {
  global.localStorage = freshLocalStorage();
  const STORE = freshStore();
  assert.equal(STORE.get("nope", "fallback"), "fallback");
  STORE.set("prefs", { mineral: "malachite" });
  assert.deepEqual(STORE.get("prefs", null), { mineral: "malachite" });
});
