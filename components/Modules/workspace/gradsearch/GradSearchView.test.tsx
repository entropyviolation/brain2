/**
 * GradSearch explorer — catalog + the same search / detail / compare flow
 * as the standalone app.
 */
import { afterEach, beforeEach, describe, expect, it } from "vitest"
import catalog from "./data.json"
import { mountGradSearch } from "./engine"
import { GRADSEARCH_SHELL } from "./shell"

const GS_KEYS = [
  "gs-theme",
  "gs-weights",
  "gs-overrides",
  "gs-vibes",
  "gs-notes",
  "gs-dataedits",
  "gs-scoremode",
  "gs-dismissed",
  "gs-favorites",
]

const sample = {
  programs: [
    {
      id: 1,
      score: 100,
      program: "Summer Internship",
      institution: "teamLab",
      city: "Tokyo / Kyoto",
      country: "Japan",
      degree: "Internship",
      degreeLevel: "Other",
      duration: "2–3wk",
      years: 0.06,
      language: "EN-workable",
      funding: "PAID",
      fundingType: "Funded / stipend",
      field: "Art-Tech / Immersive",
      fieldCategory: "Art-Tech / Immersive",
      tier: 1,
      link: "https://www.team-lab.com/recruit/internship/",
      components: { field: 100, location: 100, funding: 100, duration: 100, accred: 85 },
      baseAdjust: 0.75,
    },
    {
      id: 2,
      score: 92,
      program: "HPS Research",
      institution: "University of Sydney",
      city: "Sydney",
      country: "Australia",
      degree: "PhD",
      degreeLevel: "PhD / Doctorate",
      duration: "3–4y",
      years: 3.5,
      language: "English",
      funding: "RTP stipend",
      fundingType: "Funded / stipend",
      field: "Philosophy of Science",
      fieldCategory: "Philosophy of Science",
      tier: 1,
      link: "https://example.edu/hps",
      components: { field: 100, location: 100, funding: 90, duration: 40, accred: 95 },
      baseAdjust: 0,
    },
    {
      id: 3,
      score: 70,
      program: "Interface Cultures",
      institution: "Kunstuniversität Linz",
      city: "Linz",
      country: "Austria",
      degree: "MA",
      degreeLevel: "Master's",
      duration: "2y",
      years: 2,
      language: "English",
      funding: "tuition-free",
      fundingType: "Free / tuition-free",
      field: "Design / Tech",
      fieldCategory: "Design / Tech",
      tier: 3,
      link: "https://example.edu/linz",
      components: { field: 70, location: 45, funding: 80, duration: 70, accred: 80 },
      baseAdjust: 0,
    },
  ],
  tiers: { "1": "Tier 1 — Sydney · Tokyo", "3": "Tier 3 — Other Europe" },
  defaultWeights: { field: 0.35, location: 0.3, funding: 0.2, duration: 0.1, accred: 0.05 },
}

function mount(data: unknown = sample) {
  const host = document.createElement("div")
  document.body.appendChild(host)
  const shadow = host.attachShadow({ mode: "open" })
  shadow.innerHTML = GRADSEARCH_SHELL
  const root = shadow.querySelector(".gs-app") as HTMLElement
  const stop = mountGradSearch(root, data)
  return { host, shadow, root, stop }
}

function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

describe("GradSearch catalog", () => {
  it("bundles the full gradsearch dataset", () => {
    expect(catalog.programs.length).toBe(catalog.count)
    expect(catalog.programs.length).toBeGreaterThan(600)
    expect(catalog.defaultWeights).toEqual({
      field: 0.35,
      location: 0.3,
      funding: 0.2,
      duration: 0.1,
      accred: 0.05,
    })
    const first = catalog.programs[0]
    expect(first.institution).toBe("teamLab")
    expect(first.components.field).toBe(100)
  })
})

describe("GradSearch explorer", () => {
  beforeEach(() => {
    for (const key of GS_KEYS) localStorage.removeItem(key)
  })

  afterEach(() => {
    document.body.innerHTML = ""
    for (const key of GS_KEYS) localStorage.removeItem(key)
  })

  it("searches, opens a program, favorites it, and compares", async () => {
    const { shadow, root, stop } = mount()
    const cards = () => shadow.querySelectorAll(".card")
    expect(cards().length).toBe(3)
    expect(shadow.querySelector("#stats")?.textContent).toContain("3")

    const search = shadow.querySelector("#search") as HTMLInputElement
    search.value = "teamLab"
    search.dispatchEvent(new Event("input", { bubbles: true }))
    await wait(180)
    expect(cards().length).toBe(1)
    expect(shadow.querySelector(".card h3")?.textContent).toContain("Summer Internship")

    ;(shadow.querySelector(".card") as HTMLElement).click()
    const drawer = shadow.querySelector("#drawer") as HTMLElement
    expect(drawer.classList.contains("hidden")).toBe(false)
    expect(shadow.querySelector(".drawer-hd h2")?.textContent).toContain("Summer Internship")
    expect(shadow.querySelector("#verifyBtn")).toBeTruthy()

    ;(shadow.querySelector("#drawerFav") as HTMLButtonElement).click()
    expect(shadow.querySelector("#drawerFav")?.textContent).toContain("Favorited")
    expect(JSON.parse(localStorage.getItem("gs-favorites") || "[]").length).toBe(1)

    ;(shadow.querySelector("#closeDrawer") as HTMLButtonElement).click()
    expect(drawer.classList.contains("hidden")).toBe(true)

    ;(shadow.querySelector("[data-compare]") as HTMLButtonElement).click()
    expect(shadow.querySelector("#compareTray")?.classList.contains("hidden")).toBe(false)

    ;(shadow.querySelector("#themeToggle") as HTMLButtonElement).click()
    expect(root.getAttribute("data-theme")).toBe("light")
    expect(localStorage.getItem("gs-theme")).toBe("light")

    stop()
  })

  it("filters by field chip and switches to the research score", () => {
    const { shadow, stop } = mount()
    const chip = shadow.querySelector(
      '#filter-field .chip[data-val="Philosophy of Science"]',
    ) as HTMLButtonElement
    expect(chip).toBeTruthy()
    chip.click()
    expect(shadow.querySelectorAll(".card").length).toBe(1)
    expect(shadow.querySelector(".card h3")?.textContent).toContain("HPS Research")
    expect(chip.classList.contains("active")).toBe(true)

    const research = shadow.querySelector('.mode-btn[data-mode="research"]') as HTMLButtonElement
    research.click()
    expect(research.classList.contains("active")).toBe(true)
    expect(localStorage.getItem("gs-scoremode")).toBe("research")
    stop()
  })
})
