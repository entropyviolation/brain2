import { beforeEach, describe, expect, it } from "vitest"
import { resetAllStores } from "@/tests/test-utils"
import { EMPTY_MONEY_BOOK, useBudgetStore } from "@/lib/budget-store"
import { useCueStore } from "@/lib/cues/store"
import { resetFinanceUndoForTests } from "@/lib/finance-bimby/apply"
import { resetFinanceRunForTests } from "@/lib/finance-bimby/run"
import { useFinanceBimby } from "@/lib/finance-bimby/store"
import { isSpendEntry } from "@/lib/spend"
import { useTaskStore } from "@/lib/task-store"
import { useTimeTrackingStore } from "@/lib/time-tracking-store"
import { parseKeepTodo, resetKeepForTests } from "./bim-keep"
import { sendToBim, useBimChatStore } from "./bim-chat"

const CUE = "got 15$ off restaurant food on instacart remind me if im thinking about ordering food or if i need to order food"

describe("parseKeepTodo", () => {
  it("reads a thing not to forget", () => {
    expect(parseKeepTodo("dont forget to cancel instacart")).toEqual({ what: "cancel instacart", dayOffset: 0 })
    expect(parseKeepTodo("Don't let me forget to email Foxtide tomorrow")).toEqual({ what: "email Foxtide", dayOffset: 1 })
    expect(parseKeepTodo("remind me to water the plants")).toEqual({ what: "water the plants", dayOffset: 0 })
  })

  it("leaves a timed or conditional line for the rest of chat", () => {
    expect(parseKeepTodo("remind me to call mom at 5pm")).toBeNull()
    expect(parseKeepTodo("remind me to stretch if i sit too long")).toBeNull()
    expect(parseKeepTodo("don't forget that the gate code is 4412")).toBeNull()
    expect(parseKeepTodo("i forgot to eat")).toBeNull()
  })
})

describe("BIM chat: keep and money lanes", () => {
  beforeEach(() => {
    resetAllStores()
    useBimChatStore.setState({ lines: [], busy: false })
    useBudgetStore.setState({ ...EMPTY_MONEY_BOOK })
    useFinanceBimby.setState({ purchases: [], perks: [], loose: [], lines: [], busy: false })
    useCueStore.setState({ cues: [] })
    resetFinanceUndoForTests()
    resetFinanceRunForTests()
    resetKeepForTests()
  })

  const titles = () => useTaskStore.getState().tasks.map((t) => `${t.title ?? ""} ${t.description ?? ""}`.trim())

  it("puts “dont forget to cancel instacart” on today's To Do", async () => {
    const line = await sendToBim("dont forget to cancel instacart")
    expect(line.route).toBe("KEEP · to do · code")
    expect(line.text).toBe("On today's To Do: cancel instacart.")
    expect(titles().some((t) => /cancel instacart/i.test(t))).toBe(true)
  })

  it("takes the To Do back on “undo that”", async () => {
    await sendToBim("dont forget to cancel instacart")
    const undone = await sendToBim("undo that")
    expect(undone.text).toContain("Undone")
    expect(titles().some((t) => /cancel instacart/i.test(t))).toBe(false)
  })

  it("keeps the discount as a cue and a perk, and says it back only in that situation", async () => {
    const kept = await sendToBim(CUE)
    expect(kept.route).toBe("KEEP · cue · code")
    expect(useCueStore.getState().cues).toHaveLength(1)
    const [perk] = useFinanceBimby.getState().perks
    expect(perk).toMatchObject({ cents: 1500, merchant: "Instacart", cueId: useCueStore.getState().cues[0]!.id })

    const other = await sendToBim("log: cleaned the kitchen")
    expect(other.text).not.toContain("remind you")

    const hungry = await sendToBim("log: thinking about ordering food tonight")
    expect(hungry.text).toContain("↳ You asked me to remind you: got 15$ off restaurant food on instacart.")

    // Said once; quiet for the next half hour.
    const again = await sendToBim("log: i need to order food")
    expect(again.text).not.toContain("remind you")
  })

  it("closes the cue and the perk on “used it”", async () => {
    await sendToBim(CUE)
    await sendToBim("log: i need to order food")
    const used = await sendToBim("used it")
    expect(used.text).toContain("Marked used")
    expect(useCueStore.getState().cues[0]!.doneAt).toBeTruthy()
    expect(useFinanceBimby.getState().perks[0]!.usedAt).toBeTruthy()
  })

  it("lists and drops cues by name", async () => {
    await sendToBim(CUE)
    expect((await sendToBim("what are you reminding me about?")).text).toContain("got 15$ off restaurant food on instacart")
    expect((await sendToBim("stop reminding me about the instacart discount")).text).toContain("stop reminding you")
    expect(useCueStore.getState().cues[0]!.doneAt).toBeTruthy()
  })

  it("sends a money line to the Financial BIMBY and undoes it", async () => {
    const line = await sendToBim("Spent 90$ on the amex getting hairdye and other stuff on instacart")
    expect(line.route).toBe("MONEY · spend · code")
    expect(useTimeTrackingStore.getState().entries.filter(isSpendEntry)).toHaveLength(1)
    const debt = await sendToBim("foxtide owes me 600$ for the cd designs")
    expect(debt.route).toBe("MONEY · debt · code")
    expect(useBudgetStore.getState().debts).toMatchObject([{ who: "Foxtide", cents: 60000 }])
    expect((await sendToBim("undo that")).text).toContain("Undone: Foxtide owes you $600")
    expect(useBudgetStore.getState().debts).toHaveLength(0)
  })

  it("attaches a receipt photo sent after the purchase", async () => {
    await sendToBim("Spent 90$ on the amex getting hairdye and other stuff on instacart")
    const pixel = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg=="
    const line = await sendToBim("", new Date(), { photos: [{ kind: "photo", mime: "image/png", name: "r.png", dataUrl: pixel }] })
    expect(line.route).toBe("MONEY · receipt · code")
    expect(useFinanceBimby.getState().purchases[0]!.receipts).toHaveLength(1)
  })

  it("still keeps a plain fact told with “don't forget that”", async () => {
    const line = await sendToBim("don't forget that the gate code is 4412")
    expect(line.route ?? "").not.toMatch(/^KEEP/)
    expect(titles().some((t) => /gate code/i.test(t))).toBe(false)
  })
})
