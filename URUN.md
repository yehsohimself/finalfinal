# finalfinal: product notes

Internal notes for the maker. Working title during the night: "Revision Machine". Public name: **finalfinal**.

## Product

- **One sentence:** for agency and freelance designers: a toy that actually applies client comments to a design, archives every version, and replaces the comment thread.
- **Problem:** the revision loop runs on email, screenshots and file names. Comments are vague, results are a surprise, the archive is a mess.
- **Audience (ICP):** designers, copywriters and agency staff. Found in the LinkedIn agency crowd, design communities on X, agency Slack channels.
- **MVP scope:** a ready-made poster and a comment box; a local model plus a small rulebook that turn a comment into a design change (pop: saturation and rotation; bigger: +30%); a `Final_vN` name and a thumbnail strip for each version; a timeline that plays every version and a one-image download; hidden surprise: version 27 is the first draft.
- **Difference:** the joke comes from someone who worked inside agencies, and the tool really works. The same engine can do serious work in Couple (brief and presentation prep).
- **Distribution:** a 15-second screen recording on LinkedIn and X; a link sent to friends in agencies.
- **Revenue:** free, single page.
- **Competitors:** no known direct one. Adjacent: Figma comments, Filestage.
- **Series:** Night Shift, episode 1. The trick revealed at the end of the video: a 4B model on a laptop turns a sentence into `[{element, property, value}]`, and a 14-rule glossary keeps it from saying "logo bigger" every time.

## What was built (first night)

- `site/index.html`: the working toy. Runs alone with the rulebook (hostable as a static page).
- `server.py`: Flask endpoint (`/api/revise`, `/api/score`, `/api/health`) that talks to Ollama on localhost.
- Editor's addition, done: a local vision model scores each version against v1 ("was the comment met, how far did we drift") next to a measured pixel drift; both are drawn as a curve above the thumbnail strip.

## Assumptions to validate

1. **Riskiest: translations are not monotonous.** Already seen once: before the prompt had a glossary, gemma3:4b answered "pop", "premium" and "dynamic" with "logo bigger". Cheapest test: collect 20 comments you really heard, type them in, count how many made someone laugh. Pass mark to decide in advance (suggestion: 10 of 20).
2. **The 27th-version reveal lands in 15 seconds.** Test: show the demo recording to five agency people without explaining; do they get the ending?
3. **People type their own comments** instead of only pressing the chips. Test: watch three people use the page; count typed vs clicked.
4. **The vision score adds something.** Right now it is coarse (mostly 6-8). If people ignore the curve, drop the model score and keep the pixel line.
5. **The engine is useful for real work (Couple).** Test: apply 10 real comments from one Couple presentation and see how many changes are usable as-is.

## Next 3 steps

1. Run the 20-real-comments test with gemma3:4b and write the score here. Fix the glossary for the ones that fall flat.
2. Record the 15-second video from `demo.json` (desktop and 540 px), with the trick reveal at the end, and post it once on LinkedIn.
3. Let people bring their own poster: accept an SVG with four named layers (`layer-title`, `layer-logo`, `layer-product`, `layer-background`), so a designer can try it on their own work. Keep versions in localStorage so a reload does not lose the thread.
