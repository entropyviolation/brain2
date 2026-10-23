# Accuracy → Regret

_Last mapped: 2026-10-23_

File: `components/Analytics/RegretView.tsx`. Math: `lib/regret-store.ts` (`regretCost`, `daysOverdue`, `dailyRegretIncrement`, ledger by local `YYYY-MM-DD`). New plates use `squareSide` from `accuracy-stats.ts`.

## Information
- Ledger rows in the window (date, task, regret, optional blocked reason).
- Outstanding cost of every open overdue item: days overdue × (importance + urgency + reward, or the minimum weight).

## Plates
- Daily accrual bars (**fixed:** every other tick crowded long windows; ticks now thin out), heaviest regrets, by reason.
- **New, regret clock** (IIB *Senseless*, rate clock): regret accruing per day and per waking hour (÷ 16), and a look-ahead slider (1–60 days) for "if nothing moves".
- **New, outstanding regret by list** (IIB *Billion Dollar-o-Gram*): square area ∝ cost, with an outlined anchor of one day of the heaviest item.
- **New, every overdue item:** search, sort by days late / per day / cost, folds above 12 rows.
- The three new plates show whenever something is overdue, even when the ledger window is too thin for a finding.

## Research notes
- Regrets of inaction grow with time while regrets of action fade (Gilovich & Medvec 1995). A linear daily cost is a simple stand-in.

## Ideas not built
- Square groups by area or by blocked reason (picker).
