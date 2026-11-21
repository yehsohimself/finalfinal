# /// script
# requires-python = ">=3.9"
# dependencies = ["flask>=3"]
# ///
"""finalfinal: serves the poster page and turns client comments into change lists with a local Ollama model.

Run:  uv run server.py      (or: pip install flask && python3 server.py)
Then open http://127.0.0.1:5027
Nothing leaves your machine: the only outbound call is to Ollama on localhost.
"""
import json
import os
import re
import urllib.error
import urllib.request

from flask import Flask, jsonify, request, send_from_directory

HERE = os.path.dirname(os.path.abspath(__file__))
SITE = os.path.join(HERE, "site")
OLLAMA = os.environ.get("OLLAMA_URL", "http://127.0.0.1:11434").rstrip("/")
MODEL = os.environ.get("FINALFINAL_MODEL", "gemma3:4b")
VISION_MODEL = os.environ.get("FINALFINAL_VISION_MODEL", MODEL)
PORT = int(os.environ.get("PORT", "5027"))

ELEMENTS = {"title", "logo", "product", "background"}
PROPERTIES = {"size", "color", "rotate", "position", "weight", "shadow"}

REVISE_PROMPT = """You are a senior designer applying a client's comment to a poster. You may only answer with JSON.

The poster has four layers: title, logo, product (a big circle), background.
Current state (JSON): {state}

Allowed properties and values:
- size: a multiplier, e.g. 1.3 for 30% bigger, 0.8 for smaller (not for background)
- color: a hex code like "#FF3366", or one of: saturate, desaturate, lighten, darken, warmer, cooler, whiter, red, orange, yellow, green, teal, blue, purple, pink
- rotate: degrees to add, e.g. -8 (not for background)
- position: one of left, right, up, down, center (not for background)
- weight: font weight 100-900, or "bolder" / "lighter" (title and logo)
- shadow: 0 to 1 (0 = none)

Agency glossary (how this studio translates the classics):
- "bigger" = size 1.3 on the element named; only the logo if the logo is named
- "pop" = product color saturate, product rotate -8, title color saturate
- "whiter" = background color whiter (white things live in the background)
- "premium" = background "#15151A", title color "#C9A646", title weight 300, product shadow 0.8
- "younger" = background "#C6F432", title rotate -6, title weight 900, product color pink
- "cleaner" = shadows 0, title weight 200, product color desaturate
- a colour the client dislikes = change that element to a different named colour

Rules: pick the layer the comment is really about; the logo is only one of four layers. Always make at least one
visible change, even for vague or impossible comments. Keep it to 1-5 changes. "reply" is one dry, short sentence the
designer would send back to the client, no exclamation marks.

Examples:
Comment: "can the headline breathe a bit" ->
{{"changes":[{{"element":"title","property":"size","value":0.85}},{{"element":"title","property":"weight","value":300}}],"reply":"Gave the headline some air."}}
Comment: "the circle feels flat" ->
{{"changes":[{{"element":"product","property":"shadow","value":0.6}},{{"element":"product","property":"color","value":"saturate"}}],"reply":"Added depth. It is still a circle."}}
Comment: "too beige" ->
{{"changes":[{{"element":"background","property":"color","value":"cooler"}}],"reply":"Less beige. Still tasteful."}}

Answer with JSON only, in that shape.
Client comment: {comment}"""

SCORE_PROMPT = """Image 1 is the first draft of a poster. Image 2 is the revised version.
The client asked: "{comment}"
First list what visibly differs between the two images (colours, sizes, rotation, type weight, background).
Then score two things as whole numbers from 0 to 10:
- met: how well image 2 does what the client asked (0 = ignored, 5 = partly, 10 = exactly)
- drift: how far image 2 has moved from image 1 (0 = identical, 2 = one small tweak, 5 = clearly different colours or
  sizes, 8 = different palette and layout, 10 = unrecognisable)
Answer only with JSON in this shape, replacing the angle brackets:
{{"why": "<what differs, one short sentence>", "met": <0-10>, "drift": <0-10>}}"""

