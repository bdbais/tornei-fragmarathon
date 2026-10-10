// La prima voce delle novità deve essere la versione del programma.
const test = require("node:test");
const assert = require("node:assert");
const CHANGELOG = require("../js/changelog.js");
const pkg = require("../package.json");

test("la versione in cima alle novità è quella di package.json", () => {
  assert.strictEqual(CHANGELOG[0].v, pkg.version);
});
test("ogni versione ha data, titolo e almeno una novità", () => {
  for (const r of CHANGELOG) {
    assert.match(r.d, /^\d{4}-\d{2}-\d{2}$/, r.v);
    assert.ok(r.t && r.items.length, r.v);
  }
});
