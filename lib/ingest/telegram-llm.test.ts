import { describe, expect, it } from "vitest"
import { createChatQueue } from "./chat-queue"
import { telegramFollowUp } from "./telegram-llm"
import type { SwitchboardResult } from "./bim-switchboard"
import type { ApplyResult } from "./types"

const SRC = { channel: "telegram", chatId: "c1" } as const
const logged = { status: "ok", kind: "event-log", reply: "Logged" } as unknown as ApplyResult
const asked = { status: "ignored", kind: "capture", reply: "That reads as a question" } as unknown as ApplyResult
const groc = { status: "ok", kind: "grocery", reply: "Added milk" } as unknown as ApplyResult
const board = (b: Partial<SwitchboardResult>) => async () => ({ route: "ASK · code · q2.5 14b · 3.0s", passThrough: false, ...b }) as SwitchboardResult

describe("Telegram: BIM chat's LLM lanes as a second message", () => {
  it("answers a question the executor turned away, with the route chip", async () => {
    const more = await telegramFollowUp("when did I last shower?", new Date(), SRC, asked, { llm: true, run: board({ answer: { text: "Oct 30.", confidence: "high", evidence: ["Oct 30 · log · shower"] } }) })
    expect(more).toBe("Oct 30.\n\n• Oct 30 · log · shower\n\nASK · code · q2.5 14b · 3.0s")
  })

  it("replies to talk after the line is logged", async () => {
    const more = await telegramFollowUp("so tired today", new Date(), SRC, logged, { llm: true, run: board({ chat: { text: "That sounds long.", general: true, evidence: [] }, route: "CHAT · q2.5 3b · 2.0s" }) })
    expect(more).toBe("That sounds long.\n(general, not from your data)\n\nCHAT · q2.5 3b · 2.0s")
  })

  it("stays silent with the switch off, on a command, or with nothing to add", async () => {
    const never = async () => {
      throw new Error("not asked")
    }
    expect(await telegramFollowUp("when?", new Date(), SRC, asked, { llm: false, run: never })).toBeNull()
    expect(await telegramFollowUp("g milk", new Date(), SRC, groc, { llm: true, run: never })).toBeNull()
    expect(await telegramFollowUp("making soup", new Date(), SRC, logged, { llm: true, run: board({ passThrough: true }) })).toBeNull()
    expect(await telegramFollowUp("making soup", new Date(), SRC, logged, { llm: true, run: never })).toBeNull()
  })

  it("a burst of 10 lines in one chat runs in send order, each to the end, none lost", async () => {
    const enqueue = createChatQueue()
    const done: number[] = []
    // Later lines are faster, so only the queue keeps them in order.
    const runs = Array.from({ length: 10 }, (_, i) => enqueue("c1", () => new Promise<void>((ok) => setTimeout(() => (done.push(i), ok()), 30 - i * 3))))
    // A failing line releases the next one.
    runs.push(enqueue("c1", async () => Promise.reject(new Error("boom"))).catch(() => undefined) as Promise<void>)
    runs.push(enqueue("c1", async () => void done.push(10)))
    await Promise.all(runs)
    expect(done).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10])
  })
})
