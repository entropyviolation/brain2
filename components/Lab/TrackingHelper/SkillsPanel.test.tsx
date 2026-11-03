import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { loadBank, saveBank } from "@/lib/skills/bank"
import { saveExperiences } from "@/lib/skills/experience"
import { TRACKING_HELPER_SKILLS } from "@/lib/skills/seeds"
import type { Experience } from "@/lib/skills/types"
import { SkillsPanel } from "./SkillsPanel"

vi.mock("@/lib/bim-flow/chat-models", () => ({ chatCrew: async () => null }))

const PAIRS = [["walking", "hiking a trail"], ["cooking", "baking bread"], ["scrolling", "doomscrolling news"]]
const fail = (i: number): Experience => ({ id: `e${i}`, agentId: "tracking-helper", at: i, category: "wire:activity-name", input: "line " + i, outcome: "failure", severity: 1, chose: PAIRS[i - 1]![0]!, should: PAIRS[i - 1]![1]!, skillsUsed: [] })

describe("SkillsPanel", () => {
  beforeEach(() => localStorage.clear())

  it("lists the shipped skills and says when nothing is logged", () => {
    render(<SkillsPanel />)
    expect(screen.getByText("Point at tags, never write times")).toBeTruthy()
    expect(screen.getByText(/No reactions logged yet/)).toBeTruthy()
    expect((screen.getByRole("button", { name: "Find new skills" }) as HTMLButtonElement).disabled).toBe(true)
  })

  it("proposes plain lessons from corrections, then accepts one so it is active in the saved bank", async () => {
    saveExperiences("tracking-helper", [1, 2, 3].map(fail))
    render(<SkillsPanel />)
    fireEvent.click(screen.getByRole("button", { name: "Find new skills" }))
    await waitFor(() => expect(screen.getByRole("status").textContent).toMatch(/proposed from 3 corrections/))
    expect(loadBank("tracking-helper", TRACKING_HELPER_SKILLS).skills.filter((s) => s.status === "proposed")).toHaveLength(3)
    fireEvent.click(screen.getAllByRole("button", { name: "Accept" })[0]!)
    expect(loadBank("tracking-helper", TRACKING_HELPER_SKILLS).skills.filter((s) => s.status === "proposed")).toHaveLength(2)
    expect(loadBank("tracking-helper", TRACKING_HELPER_SKILLS).skills.filter((s) => s.source === "distilled" && s.status === "active")).toHaveLength(1)
  })

  it("retires a skill and keeps it retired on reload", () => {
    saveBank(loadBank("tracking-helper", TRACKING_HELPER_SKILLS))
    render(<SkillsPanel />)
    fireEvent.click(screen.getAllByRole("button", { name: "Retire" })[0]!)
    expect(loadBank("tracking-helper", TRACKING_HELPER_SKILLS).skills.filter((s) => s.status === "retired")).toHaveLength(1)
  })
})
