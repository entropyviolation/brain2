# components/Lab/Agents

Shared agent UI. Reads Blueprints from `lib/agents/`; runs and saves nothing.

- `AgentRail.tsx` — one chip per agent. Used by the BIM, Tracking, Habit and Lists labs.
- `agent-href.ts` — which lab page a chip opens. BIM flows have none (null).
- `AgentsDesk.tsx` — the **Agents** Go tab (`agents` in `lib/app-navigation.ts`, wired in `app/page.tsx`). A solid two-pane board (`agents-desk.css`, every surface opaque so the app backdrop never shows through): the agent list on the left, and on the right the picked agent's purpose, its named pipelines as cards (built or planned badge, tool name, stage chain), and **Open lab** / **Agent bench** keys. It does not use `AgentRail`; the rail's chip styles only apply inside `.bf-lab`.
- `CopyReportButton.tsx` + `run-report.ts` — clipboard key in the upper right of the Tracking and Habits **Try it** wells. Copies a labeled step-by-step report (input, summary, each stage's prompt and output, result) to paste to a coding agent. Disabled until a run exists.
- `agent-href.ts` also opens `/lab/overcome` for the Overcome BIMBY (_2026-11-02_).
- `AgentsDesk.tsx` also shows **Open popup** for the Overcome BIMBY (`../OvercomeBimby/OvercomeBimbyPopup.tsx`) (_2026-11-03_).
- `agent-rail.css` — rail styles.
- `agents-desk.css` — the Agents desk tab styles.
- `AgentBench.tsx` + `agent-bench.css` — the **Agent bench** at `/lab/agents` (`app/lab/agents/page.tsx`; the Agents desk links to it; a "← Back to the app" link at the top returns to `/`). Pick variants, run them on the same labelled lines, read a scorecard (pass rate with n, per-tag, ms/line, declined, errors, right-when-sure, the mix-ups), and compare any two kept runs to see which lines were gained or lost. Variants: a free code keyword baseline, one run per picked Ollama model, and a swarm of all voters (plain, and "clear only", which declines on a split). Add your own lines (kept in this browser, `brain2:agent-bench:cases:v1`); the last five runs per variant are kept (`brain2:agent-bench:cards:v1`). Today the question is the Lists BIMBY's: which tool does this line mean? Engine and cases: `lib/agents/bench*.ts`.

**Planned:** the rest of the `/lab/agents` rooms (Blueprint form, Theater; the bench is the first slice of Evals) from `docs/AGENT_LAB_PLAN.md`. The desk tab then becomes their door.

_Last mapped: 2026-11-02_

**Bench Planned:** more closed-list questions than the Lists BIMBY's (a `ClosedList` is all a new one needs); variants for paraphrase stability, logprob confidence and a critic pass (`docs/BIMBY_IDEAS.md` §2, §3, §4); a per-stage verdict (§5); cases built from the person's chat corrections; a sweep over voter count.
