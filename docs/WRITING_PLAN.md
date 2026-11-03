# Writing — Three pages and 100% human

_Last mapped: 2026-11-02_

**Planned.** Nothing here is built. This replaces sections 3 and 4 of [`STREAM_LOG_PLAN.md`](STREAM_LOG_PLAN.md) and is item 3–4 of Wave 16 in [`PLAN_OF_ACTION.md`](PLAN_OF_ACTION.md).

## What you asked for

- A **Three pages** section in Docs, tied to the daily "3 pages" habit.
- No `-3p` flag.
- Brain2 notices long text you wrote by hand and offers to tag it as human-written.
- A separate **100% human** document. You opt text in. It is not Three pages.
- Any passage can say who wrote it: you, a model, a named person, or copied from a source.
- Import old three pages and other writing from Google Docs.
- Later: a weekly habit to prune and tag the week's writing, and a check on whether typing changes three pages too much compared with handwriting.

## Decisions (asked 2026-11-02)

- **A doc per day.** Each day's three pages is its own doc in a Three pages folder.
- **No flag.** Captured text is not appended to Three pages from Quick Add or Telegram.
- **Human text is opt-in.** Brain2 auto-tags long hand-typed text. Only text you accept goes into the 100% human document.

## What already exists

| Piece | Where |
|---|---|
| Docs: a rich editor over `note` items, with folders, auto-save, and a folder filter | `components/Docs/`, `components/Docs/doc-actions.ts`, `lib/doc-persist.ts`, `lib/doc-html.ts` |
| Pasted and typed links auto-linkify, so the editor already sees paste events | `lib/doc-links.ts` |
| A seeded daily habit, "Write at least 3 pages per day", goal 3, unit pages | `lib/habits-store.ts` |
| Habit auto-links that fill a habit from a list, tag, or keyword | `docs/analytics-vision/02-habits.md`, `components/Home/Habits/README.md` |
| Capture origin: which door an idea came through | `lib/capture-origin.ts` |
| A planned writer stamp (`writtenBy`) | [`PEOPLE_AND_KEYS.md`](PEOPLE_AND_KEYS.md) build order step 1 |
| Every Telegram text you sent, kept | `lib/ingest/telegram-feed-store.ts` |
| Journal scans from photos and PDFs | `lib/ingest/scan-door.ts`, `lib/ingest/ocr.ts` |

## Part 1 — Three pages

**Folder.** A built-in **Three pages** folder in Docs. It cannot be deleted. Renaming it keeps its role.

**One doc per day.** Opening Three pages opens today's doc, titled by date (`2026-11-02`). If it does not exist yet, it is made on first keystroke, not on open, so an empty day leaves no doc. Previous and next keys walk the days, like the other day-scrolling rooms.

**Pages, not words.** The doc shows a page count as you write. One page is 250 typed words by default (Settings). That is the common equivalent of a longhand page (three pages ≈ 750 words). A scanned handwritten page counts as one page.

**The habit.** "Write at least 3 pages per day" gets an auto-link to the Three pages folder. The day's page count fills the habit cell. Bare minimum, goal, and exceptional can be set on page counts (for example 1, 3, 5) once [`STREAM_LOG_PLAN.md`](STREAM_LOG_PLAN.md) section 6 lands.

**Handwritten days.** A journal scan can be filed as that day's three pages: the scan is attached and its OCR text becomes the body, marked `me`. This is where the typing-versus-handwriting comparison lives: Data can compare word count, mood words, and how often you hit three pages on typed days versus handwritten days.

**Import.** Old three pages from Google Docs: export each as `.docx` or HTML and upload. A date in the title or first line puts it on that day; otherwise you pick one. Other Google Docs writing imports as normal docs.

## Part 2 — Who wrote it

A mark on any block or selection in a doc body, and on captured items:

| Mark | Means |
|---|---|
| `me` | You wrote it. The only mark the 100% human document accepts. |
| `model` | A model wrote it (BIM, a BIMBY, Claude, pasted from a chat). |
| `person:<id>` | Someone else wrote it, linked to their person item. Later also "said by". |
| `copied` | Copied from a source, with a free `source` field ("Artist's Way p. 12", a URL). |

**Defaults are stamped, never silent guesses.**
- Typed into Docs, Quick Add, Plan logs, or Telegram: `me`.
- Pasted into Docs: a small bar asks "Copied from?" with **me**, **model**, **a person**, and a source field. Esc keeps it unmarked.
- Written by BIM or any model in the app: `model`.

**Storage.** A `data-author` and `data-source` attribute on the block in the doc HTML (`lib/doc-html.ts`). On items it uses the same word as the planned `writtenBy`. One vocabulary for both.

**Seen as.** A thin margin rule per mark, and a filter in Docs and Search. The graph reads the mark.

## Part 3 — 100% human

**Auto-tagging long hand-typed text.** A candidate is text that is all of:
- typed, not pasted (the editor and Quick Add know which);
- from you, by its door (Quick Add, Telegram, Plan log, BIM chat, Docs, Three pages);
- at least N words (default 80);
- not already in the 100% human document.

Each candidate gets the `me` mark and a quiet **Add to 100% human?** key where it was written, plus a weekly batch.

**The document.** One built-in doc, **100% human**, separate from Three pages. Accepted text is copied in as a dated block with its source line ("from Telegram, 2026-10-24 4:49 pm"), linked back to the original. It is editable. Only `me` text can enter.

**Weekly prune.** A weekly habit, **Prune writing**, opens the week's candidates and the week's 100% human blocks with keep, tag (topic, person, operation, task), or drop. Drop removes it from 100% human only; the original stays.

## Steps

1. Three pages folder, a doc per day, day walking, page count.
2. Habit auto-link from the page count.
3. Author marks in doc HTML, the editor command, and the paste bar.
4. `writtenBy` on items from Quick Add, Telegram, and BIM (shared with [`PEOPLE_AND_KEYS.md`](PEOPLE_AND_KEYS.md) step 1).
5. Candidate detection and the **Add to 100% human?** key.
6. The 100% human document and its weekly batch.
7. Journal scan → that day's three pages.
8. Google Docs import.
9. Prune writing habit.
10. Data: typed versus handwritten days.

## Done when

- Writing 750 words in today's Three pages doc ticks the 3 pages habit.
- Pasting a ChatGPT answer into a doc asks where it came from, and the block shows its mark.
- A long Telegram rant shows up as a candidate, and accepting it puts a dated copy in 100% human.

## Open questions

- Should Telegram texts count toward the day's three pages if you choose, or stay only as 100% human candidates?
- Is 80 words the right floor for a candidate, or should only much longer pieces be offered?
