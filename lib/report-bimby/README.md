# Report BIMBY

_Last mapped: 2026-11-09_

One BIM chat message that says several things ("started my period today. been working on baby animal game for a while, before that watching youtube and scrolling. had a coffee earlier and took 1 adderall, only 3 left now.") or a whole night ("4 hours ago stopped working on baby animal game ... both at the very beginning of it ... scrolling and watching youtube since I woke up at 1:30 am after falling asleep at around 8 yesterday") becomes a **plan card** in the chat. The card shows how BIM read the message, then one proposed change per effect, each with why, evidence, editable fields, and Accept / Reject. **Nothing is saved until Accept.**

## Flow

`tryReport` (`run.ts`) is called from `sendToBim` (`lib/ingest/bim-chat.ts`) after the tell and fact lanes and before the router. Skipped when a clarify is open or the line is a command. It builds a plan, keeps it in `useReportStore`, and returns a short chat line with `reportId`. The console (`components/Bim/console/bim-console.tsx`) and phone (`components/Bim/phone/bim-phone.tsx`) draw `components/Bim/report-card.tsx` under that line.

_2026-11-11:_ `acceptEffect(planId, id, "ok")` and `acceptAll(planId, "ok")` are the **Neutral** accept: the same write, with `Effect.grade = "ok"` kept on the applied effect so nothing learns from it as right (`lib/accept-grade.ts`).

## Files

| File | Role |
|------|------|
| `types.ts` | `ReportPlan`, `Effect`, `EffectField`. Field values are strings so an input can hold them |
| `parse.ts` | Rules, no model. Clauses, then: period, doses, "N left", caffeine, activity segments (newest first, "before that" older), "N hours ago stopped X" (`endedAgoMin`), "since I woke up" (`sinceWake`, merged with the same activity said earlier), "woke up at 1:30 am" (`wake`, `sure` on "definitely"), "fell asleep at around 8 yesterday" (`bed`), and "at the very beginning of X" / "both" (`anchor` on a dose or drink). A bare "reading a book" is not a report |
| `evidence.ts` | Pure. Every sign of life as one list of `Signal`s: Mac and iPhone Screen Time, Chrome visits, texts sent, BIM chat and Telegram lines, log items, items created, file changes. Hard signals prove awake; a text that came in does not. Helpers: last/first sign near a time, runs of work or of watching and scrolling, app minutes |
| `sleep.ts` | Pure. `resolveSleep`: wake from the clock said (latest one before now), bedtime from the rough one said (am/pm chosen so the night is 2 to 14 hours), moved later only by a sign of life, with the text-quiet line from `lib/bim-flow/text-sleep.ts` |
| `plan.ts` | Pure. Effects, reasons, Chrome cross-check. Inventory/pen/last-tracked-end/visits are injected (`PlanDeps`) |
| `time.ts` | Local clock and `datetime-local` formatting |
| `apply.ts` | One writer per effect kind, one undo step each (`runAsAction`) |
| `decide.ts` | Accept, reject, reconsider, accept all, reject all. Accept is async: the effect shows `working` (a saving bar on the card), the browser paints, then one queued write runs at a time with a paint between writes. A night of sleep saves in three paced pieces (bedtime, wake, paint) with a repaint between, under one undo step. The queue is module-level, so leaving the screen never cancels a save, and closing the tab mid-save asks first. A save over 1 s says how long it took and logs a console warning. A `working` effect saved by a reload comes back as `pending` |
| `store.ts` | Plans per device in `localStorage` `bimchat-reports`, last 40 |
| `run.ts` | `tryReport`, `gatherEvidence` (stores, hub texts and file changes with a 6 s limit each, kept Chrome visits), and `storeDeps`. The wide search runs only when the message places something in time (a wake, a bedtime, an activity) |

## Effects

