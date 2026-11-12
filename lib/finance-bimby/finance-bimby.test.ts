import { beforeEach, describe, expect, it } from "vitest"
import { resetAllStores } from "@/tests/test-utils"
import { EMPTY_MONEY_BOOK, useBudgetStore } from "@/lib/budget-store"
import { cuesFor, matchCue, parseCue } from "@/lib/cues/cue"
import { useCueStore } from "@/lib/cues/store"
import { isSpendEntry } from "@/lib/spend"
import { useTimeTrackingStore } from "@/lib/time-tracking-store"
import { resetFinanceUndoForTests, undoLastMoney } from "./apply"
import { findAmount, readAsk, readIntent, readMoney, readReflection } from "./read"
import { readReceipt } from "./receipt"
import { resetFinanceRunForTests, tryMoney, tryMoneyPhoto } from "./run"
import { useFinanceBimby } from "./store"

const NOW = new Date(2026, 10, 11, 14, 30)
const PIXEL = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg=="
const photo = { kind: "photo" as const, mime: "image/png", name: "receipt.png", dataUrl: PIXEL }

function reset() {
  resetAllStores()
  useBudgetStore.setState({ ...EMPTY_MONEY_BOOK })
  useFinanceBimby.setState({ purchases: [], perks: [], loose: [], lines: [], busy: false })
  useCueStore.setState({ cues: [] })
  resetFinanceUndoForTests()
  resetFinanceRunForTests()
}

const spends = () => useTimeTrackingStore.getState().entries.filter(isSpendEntry)

describe("readMoney", () => {
  it("reads the spend sentence: amount, card, shop, what", () => {
    expect(readMoney("Spent 90$ on the amex getting hairdye and other stuff on instacart", NOW)).toEqual({
      kind: "spend",
      cents: 9000,
      what: "hairdye and other stuff",
      merchant: "Instacart",
      account: "Amex",
      accountKind: "card",
      date: "2026-11-11",
    })
  })

  it("reads who owes whom, with the reason", () => {
    expect(readMoney("foxtide owes me 600$ for the cd designs", NOW)).toEqual({ kind: "debt", direction: "owed", who: "Foxtide", cents: 60000, note: "the cd designs" })
    expect(readMoney("i owe shelby $40 for dinner", NOW)).toEqual({ kind: "debt", direction: "owe", who: "Shelby", cents: 4000, note: "dinner" })
  })

  it("reads a discount as a perk", () => {
    expect(readMoney("got 15$ off restaurant food on instacart", NOW)).toMatchObject({ kind: "perk", cents: 1500, what: "restaurant food", merchant: "Instacart" })
    expect(readMoney("20% off at Sephora", NOW)).toMatchObject({ kind: "perk", percent: 20, merchant: "Sephora" })
  })

  it("reads other shapes", () => {
    expect(readMoney("bought hairdye for $20 at Sally's yesterday", NOW)).toMatchObject({ kind: "spend", cents: 2000, what: "hairdye", merchant: "Sally's", date: "2026-11-10" })
    expect(readMoney("spent 12 on coffee", NOW)).toMatchObject({ kind: "spend", cents: 1200, what: "coffee" })
    expect(readMoney("got paid 200 from foxtide for the poster", NOW)).toMatchObject({ kind: "earning", cents: 20000, from: "Foxtide", what: "the poster" })
    expect(readMoney("foxtide paid me", NOW)).toMatchObject({ kind: "settle", direction: "owed", who: "Foxtide" })
  })

  it("leaves lines that are not money", () => {
    for (const line of ["spent 3 hours on foxtide", "got 2 things done today", "paid attention in class", "ordered my thoughts", "got home at 5", "made dinner", "i owe shelby a call", "what did i spend?"]) {
      expect(readMoney(line, NOW), line).toBeNull()
    }
  })

  it("does not take a duration or a clock for an amount", () => {
    expect(findAmount("3 hours", { bare: true })).toBeNull()
    expect(findAmount("at 5pm", { bare: true })).toBeNull()
    expect(findAmount("1,200.50 dollars")?.cents).toBe(120050)
    expect(findAmount("$1.2k")?.cents).toBe(120000)
  })
})

describe("verdicts, questions, intent", () => {
  it("reads how a purchase sat", () => {
    expect(readReflection("i regret the instacart order")?.kind).toBe("regret")
    expect(readReflection("the hairdye was so worth it")?.kind).toBe("satisfied")
    expect(readReflection("no regrets on the jacket")?.kind).toBe("satisfied")
    expect(readReflection("kinda regret it")?.kind).toBe("mixed")
    expect(readReflection("went for a walk")).toBeNull()
  })

  it("reads ledger questions and a buy being weighed", () => {
    expect(readAsk("who owes me money?", NOW)).toEqual({ kind: "owed" })
    expect(readAsk("how much did i spend on instacart this week?", NOW)).toMatchObject({ kind: "spent", label: "this week", from: "2026-11-09", about: ["instacart"] })
    expect(readIntent("thinking about ordering from instacart")?.tokens).toEqual(["instacart"])
    expect(readIntent("went to the store")).toBeNull()
  })
})

