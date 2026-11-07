import { describe, it, expect } from "vitest"
import { useTaskStore } from "@/lib/task-store"
import { useRulesStore } from "@/lib/rules/rules-store"
import { fireRuleEvent } from "@/lib/rules/rules-engine"
import { applyTextMirror } from "./apply-text-mirror"

const long = (n: number) => Array(n).fill("word").join(" ")

describe("applyTextMirror + rules engine", () => {
  it("adds a rule, delivers long typed text once, skips short, and stops", async () => {
    const r = applyTextMirror('Create a document in Docs called "Allietext" and add any text I type over 70 words automatically')
    expect(r?.status).toBe("ok")
    const rule = useRulesStore.getState().rules[0]!
    expect(rule.on).toBe(true)
    expect(useTaskStore.getState().tasks.find((t) => t.id === rule.sink.docId && t.type === "note")?.description).toBe("Allietext")

    const at = new Date(2026, 10, 7, 9, 5)
    fireRuleEvent({ kind: "typed-text", text: long(70), source: "Item › Notes", at })
    fireRuleEvent({ kind: "typed-text", text: long(71), source: "Item › Notes", at })
    fireRuleEvent({ kind: "typed-text", text: long(71), source: "Item › Notes", at })
    await new Promise((res) => setTimeout(res, 50))
    const body = useTaskStore.getState().tasks.find((t) => t.id === rule.sink.docId)?.body ?? ""
    expect(body.match(/Item › Notes/g)?.length).toBe(1)

    applyTextMirror("stop auto-adding typed text")
    expect(useRulesStore.getState().rules[0]!.on).toBe(false)
    fireRuleEvent({ kind: "typed-text", text: long(80), source: "Other", at })
    await new Promise((res) => setTimeout(res, 50))
    expect(useTaskStore.getState().tasks.find((t) => t.id === rule.sink.docId)?.body).not.toContain("Other")
  })
})
