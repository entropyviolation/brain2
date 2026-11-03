/**
 * lib/plan-bimby/modes.ts — The kinds of plan chat the Plan BIMBY panel can hold
 *
 * One chat shell, one mode at a time. A mode names what the person is talking about and what the BIMBY says first.
 * Only `short-term` is built. The others are listed so the shell has a place for them; a mode that is not `ready`
 * shows as a disabled key and does nothing. A new mode adds a row here and a thread in `PlanBimbyPanel.tsx`.
 */

export type PlanChatModeId = "short-term" | "day" | "week" | "season"

export interface PlanChatMode {
  id: PlanChatModeId
  label: string
  /** What the BIMBY says at the top of the thread. */
  hello: string
  placeholder: string
  ready: boolean
}

export const PLAN_CHAT_MODES: readonly PlanChatMode[] = [
  {
    id: "short-term",
    label: "Right now",
    hello: "Tell me the plan for right now, in one breath. I will split it into tasks for you to confirm, then you can play them through one by one.",
    placeholder: "Plan for rn: make more coffee, take another adderall, book ny flights (nowwww), then clean space for 15 min, then finish cds…",
    ready: true,
  },
  { id: "day", label: "Today", hello: "Plan the whole day.", placeholder: "", ready: false },
  { id: "week", label: "This week", hello: "Plan the week.", placeholder: "", ready: false },
  { id: "season", label: "Season", hello: "Plan the season.", placeholder: "", ready: false },
]

export function modeById(id: PlanChatModeId): PlanChatMode {
  return PLAN_CHAT_MODES.find((m) => m.id === id) ?? PLAN_CHAT_MODES[0]!
}
