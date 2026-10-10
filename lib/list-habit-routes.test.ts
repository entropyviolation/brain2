import { describe, expect, it } from "vitest"
import { listHabitRole, listHabitRoutes } from "./list-habit-routes"
import { TaskType, type WeeklyTask } from "./types"

const texts = { id: "texts", name: "texts I need to send" }

function habit(partial: Partial<WeeklyTask> & Pick<WeeklyTask, "id" | "name">): WeeklyTask {
  return { type: TaskType.GOAL, ...partial }
}

describe("listHabitRoutes", () => {
  it("returns a title and role when a completion source points at the list", () => {
    const routes = listHabitRoutes(texts, [
      habit({
        id: "task-texts",
        name: "respond to all missing texts",
        listSentLink: { listId: "texts", grace: 100, measure: "sent", target: "listLength" },
      }),
    ])
    expect(routes).toEqual([
      {
        habitId: "task-texts",
        title: "respond to all missing texts",
        role: "sent items, target is list length",
      },
    ])
  })

  it("is empty when no habit saves a link to the list", () => {
    expect(listHabitRoutes(texts, [])).toEqual([])
    expect(
      listHabitRoutes(texts, [
        habit({
          id: "other",
          name: "Read 30 pages",
          listSentLink: { listId: "books", measure: "sent", target: "listLength" },
        }),
      ]),
    ).toEqual([])
  })

  it("changes the role when the source is list length versus sent", () => {
    const length = listHabitRole({ measure: "completed", target: "listLength" })
    const sent = listHabitRole({ measure: "sent", target: "periodSet" })
    expect(length).toBe("completed items, target is list length")
    expect(sent).toBe("sent items, target is this period's set")
    expect(length).not.toBe(sent)
    expect(listHabitRole({ measure: "sent", target: "listLength" })).toBe("sent items, target is list length")
  })

  it("reads a saved next-action link and skips a stats pipeline that does not name the list", () => {
    const routes = listHabitRoutes(
      { id: "todo", name: "to do" },
      [
        habit({
          id: "pages",
          name: "Read 30 pages",
          unit: "pages",
          completionPipelines: [
            {
              id: "pipe",
              kind: "habitsStats",
              sources: [],
              statBinding: {
                mode: "simple",
                pipelineId: "pages",
                pipelines: [
                  {
                    id: "pages",
                    name: "Page total",
                    outputName: "pages",
                    sourceId: "daily",
                    periodId: "thisWeek",
                    outputId: "specificHabit",
                    habitId: "daily-read",
                    valueId: "loggedAmount",
                  },
                ],
              },
            },
          ],
        }),
        habit({
          id: "todo-habit",
          name: "complete 1 to-do list item",
          listLink: { listName: "To-Do", count: 1 },
        }),
      ],
    )
    expect(routes).toEqual([
      { habitId: "todo-habit", title: "complete 1 to-do list item", role: "next actions, target is 1" },
    ])
  })

  it("keeps one row when the list source and the next-action link name the same list", () => {
    const routes = listHabitRoutes(texts, [
      habit({
        id: "both",
        name: "respond to all missing texts",
        listSentLink: { listId: "texts", mode: "sentThisWeek" },
        listLink: { listName: "texts I need to send", count: 1 },
      }),
    ])
    expect(routes).toHaveLength(1)
    expect(routes[0]?.role).toBe("sent items, target is this period's set")
  })

  it("leaves out a link that was turned off", () => {
    expect(
      listHabitRoutes(texts, [
        habit({
          id: "off",
          name: "respond to all missing texts",
          listSentLink: { listId: "texts", enabled: false, measure: "sent", target: "listLength" },
        }),
      ]),
    ).toEqual([])
  })
})
