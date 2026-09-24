import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { resetAllStores } from "@/tests/test-utils"
import { useHabitsStore } from "@/lib/habits-store"
import {
  DEFAULT_WILLPOWER_ORB,
  WillpowerGems,
  WillpowerGemsSettingsField,
  willpowerSrc,
} from "./willpower-gems"
import "./habit-chrome.css"

vi.mock("@/lib/remove-background", () => ({
  removeBackground: vi.fn(async () => "data:image/png;base64,willpower"),
}))

describe("WillpowerGems", () => {
  beforeEach(() => {
    resetAllStores()
  })

  it("labels Willpower gems and uses the default crystal", () => {
    render(<WillpowerGems />)
    expect(screen.getByText("Willpower gems")).toBeInTheDocument()
    expect(screen.getByLabelText("Willpower gems")).toBeInTheDocument()
    expect(screen.queryByText(/pasture/i)).not.toBeInTheDocument()
    const img = document.querySelector(".hab-willpower-crystal") as HTMLImageElement
    expect(img.getAttribute("src")).toBe(DEFAULT_WILLPOWER_ORB)
  })

  it("does not mount a file picker on the plate", () => {
    render(<WillpowerGems />)
    expect(document.querySelector(".hab-willpower-gems input[type='file']")).toBeNull()
    expect(screen.queryByRole("button", { name: /Change WILLPOWER image/i })).not.toBeInTheDocument()
    const plate = screen.getByRole("button", { name: /Stir Willpower gems/i })
    expect(plate).toHaveAttribute("data-physics", "willpower-gems")
    expect(plate).toHaveAttribute("data-no95")
  })

  it("stir click does not open a picker or replace the crystal", async () => {
    const user = userEvent.setup()
    render(<WillpowerGems />)
    await user.click(screen.getByRole("button", { name: /Stir Willpower gems/i }))
    expect(useHabitsStore.getState().willpowerImage).toBeNull()
    expect(document.querySelector(".hab-willpower-stage")).toBeTruthy()
  })

  it("collects completed habit gems as small satellites", () => {
    render(
      <WillpowerGems
        stones={[{ id: "drink:2026-09-21", src: "/gems-removebackground/gem5.png", name: "Drink water" }]}
      />,
    )
    const stone = document.querySelector(".hab-willpower-stone") as HTMLImageElement
    expect(stone).toBeTruthy()
    expect(stone.getAttribute("data-stone-id")).toBe("drink:2026-09-21")
    expect(stone.getAttribute("src")).toBe("/gems-removebackground/gem5.png")
    expect(window.getComputedStyle(stone).width).toBe("12px")
    expect(stone.getAttribute("loading")).toBe("lazy")
  })

  it("shows one copy per completion of the same gem", () => {
    render(
      <WillpowerGems
        stones={[
          { id: "drink:2026-09-21", src: "/gems-removebackground/gem5.png", name: "Drink water" },
          { id: "drink:2026-09-22", src: "/gems-removebackground/gem5.png", name: "Drink water" },
          { id: "drink:2026-09-23", src: "/gems-removebackground/gem5.png", name: "Drink water" },
        ]}
      />,
    )
    const stones = [...document.querySelectorAll(".hab-willpower-stone")] as HTMLImageElement[]
    expect(stones).toHaveLength(3)
    expect(stones.every((el) => el.getAttribute("src") === "/gems-removebackground/gem5.png")).toBe(true)
  })

  it("keeps a crowded Sunday plate at 12px and still stirs on click", async () => {
    const user = userEvent.setup()
    const stones = Array.from({ length: 21 }, (_, i) => ({
      id: `habit:2026-09-${String((i % 7) + 14)}-${i}`,
      src: "/gems-removebackground/gem5.png",
      name: "Crowded",
    }))
    render(<WillpowerGems stones={stones} />)
    const gems = [...document.querySelectorAll(".hab-willpower-stone")] as HTMLImageElement[]
    expect(gems).toHaveLength(21)
    expect(gems.every((el) => window.getComputedStyle(el).width === "12px")).toBe(true)
    const plate = screen.getByRole("button", { name: /Stir Willpower gems/i })
    await user.click(plate)
    expect(plate).toHaveClass("is-stirring")
  })

  it("paints stones behind the crystal PNG when they sit higher on the plate", () => {
    render(
      <WillpowerGems
        stones={[
          { id: "back", src: "/gems-removebackground/gem5.png", name: "Back" },
          { id: "front", src: "/gems-removebackground/gem.png", name: "Front" },
        ]}
      />,
    )
    const stage = document.querySelector(".hab-willpower-stage") as HTMLElement
    const kids = [...stage.children] as HTMLElement[]
    const crystalIdx = kids.findIndex((el) => el.classList.contains("hab-willpower-crystal"))
    expect(crystalIdx).toBeGreaterThan(-1)
    const behind = kids.filter((el) => el.getAttribute("data-depth") === "behind")
    const front = kids.filter((el) => el.getAttribute("data-depth") === "front")
    expect(behind.length).toBeGreaterThan(0)
    expect(front.length).toBeGreaterThan(0)
    expect(behind.every((el) => kids.indexOf(el) < crystalIdx)).toBe(true)
    expect(front.every((el) => kids.indexOf(el) > crystalIdx)).toBe(true)
    expect(window.getComputedStyle(document.querySelector(".hab-willpower-crystal") as Element).zIndex).toBe("2")
    expect(window.getComputedStyle(behind[0]).zIndex).toBe("1")
    expect(window.getComputedStyle(front[0]).zIndex).toBe("3")
  })

  it("keeps the oval plate while scaling the crystal", () => {
    render(<WillpowerGems />)
    const plate = document.querySelector(".hab-willpower-gems-hit") as HTMLElement
    const img = document.querySelector(".hab-willpower-crystal") as HTMLElement
    expect(plate).toBeTruthy()
    expect(window.getComputedStyle(plate).borderRadius).toMatch(/50%/)
    expect(window.getComputedStyle(img).height).toMatch(/72px|calc/)
    expect(window.getComputedStyle(img).transform).toMatch(/scale\(1\.62\)|matrix/)
  })

  it("opens a physics popup with live equations, graphs, and reset", async () => {
    const user = userEvent.setup()
    render(<WillpowerGems />)
    expect(screen.queryByRole("dialog", { name: /Willpower gems physics/i })).not.toBeInTheDocument()
    await user.click(screen.getByRole("button", { name: "Physics" }))
    expect(useHabitsStore.getState().willpowerPhysicsHud).toBe(true)
    expect(screen.getByRole("dialog", { name: /Willpower gems physics/i })).toBeInTheDocument()
    expect(screen.getByLabelText("Live equations")).toBeInTheDocument()
    expect(screen.getByLabelText("Live trajectories")).toBeInTheDocument()
    expect(document.body.textContent).toMatch(/½ g t/)
    const g = screen.getByLabelText(/Gravity g/i) as HTMLInputElement
    fireEvent.change(g, { target: { value: "400" } })
    expect(g).toHaveValue("400")
    await waitFor(() => expect(useHabitsStore.getState().willpowerPhysics.g).toBe(400))
    await user.click(screen.getByRole("button", { name: "Reset to default" }))
    expect(useHabitsStore.getState().willpowerPhysics.g).toBe(820)
    await user.click(screen.getByRole("button", { name: "Close physics" }))
    expect(useHabitsStore.getState().willpowerPhysicsHud).toBe(false)
    expect(screen.queryByRole("dialog", { name: /Willpower gems physics/i })).not.toBeInTheDocument()
  })

  it("draws habit gems without stretch or drop-shadow", () => {
    render(
      <WillpowerGems
        stones={[{ id: "drink:2026-09-21", src: "/gems-removebackground/gem5.png", name: "Drink water" }]}
      />,
    )
    const stone = document.querySelector(".hab-willpower-stone") as HTMLImageElement
    expect(stone.style.transform).toBe("")
    expect(stone.style.filter).toBe("")
    expect(window.getComputedStyle(stone).filter).toMatch(/none|^$/)
  })

  it("lets gems paint outside the oval rim", () => {
    render(<WillpowerGems />)
    const plate = document.querySelector(".hab-willpower-gems-hit") as HTMLElement
    expect(window.getComputedStyle(plate).overflow).toBe("visible")
    expect(window.getComputedStyle(document.querySelector(".hab-willpower-gems") as Element).overflow).toBe(
      "visible",
    )
    expect(window.getComputedStyle(document.querySelector(".hab-willpower-stage") as Element).overflow).toBe(
      "visible",
    )
    expect(window.getComputedStyle(plate).borderRadius).toMatch(/50%/)
  })

  it("centers the plate in the control-panel foot", () => {
    render(<WillpowerGems />)
    const wrap = document.querySelector(".hab-willpower-gems") as HTMLElement
    const s = window.getComputedStyle(wrap)
    expect(s.alignItems).toBe("center")
    const left = Number.parseFloat(s.paddingLeft)
    const right = Number.parseFloat(s.paddingRight)
    expect(left).toBeCloseTo(right, 0)
  })

  it("presses the plate in like a physical button", () => {
    render(<WillpowerGems />)
    const plate = screen.getByRole("button", { name: /Stir Willpower gems/i })
    fireEvent.pointerDown(plate, { clientX: 80, clientY: 40 })
    expect(plate).toHaveClass("is-pressed")
    fireEvent.pointerUp(plate)
    expect(plate).not.toHaveClass("is-pressed")
  })

  it("grabs a habit gem and throws it through the sim", () => {
    render(
      <WillpowerGems
        stones={[{ id: "drink:2026-09-21", src: "/gems-removebackground/gem5.png", name: "Drink water" }]}
      />,
    )
    const stone = document.querySelector(".hab-willpower-stone") as HTMLImageElement
    const before = stone.style.left
    fireEvent.pointerDown(stone, { clientX: 20, clientY: 20, pointerId: 1, bubbles: true })
    expect(stone.getAttribute("data-held")).toBe("true")
    fireEvent.pointerMove(window, { clientX: 64, clientY: 8, pointerId: 1, bubbles: true })
    expect((document.querySelector(".hab-willpower-stone") as HTMLImageElement).style.left).not.toBe(before)
    const midTop = (document.querySelector(".hab-willpower-stone") as HTMLImageElement).style.top
    fireEvent.pointerMove(window, { clientX: 70, clientY: -220, pointerId: 1, bubbles: true })
    const lifted = document.querySelector(".hab-willpower-stone.is-held") as HTMLImageElement
    expect(lifted).toBeTruthy()
    expect(lifted.style.top).not.toBe(midTop)
    fireEvent.pointerUp(window, { pointerId: 1, bubbles: true })
    expect(document.querySelector(".hab-willpower-stone")?.getAttribute("data-held")).toBeNull()
  })

  it("plays the same plate inside the physics popup", async () => {
    const user = userEvent.setup()
    render(
      <WillpowerGems
        stones={[{ id: "drink:2026-09-21", src: "/gems-removebackground/gem5.png", name: "Drink water" }]}
      />,
    )
    await user.click(screen.getByRole("button", { name: "Physics" }))
    expect(screen.getByRole("dialog", { name: /Willpower gems physics/i })).toBeInTheDocument()
    expect(document.querySelector(".hab-willpower-lab-play .hab-willpower-gems-hit")).toBeTruthy()
    expect(document.querySelectorAll(".hab-willpower-gems-hit").length).toBe(2)
    expect(document.querySelectorAll(".hab-willpower-stone").length).toBeGreaterThanOrEqual(2)
    expect(document.querySelector(".hab-willpower-eq-block")).toBeTruthy()
    expect(document.querySelector(".hab-willpower-graphs")).toBeTruthy()
    const reset = screen.getByRole("button", { name: /Reset to default/i })
    expect(reset.closest(".hab-willpower-lab-foot")).toBeTruthy()
    expect(reset.classList.contains("hab-willpower-lab-reset")).toBe(true)
  })

  it("grabbing a habit gem does not stir the plate", () => {
    render(
      <WillpowerGems
        stones={[
          { id: "drink:2026-09-21", src: "/gems-removebackground/gem5.png", name: "Drink water" },
          { id: "walk:2026-09-21", src: "/gems-removebackground/gem.png", name: "Walk" },
        ]}
      />,
    )
    const plate = screen.getByRole("button", { name: /Stir Willpower gems/i })
    const gems = [...document.querySelectorAll(".hab-willpower-stone")] as HTMLImageElement[]
    const other = gems.find((el) => el.getAttribute("data-stone-id") === "walk:2026-09-21")!
    const left = other.style.left
    fireEvent.pointerDown(gems[0], { clientX: 20, clientY: 20, pointerId: 1, bubbles: true })
    expect(plate).not.toHaveClass("is-pressed")
    expect(plate).toHaveClass("is-holding")
    fireEvent.click(plate)
    expect(
      (document.querySelector('[data-stone-id="walk:2026-09-21"]') as HTMLImageElement).style.left,
    ).toBe(left)
    fireEvent.pointerUp(window, { pointerId: 1, bubbles: true })
    fireEvent.click(plate)
    expect(
      (document.querySelector('[data-stone-id="walk:2026-09-21"]') as HTMLImageElement).style.left,
    ).toBe(left)
  })

  it("physics sliders write through instead of snapping to min", async () => {
    const user = userEvent.setup()
    render(<WillpowerGems />)
    await user.click(screen.getByRole("button", { name: "Physics" }))
    const gravity = screen.getByRole("slider", { name: /Gravity g/i })
    expect(gravity).toHaveValue(String(useHabitsStore.getState().willpowerPhysics.g))
    expect(useHabitsStore.getState().willpowerPhysics.g).toBeGreaterThan(120)
    fireEvent.change(gravity, { target: { value: "1000" } })
    expect(screen.getByRole("slider", { name: /Gravity g/i })).toHaveValue("1000")
    await waitFor(() => expect(useHabitsStore.getState().willpowerPhysics.g).toBe(1000))
  })

  it("show and hide all explanations", async () => {
    const user = userEvent.setup()
    render(<WillpowerGems />)
    await user.click(screen.getByRole("button", { name: "Physics" }))
    expect(screen.queryByText(/Newton/)).not.toBeInTheDocument()
    expect(screen.queryByText(/Downward acceleration/)).not.toBeInTheDocument()
    await user.click(screen.getByRole("button", { name: "Show all explanations" }))
    expect(screen.getByText(/Newton/)).toBeInTheDocument()
    expect(screen.getByText(/Downward acceleration/)).toBeInTheDocument()
    await user.click(screen.getByRole("button", { name: "Hide all explanations" }))
    expect(screen.queryByText(/Newton/)).not.toBeInTheDocument()
    expect(screen.queryByText(/Downward acceleration/)).not.toBeInTheDocument()
  })
})

describe("WillpowerGemsSettingsField", () => {
  beforeEach(() => {
    resetAllStores()
  })

  it("still changes the willpower crystal from Settings", async () => {
    const user = userEvent.setup()
    render(<WillpowerGemsSettingsField />)
    const input = document.querySelector('input[type="file"]') as HTMLInputElement
    const file = new File(["orb"], "orb.png", { type: "image/png" })
    await user.upload(input, file)
    expect(useHabitsStore.getState().willpowerImage).toBe("data:image/png;base64,willpower")
    expect(willpowerSrc(useHabitsStore.getState().willpowerImage)).toBe("data:image/png;base64,willpower")
    expect(screen.getByRole("button", { name: /Change image/i })).toBeInTheDocument()
  })
})
