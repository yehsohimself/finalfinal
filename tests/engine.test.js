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

// Negation: a colour the client rejects is never the colour they get.
const colourOf = (c) => E.ruleChanges(c).changes.find((x) => x.property === "color").value;
assert.notStrictEqual(colourOf("I hate the orange"), "orange");
assert.notStrictEqual(colourOf("no more blue please"), "blue");
assert.ok(!["orange", "blue"].includes(colourOf("I dislike the orange and the blue")));
assert.strictEqual(colourOf("not red, maybe green"), "green");
assert.strictEqual(colourOf("I hate the orange, make it blue"), "blue");
assert.strictEqual(colourOf("make it orange"), "orange");
assert.strictEqual(E.ruleChanges("I hate the shadow").changes[0].value, "none");
const hated = E.applyChanges(E.firstDraft(), E.ruleChanges("I hate the orange").changes);
assert.ok(hated.applied.length > 0, "'I hate the orange' should visibly change the poster");

// Naming the logo grows only the logo ("can" is not a product).
assert.deepStrictEqual(E.ruleChanges("can we make the logo bigger").changes, [{ element: "logo", property: "size", value: 1.3 }]);

const names = [1, 2, 10, 11, 12, 19, 26, 27, 28].map(E.versionName);
console.log(names.join("  "));
assert.deepStrictEqual(names.slice(0, 3), ["Final_v1", "Final_v2", "Final_v10"]);
assert.strictEqual(E.versionName(12), "Final_v12_FINAL");
assert.strictEqual(E.versionName(19), "Final_v19_FINALFINAL_this_one");
assert.strictEqual(E.versionName(27), "Final_v27_FINALFINAL");
console.log("engine ok");
