# Time → Transitions

_Last mapped: 2026-10-23_

File: `components/Analytics/TransitionsView.tsx`. Math: `signal-stats.ts` (`penTransitionMatrix`) and `time-flow-stats.ts` (`penFlows`, `penDaySequences`, `returnLoops`). Styles: `time-flow.css`. Tests: `time-flow-stats.test.ts`, `time-flow-views.test.tsx`.

## Inventory

- Reads the time-tracking store: `scopes` (pens, names, colors) and `entries`. One scope at a time (Scope select).
- A transition is one block ending and a different pen starting next on the same day. Zero-minute blocks are dropped. Same-pen continuation is not a switch.
- `n` = switch count. Thin floor: `SAMPLE_FLOORS.transitions` (8).

## Plates

1. **Readouts.** Switches, pens in the mix, the most common switch.
2. **Matrix.** Row = from-pen, column = to-pen, shade = P(to | from). Rows sum to 1.
   - Controls: P / Count toggle, Busiest first / A–Z order, Min N× slider that hides faint cells.
   - The diagonal is hatched. Staying is not a switch.
   - Click a cell (or Enter on it) to list the days that switch happened on, with ×n. Click again or Clear to close. _Added 2026-10-25._
   - Pen names now show in full with an ellipsis. They were cut to 8 letters.
3. **Where you land, where you leave.** Signed bars. Net = switches in − switches out. Right of the centre line = a pen you land on. Left = a pen you leave from. The right column adds next-pen predictability.
4. **Return loops.** A → B → A on the same day. Loop rate = loops ÷ every three-step window. Top 8 pairs as bars.
5. **Alluvial of switches.** Now folded. Ribbon = raw count.

## Math

- P(j | i) = count(i → j) / Σ count(i → ·).
- Exit entropy H(i) = −Σ p log₂ p, in bits.
- Predictability = 1 − H(i) / log₂(k − 1), where k = pens in the mix. 1 = always the same next pen. Blank when the pen has no exits or there are fewer than three pens.

## Research notes

From known work. No new search was run in this pass.

- **Markov chains of activity.** First-order chains are the usual model for activity sequences. Entropy of the next state is the standard "how predictable" number.
- **Attention residue** (Leroy, 2009). Leaving a task unfinished leaves part of your attention on it. Return loops are a cheap proxy for this: you left and came straight back.
- IIB moves used: **Digit grid** (the matrix, diagonal marked) and **Loop timelines** (return loops). See `viz-inspiration.md` → Transitions.

## Planned

- Second-order chain (A → B → ?) once there is enough data.
