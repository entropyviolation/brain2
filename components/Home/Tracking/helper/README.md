# `components/Home/Tracking/helper/` — Tracking Helper chat

_Last mapped: 2026-11-01_

The **Chat** key on the Tracking fascia (desktop, right of the gear) opens a dialog titled **Tracking Helper**.
The person says what they did and roughly when; the Helper proposes Activity and Location blocks. Nothing is
saved until **Add**. Logic and reasoning: [`lib/tracking-helper/README.md`](../../../../lib/tracking-helper/README.md),
[`docs/TRACKING_HELPER.md`](../../../../docs/TRACKING_HELPER.md).

| File | Role |
|------|------|
| `tracking-helper-key.tsx` | The Chat key (`.trk-helper-key`). Loads the dialog on first press. Mounted in `tracking-desk.tsx`. The phone shell does not have it yet |
| `tracking-helper-dialog.tsx` | Transcript, compose well (Enter sends, Shift+Enter a new line), starter chips, **Flow lab** door (`/lab/tracking-helper`), Clear |
| `proposal-board.tsx` | Per day: a ruler with one lane per block and a place strip under it; then one editable card per block (**Add**, **Neutral**, Dismiss); **Add all N**, **Neutral all**. _2026-11-11:_ Neutral adds the same block but is not learned from as right (`lib/accept-grade.ts`) |
| `tracking-helper.css` | Cool paper with a graph rule, silver keycaps, hue per activity from the teal-to-violet half of the wheel (never yellow) |

## How a block reads

- **Bar edges.** Solid cap = certain. Hatched fade = estimated. Dashed bar and `?` = the end was never given, so
  a stand-in (30 min) is shown.
- **Time chips.** `certain`, `est`, `from neighbour` (the edge came from the block before or after), `not given`.
  Click a chip to flip certain/estimated. Click a time, the activity, the place or the note to edit it; typing a time
  makes that edge certain.
- **Place chip.** `stated` (you said it), `learned` (where this usually happens, from your own days), `assumed`
  (a chore at home). Dashed outline means assumed: change it if wrong.
- **Add** writes that block. If it sits on time you painted by hand the card says so and offers **Add anyway**.
  Added, dismissed, and replaced cards stay in the transcript, greyed.
- **Correct it in words.** "Actually the walk ended at 4:45" while blocks are open re-reads the whole account with
  your correction last; the old cards are marked replaced.

The transcript and open proposals are per device (`localStorage` `trackinghelper-chat-v1`). Undo reverts one Add
in one step (Tracking's usual undo).

## Opened from elsewhere

_Last mapped: 2026-11-07_ The Chat key opens itself when `useHelperOpenRequest` (`lib/tracking-helper/open.ts`) is raised, which the Inbox notice does after switching to Home → Tracking. Lines sent from BIM chat carry `fromBim`.

## Not yet

Phone shell; a Day Log or Time Grid ghost preview of proposals before they are added (**Planned**).

## Standing instructions

_Last mapped: 2026-11-07_ A line that is a rule, not an account of a day ("whenever I am actively speed reading, track that time on a pen called speedreading that counts as reading, with a note of the book and pages"), is not sent to the timeblock pipeline. `send` in `lib/tracking-helper/store.ts` checks `wantsTrack` first and shows the Wire BIMBY's plan card (`components/Bim/wire-card.tsx`) in the dialog. Accept makes the pen, nests it, and has the module paint its sessions from then on (`lib/wire-bimby/README.md`). **Planned:** more standing rules (other modules; a rule for a screen-time app).
