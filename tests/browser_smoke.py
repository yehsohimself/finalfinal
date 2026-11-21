# /// script
# requires-python = ">=3.9"
# dependencies = ["playwright"]
# ///
"""Browser smoke test: five comments, version names, autopilot to v27, playback, screenshots.

Usage: uv run tests/browser_smoke.py [base_url] [--shots]
Default base_url is the local server (http://127.0.0.1:5027/). Pass a file:// URL to test the static page alone.
Set CHROME=/path/to/chrome if Playwright's own browser is not installed.
"""
import glob
import os
import sys
import time

from playwright.sync_api import sync_playwright

args = [a for a in sys.argv[1:] if not a.startswith("--")]
BASE = args[0] if args else "http://127.0.0.1:5027/"
SHOTS = "--shots" in sys.argv
HERE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

COMMENTS = ["can we make the logo bigger", "I hate the orange","make it pop a bit more", "the white could be whiter", "more premium", "our audience is younger"]


def main():
    with sync_playwright() as p:
        chrome = os.environ.get("CHROME") or next(iter(sorted(glob.glob(os.path.expanduser(
            "~/Library/Caches/ms-playwright/chromium-*/chrome-mac*/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing")))), None)
        kw = {"executable_path": chrome} if chrome else {}
        browser = p.chromium.launch(**kw)
        page = browser.new_page(viewport={"width": 1280, "height": 900})
        errors = []
        page.on("pageerror", lambda e: errors.append(str(e)))
        page.goto(BASE)
        page.wait_for_timeout(800)
        print("mode:", page.inner_text("#mode"))

        last_svg = page.inner_html("#poster")
        for i, c in enumerate(COMMENTS, start=2):
            page.fill("#comment", c)
            page.press("#comment", "Enter")
            page.wait_for_function(f"window.finalfinal.versions.length === {i} && !document.getElementById('send').disabled", timeout=120000)
            svg = page.inner_html("#poster")
            assert svg != last_svg, f"poster did not change for {c!r}"
            last_svg = svg
            v = page.evaluate("(() => { const v = window.finalfinal.versions.at(-1); return [v.name, v.source, v.applied.length]; })()")
            print(f"{c!r:32} -> {v[0]:28} {v[2]} changes via {v[1]}")
            assert page.inner_text("#filename") == v[0] + ".svg"

        page.click("#autopilot")
        page.wait_for_function("window.finalfinal.versions.length === 27 && !document.getElementById('play').disabled", timeout=60000)
        names = page.evaluate("window.finalfinal.versions.map(v => v.name)")
        assert names[11] == "Final_v12_FINAL" and names[18] == "Final_v19_FINALFINAL_this_one" and names[26] == "Final_v27_FINALFINAL", names
        same = page.evaluate("JSON.stringify(window.finalfinal.versions[26].state) === JSON.stringify(window.finalfinal.versions[0].state)")
        assert same, "v27 should be the first draft"
        print("v27:", names[26], "== first draft")

        t = time.time()
        page.click("#play")
        page.wait_for_selector("#stage.surprise", timeout=30000)
        print("playback reached the surprise in %.1fs; stamp:" % (time.time() - t), page.inner_text("#stamp").replace("\n", " "))
        page.wait_for_function("!document.getElementById('play').disabled", timeout=30000)
        assert page.evaluate("document.getElementById('stage').classList.contains('surprise')"), "playback should end on v27"
        if SHOTS:  # taken after playback ends, so the buttons are not dimmed
            page.wait_for_timeout(300)
            page.screenshot(path=os.path.join(HERE, "site", "screenshot-v27.png"))

        with page.expect_download() as dl:
            page.click("#download")
        print("download:", dl.value.suggested_filename)

        if "127.0.0.1" in BASE or "localhost" in BASE:
            try:  # the vision model scores in the background; wait for a few
                page.wait_for_function("window.finalfinal.versions.filter(v => v.model).length >= 6", timeout=240000)
            except Exception:
                pass
            scored = page.evaluate("window.finalfinal.versions.filter(v => v.model).map(v => [v.name, v.comment, v.model.met, v.model.drift, v.drift])")
            for s in scored:
                print("  scored:", s)
        if SHOTS:
            page.set_viewport_size({"width": 1280, "height": 1060})
            page.click(".thumb[data-i='5']")
            page.evaluate("document.getElementById('track').scrollLeft = 0; window.scrollTo(0, 230)")
            page.wait_for_timeout(300)
            page.screenshot(path=os.path.join(HERE, "site", "screenshot.png"))

        phone = browser.new_page(viewport={"width": 540, "height": 960})
        phone.goto(BASE)
        phone.wait_for_timeout(500)
        overflow = phone.evaluate("document.documentElement.scrollWidth > window.innerWidth")
        print("phone width 540, horizontal overflow:", overflow)
        assert not overflow
        if SHOTS:
            phone.screenshot(path=os.path.join(HERE, "site", "screenshot-phone.png"))

        assert not errors, errors
        print("browser ok")
        browser.close()


main()
