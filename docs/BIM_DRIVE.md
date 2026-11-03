# Drive: resistance and excitement about next actions

_Last mapped: 2026-10-30_

Code: `lib/bim-flow/drive.ts`. Screen: **Drive** button in the BIM flow bench
(`components/Lab/BimFlow/drive-sheet.tsx`). Tests: `lib/bim-flow/drive.test.ts`.

## Why

A task list says what is next. It does not say what the person is pulled
toward or pushing away from, and that is what decides whether the next action
gets done. People already write it down without being asked: "ugh, the taxes",
"can't wait to finish the flow". The Data screens keep why things were missed
(`miss-reasons`, `pushed-tasks`). Drive keeps the feeling _before_ the miss,
with its reason, as a score that moves.

## What a reading is

One line of the person's words about one task.

| Field | Meaning |
| --- | --- |
| `task` | The task as they would name it. Phrasings merge by shared stem words (`taskKey`). |
| `pole` | `excitement` (drawn to it) or `resistance` (dreading, avoiding, putting off). |
| `strength` | 1 faint … 10 overwhelming. Same scale as the level it aims at. |
| `reason` | Why, in their terms, only if the note says. Empty is a real answer. |
| `quote` | The exact words. Code drops a reading whose quote is not in the text. |
| `source` | `bim`, `log`, `day note`, `thought`, `flow`, `by hand`. |

## How it is found

1. **Code picks the sentences.** `feelingWindows` keeps sentences with a
   resistance or excitement cue plus the sentence before and after, because
   the reason is often next door. Overlaps merge. A long thought-process note
   becomes at most six short windows.
2. **The model reads only those.** `readDrive` sends the windows with the
   known task names, so "emailing the landlord" reuses "email landlord". JSON
   schema, at most four readings, an empty list is fine.
3. **Code checks.** `checkReadings` needs a task, a pole, a strength, and a
   quote that appears in the text.
4. **Live messages** go through the starter Log graph's drive lane: gate
   "Feels about a task?" → extract task / pole / strength / reason → `drive`
   proposal. After a run, the lab writes each `drive` proposal to the drive
   log. Other proposals are still only previewed.
5. **Scan notes** in the Drive sheet reads BIM messages, logs, day notes and
   thought notes that contain a cue, newest first, 80 per press, each text
   once (`bimflow-drive-seen-v1`). Thought notes come from the `thoughts`
   dataset, which clips each at 260 characters; the full text of a long note
   is a **Planned** improvement.

## The score

Each pole is a level 0–10. It decays toward 0 with a 10 day half-life, and each
new reading pulls it halfway to its strength (1–10). So:

- a fresh strong line moves the score at once;
- a task you stopped mentioning fades instead of staying dreaded forever;
- two readings in a row climb toward the cap, they do not add past it.

`pull = excitement − resistance` (−10…10) is the sort key for a next-action
list. `trend` is pull now minus pull seven days ago. `series` is pull after each
reading, drawn as the sparkline. `driveBoard` returns one row per task with the
newest reason for each pole.

## Asking

Some tasks the notes cannot settle, so BIM asks (`driveAsks`, code only). In
the Drive sheet each question has resistant / excited, a 1–10 score and an
optional reason, and the answer becomes a reading with source `asked`. When it
asks, most useful first:

1. **mixed**: both poles are live (3+), so the notes disagree.
2. **no reason**: a strong feeling (4+) with no reason on its side.
3. **stale**: the newest reading is 7+ days old and the score has mostly decayed.
4. **no reading**: a task item the app has, never read from any note.

Skip with "Not now" (this session only).

## Where it shows up

- **Drive sheet**: the board (sort by pull, resistance, excitement, movement,
  recency), every reading with its quote, add by hand, scan, clear.
- **Data**: `drive` is a dataset (`driveDataset`): each reading, plus a
  `score now` row per task. Six analyses in the **Drive** group read it: why a
  task is resisted, why one is exciting, tasks that flip, feelings with no
  reason, drive vs what gets pushed, where the scores stand.
- **Storage**: `bimflow-drive-v1` in the browser, 4000 readings at most.

## Planned

- Read the full text of long thought-process items, not the 260 character clip.
- Link each task name to its real item, so a score sits on the task in the
  app and the phone's next-action list can sort by pull.
- Feed `pull` and `trend` into the Ask flow ("what should I start with?") as a
  `retrieve` kind, and into the morning plan ritual.
- A question node: when resistance has no reason, ask for one.
- Show the math: formulas and a pull-over-time plot behind "Show the math".
- Sync the log to the phone hub the way texts are, instead of browser storage.

## Lessons

- Reading whole notes with a 14B local model invents feelings. Cue windows
  plus a quote check keep it to what was written.
- Do not average. An average of old dread and new eagerness says "meh"; the
  decayed level says "it changed".
