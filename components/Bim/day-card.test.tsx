import { beforeEach, describe, expect, it } from "vitest"
import { fireEvent, render, screen, within } from "@testing-library/react"
import { useBimChatStore } from "@/lib/ingest/bim-chat"
import { tryDay } from "@/lib/plan-bimby/day/run"
import { useDayPlanStore } from "@/lib/plan-bimby/day/store"
import { usePlanRunStore } from "@/lib/plan-bimby/store"
import { useTaskStore } from "@/lib/task-store"
import { DayCard } from "./day-card"

const MSG =
  "what I have to do for the rest of the day: order hairdye and anything else from walmart (tights comes to mind) asap, dye hair, bleach eyebrows, shave legs, pack (my stuff and elijahs) and plan outfits, finish foxtide stuff, and plan ny, and read shelby text and reply. MUST be done is dye hair (and thus order hairdye) bleach eyebrows and pack, and text shelby. and then foxtide stuff and planning ny is important as well."

beforeEach(() => {
  useDayPlanStore.setState({ plans: {}, order: [] })
  usePlanRunStore.setState({ run: null })
  useBimChatStore.setState({ lines: [], busy: false })
})

describe("day card", () => {
  it("shows every row with its weight, time and source, takes an edit, and files on the key", async () => {
    const reply = await tryDay(MSG, new Date(), { llm: false })
    const id = reply!.dayId!
    render(<DayCard dayId={id} lineId="line-1" />)
    const card = screen.getByLabelText("Your plan for the rest of today")
    expect(within(card).getAllByLabelText("Task").length).toBe(9)
    expect((within(card).getByLabelText("Weight of dye hair") as HTMLSelectElement).value).toBe("must")
    expect((within(card).getByLabelText("Weight of plan ny") as HTMLSelectElement).value).toBe("important")
    expect(within(card).getAllByText("rule of thumb").length).toBeGreaterThan(0)

    // A typed time is the person's, and says so.
    const item = useDayPlanStore.getState().plans[id]!.items.find((i) => i.title === "pack")!
    fireEvent.change(card.querySelector(`#${CSS.escape(`${id}-${item.id}-min`)}`)!, { target: { value: "75" } })
    expect(useDayPlanStore.getState().plans[id]!.items.find((i) => i.id === item.id)!.estimate).toMatchObject({ minutes: 75, source: "you" })

    // The tweak box uses the same rules as chat.
    fireEvent.change(within(card).getByLabelText("Say a change"), { target: { value: "drop shave legs" } })
    fireEvent.click(within(card).getByText("Change plan"))
    expect(within(card).getAllByLabelText("Task").length).toBe(8)

    const before = useTaskStore.getState().tasks.length
    fireEvent.click(within(card).getByText("Put on To Do today"))
    expect(useTaskStore.getState().tasks.length).toBe(before + 8)
    expect(within(card).getByText(/Filed: 8 new on To Do today/)).toBeTruthy()
    expect(within(card).getAllByText("ON TO DO").length).toBe(8)
  })

  it("is a stub under an older line once a newer line carries the plan", async () => {
    const reply = await tryDay(MSG, new Date(), { llm: false })
    const id = reply!.dayId!
    useBimChatStore.setState({ lines: [{ id: "a", at: "", who: "bim", text: "", dayId: id }, { id: "b", at: "", who: "bim", text: "", dayId: id }] })
    render(<DayCard dayId={id} lineId="a" />)
    expect(screen.getByText(/continues under a newer line/)).toBeTruthy()
  })
})
