# `lib/overcome-bimby/` — The Overcome BIMBY

_Last mapped: 2026-11-03_

A **BIMBY** for "I have to do this and I cannot make myself start". Its one pipeline is the **Overcome executive dysfunction pipeline**. You say "I really have to finish those CDs but I feel a lot of resistance, it was due a week ago". It logs the resistance, then pushes you to start. Tactics come from the ADDA ADHD-motivation article and the ADHD hack list (pasted 2026-11-02). Lab: `/lab/overcome` (`components/Lab/OvercomeBimby/`). Blueprint: `lib/agents/adapters/overcome-bimby.ts`.

## Flow

READ (`read.ts`, one model call, `extract` ladder) → LOG (`store.ts`) → GATHER (`pick.ts`) → PICK (`pick.ts`) → PUSH (`push.ts`, `prose` ladder). `run.ts` chains them.

- **Read.** Schema-bound: task, resistance (their words), barrier (`dread`, `boring`, `overwhelm`, `vague`, `perfectionism`, `unknown`), days overdue, their motivation and the consequences, quoted. No model: `readByRules` guesses.
- **Log.** Appends a `ResistanceEntry` (the exact message, the reading, the tactic ids offered) to `brain2-overcome-bimby-log`. Capped at 500. The only thing this BIMBY writes.
- **Gather.** Earlier entries on the same task (`sameTask`: they share a meaningful word) give back your own earlier reasons and costs.
- **Pick.** `tactics.ts` is plain data (16 tactics in 7 kinds). Score is barrier fit, plus tactics that got you **Started** before, minus ones that left you **Still stuck** on this task. Three tactics, never two of one kind, so a push mixes a tiny first step with a dopamine, scaffold or reframe move.
- **Push.** The model only phrases: it is handed the tactics, your quotes and the costs, and told not to invent a reason. A short or failed answer falls back to `pushByRules`.

## In BIM chat

`lib/ingest/bim-resistance.ts`, called from `sendToBim` (`lib/ingest/bim-chat.ts`) after the tell/fact steps and before the LLM router, on a line `routable` would only capture. A hit runs the pipeline (rules only when LLM mode is off), logs a `chat` entry (that is the tag; the chat line also carries `tag: "resistance"` and a `RESISTANCE · barrier · task` route chip), and replies with the push, the three tactics (one marked 🧪 as the test), and tap answers `started: <tactic>` / `stuck: <tactic>`. Those lines are caught first and mark the newest chat entry that offered the tactic. The line is not also filed as a note.

## The loop (redesigned 2026-11-03)

From two example replies the person pasted. A push now groups tactics under headings (`KIND_HEADING` in `tactics.ts`): **Shrink the first step**, **Cut the decision load**, **Get it ready**, **Add momentum**, **Cut the friction**. Tactics name the task (`{task}` is filled by `fillTactic`: "only open the first tab or file for book flights"). New barriers `choices` and `cost`; new kinds `decide` (good-enough rule, three options then flip, dealbreakers first, lock something reversible), `prep` (four facts, five-item checklist, everything in one note, price range first), `message` (tell whoever is waiting) and `restart`. The push says shame and panic make it worse.

The loop in chat: push → tap **Started** or **Stuck** → on Stuck, a **Reset and restart** line and chips naming what is in the way (`why: choices`, `why: cost`, …) → that barrier re-picks on the same task, skipping tactics that already failed. `restart` is never picked normally; it only appears on Stuck.

## Rules

- **Never destroy.** It writes only its own log.
- **Your words.** Reasons and costs are quoted from you, never made up.
- **Tone.** Warm and direct, the cost said once, no shame.

## Planned

- Drafting the exact message for `tell-waiting` and a "do the legwork" offer (search or checklist for the task).
- Chat: ask for the outcome unprompted after N minutes; let a model confirm a weak (score 1) detection.
- Follow-up pipeline: check back after N minutes and ask if you started.
- Link the task to a real task in `useTaskStore` and log the time you then spend (as `lib/plan-bimby/apply.ts` does).
- Pull consequences from the task's own due date and notes, and peak-hours from Tracking.
- A Home / phone entry point, and a Plan BIMBY door for a row that stays unplayed.

## Files

- `detect.ts`: code-only test for "I cannot start" in a chat line (strong phrases, or "have to" + "but" + lateness). Questions and commands never hit.
- `experiment.ts`: `withExperiment` swaps a push's last tactic for the least-offered one that fits (chat and the lab both pass `explore`); `tacticScoreboard` counts offered / Started / Still stuck per tactic. The entry keeps `experiment` and `source` (`lab` or `chat`).
- `flow.ts` (+ `flow.test.ts`): the pipeline as a BIM flow graph, flow id `overcome`, registered in `lib/bim-flow/flows.ts` with a door in `entries.ts`. READ and PUSH reuse the real prompts. LOG and PICK are code, so the graph folds them into LOG + GATHER (reads the `overcome-log` dataset, `lib/bim-flow/datasets.ts`) and PICK + PUSH (one answer node). The lab writes nothing. The lab saves the graph in the browser, which is where critique is kept.
- `types.ts`, `tactics.ts`, `read.ts`, `pick.ts`, `push.ts`, `store.ts`, `run.ts`, `overcome.test.ts`.
