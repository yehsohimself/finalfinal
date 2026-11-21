/* finalfinal engine: poster state, a small design language, a rulebook, and version names.
   Runs in the browser and in Node (for the smoke test). No dependencies. */
(function (root) {
  "use strict";

  const ELEMENTS = ["title", "logo", "product", "background"];
  const PROPERTIES = ["size", "color", "rotate", "position", "weight", "shadow"];

  // The first draft. Everything the client will ever ask for is a change to these numbers.
  function firstDraft() {
    return {
      background: { color: "#EFE6D2", shadow: 0 },
      title: { text: "Taste the Weekend", color: "#1E1E24", size: 1, rotate: 0, x: 0, y: 0, weight: 700, shadow: 0 },
      logo: { color: "#1E1E24", size: 1, rotate: 0, x: 0, y: 0, weight: 700, shadow: 0 },
      product: { color: "#E4572E", size: 1, rotate: 0, x: 0, y: 0, weight: 700, shadow: 0 },
    };
  }

  const clone = (o) => JSON.parse(JSON.stringify(o));
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

  // ---------- colour helpers ----------
  function hexToHsl(hex) {
    let h = String(hex).replace("#", "");
    if (h.length === 3) h = h.split("").map((c) => c + c).join("");
    const r = parseInt(h.slice(0, 2), 16) / 255, g = parseInt(h.slice(2, 4), 16) / 255, b = parseInt(h.slice(4, 6), 16) / 255;
    const max = Math.max(r, g, b), min = Math.min(r, g, b), l = (max + min) / 2;
    let hue = 0, s = 0;
    if (max !== min) {
      const d = max - min;
      s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
      if (max === r) hue = (g - b) / d + (g < b ? 6 : 0);
      else if (max === g) hue = (b - r) / d + 2;
      else hue = (r - g) / d + 4;
      hue *= 60;
    }
    return { h: hue, s, l };
  }
  function hslToHex({ h, s, l }) {
    h = ((h % 360) + 360) % 360; s = clamp(s, 0, 1); l = clamp(l, 0, 1);
    const c = (1 - Math.abs(2 * l - 1)) * s, x = c * (1 - Math.abs(((h / 60) % 2) - 1)), m = l - c / 2;
    let [r, g, b] = h < 60 ? [c, x, 0] : h < 120 ? [x, c, 0] : h < 180 ? [0, c, x] : h < 240 ? [0, x, c] : h < 300 ? [x, 0, c] : [c, 0, x];
    const to = (v) => Math.round((v + m) * 255).toString(16).padStart(2, "0");
    return ("#" + to(r) + to(g) + to(b)).toUpperCase();
  }
  const NAMED = { red: 0, orange: 25, yellow: 50, green: 130, teal: 175, blue: 215, purple: 275, pink: 330 };

  // Colour values the design language accepts: a hex code, a hue name, or a modifier.
  function applyColor(current, value) {
    const v = String(value).trim().toLowerCase();
    if (/^#?[0-9a-f]{6}$/.test(v) || /^#?[0-9a-f]{3}$/.test(v)) return ("#" + v.replace("#", "")).toUpperCase();
    const c = hexToHsl(current);
    if (v in NAMED) return hslToHex({ h: NAMED[v], s: Math.max(c.s, 0.65), l: clamp(c.l, 0.35, 0.6) });
    switch (v) {
      case "saturate": return hslToHex({ ...c, s: c.s + 0.3, l: clamp(c.l, 0.3, 0.65) });
      case "desaturate": return hslToHex({ ...c, s: c.s - 0.35 });
      case "lighten": return hslToHex({ ...c, l: c.l + 0.15 });
      case "darken": return hslToHex({ ...c, l: c.l - 0.18 });
      case "warmer": return hslToHex({ ...c, h: c.h + (c.h > 200 ? 40 : -20), s: Math.max(c.s, 0.4) });
      case "cooler": return hslToHex({ ...c, h: c.h + (c.h < 200 ? 35 : 15), s: Math.max(c.s, 0.3) });
      case "whiter": {
        // Optical brightener: a white with a hint of blue reads whiter than white. Detergent ads have known this for decades.
        const b = hexToHsl(current);
        return b.l >= 0.96 ? hslToHex({ h: 215, s: clamp(b.s + 0.35, 0, 1), l: 0.97 }) : hslToHex({ h: b.h, s: b.s * 0.4, l: b.l + 0.12 });
      }
    }
    return null;
  }

  // ---------- applying a change list ----------
  // A change is {element, property, value}. Anything outside the design language is dropped, not guessed.
  function applyChanges(state, changes) {
    const next = clone(state);
    const applied = [];
    for (const ch of Array.isArray(changes) ? changes : []) {
      if (!ch || typeof ch !== "object") continue;
      const el = String(ch.element || "").toLowerCase(), prop = String(ch.property || "").toLowerCase();
      if (!ELEMENTS.includes(el) || !PROPERTIES.includes(prop)) continue;
      const e = next[el], v = ch.value;
      if (el === "background" && prop !== "color" && prop !== "shadow") continue;
      const before = JSON.stringify(e);
      const num = typeof v === "number" ? v : parseFloat(v);
      switch (prop) {
        case "size": {
          let f = Number.isFinite(num) ? num : String(v).match(/big|larg/) ? 1.3 : String(v).match(/small/) ? 0.77 : NaN;
          if (!Number.isFinite(f)) break;
          if (f > 3) f = 1 + f / 100; // "30" means +30%
          e.size = +clamp(e.size * f, 0.35, 3).toFixed(3);
          break;
        }
        case "color": { const c = applyColor(e.color, v); if (c) e.color = c; break; }
        case "rotate": if (Number.isFinite(num)) e.rotate = +clamp(e.rotate + num, -180, 180).toFixed(1); break;
        case "position": {
          const s = String(v).toLowerCase(), step = 40;
          if (s.includes("left")) e.x -= step;
          if (s.includes("right")) e.x += step;
          if (s.includes("up") || s.includes("top")) e.y -= step;
          if (s.includes("down") || s.includes("bottom")) e.y += step;
          if (s.includes("center") || s.includes("centre")) { e.x = 0; if (!/up|down|top|bottom/.test(s)) e.y = 0; }
          e.x = clamp(e.x, -150, 150); e.y = clamp(e.y, -200, 200);
          break;
        }
        case "weight": {
          const s = String(v).toLowerCase();
          let w = Number.isFinite(num) ? num : s.includes("bold") || s.includes("heav") ? e.weight + 200 : s.includes("light") || s.includes("thin") ? e.weight - 300 : NaN;
          if (Number.isFinite(w)) e.weight = clamp(Math.round(w / 100) * 100, 100, 900);
          break;
        }
        case "shadow": {
          const s = String(v).toLowerCase();
          let d = Number.isFinite(num) ? num : s.includes("more") || s.includes("add") ? e.shadow + 0.4 : s.includes("less") || s.includes("none") || s.includes("remove") ? 0 : NaN;
          if (Number.isFinite(d)) e.shadow = +clamp(d, 0, 1).toFixed(2);
          break;
        }
      }
      if (JSON.stringify(e) !== before) applied.push({ element: el, property: prop, value: v });
    }
    return { state: next, applied };
  }

  // ---------- the rulebook (fallback when there is no local model) ----------
  const WORDS = {
    title: /\b(title|headline|heading|text|copy|type|font|words?|tagline)\b/,
    logo: /\b(logo|brand|mark|branding)\b/,
    product: /\b(product|packshot|circle|can|bottle|ball|hero)\b/,
    background: /\b(background|bg|backdrop|white space|whitespace)\b/,
  };
  function mentioned(text) { return ELEMENTS.filter((el) => WORDS[el].test(text)); }
  const C = (element, property, value) => ({ element, property, value });

  const RULES = [
    { id: "whiter", test: /whiter|more white|brighter white|white.*white/, run: () => [C("background", "color", "whiter")],
      reply: "Added an optical brightener. A drop of blue reads whiter than white." },
    { id: "pop", test: /\bpop|punch|wow|vibrant|zing|energy/, run: (m) => [C(m[0] || "product", "color", "saturate"), C(m[0] || "product", "rotate", -8), C("title", "color", "saturate")],
      reply: "Saturation up, a little tilt. That is what pop means." },
    { id: "premium", test: /premium|luxur|classy|elegant|expensive|high.?end/, run: () => [C("background", "color", "#15151A"), C("title", "color", "#C9A646"), C("title", "weight", 300), C("logo", "color", "#C9A646"), C("product", "shadow", 0.8)],
      reply: "Black, gold, thin type. Premium, as briefed." },
    { id: "young", test: /young|youth|fresh|gen ?z|fun|playful|tiktok/, run: () => [C("background", "color", "#C6F432"), C("title", "rotate", -6), C("title", "weight", 900), C("product", "color", "pink"), C("logo", "rotate", 12)],
      reply: "Acid green and a tilt. The kids will love it, apparently." },
    { id: "bigger", test: /bigger|larger|enlarge|grow|more visible|stand out|scale up|huge/, run: (m) => (m.length ? m : ["logo"]).filter((e) => e !== "background").map((e) => C(e, "size", 1.3)),
      reply: "Plus thirty percent." },
    { id: "smaller", test: /smaller|shrink|less big|too big|tone it down|scale down/, run: (m) => (m.length ? m : ["product"]).filter((e) => e !== "background").map((e) => C(e, "size", 0.77)),
      reply: "Minus a quarter. Let it breathe." },
    { id: "bolder", test: /bold|stronger|heavier|louder|confident/, run: () => [C("title", "weight", "bolder"), C("title", "size", 1.1)],
      reply: "Heavier weight. More confident, apparently." },
    { id: "minimal", test: /minimal|clean|simple|apple|scandi|less busy|calm/, run: () => [C("product", "shadow", 0), C("title", "weight", 200), C("background", "color", "#F5F5F2"), C("product", "color", "desaturate")],
      reply: "Removed everything that was not paid for." },
    { id: "shadow", test: /shadow|depth|3d|lift|float/, run: (m) => [C(m.find((e) => e !== "background") || "product", "shadow", "more")],
      reply: "Drop shadow. It is 2004 again." },
    { id: "warmer", test: /warm|cosy|cozy|summer|sunny/, run: () => [C("background", "color", "warmer"), C("product", "color", "orange")],
      reply: "Warmer. Like a summer you were not invited to." },
    { id: "cooler", test: /cool|cold|winter|tech|corporate/, run: () => [C("background", "color", "cooler"), C("product", "color", "blue")],
      reply: "Cooler. Very corporate. Very winter." },
    { id: "colour", test: /\b(red|orange|yellow|green|teal|blue|purple|pink)\b/, run: (m, t) => [C(m[0] || "product", "color", t.match(/\b(red|orange|yellow|green|teal|blue|purple|pink)\b/)[1])],
      reply: "New colour, same idea." },
    { id: "move", test: /\b(left|right|up|down|higher|lower|top|bottom|center|centre|middle)\b/, run: (m, t) => [C(m.find((e) => e !== "background") || "logo", "position",
        /higher/.test(t) ? "up" : /lower/.test(t) ? "down" : /middle/.test(t) ? "center" : t.match(/\b(left|right|up|down|top|bottom|center|centre)\b/)[1])],
      reply: "Moved. Forty pixels of progress." },
    { id: "rotate", test: /rotat|tilt|angle|dynamic|movement|straight/, run: (m, t) => [C(m.find((e) => e !== "background") || "product", "rotate", /straight/.test(t) ? -10 : 15)],
      reply: "Rotated. Now it moves without moving." },
  ];

  // Matches every rule that fires; the first match also gives the reply. Unknown comments get the classic answer.
  function ruleChanges(comment) {
    const t = " " + String(comment).toLowerCase() + " ";
    const m = mentioned(t);
    const hits = RULES.filter((r) => r.test.test(t));
    if (!hits.length) return { changes: [C("logo", "size", 1.3)], reply: "Not sure what that meant, so the logo is bigger. It is always the logo.", rules: ["default"] };
    return { changes: hits.flatMap((r) => r.run(m, t)), reply: hits[0].reply, rules: hits.map((r) => r.id) };
  }

  // ---------- version names ----------
  function versionName(n) {
    if (n <= 10) return "Final_v" + n;
    if (n < 19) return "Final_v" + n + "_FINAL";
    if (n < 27) return "Final_v" + n + "_FINALFINAL_this_one";
    if (n === 27) return "Final_v27_FINALFINAL";
    return "Final_v" + n + "_FINALFINAL_USE_THIS";
  }
  const SURPRISE_AT = 27;

  // ---------- rendering ----------
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  function contrastInk(hex) { return hexToHsl(hex).l > 0.55 ? "#1E1E24" : "#F6F5F1"; }
  function shadowAttr(id, s) { return s > 0 ? ` filter="url(#sh-${id})"` : ""; }
  function shadowDef(id, s) {
    if (!(s > 0)) return "";
    return `<filter id="sh-${id}" x="-50%" y="-50%" width="200%" height="200%"><feDropShadow dx="${(6 * s).toFixed(1)}" dy="${(10 * s).toFixed(1)}" stdDeviation="${(8 * s).toFixed(1)}" flood-color="#000" flood-opacity="${(0.25 + 0.3 * s).toFixed(2)}"/></filter>`;
  }
  function tf(cx, cy, e) { return `translate(${cx + e.x} ${cy + e.y}) rotate(${e.rotate}) scale(${e.size})`; }

  // Four layers in a 400x560 poster: background, product, title, logo.
  function renderSVG(s, opts) {
    const o = opts || {};
    const bg = s.background, ti = s.title, lo = s.logo, pr = s.product;
    const ink = contrastInk(bg.color);
    const hi = hslToHex({ ...hexToHsl(pr.color), l: clamp(hexToHsl(pr.color).l + 0.18, 0, 0.95) });
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 560" ${o.attrs || ""}>
<defs>${shadowDef("p", pr.shadow)}${shadowDef("t", ti.shadow)}${shadowDef("l", lo.shadow)}</defs>
<rect id="layer-background" width="400" height="560" fill="${bg.color}"/>
<g id="layer-product" transform="${tf(200, 300, pr)}"${shadowAttr("p", pr.shadow)}>
  <circle r="110" fill="${pr.color}"/>
  <circle cx="-38" cy="-42" r="30" fill="${hi}" opacity=".55"/>
  <text y="10" text-anchor="middle" font-family="system-ui,Helvetica,Arial,sans-serif" font-size="26" font-weight="800" fill="${contrastInk(pr.color)}">0% SUGAR</text>
</g>
<g id="layer-title" transform="${tf(200, 110, ti)}"${shadowAttr("t", ti.shadow)}>
  <text text-anchor="middle" font-family="system-ui,Helvetica,Arial,sans-serif" font-size="40" font-weight="${ti.weight}" letter-spacing="-1" fill="${ti.color}">${esc(ti.text)}</text>
</g>
<g id="layer-logo" transform="${tf(200, 492, lo)}"${shadowAttr("l", lo.shadow)}>
  <rect x="-62" y="-20" width="40" height="40" rx="6" fill="${lo.color}"/>
  <polygon points="-42,-11 -31,11 -53,11" fill="${bg.color}"/>
  <text x="-12" y="11" font-family="system-ui,Helvetica,Arial,sans-serif" font-size="30" font-weight="${lo.weight}" fill="${lo.color}">norda</text>
</g>
<text x="390" y="550" text-anchor="end" font-family="ui-monospace,Menlo,monospace" font-size="9" fill="${ink}" opacity=".45">${esc(o.label || "")}</text>
</svg>`;
  }

  const api = { ELEMENTS, PROPERTIES, firstDraft, applyChanges, ruleChanges, versionName, renderSVG, SURPRISE_AT, RULES, hexToHsl };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.Engine = api;
})(typeof window !== "undefined" ? window : globalThis);