describe("cues", () => {
  const LINE = "got 15$ off restaurant food on instacart remind me if im thinking about ordering food or if i need to order food"

  it("splits the fact from the situation", () => {
    const cue = parseCue(LINE)!
    expect(cue.fact).toBe("got 15$ off restaurant food on instacart")
    expect(cue.clauses).toEqual([["order", "food"]])
    expect(parseCue("when I'm about to book a flight, remind me that I have a $200 Delta credit")?.fact).toBe("I have a $200 Delta credit")
    expect(parseCue("remind me to call mom")).toBeNull()
  })

  it("fires in that situation and not around it", () => {
    const cue = parseCue(LINE)!
    for (const yes of ["thinking about ordering food tonight", "i need to order food", "should i doordash dinner?", "might get takeout", "hungry, want to order something"]) {
      expect(matchCue(cue, yes), yes).toBe("yes")
    }
    for (const no of ["cleaned the kitchen", "foxtide owes me 600", "walked to the park"]) {
      expect(matchCue(cue, no), no).toBe("no")
    }
    // Half the situation is never a sure match.
    expect(matchCue(cue, "ordered a new phone case")).not.toBe("yes")
    // Already eaten, or only half the situation: not sure, so no reminder without a model.
    expect(matchCue(cue, "ordered food an hour ago")).toBe("maybe")
    expect(matchCue(cue, "so hungry")).toBe("maybe")
  })

  it("stays quiet after it has just been said, and when done", () => {
    const base = { id: "c", at: "", fires: 0, ...parseCue(LINE)! }
    const t = NOW.getTime()
    expect(cuesFor([base], "i need to order food", t).fire).toHaveLength(1)
    expect(cuesFor([{ ...base, firedAt: t - 60_000 }], "i need to order food", t).fire).toHaveLength(0)
    expect(cuesFor([{ ...base, doneAt: "x" }], "i need to order food", t).fire).toHaveLength(0)
  })
})

describe("receipts", () => {
  it("takes the total from a total line, never the subtotal", () => {
    const text = "Instacart\nOrder details\nHair dye  $14.99\nSubtotal $78.40\nService fee $6.10\nTotal charged $90.12\nYou saved $4.00"
    expect(readReceipt(text)).toEqual({ totalCents: 9012, merchant: "Instacart" })
    expect(readReceipt("12:41\n$14.99\n$78.40").totalCents).toBeUndefined()
  })
})

