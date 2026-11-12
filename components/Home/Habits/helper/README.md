# `components/Home/Habits/helper/` — Habits BIMBY chat

_Last mapped: 2026-11-07_

The **Chat** key in the desktop Habits header (right of Settings) opens a dialog titled **Habits BIMBY**.
Logic and reasoning: [`lib/habit-helper/README.md`](../../../../lib/habit-helper/README.md),
[`docs/HABIT_HELPER.md`](../../../../docs/HABIT_HELPER.md). Nothing is saved until **Accept**.

| File | Role |
|------|------|
| `habit-helper-key.tsx` | The Chat key (`.habit-chrome-btn.hh-key`). Loads the dialog on first press. Mounted in `tracker/habit-desk-header.tsx` |
| `habit-helper-dialog.tsx` | Transcript, compose well (Enter sends, Shift+Enter a new line), starter chips, **Flow lab** door (`/lab/habit-helper`), Clear, Skip on an open why-question |
| `proposal-table.tsx` | Per BIMBY line: ask keys (pick the habit), then rows of habit · day · old → new · the words; every part is editable before Accept (habit, day, done/undone, amount, note, reason, start/end time); ask keys end in **Other…**, a search over all habits; **Accept**, **Neutral**, ×, **Accept all N**, **Neutral all**. _2026-11-11:_ Neutral writes the same row and marks it `ok`, never a good example (`lib/accept-grade.ts`) |
| `reasons-view.tsx` | One habit's recorded reasons with days, themes and common words (last year) |
| `habit-helper.css` | Cool paper with a graph rule, silver keycaps, teal for go and violet for a miss (never yellow) |
| `habit-helper.test.tsx` | Writes nothing before Accept; Accept writes one row; Accept all; a miss keeps its reason; shorthand names |

## How it behaves

- **On open, once a day:** today's open habits (the six with the most specific nudge first, the rest counted),
  then the first why-question if one is due.
- **A why-question** has a violet rule. The next message is the answer, kept word for word, unless it reads
  as a log. Answering asks the next one, up to three a day.
- **Ambiguous words** show one key per habit plus **Other…** (search all habits); the pick becomes a row. A habit that needs an amount shows "How much?" on the row.
- **Decided rows** stay, greyed. The transcript is per device (`localStorage` `habithelper-chat-v1`).

## Not yet

Phone shell; reminders (**Planned**).
