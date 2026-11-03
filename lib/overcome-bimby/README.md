# `lib/overcome-bimby/` — The Overcome BIMBY

_Last mapped: 2026-11-02_

A **BIMBY** for "I have to do this and I cannot make myself start". Its one pipeline is the **Overcome executive dysfunction pipeline**. You say "I really have to finish those CDs but I feel a lot of resistance, it was due a week ago". It logs the resistance, then pushes you to start. Tactics come from the ADDA ADHD-motivation article and the ADHD hack list (pasted 2026-11-02). Lab: `/lab/overcome` (`components/Lab/OvercomeBimby/`). Blueprint: `lib/agents/adapters/overcome-bimby.ts`.

## Flow

READ (`read.ts`, one model call, `extract` ladder) → LOG (`store.ts`) → GATHER (`pick.ts`) → PICK (`pick.ts`) → PUSH (`push.ts`, `prose` ladder). `run.ts` chains them.

- **Read.** Schema-bound: task, resistance (their words), barrier (`dread`, `boring`, `overwhelm`, `vague`, `perfectionism`, `unknown`), days overdue, their motivation and the consequences, quoted. No model: `readByRules` guesses.
- **Log.** Appends a `ResistanceEntry` (the exact message, the reading, the tactic ids offered) to `brain2-overcome-bimby-log`. Capped at 500. The only thing this BIMBY writes.
- **Gather.** Earlier entries on the same task (`sameTask`: they share a meaningful word) give back your own earlier reasons and costs.
- **Pick.** `tactics.ts` is plain data (16 tactics in 7 kinds). Score is barrier fit, plus tactics that got you **Started** before, minus ones that left you **Still stuck** on this task. Three tactics, never two of one kind, so a push mixes a tiny first step with a dopamine, scaffold or reframe move.
- **Push.** The model only phrases: it is handed the tactics, your quotes and the costs, and told not to invent a reason. A short or failed answer falls back to `pushByRules`.

## Rules

- **Never destroy.** It writes only its own log.
- **Your words.** Reasons and costs are quoted from you, never made up.
- **Tone.** Warm and direct, the cost said once, no shame.

## Planned

- Follow-up pipeline: check back after N minutes and ask if you started.
- Link the task to a real task in `useTaskStore` and log the time you then spend (as `lib/plan-bimby/apply.ts` does).
- Pull consequences from the task's own due date and notes, and peak-hours from Tracking.
- A Home / phone entry point, and a Plan BIMBY door for a row that stays unplayed.

## Files

- `types.ts`, `tactics.ts`, `read.ts`, `pick.ts`, `push.ts`, `store.ts`, `run.ts`, `overcome.test.ts`.
