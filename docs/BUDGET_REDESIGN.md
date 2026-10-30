# Budget redesign plan — money in and out, expected and received

_Last mapped: 2026-10-28_ Status: **Partly built**. The Money widget (kind id `budget`, face in `home-budget-tile.tsx`) opens the money book, and Tracking log → Spent opens that same book (`tracking-log/money-book.tsx`). Built on top of the earlier month view: accounts (cash, bank, card) and debts as separate lists, bills, a monthly budget envelope, future spend as `expected` lines, prospective gigs, a natural-language line (`lib/money-parse.ts`), and statement text kept in `brain2-budget`. Still **Planned**: account filter, account on each log-spend row, `importId` dedupe, `pays` link relation, bill lines generated ahead on a horizon, shared editing. Today: `lib/budget-store.ts`, spending on the Tracking log, `budget-panel.tsx` for the month, statement import in the book + `lib/bank-statement.ts`.

Ideas borrowed from [Actual Budget](https://github.com/actualbudget/actual)
(from memory of its model, not a code read): **accounts** hold money, **payees**
are who it moved to or from, **categories** group it, **schedules** make
expected and recurring transactions, **cleared** marks a line the bank has
confirmed, and an **imported id** keeps a re-imported statement from doubling
lines. We take the model, not the code or its envelope budgeting.

## Rules this must keep

1. **One ledger for spending.** Spending the user logs stays a Tracking log
   entry (`lib/spend.ts`: "No second ledger"). Nothing here copies it.
2. **Plans are drawn beside what happened, never merged into it**
   ([`TEMPORAL_POLARITY.md`](TEMPORAL_POLARITY.md)). Prospective money never
   changes a "Spent" readout, the day ledger, or any Tracking number.
3. **Certainty is its own axis.** "Maybe / likely / sure" is how sure the
   prospective money is. It is not `est.` clock certainty and not polarity.
4. **Item, used everywhere.** Money attaches to an item or project by id and a
   link relation. The budget store never owns a second copy of a project.
5. **Additive persistence.** `brain2-budget` goes v1 to v2 with defaults; old
   lines load as received money. Nothing is renamed.

## The type (reusable)

Rename the concept `BudgetLine` to **`MoneyLine`**; keep the file and storage
key. All new fields are optional.

| Field | Meaning |
|---|---|
| `kind` | `earning` or `spend` (kept) |
| `status` | `received` (default, retrospective) · `expected` · `maybe` · `skipped` (prospective or closed) |
| `certainty` | `sure` · `likely` · `maybe`, prospective only |
| `date` / `expectedDate` | when it happened, or when it is due |
| `source` | who it is from or to (payer / payee). Filterable (Phase 1) |
| `account` | where the money sits or sat, from `accounts` (Phase 1) |
| `notes` | free text (Phase 1) |
| `itemId` | attached project, contract, or task, with a link relation (Phase 3) |
| `scheduleId` | the recurring pattern that made it (Phase 4) |
| `matchedId` | expected line this one fulfilled, or the received line that closed it |
| `importId` | hash of date + cents + raw statement text, for dedupe (Phase 2) |

Polarity is derived: `received` is retrospective; `expected`, `maybe` are
prospective. Add the rows to the catalog in `TEMPORAL_POLARITY.md` and a
helper beside `lib/temporal-polarity.ts`.

Tracking log spending keeps its own fields. Its notes already fit
`TimeEntry.notes`; its source stays `spendSource`. The budget view maps both
into one row shape (`Row` in `budget-panel.tsx` already does).

## Phases

**Phase 0 (done).** Statement import, earnings store, month Budget tab with
source chips, sort, inline edit.

**Phase 1: sources, accounts, notes.**
- `accounts: { id, name, kind, last4? }[]` in the store. Source stays free
  text with suggestions; account is a pick-list. Statement import offers the
  account (matched by `last4`, which the statement header prints).
- Add `notes` to `MoneyLine`; log-spend rows read and write `entry.notes`.
- Budget panel: a source filter (already chips), an account filter, and a notes
  field per row (a one-line input that opens a small textarea).
- Spend rows get account too: add optional `spendAccount` beside `spendSource`
  in `lib/spend.ts` / `time-entries.ts` / the store patch (about six touch
  points; compactSpend passes it through unchanged when absent).
- Tests: sanitize v1 to v2, notes round-trip, filters.

**Phase 2: retrospective polish.**
- `importId` dedupe replaces the current name-match guess in
  `spending-dialog.tsx`.
- Reconcile: mark a line `cleared` against a statement total (ending balance
  checks out or shows the gap), like Actual's reconcile.
- Payee rules: remember "RALPHS # 0212 → Ralphs" and a default source/account.
  Stored in the budget store, applied at import preview. _Planned in the README
  already._

**Phase 3: prospective money (the ask).**
- Add an expected line from the Budget tab, from a statement-less quick add, or
  from an item: an item detail "Money" row (amount, date, certainty, sure /
  likely / maybe, source). Contracts and projects are items, so the link is
  `itemId` plus a relation from the library in `lib/links.ts` (a new
  `pays` / `paid-by` pair, defined in `LINKS_REDESIGN.md` style: names its
  reverse). No new item type.
- Budget panel: a **Past / Ahead / Both** switch. Ahead lists expected lines,
  muted and dashed (Plan's "dashed linen" look), grouped by certainty. A
  forecast strip shows month-end net as *sure only* and *with maybes*, never one
  blended number.
- **Confirm bridge** (same idea as confirming a Day Log ghost): one tap turns an
  expected line into received, defaulting date to today and amount to the
  expected amount, and stamps `matchedId`. Differences stay visible (expected
  $4,000, received $3,850).
- Statement import proposes matches: an incoming deposit within a few days and
  a few percent of an open expected line offers "this fulfils X".
- Tracking Home/Plan readouts stay untouched. Prospective money can show in
  Plan as a quiet "Money due" rail later; it must not enter retrospective
  totals.

**Phase 4: usual and recurring (Actual's schedules).**
- `schedules: { id, name, kind, cents, source, account, rule, active }`. A rule
  is monthly on day N, weekly, or every N days; it makes `expected` lines
  ahead (horizon 90 days) and is idempotent by `scheduleId + date`.
- "Usual expenses" suggestion: find lines with the same source and a steady
  cadence in the log and offer to make a schedule. Always the user's tap.
- A missed expected line past its date turns "overdue" in the view, not red
  alarm; one tap skips, moves, or confirms it.

**Phase 5: collaborative.**
- The store is hub-safe persist, so it syncs like other stores. For several
  people, add `by` (a `WriterKind`, see
  [`PEOPLE_AND_KEYS.md`](PEOPLE_AND_KEYS.md), still **Planned**) and per-line
  last-write-wins on id; deletes leave a tombstone so a sync cannot revive a
  removed line.
- A person lens (their own vs shared accounts) waits on that doc.

## What plugs into what exists

| Existing | Use |
|---|---|
| `lib/spend.ts`, Tracking log | retrospective spending, unchanged |
| `lib/budget-store.ts` | `MoneyLine` home; v2 migration |
| `lib/bank-statement.ts` | add `importId`, account match, payee rules |
| `TEMPORAL_POLARITY.md`, `lib/temporal-polarity.ts` | polarity rows for `status` |
| `lib/links.ts` relations | `itemId` attachment (new `pays` pair) |
| Day Log confirm-planned flow | model for confirming expected money |
| `lib/period-ledger.ts` | pattern for a period's expected vs received sets |
| `lib/demo-day-fill.ts` | add a few expected lines (contract, royalty due) |

## Risks and how we avoid them

- **Double counting:** a received line imported from a statement and an expected
  line both exist. Only `matchedId` closes the expected one; totals count
  received only.
- **Two spend ledgers:** prospective *spending* lives in the budget store only;
  it is never a Tracking entry until the user logs it as real.
- **Migration:** old lines have no `status`; sanitize sets `received`. A test
  loads a v1 snapshot.
- **Scope creep:** envelopes, rollover, and bank sync from Actual are out. Only
  accounts, schedules, cleared, and import dedupe come over.

## Done looks like

Every line has a source, an account, and notes and filters by each. Ahead shows
sure vs maybe money and a forecast. A deposit can close an expected line.
Recurring lines make themselves. No Tracking number moves because of a plan.

## Borrowed ideas: Actual and Wealthfolio (all Planned, none built)

Recalled from memory of both projects' feature lists, not a code read. Each
line says where it lands. We keep Brain2's rules above; nothing here makes a
second ledger or merges plan into lived.

**From Actual Budget** ([repo](https://github.com/actualbudget/actual))

| Idea | Lands as |
|---|---|
| Accounts, on-budget vs off-budget (tracking-only) | `accounts` with `onBudget`; off-budget lines stay out of month net |
| Payees | `source` becomes a payee list with merge and rename |
| Category groups, hidden categories | `category` gets a parent group; hide without deleting |
| Envelope budgeting: money assigned per category, rollover, "to budget" | Optional Phase 6: monthly `assigned` per category on top of lines; overspend carries or resets by setting |
| Budget templates / goals ("save $X by date", "monthly $Y") | A category goal; shows on the breakdown bar as a target tick |
| Schedules (upcoming, recurring, auto-post, weekend rule) | Phase 4 schedules; a due schedule makes an `expected` line, ✓ confirms |
| Rules (if payee contains X then category Y, rename, set account) | Payee rules from Phase 2, extended to conditions → actions, run at import preview |
| Split transactions | A line with `parts[]` (category + cents each) that sum to the whole |
| Transfers between accounts | A paired line (out, in) that nets to zero and never counts as spend or earning |
| Cleared and reconciled | `cleared` flag; reconcile against a statement ending balance |
| Notes and tags on lines | `notes` (built) and `tags` that reuse the app's tag store |
| Import: CSV, OFX, QIF, CAMT; dedupe by imported id | Parsers beside `bank-statement.ts`; `importId` dedupe |
| Bank sync (SimpleFIN / GoCardless) | Out of scope until a hub route exists; import stays manual |
| Reports: cash flow, net worth, spending by category, custom range | Reports tab on the Budget view; month strip becomes a range picker |
| Search and saved filters | Filter by text, amount range, account, category; save as a named view |

**From Wealthfolio** ([repo](https://github.com/wealthfolio/wealthfolio))

| Idea | Lands as |
|---|---|
| Local-first, private | Already how the vault works; keep statements in-browser |
| Accounts with holdings (stocks, funds, crypto, cash) | An `investment` account kind with `holdings`, kept apart from the spending ledger |
| Activity types: buy, sell, dividend, deposit, withdrawal, transfer, fee, interest, split | Activity lines on an investment account; deposits and dividends can also count as earnings with a flag |
| Performance: time-weighted and money-weighted return, gain/loss | Computed in `lib/budget-math.ts`-style pure helpers; shown read-only |
| Asset allocation and diversification | A breakdown by asset class beside category bars |
| Savings goals with progress | A goal on a category or account; progress bar and a Home widget face |
| Contribution limits (retirement accounts) | Optional per-account yearly cap and a gauge |
| Multi-currency and FX | `currency` per account; totals convert at a stored rate, never silently |
| CSV import with column-mapping templates | Import preview lets you map columns and save the mapping per account |
| Income dashboard (dividends, interest over time) | A Reports view for earnings by source over months |
| Net worth over time | Daily balance snapshots per account; line chart with the month strip's look |
| Addons | Maps to the user-made widget kind (`user:<slug>`) in `WIDGETS_REDESIGN.md` |

New phases these add: **Phase 6** envelopes and goals, **Phase 7** reports and
net worth, **Phase 8** investment accounts and FX. Each ships behind a setting
so the plain month view stays small.
