# Report BIMBY

_Last mapped: 2026-11-07_

One BIM chat message that says several things ("started my period today. been working on baby animal game for a while, before that watching youtube and scrolling. had a coffee earlier and took 1 adderall, only 3 left now.") becomes a **plan card** in the chat. The card shows how BIM read the message, then one proposed change per effect, each with why, evidence, editable fields, and Accept / Reject. **Nothing is saved until Accept.**

## Flow

`tryReport` (`run.ts`) is called from `sendToBim` (`lib/ingest/bim-chat.ts`) after the tell and fact lanes and before the router. Skipped when a clarify is open or the line is a command. It builds a plan, keeps it in `useReportStore`, and returns a short chat line with `reportId`. The console (`components/Bim/console/bim-console.tsx`) and phone (`components/Bim/phone/bim-phone.tsx`) draw `components/Bim/report-card.tsx` under that line.

## Files

| File | Role |
|------|------|
| `types.ts` | `ReportPlan`, `Effect`, `EffectField`. Field values are strings so an input can hold them |
| `parse.ts` | Rules, no model. Clauses, then: period, doses, "N left", caffeine, activity segments (newest first, "before that" older). A bare "reading a book" is not a report |
| `plan.ts` | Pure. Effects, reasons, Chrome cross-check. Inventory/pen/last-tracked-end/visits are injected (`PlanDeps`) |
| `time.ts` | Local clock and `datetime-local` formatting |
| `apply.ts` | One writer per effect kind, one undo step each (`runAsAction`) |
| `decide.ts` | Accept, reject, reconsider, accept all, reject all |
| `store.ts` | Plans per device in `localStorage` `bimchat-reports`, last 40 |
| `run.ts` | `tryReport`, plus `storeDeps` (reads the real stores and the kept Chrome visits) |

## Effects

| Kind | Written through | Notes |
|------|-----------------|-------|
| `cycle` | `setCycleFlag` | Marks bleeding (editable: spotting, ovulation) on the day |
| `inventory` | direct `updateTask` / `addTask` on the Inventory list | **Sets** the count. "only 3 left" wins over a stored count; with no count said it counts down from the stored one. Writes no kitchen pantry lot |
| `intake` | `applyIntake` | A dose with no time is logged at send time; "earlier" is guessed 2 hours back and says so |
| `timeblock` | `acceptSuggestion` (`lib/bim-flow/accept.ts`) | Same overlap refusal, merge, and "autodetected" notes as an accepted LLM suggestion; stamped `generatedBy: llm` |

## Time blocks and Chrome

Blocks run backward from the message. "For a while" is assumed 3 hours (`VAGUE_MIN`). A "before that" with no length fills back to the end of the last tracked Activity (within 12 hours), else 2 hours. The oldest block never starts before that end.

Chrome visits come from `loadKeptVisits` (IndexedDB `brain2-browser-history`, this computer only). Each block looks for pages of its kind (video, social, dev). Where an older block's start was only assumed, Chrome moves it to the first matching page. Where the older block's last page is followed by the newer block's first page, Chrome moves the switch to the midpoint (only when it differs by 10+ minutes). Every move is written in that block's reasoning. With no history on the device, or none in the window, the card says so and keeps the stated times.

## Not built yet

**Planned:** a model read for phrasing the rules miss (the parser is strict and ignores what it does not know); a second look at the day's Health and screen-time rows as evidence; reading Chrome history from the Mac when the phone sends the message; remembering rejections as verdicts the way `suggestion-verdicts.ts` does.

Test: `npx vitest run --exclude '.claude/**' lib/report-bimby`
