/**
 * lib/overcome-bimby/flow.ts — The Overcome pipeline drawn as a BIM flow graph
 *
 * So the BIM flow lab (`/lab/bim-flow?flow=overcome`) can show it as nodes, be edited, run on sample lines, critiqued and kept
 * (the lab saves each flow's graph). READ and PUSH reuse the real prompts. LOG and PICK are code in `run.ts`; the lab writes nothing,
 * so here GATHER reads the log and the final answer stands in for PICK + PUSH.
 */
import { PUSH_SYSTEM } from "./push"
import { readSystemText } from "./read"
import { BARRIERS } from "./tactics"
import type { Flow } from "@/lib/bim-flow/types"

export const OVERCOME_FLOW_ID = "overcome"
export const OVERCOME_FLOW_HREF = `/lab/bim-flow?flow=${OVERCOME_FLOW_ID}`
export const OVERCOME_ENTRY_ID = "overcome"

const COL = 230
const at = (col: number) => ({ x: 30 + col * COL, y: 30 + 2 * 118 })

export function overcomeFlow(): Flow {
  return {
    version: 1,
    nodes: [
      { id: "msg", kind: "message", label: "I cannot start…", ...at(0), config: { entry: OVERCOME_ENTRY_ID } },
      {
        id: "x-read", kind: "extract", label: "READ", ...at(1),
        config: {
          question: "Read this message from a person who is avoiding a task.",
          system: readSystemText(),
          fields: [
            { name: "task", type: "string", hint: "the thing to do, short, starts with a verb" },
            { name: "resistance", type: "string", hint: "how the avoidance feels, in their words" },
            { name: "barrier", type: "enum", options: [...BARRIERS] },
            { name: "overdueDays", type: "number", hint: "days late if said, else 0" },
            { name: "motivation", type: "string", hint: "their reasons for wanting it done, quoted" },
            { name: "consequences", type: "string", hint: "what happens if it stays undone, quoted" },
          ],
        },
      },
      { id: "r-gather", kind: "retrieve", label: "LOG + GATHER", ...at(2), config: { retrieve: { kind: "dataset", datasetId: "overcome-log", limit: 12 } } },
      {
        id: "a-push", kind: "answer", label: "PICK + PUSH", ...at(3),
        config: {
          mode: "answer",
          fromNodeIds: ["r-gather"],
          system: PUSH_SYSTEM,
          extra: "Earlier rows show which tactic got this person Started and which left them Still stuck on the same task. Favour the first, drop the second. Offer three tactics, never two of one kind: one tiny first step plus a dopamine, scaffold or reframe move.",
        },
      },
    ],
    edges: [
      { id: "msg>x-read:out", from: "msg", to: "x-read", port: "out" },
      { id: "x-read>r-gather:out", from: "x-read", to: "r-gather", port: "out" },
      { id: "r-gather>a-push:out", from: "r-gather", to: "a-push", port: "out" },
    ],
  }
}
