/* finalfinal page: comment in, change list out, every version archived, scored and playable. */
(function () {
  "use strict";
  const E = window.Engine;
  const $ = (id) => document.getElementById(id);
  const STEP = 80; // thumb width 72 + gap 8; the drift curve uses the same grid

  // A real-sounding client thread for the autopilot button. 26 comments take the poster from v1 to v27.
  const THREAD = [
    "Can we make the logo bigger?", "Make it pop a bit more", "The white could be whiter", "Feels a bit cheap, more premium please",
    "Our audience is younger though", "Logo bigger", "Can the title be bolder?", "Too busy. Make it cleaner", "Add some depth",
    "Make it warmer, it is a summer campaign", "Can the product be more visible?", "Move the logo up a bit", "Try blue for the product",
    "Maybe more dynamic?", "My wife does not like the green", "CEO says logo bigger", "Less corporate", "Can it pop but also be premium?",
    "Make the headline stand out", "Move the title to the left", "It needs more energy", "Can you make the text smaller",
    "I will know it when I see it", "Make the white whiter, still", "What if the product was red?", "Let's try something closer to the first one",
  ];

  let versions = [];
  let server = null; // {model, vision_model} when the local Flask server and Ollama are up
  let busy = false;
  let shown = 0;
  const scoreQueue = [];
  let scoring = false;

  // ---------- rendering helpers ----------
  function svgFor(v, label) { return E.renderSVG(v.state, { label: label || v.name }); }

  function rasterize(svg, w, h) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      const url = URL.createObjectURL(new Blob([svg], { type: "image/svg+xml" }));
      img.onload = () => {
        const c = document.createElement("canvas");
        c.width = w; c.height = h;
        const ctx = c.getContext("2d");
        ctx.drawImage(img, 0, 0, w, h);
        URL.revokeObjectURL(url);
        resolve(c);
      };
      img.onerror = (e) => { URL.revokeObjectURL(url); reject(e); };
      img.src = url;
    });
  }

  // Mean absolute RGB difference against v1 on a 100x140 render, 0-100.
  async function pixelDrift(v) {
    const [a, b] = await Promise.all([rasterize(svgFor(versions[0], ""), 100, 140), rasterize(svgFor(v, ""), 100, 140)]);
    const da = a.getContext("2d").getImageData(0, 0, 100, 140).data, db = b.getContext("2d").getImageData(0, 0, 100, 140).data;
    let sum = 0;
    for (let i = 0; i < da.length; i += 4) sum += Math.abs(da[i] - db[i]) + Math.abs(da[i + 1] - db[i + 1]) + Math.abs(da[i + 2] - db[i + 2]);
    return +(100 * sum / (da.length / 4 * 3 * 255)).toFixed(1);
  }

  function show(i, opts) {
    const v = versions[i];
    shown = i;
    $("poster").innerHTML = svgFor(v);
    $("stage").classList.toggle("surprise", !!v.surprise);
    $("filename").textContent = v.name + ".svg";
    $("count").textContent = versions.length + (versions.length === 1 ? " version" : " versions");
    const who = v.n === 1 ? "First draft. Waiting for feedback." : "";
    $("reply").innerHTML = '<span class="meta">' + (v.comment ? "Client: " : "Designer") + "</span>" +
      (v.comment ? "<q>" + escapeHtml(v.comment) + "</q><br><span class=\"meta\">Designer</span> " : "<br>") + escapeHtml(v.reply || who);
    $("changes").innerHTML = (v.applied || []).map((c) => "<li>" + c.element + " · " + c.property + " · " + escapeHtml(JSON.stringify(c.value)) + "</li>").join("") +
      (v.source ? '<li class="src">via ' + escapeHtml(v.source) + "</li>" : "");
    scoreLine(v);
    document.querySelectorAll(".thumb").forEach((t, k) => t.classList.toggle("on", k === i));
    if (!opts || !opts.noScroll) {
      const tr = $("track"), x = i * STEP;
      if (x < tr.scrollLeft || x > tr.scrollLeft + tr.clientWidth - STEP) tr.scrollLeft = Math.max(0, x - tr.clientWidth / 2);
    }
  }

  function scoreLine(v) {
    const parts = [];
    if (v.drift != null) parts.push("drift " + v.drift + "% (pixels)");
    if (v.model) parts.push("model: met " + v.model.met + "/10, drift " + v.model.drift + "/10" + (v.model.why ? " · " + escapeHtml(v.model.why) : ""));
    else if (server && v.n > 1) parts.push(v.scoreError ? "model score failed" : "model scoring…");
    $("score").innerHTML = parts.join(" · ");
  }

  function escapeHtml(s) { return String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c])); }

  function renderStrip() {
    $("thumbs").innerHTML = versions.map((v, i) =>
      '<button type="button" class="thumb" data-i="' + i + '" title="' + escapeHtml(v.name + (v.comment ? ": " + v.comment : "")) + '">' +
      '<span class="mini">' + E.renderSVG(v.state, { label: "" }).replace("<svg ", '<svg aria-hidden="true" ') + "</span>" +
      '<span class="nm">' + escapeHtml(v.name) + "</span>" +
      '<span class="met">' + (v.model ? "✓" + Math.round(v.model.met) : "") + "</span></button>").join("");
    drawCurve();
  }

  function drawCurve() {
    const svg = $("curve"), w = Math.max(versions.length * STEP, 80), h = 56;
    svg.setAttribute("width", w); svg.setAttribute("viewBox", "0 0 " + w + " " + h);
    const y = (p) => (h - 6 - (p / 100) * (h - 12)).toFixed(1);
    const max = Math.max(20, ...versions.map((v) => v.drift || 0)); // scale pixel drift so small changes stay visible
    const px = versions.map((v, i) => v.drift != null ? (i * STEP + 36) + "," + y(100 * v.drift / max) : null).filter(Boolean);
    const md = versions.map((v, i) => v.model ? (i * STEP + 36) + "," + y(v.model.drift * 10) : null).filter(Boolean);
    svg.innerHTML =
      '<line x1="0" x2="' + w + '" y1="' + y(0) + '" y2="' + y(0) + '" stroke="var(--line)"/>' +
      (md.length > 1 ? '<polyline points="' + md.join(" ") + '" fill="none" stroke="var(--ink-2)" stroke-width="1.5" stroke-dasharray="4 3"/>' : "") +
      '<polyline points="' + px.join(" ") + '" fill="none" stroke="var(--accent)" stroke-width="2.5" stroke-linejoin="round"/>' +
      px.map((p) => '<circle cx="' + p.split(",")[0] + '" cy="' + p.split(",")[1] + '" r="3" fill="var(--accent)"/>').join("");
  }

  // ---------- turning a comment into a version ----------
  async function askModel(comment, state) {
    if (!server) return null;
    try {
      const r = await fetch("api/revise", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ comment, state }) });
      const j = await r.json();
      return j.changes && j.changes.length ? j : null;
    } catch (e) { return null; }
  }

  async function addVersion(comment, opts) {
    const prev = versions[versions.length - 1];
    const n = versions.length + 1;
    let state, applied = [], reply = "", source = "";
    if (n === E.SURPRISE_AT) {
      // The surprise: after 26 rounds of feedback, the client picks the first draft.
      state = JSON.parse(JSON.stringify(versions[0].state));
      reply = "Client picked the first one.";
      source = "every agency, eventually";
    } else {
      const fromModel = opts && opts.rulebookOnly ? null : await askModel(comment, prev.state);
      if (fromModel) {
        const res = E.applyChanges(prev.state, fromModel.changes);
        if (res.applied.length) { state = res.state; applied = res.applied; reply = fromModel.reply; source = server.model; }
      }
      if (!state) {
        const rb = E.ruleChanges(comment);
        let res = E.applyChanges(prev.state, rb.changes);
        if (!res.applied.length) res = E.applyChanges(prev.state, [{ element: "logo", property: "size", value: 1.3 }]); // always a visible change
        if (!res.applied.length) res = E.applyChanges(prev.state, [{ element: "logo", property: "rotate", value: 15 }]);
        state = res.state; applied = res.applied; reply = rb.reply; source = "rulebook (" + rb.rules.join(", ") + ")";
      }
    }
    const v = { n, name: E.versionName(n), comment, state, applied, reply, source, surprise: n === E.SURPRISE_AT, drift: null, model: null };
    versions.push(v);
    renderStrip();
    show(versions.length - 1);
    v.drift = await pixelDrift(v).catch(() => null);
    drawCurve();
    if (shown === versions.length - 1) scoreLine(v);
    if (server && server.vision && n > 1) { scoreQueue.push(v); pumpScores(); }
    return v;
  }

  // The vision model looks at v1 and vN and scores them, one at a time, in the background.
  async function pumpScores() {
    if (scoring) return;
    scoring = true;
    while (scoreQueue.length) {
      const v = scoreQueue.shift();
      if (!versions.includes(v)) continue;
      try {
        const [a, b] = await Promise.all([rasterize(svgFor(versions[0], ""), 400, 560), rasterize(svgFor(v, ""), 400, 560)]);
        const r = await fetch("api/score", { method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ comment: v.comment, first: a.toDataURL("image/png"), current: b.toDataURL("image/png") }) });
        const j = await r.json();
        if (j.met != null) v.model = { met: j.met, drift: j.drift, why: j.why }; else v.scoreError = true;
      } catch (e) { v.scoreError = true; }
      if (!versions.includes(v)) continue;
      renderStrip();
      document.querySelectorAll(".thumb").forEach((t, k) => t.classList.toggle("on", k === shown));
      if (versions[shown] === v) scoreLine(v);
    }
    scoring = false;
  }

  function setBusy(b) {
    busy = b;
    ["send", "play", "autopilot", "download", "reset", "comment"].forEach((id) => ($(id).disabled = b));
    document.querySelectorAll(".chip").forEach((c) => (c.disabled = b));
  }

  async function submit(comment) {
    comment = comment.trim();
    if (!comment || busy) return;
    setBusy(true);
    $("send").textContent = server ? "Thinking…" : "Apply";
    try { await addVersion(comment); } finally { setBusy(false); $("send").textContent = "Apply"; $("comment").value = ""; $("comment").focus(); }
  }

  const wait = (ms) => new Promise((r) => setTimeout(r, ms));

  async function autopilot() {
    if (busy) return;
    setBusy(true);
    try {
      const start = Math.max(0, versions.length - 1) % THREAD.length;
      const need = Math.max(1, E.SURPRISE_AT - versions.length);
      for (let k = 0; k < need; k++) {
        await addVersion(THREAD[(start + k) % THREAD.length], { rulebookOnly: true });
        await wait(120);
      }
    } finally { setBusy(false); }
  }

  async function play() {
    if (busy || versions.length < 2) return;
    setBusy(true);
    document.body.classList.add("playing");
    try {
      for (let i = 0; i < versions.length; i++) {
        show(i);
        await wait(versions[i].surprise ? 2200 : i === 0 ? 700 : 420);
      }
    } finally { document.body.classList.remove("playing"); setBusy(false); }
  }

  // One PNG with every version in order: the archive the client will never open.
  async function downloadSheet() {
    if (busy) return;
    setBusy(true);
    try {
      const cols = Math.min(6, versions.length), rows = Math.ceil(versions.length / cols);
      const tw = 200, th = 280, pad = 24, lab = 26, head = 70;
      const c = document.createElement("canvas");
      c.width = pad + cols * (tw + pad); c.height = head + rows * (th + lab + pad) + pad;
      const ctx = c.getContext("2d");
      ctx.fillStyle = "#16171A"; ctx.fillRect(0, 0, c.width, c.height);
      ctx.fillStyle = "#F2F1EC"; ctx.font = "600 26px ui-monospace,Menlo,monospace";
      ctx.fillText("finalfinal · " + versions.length + " versions · " + versions[versions.length - 1].name, pad, 44);
      for (let i = 0; i < versions.length; i++) {
        const x = pad + (i % cols) * (tw + pad), y = head + Math.floor(i / cols) * (th + lab + pad);
        ctx.drawImage(await rasterize(svgFor(versions[i], ""), tw * 2, th * 2), x, y, tw, th);
        if (versions[i].surprise) { ctx.strokeStyle = "#FF6B6B"; ctx.lineWidth = 4; ctx.strokeRect(x, y, tw, th); }
        ctx.fillStyle = versions[i].surprise ? "#FF6B6B" : "#A3A6AD"; ctx.font = "13px ui-monospace,Menlo,monospace";
        ctx.fillText(versions[i].name.slice(0, 28), x, y + th + 18);
      }
      const a = document.createElement("a");
      a.download = versions[versions.length - 1].name + "_contact_sheet.png";
      a.href = c.toDataURL("image/png");
      document.body.appendChild(a); a.click(); a.remove();
    } finally { setBusy(false); }
  }

  function reset() {
    if (busy) return;
    scoreQueue.length = 0;
    versions = [{ n: 1, name: E.versionName(1), comment: "", state: E.firstDraft(), applied: [], reply: "", source: "", drift: 0, model: null }];
    renderStrip();
    show(0);
  }

  async function detectServer() {
    if (location.protocol === "file:") return;
    try {
      const r = await fetch("api/health", { cache: "no-store" });
      const j = await r.json();
      if (j.ok && j.installed) {
        server = { model: j.model, vision: j.vision_installed, vision_model: j.vision_model };
        $("mode").textContent = "Local model: " + j.model;
        $("mode").classList.add("live");
      } else if (j.ok === false || !j.installed) {
        $("mode").textContent = "Rulebook (" + (j.ok ? j.model + " not pulled" : "Ollama is off") + ")";
      }
    } catch (e) { /* static hosting: rulebook only */ }
  }

  // ---------- wiring ----------
  $("ask").addEventListener("submit", (e) => { e.preventDefault(); submit($("comment").value); });
  $("chips").addEventListener("click", (e) => { if (e.target.classList.contains("chip")) submit(e.target.textContent); });
  $("thumbs").addEventListener("click", (e) => { const t = e.target.closest(".thumb"); if (t && !busy) show(+t.dataset.i, { noScroll: true }); });
  $("play").addEventListener("click", play);
  $("autopilot").addEventListener("click", autopilot);
  $("download").addEventListener("click", downloadSheet);
  $("reset").addEventListener("click", reset);

  reset();
  detectServer();
  window.finalfinal = { get versions() { return versions; } }; // for the smoke test
})();
