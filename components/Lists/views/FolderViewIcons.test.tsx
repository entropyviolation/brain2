import { act, fireEvent, render } from "@testing-library/react"
import type { ComponentProps } from "react"
import { afterEach, describe, expect, it, vi } from "vitest"
import type { GridEntry } from "@/components/Lists/types"
import { layoutVelvetIconGrid } from "@/components/Lists/lib/velvet-icon-grid"
import { FolderViewIcons, prefersOrganizeTrailReduced } from "./FolderViewIcons"

vi.mock("@/components/Lists/lib/icon-utils", () => ({
  FolderGlyph: () => <span data-testid="folder-glyph" />,
  iconFor: () => "/orb.png",
  orbFor: () => "/orb.png",
}))

const entry = (id: string, name: string): GridEntry => ({
  kind: "list",
  id,
  name,
  count: 1,
})

function iconKey(id: string) {
  return `list-${id}`
}

function renderIcons(overrides: Partial<ComponentProps<typeof FolderViewIcons>> = {}) {
  const entries = [entry("a", "Alpha"), entry("b", "Beta"), entry("c", "Gamma")]
  const keys = entries.map((e) => iconKey(e.id))
  const packed = layoutVelvetIconGrid(keys, 840)
  const iconPositions: Record<string, { x: number; y: number }> = {}
  for (const key of keys) {
    iconPositions[`home:${key}`] = packed[key]
  }
  const props: ComponentProps<typeof FolderViewIcons> = {
    location: "home",
    entries,
    isHome: true,
    selectMode: false,
    selectedCategories: [],
    activeIconId: null,
    dropTargetId: null,
    homePinned: [],
    iconPositions,
    iconLayoutMode: "auto",
    setIconPosition: vi.fn(),
    commitIconLayout: vi.fn(),
    setActiveIconId: vi.fn(),
    setSelectedCategories: vi.fn(),
    setDropTargetId: vi.fn(),
    openEntry: vi.fn(),
    onFileCategoryOnEntry: vi.fn(),
    toggleHomePin: vi.fn(),
    setIconPickerFor: vi.fn(),
    openNewCategoryDialog: vi.fn(),
    ...overrides,
  }
  return { ...render(<FolderViewIcons {...props} />), props, packed, keys }
}

function iconEl(id: string) {
  return document.querySelector(`[data-icon-entry][data-id="${id}"]`) as HTMLElement
}

describe("FolderViewIcons drag freeze", () => {
  it("keeps sibling coordinates when one icon is dragged", () => {
    const commitIconLayout = vi.fn()
    const { packed } = renderIcons({ commitIconLayout })

    const a = iconEl("a")
    const b = iconEl("b")
    const c = iconEl("c")
    expect(a.style.left).toBe(`${packed["list-a"].x}px`)
    expect(c.style.left).toBe(`${packed["list-c"].x}px`)
    expect(c.style.top).toBe(`${packed["list-c"].y}px`)

    fireEvent.mouseDown(b, { button: 0, clientX: packed["list-b"].x + 8, clientY: packed["list-b"].y + 8 })
    fireEvent.mouseMove(window, { clientX: packed["list-b"].x + 80, clientY: packed["list-b"].y + 40 })

    expect(iconEl("a").style.left).toBe(`${packed["list-a"].x}px`)
    expect(iconEl("a").style.top).toBe(`${packed["list-a"].y}px`)
    expect(iconEl("c").style.left).toBe(`${packed["list-c"].x}px`)
    expect(iconEl("c").style.top).toBe(`${packed["list-c"].y}px`)
    expect(iconEl("b").style.left).not.toBe(`${packed["list-b"].x}px`)

    expect(commitIconLayout).toHaveBeenCalled()
    const [location, snapshot, mode] = commitIconLayout.mock.calls[0]
    expect(location).toBe("home")
    expect(mode).toBe("freeform")
    expect(snapshot["list-a"]).toEqual(packed["list-a"])
    expect(snapshot["list-c"]).toEqual(packed["list-c"])
    expect(snapshot["list-b"]).not.toEqual(packed["list-b"])

    fireEvent.mouseUp(window)
    expect(iconEl("a").style.left).toBe(`${packed["list-a"].x}px`)
    expect(iconEl("c").style.left).toBe(`${packed["list-c"].x}px`)
  })

  it("paints a never-arranged folder as a width-filling pack", () => {
    renderIcons({ iconPositions: {}, iconLayoutMode: "auto" })
    const packed = layoutVelvetIconGrid(["list-a", "list-b", "list-c"], 840)
    expect(iconEl("a").style.left).toBe(`${packed["list-a"].x}px`)
    expect(iconEl("b").style.left).toBe(`${packed["list-b"].x}px`)
    expect(iconEl("c").style.left).toBe(`${packed["list-c"].x}px`)
    expect(document.querySelector("[data-icon-pack]")?.getAttribute("data-icon-pack")).toBe("auto")
  })

  it("does not switch the canvas into a CSS flow pack when a drag starts", () => {
    renderIcons({ iconLayoutMode: "auto" })
    fireEvent.mouseDown(iconEl("a"), { button: 0, clientX: 20, clientY: 20 })
    fireEvent.mouseMove(window, { clientX: 80, clientY: 60 })
    expect(document.querySelector("[data-icon-pack]")?.getAttribute("data-icon-pack")).toBe("freeform")
    expect(document.querySelector(".fm-icon-grid-packed")).toBeNull()
    expect(document.querySelector(".fm-icon-grid-free")).toBeTruthy()
  })
})