app = Flask(__name__, static_folder=None)


def ollama(prompt, images=None, timeout=90):
    body = {"model": VISION_MODEL if images else MODEL, "prompt": prompt, "stream": False, "format": "json",
            "options": {"temperature": 0.4}}
    if images:
        body["images"] = images
    req = urllib.request.Request(OLLAMA + "/api/generate", data=json.dumps(body).encode(),
                                 headers={"Content-Type": "application/json"})
    with urllib.request.urlopen(req, timeout=timeout) as r:
        text = json.load(r).get("response", "")
    match = re.search(r"\{.*\}", text, re.S)
    return json.loads(match.group(0) if match else text)


def clean_changes(raw):
    """Keep only changes inside the design language; the browser clamps the values."""
    out = []
    items = raw.get("changes", []) if isinstance(raw, dict) else raw if isinstance(raw, list) else []
    for c in items:
        if not isinstance(c, dict):
            continue
        el = str(c.get("element", c.get("oge", ""))).lower().strip()
        prop = str(c.get("property", c.get("ozellik", ""))).lower().strip()
        prop = {"colour": "color", "rotation": "rotate", "scale": "size", "font_weight": "weight", "font-weight": "weight",
                "align": "position", "alignment": "position"}.get(prop, prop)
        val = c.get("value", c.get("deger"))
        if el in ELEMENTS and prop in PROPERTIES and val is not None and not isinstance(val, (dict, list)):
            out.append({"element": el, "property": prop, "value": val})
    return out[:6]


@app.get("/api/health")
def health():
    try:
        with urllib.request.urlopen(OLLAMA + "/api/tags", timeout=3) as r:
            names = [m.get("name") for m in json.load(r).get("models", [])]
        return jsonify(ok=True, model=MODEL, vision_model=VISION_MODEL, installed=MODEL in names,
                       vision_installed=VISION_MODEL in names)
    except (urllib.error.URLError, OSError, ValueError) as e:
        return jsonify(ok=False, error=f"Ollama not reachable at {OLLAMA}: {e}")


@app.post("/api/revise")
def revise():
    data = request.get_json(force=True, silent=True) or {}
    comment = str(data.get("comment", ""))[:300].strip()
    if not comment:
        return jsonify(error="Empty comment."), 400
    state = data.get("state", {})
    try:
        raw = ollama(REVISE_PROMPT.format(state=json.dumps(state), comment=json.dumps(comment)))
    except Exception as e:  # model missing, timeout, unparsable output: the page falls back to the rulebook
        return jsonify(changes=[], reply="", error=f"model failed: {e}"), 200
    reply = str(raw.get("reply", ""))[:200] if isinstance(raw, dict) else ""
    return jsonify(changes=clean_changes(raw), reply=reply, model=MODEL)


@app.post("/api/score")
def score():
    data = request.get_json(force=True, silent=True) or {}
    first, current = data.get("first", ""), data.get("current", "")
    strip = lambda s: s.split(",", 1)[1] if s.startswith("data:") else s
    try:
        raw = ollama(SCORE_PROMPT.format(comment=str(data.get("comment", ""))[:300].replace('"', "'")),
                     images=[strip(first), strip(current)], timeout=120)
        met = max(0, min(10, float(raw.get("met"))))
        drift = max(0, min(10, float(raw.get("drift"))))
        return jsonify(met=met, drift=drift, why=str(raw.get("why", ""))[:160], model=VISION_MODEL)
    except Exception as e:
        return jsonify(error=f"scoring failed: {e}"), 200


@app.get("/")
def index():
    return send_from_directory(SITE, "index.html")


@app.get("/<path:name>")
def static_files(name):
    return send_from_directory(SITE, name)


if __name__ == "__main__":
    print(f"finalfinal: http://127.0.0.1:{PORT}  (model: {MODEL}, Ollama: {OLLAMA})")
    app.run(host="127.0.0.1", port=PORT, debug=False)
