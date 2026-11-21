"""Sends real-sounding client comments to the running server and prints the change lists. Needs `uv run server.py` and Ollama.

Usage: python3 tests/model_check.py [more comments...]
"""
import json
import sys
import urllib.request

BASE = "http://127.0.0.1:5027"
COMMENTS = sys.argv[1:] or [
    "can we make the logo bigger",
    "make it pop a bit more",
    "the white could be whiter",
    "feels a bit cheap, more premium please",
    "my wife does not like orange",
    "can it feel more like summer",
    "the text is hard to read",
    "make it more dynamic",
]
STATE = {
    "background": {"color": "#EFE6D2", "shadow": 0},
    "title": {"text": "Taste the Weekend", "color": "#1E1E24", "size": 1, "rotate": 0, "x": 0, "y": 0, "weight": 700, "shadow": 0},
    "logo": {"color": "#1E1E24", "size": 1, "rotate": 0, "x": 0, "y": 0, "weight": 700, "shadow": 0},
    "product": {"color": "#E4572E", "size": 1, "rotate": 0, "x": 0, "y": 0, "weight": 700, "shadow": 0},
}


def post(path, body):
    req = urllib.request.Request(BASE + path, data=json.dumps(body).encode(), headers={"Content-Type": "application/json"})
    with urllib.request.urlopen(req, timeout=180) as r:
        return json.load(r)


print(urllib.request.urlopen(BASE + "/api/health", timeout=5).read().decode())
for c in COMMENTS:
    res = post("/api/revise", {"comment": c, "state": STATE})
    print(f"{c!r}\n  changes: {json.dumps(res.get('changes'))}\n  reply: {res.get('reply')!r} {res.get('error', '')}")
