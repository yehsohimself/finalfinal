// Smoke test for the engine: different comments in a row must each change the poster; names must progress.
const E = require("../site/engine.js");
const assert = require("assert");

let s = E.firstDraft();
const comments = ["make the logo bigger", "make it pop a bit more", "the white could be whiter", "more premium", "our audience is younger",
  "I will know it when I see it", "move the title to the left", "the white could be whiter"];
for (const c of comments) {
  const rb = E.ruleChanges(c);
  const res = E.applyChanges(s, rb.changes);
  assert.ok(res.applied.length > 0, "no visible change for: " + c);
  assert.notStrictEqual(E.renderSVG(res.state), E.renderSVG(s), "SVG unchanged for: " + c);
  console.log(c.padEnd(34), "->", rb.rules.join(","), JSON.stringify(res.applied));
  s = res.state;
}

// "Whiter" on an already-white background still changes something.
const white = E.applyChanges({ ...E.firstDraft(), background: { color: "#FFFFFF", shadow: 0 } },
  [{ element: "background", property: "color", value: "whiter" }]);
assert.ok(white.applied.length && white.state.background.color !== "#FFFFFF");

// Out-of-language changes are dropped, not guessed.
const junk = E.applyChanges(s, [{ element: "client", property: "mood", value: 1 }, { element: "background", property: "rotate", value: 9 }]);
assert.strictEqual(junk.applied.length, 0);

const names = [1, 2, 10, 11, 12, 19, 26, 27, 28].map(E.versionName);
console.log(names.join("  "));
assert.deepStrictEqual(names.slice(0, 3), ["Final_v1", "Final_v2", "Final_v10"]);
assert.strictEqual(E.versionName(12), "Final_v12_FINAL");
assert.strictEqual(E.versionName(19), "Final_v19_FINALFINAL_this_one");
assert.strictEqual(E.versionName(27), "Final_v27_FINALFINAL");
console.log("engine ok");