| Kind | Written through | Notes |
|------|-----------------|-------|
| `cycle` | `setCycleFlag` | Marks bleeding (editable: spotting, ovulation) on the day |
| `inventory` | direct `updateTask` / `addTask` on the Inventory list | **Sets** the count. "only 3 left" wins over a stored count; with no count said it counts down from the stored one. Writes no kitchen pantry lot |
| `intake` | `applyIntake` | A dose with no time is logged at send time; "earlier" is guessed 2 hours back and says so |
| `timeblock` | `acceptSuggestion` (`lib/bim-flow/accept.ts`) | Same overlap refusal, merge, and "autodetected" notes as an accepted LLM suggestion; stamped `generatedBy: llm` |
| `line` | `applyStreamLine` (`lib/stream-bimby/apply.ts`) | One executor line from the Stream BIMBY (inbox, tracking, lists, notes). The field `line` is editable and is what is sent. Card label FILE |
| `verdict`, `feeling` | `applyFollowEffect` (`lib/follow-through/run.ts`) | A plan-to-outcome link and a feeling on its scales, added to a stream card. Accept confirms the record in the follow-through ledger; Reject undoes the link (`decide.ts` calls `rejectFollowEffect`). `Effect.ref` is the record's id. Card labels LINK and FEEL |
| `sleep` | `useSleepStore.setBedtime` / `setWakeTime`, then `syncSleepNight` | One night keyed by the morning it ends in. The sleep log paints the Sleep pen and the Done row, so this is the same writer as the Sleep tab. The wake carries `definite` or `estimated`; the bedtime is always `estimated`. Reads the night back and fails if the log did not keep it |

## Sleep and the wider search

_Last mapped: 2026-11-07_ With a stated wake, the plan adds a `sleep` effect. The bedtime is only moved by presence: a sign of life after the stated bedtime pushes sleep to 10 minutes after the last one, and the reason names that sign. Silence moves nothing. The card lists the first sign after the wake, the last before it, signs inside the sleep (your own logs say a sent text never fell inside one), the last text you sent, and what the night already holds.

An activity whose start was only assumed ("stopped 4 hours ago after a while") is placed by the run of work signs (dev apps in Screen Time, local/code pages in Chrome, file changes whose path names it) that reaches its stop time. If none is found the block is titled "(start unknown)" and says so in its reasoning. The older block then ends at that start. A watching or scrolling block reports its signs on both devices and any gap before the work. Both are estimates and say so. A dose or drink tied to "the beginning of X" is logged at that block's start; if the start is a guess, so is the dose time.

Sources and their limits: Chrome visits live in the Mac app's IndexedDB only, so Chrome evidence needs the message sent from the Mac app. Texts and file changes come from the hub and are named as unreachable when they are. iPhone Screen Time is Instagram pings only. Every source's count and newest time is in the trace.

## Time blocks and Chrome

Blocks run backward from the message. "For a while" is assumed 3 hours (`VAGUE_MIN`). A "before that" with no length fills back to the end of the last tracked Activity (within 12 hours), else 2 hours. The oldest block never starts before that end.

Chrome visits come from `loadKeptVisits` (IndexedDB `brain2-browser-history`, this computer only). Each block looks for pages of its kind (video, social, dev). Where an older block's start was only assumed, Chrome moves it to the first matching page. Where the older block's last page is followed by the newer block's first page, Chrome moves the switch to the midpoint (only when it differs by 10+ minutes). Every move is written in that block's reasoning. With no history on the device, or none in the window, the card says so and keeps the stated times.

## Stream cards

_2026-11-09:_ the same card also draws a Stream BIMBY plan (`lib/stream-bimby/`): a day of timed lines read into `line` effects. The store, the accept queue, and the card are shared; the rules are not.

## Not built yet

**Planned:** a model read for phrasing the rules miss (the parser is strict and ignores what it does not know); Health rows (steps, heart rate) as evidence for sleep and activity; reading Chrome history from the Mac when the phone sends the message; splitting a combined "YouTube and scrolling" block by device when the signs separate cleanly; remembering rejections as verdicts the way `suggestion-verdicts.ts` does.

Test: `npx vitest run --exclude '.claude/**' lib/report-bimby` (`report-night.test.ts` runs the full night message against synthetic signs)
