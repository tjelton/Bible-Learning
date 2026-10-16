# Chapter & Verse

A quick-fire phone game for learning where the key events of the Gospels are found.
You get a moment from the Gospel, either a description of an event or a verse quoted
from it, and pick the chapter it comes from out of four choices.

It starts with **Matthew**: 132 events covering all 28 chapters. Mark, Luke and John
already have switches in Options, marked "Coming soon", for when their data is added.

## Playing

- **Play a round**: 10 questions. You get 100 points for a right answer, up to +50 for
  answering quickly (the bar drains over 20 seconds), and +10 for each answer in a row
  (up to +50). The 50/50 removes two wrong answers but halves the points.
- **Three lamps**: keep answering until you've missed three. The lamps come from the
  parable of the ten virgins (Matthew 25).
- **Study the chapters**: Matthew's outline, built around its five teaching blocks
  (chapters 5–7, 10, 13, 18 and 24–25), with every event and the full passage text.

After each answer you see the exact reference, which section of Matthew it belongs to,
which other Gospels tell the same event, and a link to read the passage.

The game learns what you find hard. Events you miss come up more often, and an event
counts as **mastered** once you get it right twice in a row. Progress, settings and best
scores are saved in the browser on that device.

Options: clue type (events, verses or both), how close the wrong answers are
(spread out, mixed, or neighbouring chapters), the speed bonus timer, and sound.

## Running it

It's a static site with no build step and no dependencies. Serve the folder over HTTP:

```sh
python3 -m http.server 8000
# then open http://localhost:8000
```

To play on an iPhone, host the folder anywhere that serves static files (GitHub Pages,
Netlify, Cloudflare Pages…), open it in Safari, then tap **Share → Add to Home Screen**.
It then opens full screen like an app.

`node scripts/build.mjs` bundles everything into one file, `dist/chapter-and-verse.html`,
for hosts that take a single page.

## Accuracy

- Scripture text is the **World English Bible** (public domain), downloaded verbatim by
  `scripts/fetch-text.mjs` from bible-api.com and stored in `js/data/text-matthew.js`.
- `node scripts/check-data.mjs` checks every event: verse ranges exist, the key verse is
  inside the passage, parallel references are valid, and every chapter has events.
  `--print` shows the verses either side of each passage boundary for proof-reading.
- Clues are paraphrases written to match the text.

## Tests

```sh
node --test tests/
```

These cover the answer choices (always four distinct options including the right one,
and never a parallel account offered as a wrong answer), the 50/50, question weighting,
mastery, scoring and verse formatting.

## Adding another Gospel

1. `node scripts/fetch-text.mjs Mark 16` writes `js/data/text-mark.js`.
2. Create `js/data/mark.js` in the same shape as `js/data/matthew.js`: `book`,
   `chapters`, `sections` and `events`. For each event, list in `par` the chapters of
   the other Gospels that tell the same story, so they're never offered as wrong answers.
3. Add both files as `<script>` tags in `index.html`, and add the file names to
   `scripts/check-data.mjs` and `tests/engine.test.mjs`.

The Gospel switch turns on automatically once the data is loaded. With several Gospels
on, the wrong answers mix chapters from the different books.

## Files

```
index.html              page shell
css/styles.css          all styling (light and dark)
js/engine.js            game rules: choices, weighting, scoring (no DOM)
js/app.js               screens, input, saved progress
js/data/matthew.js      Matthew's events and outline
js/data/text-matthew.js Matthew's full text (WEB)
scripts/                fetch text, check data, build single file
tests/                  node:test unit tests
```
