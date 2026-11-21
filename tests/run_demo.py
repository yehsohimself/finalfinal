# /// script
# requires-python = ">=3.9"
# dependencies = ["playwright"]
# ///
"""Replays demo.json on the static page at desktop and phone width and reports timing. Usage: uv run tests/run_demo.py"""
import glob
import json
import os
import time

from playwright.sync_api import sync_playwright

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
demo = json.load(open(os.path.join(ROOT, "demo.json")))
url = "file://" + os.path.join(ROOT, demo["sayfa"])
chrome = os.environ.get("CHROME") or next(iter(sorted(glob.glob(os.path.expanduser(
    "~/Library/Caches/ms-playwright/chromium-*/chrome-mac*/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing")))), None)

with sync_playwright() as p:
    b = p.chromium.launch(**({"executable_path": chrome} if chrome else {}))
    for w, h in [(1280, 800), (540, 960)]:
        page = b.new_page(viewport={"width": w, "height": h})
        page.goto(url)
        t = time.time()
        for s in demo["adimlar"]:
            if "bekle" in s: page.wait_for_timeout(s["bekle"])
            elif "tikla" in s: page.click(s["tikla"])
            elif "yaz" in s: page.type(s["yaz"][0], s["yaz"][1], delay=35)
            elif "tus" in s: page.keyboard.press(s["tus"])
            elif "kaydir" in s: page.mouse.wheel(0, s["kaydir"])
        n = page.evaluate("window.finalfinal.versions.length")
        print(f"{w}px: {time.time() - t:.1f}s, versions={n}, play button enabled={page.is_enabled('#play')}, "
              f"surprise shown={page.evaluate('!!document.querySelector(\".stage.surprise\")')}")
    b.close()
