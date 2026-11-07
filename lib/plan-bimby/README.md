# `lib/plan-bimby/` — The Plan BIMBY

_Last mapped: 2026-11-02_

A **BIMBY** (small, single-job sub-agent) that helps run a short-term plan. The person says it in one breath:
"Plan for rn: make more coffee, take another adderall, book ny flights (nowwww), then clean space for 15 min, then finish cds…".
It splits that into ordered tasks, asks the person to confirm and edit them, then turns them into a run list of play / pause / done rows.
It writes nothing until a row is played or finished. UI: `components/Lab/PlanBimby/PlanBimbyPanel.tsx`. It opens from three doors: route `/lab/plan-bimby`, the **Plan now** key on the Home Plan toolbar (`PlanBimbyDialog.tsx`), and the **Plan** tab of the iPhone shell (`MobileApp.tsx`). The panel is a chat shell: a header (chat icon, **PLAN BIMBY**, one key per kind of plan chat from `modes.ts`), a thread of bubbles (BIMBY greets, your words, BIMBY's confirm card or run list), and a composer pinned under it (Cmd/Ctrl-Enter sends; "Rules only" skips the model). Only **Right now** is built; Today, This week and Season are listed disabled for later. A new kind of plan chat adds a row to `modes.ts` and a thread in `PlanBimbyPanel.tsx`. Each row is dressed as a To Do task card (`plan-bimby.css` plus `task-card.css`: header strip, state lamp, house play / pause key, Done and Skip keycaps).

## Flow

SAY → SEGMENT (`parse.ts`, one model call) → LINK (`links.ts`, code) → SECOND LOOK (`lib/critic-bimby/`, code only) → CONFIRM (the person edits) → RUN (`run.ts`, `store.ts`) → EFFECTS (`apply.ts`).

- **Segment.** Schema-bound (`PLAN_SCHEMA`, `format` on Ollama) on the `extract` ladder, via `escalate`. It returns tasks in spoken order with `minutes`, `pace` (`urgent` / `steady` / `relaxed`), `paceNote` (their words), `subtasks` (each with `due` as spoken) and `remarks` (feelings and asides that are not tasks, shown so nothing is silently dropped). With no model, or when it finds nothing, `parseByRules` splits on commas, `then` and new lines.
- **Link.** `withLinks` fills `link` on items that have none, in this order: intake (`detectIntake`: a taking verb plus a known drink, drug or food word), flight (`detectFlight`: book/buy plus "flight"), then the best open task by name (`matchTasks`). A task match starts unconfirmed; the confirm screen shows it as "time on “Finish CDs”", and **Start plan** is the yes. Changing or clearing it there is the no.
- **Second look.** The panel runs `critiquePlan` on the read and puts it on `PlanDraft.critique`. A fail draws a strip with keys on the confirm card, a warn a chip on its row. Nothing is blocked, and what the person does is kept in the critic ledger. See `lib/critic-bimby/README.md`.
- **Run.** One item plays at a time; playing another pauses the first. Every closed play is a `Span`.
- **Effects.**
  - Intake link: finishing logs one intake row (`applyIntake` with `logSource` `plan-bimby`, labelled "the Plan BIMBY"), whose note says it was auto-created from that task. Reopening and finishing again does not log twice.
  - Task link (confirmed): each closed play appends a `timeLogs` slice (`plan-log-…` id, `activityLabel` "plan bimby") through `taskRepository`, like `focus-timer-log.ts`, and refreshes `actualDuration`. Plays under 30 s are ignored.
  - Flight link: the row shows a paste box. A confirmation (a full email, or just the code) goes through the Flight BIMBY (`lib/flight-bimby/`, which also adds the calendar event; a bare code still files the old plain item) into a Flight item (`FLIGHT_ATTR` fields, `booked` true) in the list that takes the Flight type, else a list with "flight" in its name, else a new "Upcoming flights" list. Filing finishes the row.

## Rules this BIMBY keeps

- **Never destroy.** It only adds: intake rows, time logs, flight items. It never edits or deletes an existing task's other fields.
- **Doubt becomes a choice.** An uncertain task match is a dropdown of candidates on the confirm screen, not a guess.
- **Planned.** A Blueprint adapter (`lib/agents/adapters/`) so the agent lab lists it; a Home / phone entry point (today only `/lab/plan-bimby`); linking a task that is an Operation to Working Now so Tracking is painted too; a pace-aware nudge when a row runs over its minutes; auto-completing a row from a matching habit or intake already logged.

## Files

- `types.ts`: `PlanItem`, `PlanLink`, `PlanDraft` (with `critique`), `Run`, `RunItem`.
- `parse.ts`: schema, prompt and example, `cleanPlan`, `parseByRules`, `parsePlan`.
- `links.ts`: `detectIntake`, `detectFlight`, `matchTasks`, `withLinks`.
- `run.ts`: `startRun`, `play`, `pause`, `complete`, `skip`, `reopen`, `toggleSub`, `elapsedMs`, `formatClock`.
- `apply.ts`: `logIntakeFor`, `logSpanOnTask`, `buildFlightTask`, `flightList`, `fileFlight`.
- `../../components/Lab/PlanBimby/`: `PlanBimbyPanel.tsx`, `PlanBimbyDialog.tsx`, `plan-bimby.css`.
- `modes.ts`: `PLAN_CHAT_MODES`, `modeById`.
- `store.ts`: `usePlanRunStore`, persisted as `brain2-plan-bimby-run`.
- `plan-bimby.test.ts`, `store.test.ts`.
