# Wire BIMBY

_Last mapped: 2026-11-07_

A BIM chat sentence that says "connect module X to habit Y" or "make the habit's detail view show/let me log Z" becomes a **plan card** of small steps. Each step is checked against the real habits and a sample report. **Nothing is saved until Accept.**

> "Connect the 'speed reader' module to daily reading habit ... pages read ... logged with that book item ... report the time"
> "make it so the daily habits detail view includes pages read and attaches a Book type item ..."

## Flow

`tryWire` (`run.ts`) is called from `sendToBim` (`lib/ingest/bim-chat.ts`) after the flights lane and the tell shapes, before the report lane. Skipped when a clarify is open or the line is a command. `looksLikeWire` wants a cue ("connect", "make it so", "detail view", "attach"), a habit or a named module, and a measure or module. It builds a plan, keeps it in `useWireStore`, and returns a chat line with `wireId`. `components/Bim/wire-card.tsx` draws it.

_2026-11-11:_ `acceptStep(planId, id, "ok")` and `acceptAllSteps(planId, "ok")` are the **Neutral** accept: the same write, with `WireStep.grade = "ok"`; a tweak keeps it on an applied step (`lib/accept-grade.ts`).

## Files

| File | Role |
|------|------|
| `types.ts` | `WirePlan`, `WireStep` (`feed`, `breakdown`, `entry`, `track`), `WireField`, `WireCheck` |
| `plan.ts` | Rules, no model. Module from `module-output-registry.ts`, measure from `module-output.ts`, item type from the type registry, habit by word overlap with daily habit names (a habit with the wrong unit is not offered). Leaves blank what it cannot place |
| `checks.ts` | Pure. Habit exists and is daily; unit fits; module reports that measure and a time; item type exists; the detail view validates; a sample report reaches the habit; the breakdown adds up |
| `apply.ts` | Re-checks on the live habits, one `updateTask` as one undo step, reads it back, restores the habit if it did not stick. Writes only `moduleFeeds` and `detailView` on one habit |
| `decide.ts` | Accept, reject, reconsider, accept all, and `reviseWire` (tweak) |
| `store.ts` | Plans per device, `localStorage` `bimchat-wires`, last 30 |
| `run.ts` | `tryWire` |

## Track step (Tracking BIMBY)

_Last mapped: 2026-11-07_ "Whenever I am actively speed reading, track that time on a new pen called "speedreading" that counts as a pen called reading, with a note for the book and the pages" becomes one `track` step with typed fields (pen, counts as). `wantsTrack` needs a named module, the word pen, and a "whenever / while / sessions" cue. Accept makes both pens (`ensureActivityPen`), nests the new one under the other (`setPenParents`, an existing parent list is kept), and marks it `TrackPen.moduleFeed = { moduleId }`, as one undo step with a read-back. From then on `applyModuleSession` (`lib/module-session-apply.ts`) paints each session on every pen that follows the module. The Tracking BIMBY (`lib/tracking-helper/store.ts`) sends such a line here instead of to the day-account pipeline and shows the same card (`WireCard`) in its dialog.

## Tweak

The card's box takes more words ("also let me type it in", "use the other reading habit"). `reviseWire` plans again from the first sentence plus every tweak, keeps the same card, and keeps any step already saved as it was.

## Safety

The habit is chosen from the data, not from a name guess at run time, and a weekly habit is refused for a feed (it sums its daily habit through `habitValueLink`). A step with a failing check cannot be accepted. Entry steps connect the module id `habit-entry` so a typed page and a read page take the same door.

## Not built yet

**Planned:** a model that reshapes a sentence these rules do not read into the same `WireStep` data (the checks would judge it as they judge a rule's); steps for feed removal and for other module outputs as modules adopt `applyModuleOutput`; remembering a rejected step the way `suggestion-verdicts.ts` does.

Test: `npx vitest run --exclude '.claude/**' lib/wire-bimby lib/module-output.test.ts lib/module-output-apply.test.ts`
