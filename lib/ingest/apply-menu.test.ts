import { beforeEach, describe, expect, it } from "vitest"
import { resetAllStores } from "@/tests/test-utils"
import { createScheduledTodoTask } from "@/components/Home/ToDo/todo-utils"
import { formatLocalDateKey } from "@/lib/date-utils"
import { getDayNote } from "@/lib/day-notes-persist"
import { useHabitsStore } from "@/lib/habits-store"
import { getPlanEntries } from "@/lib/plan-text"
import { findQuotesList } from "@/lib/quotes-list"
import { useTaskStore } from "@/lib/task-store"
import { taskIsPrioritized, taskIsRequired } from "@/lib/todo-commitment"
import { TaskType, type WeeklyTask } from "@/lib/types"
import { useWorkSessionStore } from "@/lib/work-session-store"
import { resetActionHistory } from "@/lib/action-history"
import { resetIngestDedupeForTests } from "./dedupe"
import { ingestIncoming } from "./executor"
import { useIngestStore } from "./ingest-store"
import { menuPeriodFromText } from "./apply-menu"
import { resetPhoneUndoForTests } from "./phone-undo"
import type { ApplyResult, IncomingMessage } from "./types"

const NOW = new Date(2026, 9, 15, 17, 0, 0)
const DAY = formatLocalDateKey(NOW)

function send(text: string, at = NOW): ApplyResult {
  const msg: IncomingMessage = { source: { channel: "simulate", chatId: "sim" }, text, receivedAt: at.toISOString() }
  return ingestIncoming(msg, at)
}

function reply(r: ApplyResult): string {
  return "reply" in r && r.reply ? r.reply : ""
}

function addTodo(name: string) {
  const task = createScheduledTodoTask({ description: name, period: "day", date: NOW })
  useTaskStore.getState().addTask(task)
  return task.id
}

function habit(id: string, name: string, extra: Partial<WeeklyTask> = {}): WeeklyTask {
  return { id, name, type: TaskType.BOOLEAN, frequency: "daily", ...extra } as WeeklyTask
}

function task(id: string) {
  return useTaskStore.getState().tasks.find((t) => t.id === id)!
}

describe("phone menus", () => {
  beforeEach(() => {
    resetAllStores()
    resetIngestDedupeForTests()
    resetActionHistory()
    resetPhoneUndoForTests()
    useIngestStore.setState({ enabled: true, pendingByChat: {}, events: [], shortcuts: {}, discreteEventTriggers: [] })
    useHabitsStore.setState({ tasks: [], weeklyData: {} })
  })

  it("only whole-message triggers open a menu", () => {
    expect(menuPeriodFromText("today menu")).toBe("day")
    expect(menuPeriodFromText("Week Menu")).toBe("week")
    expect(menuPeriodFromText("season menu")).toBe("quarter")
    expect(menuPeriodFromText("show me the today menu")).toBeNull()
  })

  it("opens with the date, a quote block, reminders, and four choices; creates the Quotes list", () => {
    const r = send("today menu")
    expect(r.status).toBe("needs_clarify")
    const text = reply(r)
    expect(text.startsWith("Thursday Oct 15 2026")).toBe(true)
    expect(text).toContain("QUOTE OF THE DAY")
    expect(text).toContain("REMINDERS")
    expect(text).toMatch(/1\. To-do list\n2\. Habits\n3\. Plan\n4\. Summary/)
    expect(findQuotesList()).not.toBeNull()
  })

  it("runs several to-do actions in one message, keeping numbers", () => {
    const a = addTodo("dishes")
    const b = addTodo("email")
    const c = addTodo("write")
    send("today menu")
    expect(reply(send("1"))).toMatch(/1\. dishes\n2\. email\n3\. write/)
    const r = send("1. mow lawn\nclean house\n2. 3\n3. 1, 3\n4. 2 ~9pm\n5. 3")
    const text = reply(r)
    expect(text).toContain("Added: mow lawn, clean house")
    expect(text).toMatch(/2\. ✓ email/)
    expect(text).toMatch(/4\. mow lawn\n5\. clean house/)
    expect(taskIsPrioritized(task(c), "day", DAY)).toBe(true)
    expect(taskIsRequired(task(a), "day", DAY)).toBe(true)
    expect(taskIsRequired(task(c), "day", DAY)).toBe(true)
    expect(task(b).completed).toBe(true)
    expect(new Date(task(b).completedDate as Date).getHours()).toBe(21)
    expect(useWorkSessionStore.getState().session?.operationId).toBe(c)
  })

  it("HELP on the to-do screen explains the actions, and BACK returns", () => {
    addTodo("dishes")
    send("today menu")
    send("1")
    expect(reply(send("HELP"))).toContain("TO-DO HELP")
    expect(reply(send("back"))).toContain("TO-DO · TODAY")
    expect(reply(send("back"))).toContain("QUOTE OF THE DAY")
  })

  it("6. walks each task for details", () => {
    const a = addTodo("dishes")
    send("today menu")
    send("1")
    expect(reply(send("6. 1"))).toContain("DETAILS 1 of 1")
    const done = reply(send("A 30 10 7 3 6\nso the sink is clear"))
    expect(done).toContain("Details done.")
    expect(task(a).estimatedDuration).toBe(30)
    expect(task(a).rewardValue).toBe(10)
    expect(task(a).notes).toContain("Why: so the sink is clear")
  })

  it("habits keep their numbers and accept values", () => {
    useHabitsStore.setState({
      tasks: [
        habit("h1", "Meditate"),
        habit("h2", "Floss"),
        habit("h3", "Clean", { type: TaskType.GOAL, goal: 15, unit: "min" }),
      ],
    })
    send("today menu")
    expect(reply(send("2"))).toContain("3. Clean — 0 / 15 min")
    const text = reply(send("2, 3 = 10"))
    expect(text).toMatch(/1\. Meditate/)
    expect(text).not.toMatch(/^2\. Floss/m)
    expect(text).toContain("3. Clean — 10 / 15 min")
    expect(text).toContain("Done: 2")
  })

  it("plan and summary add text", () => {
    send("today menu")
    send("3")
    expect(reply(send("1. gym then write"))).toContain("gym then write")
    expect(getPlanEntries("day", DAY).map((e) => e.text)).toContain("gym then write")
    send("menu")
    send("4")
    send("1")
    send("good day")
    expect(getDayNote(DAY)).toContain("good day")
    send("2. replaced")
    expect(getDayNote(DAY)).toBe("replaced")
  })

  it("a message that is not a menu answer closes the menu and runs normally", () => {
    send("today menu")
    const r = send("groc milk")
    expect(r.kind).toBe("grocery")
    expect(useIngestStore.getState().getPending("simulate", "sim")).toBeFalsy()
  })

  it("week menu labels the week", () => {
    expect(reply(send("week menu"))).toMatch(/^Week of Oct 12 2026/)
  })
})
