import { describe, expect, it } from "vitest"
import { defaultFlow } from "./default-flow"
import type { ModelCall } from "./ollama"
import { runFlow } from "./run-flow"
import type { FlowMessage, SearchOutput } from "./types"
import type { VaultSnapshot } from "./vault-search"

const snap: VaultSnapshot = {
  items: [
    { id: "p1", title: "Elijah Gibbins-Croft", type: "person", listIds: [] },
    { id: "p2", title: "Alexis Reed", type: "person", listIds: [] },
  ],
  lists: [],
  habits: [],
  scopes: [],
  skipListIds: new Set(),
  people: [
    { id: "p1", title: "Elijah Gibbins-Croft", names: ["Elijah Gibbins-Croft", "Eli G"] },
    { id: "p2", title: "Alexis Reed", names: ["Alexis Reed", "Lex"] },
  ],
}

const call: ModelCall = async ({ user, schema }) => {
  const props = (schema as { properties: Record<string, unknown> }).properties
  if ("answer" in props) return { answer: user.split("\n")[0]!.includes("specific person") ? "yes" : "no" }
  if ("picks" in props) return { picks: [] }
  return { relation: "doing_now", since: "", minutes_left: 0 }
}

const msg = (text: string): FlowMessage => ({ id: "m1", text, at: new Date(2026, 9, 30, 14, 0).toISOString(), prior: [] })

async function personStep(text: string) {
  const run = await runFlow(defaultFlow(), [msg(text)], call, snap, { model: "fake" })
  return run.messages[0]!.steps.find((s) => s.nodeId === "s-people")
}

describe("link node in the Log flow", () => {
  it("finds a person by nickname, which a word search could not", async () => {
    const out = (await personStep("lunch with Lex"))!.output as SearchOutput
    expect(out.options).toEqual(["Alexis Reed"])
    expect(out.links?.[0]).toMatchObject({ text: "Lex", status: "linked" })
    expect(out.fellBack).toBeUndefined()
  })

  it("falls back to the old word search when nothing links", async () => {
    const out = (await personStep("called gibbins"))!.output as SearchOutput
    expect(out.options).toEqual(["Elijah Gibbins-Croft"])
  })

  it("passes no options when no one is named, as before", async () => {
    const out = (await personStep("called someone"))!.output as SearchOutput
    expect(out.options).toEqual([])
  })
})