describe("FolderViewIcons auto-organize trail", () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it("prefersOrganizeTrailReduced reads prefers-reduced-motion", () => {
    vi.stubGlobal(
      "matchMedia",
      vi.fn((query: string) => ({
        matches: query.includes("prefers-reduced-motion") && query.includes("reduce"),
        media: query,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        addListener: vi.fn(),
        removeListener: vi.fn(),
        dispatchEvent: vi.fn(),
        onchange: null,
      })),
    )
    expect(prefersOrganizeTrailReduced()).toBe(true)

    vi.stubGlobal(
      "matchMedia",
      vi.fn((query: string) => ({
        matches: false,
        media: query,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        addListener: vi.fn(),
        removeListener: vi.fn(),
        dispatchEvent: vi.fn(),
        onchange: null,
      })),
    )
    expect(prefersOrganizeTrailReduced()).toBe(false)
  })

  it("skips the trace canvas when prefers-reduced-motion is reduce", async () => {
    vi.stubGlobal(
      "matchMedia",
      vi.fn((query: string) => ({
        matches: query.includes("prefers-reduced-motion") && query.includes("reduce"),
        media: query,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        addListener: vi.fn(),
        removeListener: vi.fn(),
        dispatchEvent: vi.fn(),
        onchange: null,
      })),
    )
    const onOrganizeAnimationEnd = vi.fn()
    const from = {
      "list-a": { x: 200, y: 200 },
      "list-b": { x: 320, y: 200 },
      "list-c": { x: 440, y: 200 },
    }
    const { packed } = renderIcons({
      iconLayoutMode: "auto",
      organizeEpoch: 1,
      organizeFromSnapshot: from,
      onOrganizeAnimationEnd,
    })

    await act(async () => {
      await Promise.resolve()
    })

    expect(document.querySelector("[data-organize-trace]")).toBeNull()
    expect(onOrganizeAnimationEnd).toHaveBeenCalled()
    // Final grid positions unchanged — still the deterministic pack.
    expect(iconEl("a").style.left).toBe(`${packed["list-a"].x}px`)
    expect(iconEl("b").style.left).toBe(`${packed["list-b"].x}px`)
    expect(iconEl("c").style.left).toBe(`${packed["list-c"].x}px`)
  })

  it("mounts a trail canvas when motion is allowed and icons move", async () => {
    vi.stubGlobal(
      "matchMedia",
      vi.fn((query: string) => ({
        matches: false,
        media: query,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        addListener: vi.fn(),
        removeListener: vi.fn(),
        dispatchEvent: vi.fn(),
        onchange: null,
      })),
    )
    const from = {
      "list-a": { x: 200, y: 200 },
      "list-b": { x: 320, y: 200 },
      "list-c": { x: 440, y: 200 },
    }
    const { packed } = renderIcons({
      iconLayoutMode: "auto",
      organizeEpoch: 1,
      organizeFromSnapshot: from,
    })

    await act(async () => {
      await Promise.resolve()
    })

    expect(document.querySelector("[data-organize-trace]")).toBeTruthy()
    // Resting icons still sit on the packed grid (heads animate separately).
    expect(iconEl("a").style.left).toBe(`${packed["list-a"].x}px`)
    expect(iconEl("c").style.top).toBe(`${packed["list-c"].y}px`)
  })
})