describe("Financial BIMBY, end to end", () => {
  beforeEach(reset)

  it("files the spend on the Tracking log and keeps the purchase", async () => {
    const reply = await tryMoney("Spent 90$ on the amex getting hairdye and other stuff on instacart", NOW, { call: null })
    expect(reply?.text).toContain("Spent $90 at Instacart on hairdye and other stuff, paid with Amex")
    const [entry] = spends()
    expect(entry).toMatchObject({ spendAmount: 9000, spendSource: "Amex", spendOn: "hairdye and other stuff · Instacart" })
    const [p] = useFinanceBimby.getState().purchases
    expect(p).toMatchObject({ cents: 9000, merchant: "Instacart", account: "Amex", entryId: entry!.id })
    expect(useBudgetStore.getState().accounts.map((a) => a.name)).toEqual(["Amex"])
  })

  it("undoes a spend from both places", async () => {
    await tryMoney("spent 12 on coffee", NOW, { call: null })
    expect(undoLastMoney(NOW)).toContain("Undone")
    expect(spends()).toHaveLength(0)
    expect(useFinanceBimby.getState().purchases).toHaveLength(0)
  })

  it("keeps a debt, answers who owes, and settles it", async () => {
    await tryMoney("foxtide owes me 600$ for the cd designs", NOW, { call: null })
    expect(useBudgetStore.getState().debts).toMatchObject([{ who: "Foxtide", direction: "owed", cents: 60000, note: "the cd designs" }])
    expect((await tryMoney("foxtide owes me 600 for the cd designs", NOW, { call: null }))?.text).toContain("already have that")
    expect(useBudgetStore.getState().debts).toHaveLength(1)
    expect((await tryMoney("who owes me?", NOW, { call: null }))?.text).toContain("Foxtide: $600 for the cd designs")

    const paid = await tryMoney("foxtide paid me 400", NOW, { call: null })
    expect(paid?.text).toContain("$200 still owed")
    expect(useBudgetStore.getState().debts).toMatchObject([{ who: "Foxtide", cents: 20000 }])
    expect(useBudgetStore.getState().lines).toMatchObject([{ kind: "earning", cents: 40000, source: "Foxtide", name: "the cd designs" }])
  })

  it("attaches a receipt sent right after the purchase", async () => {
    await tryMoney("Spent 90$ on the amex getting hairdye and other stuff on instacart", NOW, { call: null })
    const reply = await tryMoneyPhoto("", [photo], new Date(NOW.getTime() + 60_000), { ocr: async () => ["Instacart\nTotal charged $90.00"] })
    expect(reply?.text).toContain("Receipt attached to $90 at Instacart")
    const [p] = useFinanceBimby.getState().purchases
    expect(p!.receipts).toHaveLength(1)
    expect(p!.receipts[0]).toMatch(/^idb:/)
    expect(p!.receiptText).toContain("Total charged")
  })

  it("leaves a bare photo alone when no purchase was just told", async () => {
    expect(await tryMoneyPhoto("", [photo], NOW, { ocr: async () => [""] })).toBeNull()
    expect(await tryMoneyPhoto("receipt", [photo], NOW, { ocr: async () => [""] })).toBeNull()
  })

  it("makes the purchase from the receipt when it can read a total", async () => {
    const reply = await tryMoneyPhoto("receipt for my order", [photo], NOW, { ocr: async () => ["Instacart\nSubtotal $80.00\nOrder total $92.14"] })
    expect(reply?.text).toContain("Spent $92.14 at Instacart")
    expect(useFinanceBimby.getState().purchases[0]).toMatchObject({ cents: 9214, merchant: "Instacart" })
    expect(useFinanceBimby.getState().purchases[0]!.receipts).toHaveLength(1)
  })

  it("holds an unread receipt for the purchase told next", async () => {
    const held = await tryMoneyPhoto("receipt for my order", [photo], NOW, { ocr: async () => [""] })
    expect(held?.text).toContain("kept")
    await tryMoney("spent 90 on the amex at instacart", new Date(NOW.getTime() + 120_000), { call: null })
    expect(useFinanceBimby.getState().purchases[0]!.receipts).toHaveLength(1)
    expect(useFinanceBimby.getState().loose).toHaveLength(0)
  })

  it("keeps regret in the person's words and brings it up next time", async () => {
    await tryMoney("Spent 90$ on the amex getting hairdye and other stuff on instacart", NOW, { call: null })
    const later = new Date(NOW.getTime() + 3 * 86_400_000)
    const felt = await tryMoney("i regret the instacart order, didn't need half of it and the fees were insane", later, { call: null })
    expect(felt?.text).toContain("regret")
    expect(useFinanceBimby.getState().purchases[0]!.verdict).toMatchObject({ kind: "regret", why: "i regret the instacart order, didn't need half of it and the fees were insane" })

    const weighing = await tryMoney("thinking about ordering from instacart again", later, { call: null })
    expect(weighing?.text).toContain("1 you regretted")
    expect(weighing?.text).toContain("didn't need half of it")

    const again = await tryMoney("spent 40 on the amex on instacart", later, { call: null })
    expect(again?.text).toContain("Earlier Instacart buys")
    expect((await tryMoney("what do i regret?", later, { call: null }))?.text).toContain("$90 at Instacart")
  })

  it("asks why when only the verdict is given, and keeps the answer", async () => {
    await tryMoney("spent 60 on shoes at Target", NOW, { call: null })
    const asked = await tryMoney("i regret the shoes", NOW, { own: true, call: null })
    expect(asked?.text).toContain("What about it?")
    await tryMoney("they hurt and i already have two pairs", NOW, { own: true, call: null })
    expect(useFinanceBimby.getState().purchases[0]!.verdict).toMatchObject({ kind: "regret", why: "they hurt and i already have two pairs" })
  })

  it("uses the model only for the sentence, never for what is kept", async () => {
    await tryMoney("spent 60 on shoes at Target", NOW, { call: null })
    const reply = await tryMoney("so happy with the shoes, wear them every day", NOW, { own: true, call: async () => ({ reply: "Daily wear is a good sign." }) })
    expect(reply?.text).toContain("Daily wear is a good sign.")
    expect(useFinanceBimby.getState().purchases[0]!.verdict?.why).toBe("so happy with the shoes, wear them every day")
  })

  it("asks whether a discount was used when a buy at that shop is logged", async () => {
    await tryMoney("got 15$ off restaurant food on instacart", NOW, { call: null })
    const reply = await tryMoney("spent 30 on instacart", NOW, { call: null })
    expect(reply?.text).toContain("Did you use it?")
    expect((await tryMoney("used it", NOW, { call: null }))?.text).toContain("Marked used")
    expect(useFinanceBimby.getState().perks[0]!.usedAt).toBeTruthy()
  })

  it("does not take a line that is not money", async () => {
    for (const line of ["went for a walk", "i regret texting him", "thinking about getting a haircut", "did skincare"]) {
      expect(await tryMoney(line, NOW, { call: null }), line).toBeNull()
    }
  })
})
