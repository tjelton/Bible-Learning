> Game playable from: [https://tjelton.github.io/Bible-Learning/](https://tjelton.github.io/Bible-Learning/.)

# Chapter & Verse

A quick-fire phone game for learning where the key events of the Gospels are found.
You get a moment from the Gospel, either a description of an event or a verse quoted
from it, and pick the chapter it comes from out of four choices.

It covers all four Gospels, with 362 events across every chapter:

| Gospel  | Chapters | Events |
| ------- | -------- | ------ |
| Matthew | 28       | 132    |
| Mark    | 16       | 77     |
| Luke    | 24       | 102    |
| John    | 21       | 51     |

Matthew is on by default. Switch the others on under **Options → Gospels**. With more
than one on, you pick the Gospel as well as the chapter.

## Playing

- **Play a round**: 10 questions. You get 100 points for a right answer, up to +50 for
  answering quickly (the bar drains over 20 seconds), and +10 for each answer in a row
  (up to +50). The 50/50 removes two wrong answers but halves the points.
- **Three lamps**: keep answering until you've missed three. The lamps come from the
  parable of the ten virgins (Matthew 25).
- **Training**: a learning mode that starts with three chapters and adds the next one
  each time you learn one (every event in it right twice in a row). Each new chapter is
  introduced with a list of what happens in it before the questions start. Questions
  switch between styles: given the chapter, pick what happens there; given the event,
  pick the chapter; and, once you've got an event right, given a verse, pick the chapter.
  Answers only come from chapters you're training on, chapters still being learned come
  up four times as often as learned ones, and **Show me** reveals the answer instead of
  guessing. With several Gospels on, it moves through them together.
- **Study the chapters**: each Gospel's outline, with every event and the full passage
  text. The outline notes highlight each book's shape: Matthew's five teaching blocks,
  Mark's turn at Peter's confession, Luke's journey to Jerusalem, and John's signs and
  farewell discourse.

After each answer you see the exact reference, which section of the book it belongs to,
which other Gospels tell the same event, and a link to read the passage. Passages whose
text is uncertain (Mark 16:9–20, John 7:53–8:11, Luke 22:43–44) carry a short note.

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
  `scripts/fetch-text.mjs` from bible-api.com and stored in `js/data/text-<book>.js`.
- `node scripts/check-data.mjs` checks every event: verse ranges exist, the key verse is
  inside the passage, parallel references are valid, and every chapter has events.
  `--print [Book]` shows the verses either side of each passage boundary for
  proof-reading. Clues use the same wording as this translation (e.g. "Zacharias").
- Parallels (`par`) follow the usual Gospel synopsis pairings at chapter level. They
  stop another Gospel's telling of the same story being offered as a wrong answer, and
  stop one round asking the same story twice.
- Clues are paraphrases written to match the text.

## Tests

```sh
node --test
```

These cover the answer choices (always four distinct options including the right one,
never a parallel account offered as a wrong answer, and a mix of books that never gives
the answer away), the 50/50, question weighting, mastery, scoring and verse formatting, and training
(which chapters join and when, and that its answer choices stay within those chapters
and never offer something that also happens in the asked chapter).

## Adding or changing events

Events live in `js/data/<book>.js`. Each has a stable `id` (progress is saved against
it), a `title`, a `clue`, the chapter and verse range, a `key` verse for verse clues,
`par` (parallel chapters in other Gospels), and optionally `confuse` (look-alike chapters
in the same book) and `note`. After editing, run `node scripts/check-data.mjs` and
`node --test`.

## Files

```
index.html              page shell
css/styles.css          all styling (light and dark)
js/engine.js            game rules: choices, weighting, scoring, training (no DOM)
js/app.js               screens, input, saved progress
js/data/<book>.js       each Gospel's events and outline
js/data/text-<book>.js  each Gospel's full text (WEB)
scripts/                fetch text, check data, build single file
tests/                  node:test unit tests
```
