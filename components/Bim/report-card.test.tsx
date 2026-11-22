import { beforeEach, describe, expect, it } from "vitest"
import { fireEvent, render, screen } from "@testing-library/react"
import { createPerson, ensurePeopleIKnowList } from "@/lib/people-i-know"
import { useReportStore } from "@/lib/report-bimby/store"
import { useTaskStore } from "@/lib/task-store"
import { ReportCard } from "./report-card"

beforeEach(() => {
  useTaskStore.setState({ tasks: [], lists: [] })
  useReportStore.setState({ plans: {}, order: [] })
  const nico = { ...createPerson("Nico Reyes", ensurePeopleIKnowList()), personProfile: { instagram: "nico.nyc" } }
  useTaskStore.getState().addTask(nico)
  useReportStore.getState().put({
    id: "p1",
    text: "",
    at: new Date().toISOString(),
    trace: [],
    effects: [{ id: "e1", kind: "person", title: "New person: Nico", reasoning: [], evidence: [], status: "pending", fields: [
      { key: "name", label: "Name", type: "text", value: "Nico" },
      { key: "instagram", label: "Instagram", type: "text", value: "" },
    ] }],
  })
})

const box = () => screen.getByRole("combobox") as HTMLInputElement
const type = (v: string) => fireEvent.change(box(), { target: { value: v } })

describe("Instagram field on a person block", () => {
  it("suggests known handles as you type and fills the one picked", () => {
    render(<ReportCard reportId="p1" />)
    fireEvent.focus(box())
    type("nic")
    const option = screen.getByRole("option", { name: /@nico\.nyc/ })
    expect(option.textContent).toContain("Nico Reyes")
    fireEvent.mouseDown(option)
    expect(box().value).toBe("nico.nyc")
    expect(useReportStore.getState().plans.p1!.effects[0]!.fields[1]!.value).toBe("nico.nyc")
  })

  it("keeps a new handle as typed", () => {
    render(<ReportCard reportId="p1" />)
    fireEvent.focus(box())
    type("brandnewperson")
    expect(screen.queryByRole("option")).toBeNull()
    fireEvent.keyDown(box(), { key: "Enter" })
    expect(box().value).toBe("brandnewperson")
  })
})
