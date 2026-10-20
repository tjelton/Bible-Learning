> Game playable from: [https://tjelton.github.io/Bible-Learning/](https://tjelton.github.io/Bible-Learning/.)

# Bible Learning

Quick-fire phone games for learning the Bible. You start by choosing which part of the
Bible to study, and each part has its own page of games: the Whole Bible and the
Gospels so far; others can be added later.

The Whole Bible has one game:

- **Clusters**: group sixteen words from across the Bible into four clusters of four.

The Gospels have two games:

- **Chapter & Verse**: read a moment from a Gospel and name the chapter it comes from,
  or learn the chapters a few at a time in Training.
- **Which Gospel?**: read a story, saying or detail, and tick every Gospel that tells it.

## Clusters

Sixteen words appear in a grid: people, places, books, objects and phrases from Genesis
to Revelation. Tap four that share something and submit. Find all four groups before
your four lamps go out. A guess with three of a group's four words says so.

There's no daily limit: **New puzzle** always builds a fresh one. Each puzzle takes one
group from each of four levels, shown by colour:

| Level           | Groups | For example                                 |
| --------------- | ------ | ------------------------------------------- |
| Straightforward | 16     | Sons of Jacob, Plagues of Egypt             |
| Steady          | 20     | The seven churches of Revelation, Queens    |
| Challenging     | 18     | Words left untranslated, Stoned to death    |
| Tricky          | 18     | ___ of God, Lived more than 900 years       |

Most groups have more words than a puzzle needs, so the same group comes back with
different words. New puzzles favour groups you haven't seen and hold back the 24 you saw
most recently.

- Every answer has exactly one right group. A word that would also fit another group in
  the same puzzle is never shown, so red herrings tempt but never trick. Groups whose
  stories overlap too much (Moses' life and the plagues) never meet.
- Tap a found group to read the verse behind each word, with the word highlighted.
- **Your groups** collects every group you've found, with all its words and verses.
- The home screen counts puzzles solved, perfect solves and your streak, and saves a
  puzzle in progress so you can come back to it. Starting a new one instead ends the
  streak.

## Chapter & Verse

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

- **Play a round**: 10 questions. You get 100 points for a right answer, up to +50 for
  answering quickly (the bar drains over 20 seconds), and +10 for each answer in a row
  (up to +50). The 50/50 removes two wrong answers but halves the points.
- **Three lamps**: keep answering until you've missed three. The lamps come from the
  parable of the ten virgins (Matthew 25).
- **Training**: a learning mode. It starts by asking what to train on: switch on the
  Gospels you want, and for each one choose the whole book or tap just the chapters
  you're studying (Matthew 1–7, say). It starts with the first three chapters and adds
  the next one each time you learn one (every event in it right twice in a row). Each
  new chapter is introduced with a list of what happens in it before the questions
  start. Questions switch between styles: given the chapter, pick what happens there;
  given the event, pick the chapter; and, once you've got an event right, given a verse,
  pick the chapter. Answers only come from chapters you're training on, and **Show me**
  reveals the answer instead of guessing. With several Gospels on, it moves through
  them together.

  Learned chapters come back for **review**, marked as such, on a schedule that spreads
  out each time you get them right: 10 minutes, an hour, a day, 3 days, a week, 2 weeks,
  then 1, 2 and 4 months. While any are due, about half the questions are reviews,
  most overdue first. Miss one and that chapter goes back with the ones you're learning
  until you've learned it again, and its reviews restart half as far along the schedule.
- **Study the chapters**: each Gospel's outline, with every event and the full passage
  text. The outline notes highlight each book's shape: Matthew's five teaching blocks,
  Mark's turn at Peter's confession, Luke's journey to Jerusalem, and John's signs and
  farewell discourse.

After each answer you see the exact reference, which section of the book it belongs to,
which other Gospels tell the same event, and a link to read the passage. Passages whose
text is uncertain (Mark 16:9–20, John 7:53–8:11, Luke 22:43–44) carry a short note.

Options: clue type (events, verses or both), how close the wrong answers are
(spread out, mixed, or neighbouring chapters), the speed bonus timer, and sound.

## Which Gospel?

There are 152 questions: stories (the feeding of the five thousand), details (Simon of
Cyrene carries the cross), teachings (the Golden Rule) and exact sayings ("Talitha
cumi!"). Tick every Gospel that tells it, then check. You're right only if you tick
exactly the right Gospels.

| Told by          | Questions |
| ---------------- | --------- |
| All four         | 15        |
| Three            | 32        |
| Two              | 28        |
| Only one         | 77        |

Rounds are balanced so they mix all four kinds of answer, rather than being mostly
single-Gospel questions.

- **Play a round** and **Three lamps** work the same way as in Chapter & Verse.
  **Reveal one** settles one Gospel for you (one you have wrong, if there is one) and
  halves the points.
- After each answer, the tiles show the reference in each Gospel that tells it. A note
  explains how the tellings differ, or points out a near miss (for example, Luke 7's
  anointing is a different occasion from the one at Bethany).
- **Browse the answers** lists every question grouped by its answer, such as "Only
  John" or "Matthew and Luke". Tap one to read all its passages one after another.

## Chapter & Verse and Which Gospel?

The two Gospel games learn what you find hard. Questions you miss come up more often, and one
counts as **mastered** once you get it right twice in a row. Each game keeps its own
progress, settings and best scores, saved in the browser on that device. The Gospels
page shows how far you've got in each. If the browser blocks storage (Safari with
Block All Cookies, a Private tab, some in-app browsers), each game's home screen says
that progress isn't being saved.

## Running it

It's a static site with no build step and no dependencies. Serve the folder over HTTP:

```sh
python3 -m http.server 8000
# then open http://localhost:8000
```

Each screen has its own address, so the back button works and you can link straight to a
game: `#/` (choose a part), `#/bible`, `#/bible/clusters`, `#/gospels`,
`#/gospels/chapter-and-verse`, `#/gospels/which-gospel`.

To play on an iPhone, host the folder anywhere that serves static files (GitHub Pages,
Netlify, Cloudflare Pages…), open it in Safari, then tap **Share → Add to Home Screen**.
It then opens full screen like an app.

On an iPhone or iPad in a browser tab, the first screen shows a banner offering to show
how. **Show me how** opens the steps, each with a drawing of the Safari screen and the
button to tap. The banner's **✕** hides it until the next visit; **Don't show again**
hides it for good. The steps stay available from a link at the foot of the first screen,
which is hidden once it's running from the Home Screen.

`node scripts/build.mjs` bundles everything into one file, `dist/bible-learning.html`,
for hosts that take a single page.

## Accuracy

- Scripture text is the **World English Bible** (public domain), downloaded verbatim by
  `scripts/fetch-text.mjs` from bible-api.com and stored in `js/data/text-<book>.js`.
  Clusters stores only the verses it cites, in `js/data/clusters-text.js`,
  downloaded by `scripts/fetch-clusters-text.mjs` (whole chapters are cached in
  `.cache/`, which isn't committed).
- `node scripts/check-data.mjs` checks all the data:
  - Chapter & Verse events: verse ranges exist, the key verse is inside the passage,
    parallel references are valid, and every chapter has events. `--print [Book]` shows
    the verses either side of each passage boundary for proof-reading.
  - Which Gospel? questions: every passage exists and contains the question's `find`
    phrase, and every saying's title is quoted word for word from its passage. For
    questions marked `exclusive`, the phrase must appear nowhere in the Gospels left
    out, which proves the answer is complete. That covers 94 of the 152 questions. The
    rest were checked by hand against a Gospel synopsis.
  - Clusters groups: every word's passage contains the word itself (or its
    `find` phrase), each book group's words are books, and every group can appear in
    some puzzle. Whether each word really belongs, and whether any word could also
    fit another group, was checked by hand.
- Clues are paraphrases written to match the text, using the same wording as this
  translation (e.g. "Zacharias").
- Chapter & Verse's parallels (`par`) follow the usual synopsis pairings at chapter level.
  They stop another Gospel's telling of the same story being offered as a wrong answer,
  and stop one round asking the same story twice. Which Gospel? doesn't use them: a
  chapter-level link is too loose to decide whether a Gospel tells a particular detail.

## Tests

```sh
node --test
```

`tests/engine.test.mjs` covers Chapter & Verse:

- the answer choices: always four distinct options including the right one, never a
  parallel account offered as a wrong answer, and a mix of books that never gives the
  answer away
- the 50/50, question weighting, mastery, scoring and verse formatting
- training: the chapters you choose, which chapters join and when, that its answer
  choices stay within those chapters and never offer something that also happens in the
  asked chapter, and the review schedule

`tests/clusters.test.mjs` covers Clusters:

- every puzzle has one group per level and sixteen different words
- every word belongs to exactly one of its puzzle's groups, and families never meet
- unseen groups come first, and recent ones are held back
- checking guesses (including three of one group), and the ranks quoting the text

`tests/which-gospel.test.mjs` covers Which Gospel?:

- reading references, grading and the hint
- the balance of answers across rounds
- never asking two related questions in one round
- the ranks quoting the text

## Adding or changing content

**Chapter & Verse events** live in `js/data/<book>.js`. Each has:

- a stable `id` (progress is saved against it)
- a `title` and a `clue`
- the chapter and verse range
- a `key` verse for verse clues
- `par` (parallel chapters in other Gospels)
- optionally `confuse` (look-alike chapters in the same book) and `note`

**Which Gospel? questions** live in `js/data/which-gospel.js`. Each has:

- a stable `id`
- a `kind` (event, detail, teaching or saying)
- a `title` and a `clue`
- `refs`, listing every passage that tells it (the answer is the Gospels named there)
- a `find` phrase for the checker, and `exclusive` when that phrase proves the answer
  is complete
- optionally a `note`
- optionally a `group`, shared by questions that would give each other away

**Clusters groups** live in `js/data/clusters.js`. Each has:

- a stable `id`
- a `level` from 1 to 4
- a `title` and a `note`
- `items`: each word with a reference that shows it belongs, and an optional `find`
  phrase when the passage doesn't use the word itself
- `fits`: other words that would also belong. List every word used elsewhere in the
  file that a player could fairly put in this group; the puzzle builder relies on it to
  keep answers unambiguous
- optionally a `family`, shared by groups that should never meet
- `books: true` for groups of books, whose references are each book's first verse

After adding references, run `node scripts/fetch-clusters-text.mjs` to download their
verses.

After editing any of these, run `node scripts/check-data.mjs` and `node --test`.

**A new game** is a script that registers itself on `window.Games` (see the end of
`js/which-gospel.js`). Add its id to that part's `games` list in `js/hub.js`, and its
script tag to `index.html`. To open a new part of the Bible, add an entry with its `games`
list to `PARTS` in `js/hub.js`.

## Files

```
index.html                  page shell
css/styles.css              all styling (light and dark)
js/hub.js                   choosing a part of the Bible, its games page, routing
js/kit.js                   shared pieces: saved data, sound, passage sheet, icons
js/install.js               the "Add to Home Screen" banner and steps for iPhone and iPad
js/engine.js                Chapter & Verse rules: choices, weighting, scoring, training (no DOM)
js/chapter-and-verse.js     Chapter & Verse screens and input
js/which-gospel-engine.js   Which Gospel? rules: answers, grading, hints (no DOM)
js/which-gospel.js          Which Gospel? screens and input
js/clusters-engine.js       Clusters rules: building puzzles, checking guesses (no DOM)
js/clusters.js              Clusters screens and input
js/data/<book>.js           each Gospel's events and outline
js/data/text-<book>.js      each Gospel's full text (WEB)
js/data/which-gospel.js     Which Gospel? questions
js/data/clusters.js         Clusters groups
js/data/clusters-text.js    the verses Clusters cites (WEB)
scripts/                    fetch text, check data, build single file
tests/                      node:test unit tests
```
