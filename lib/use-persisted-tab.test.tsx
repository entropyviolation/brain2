/**
 * usePersistedTab — restore after mount so Radix tab triggers stay in sync.
 */
import { StrictMode } from "react"
import { act, render, renderHook, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { hydrateRoot, type Root } from "react-dom/client"
import { renderToString } from "react-dom/server"
import { beforeEach, describe, expect, it } from "vitest"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { APP_NAV_KEYS, APP_TABS, readStoredTab, type AppTab } from "@/lib/app-navigation"
import { usePersistedTab } from "@/lib/use-persisted-tab"
import { resetLocalStorage } from "@/tests/test-utils"

function Probe() {
  const [tab] = usePersistedTab(APP_NAV_KEYS.appTab, APP_TABS, "home")
  return <div data-testid="tab">{tab}</div>
}

function AppTabStrip() {
  const [tab, setTab] = usePersistedTab(APP_NAV_KEYS.appTab, APP_TABS, "home")
  return (
    <Tabs value={tab} onValueChange={(v) => setTab(v as AppTab)}>
      <TabsList>
        <TabsTrigger value="home">Home</TabsTrigger>
        <TabsTrigger value="categories">Lists</TabsTrigger>
        <TabsTrigger value="docs">Docs</TabsTrigger>
        <TabsTrigger value="scheduler">Scheduler</TabsTrigger>
        <TabsTrigger value="operations">Operations</TabsTrigger>
        <TabsTrigger value="modules">Modules</TabsTrigger>
        <TabsTrigger value="analytics">Analytics</TabsTrigger>
      </TabsList>
      {tab === "home" && <TabsContent value="home">Home view</TabsContent>}
      {tab === "categories" && <TabsContent value="categories">Lists view</TabsContent>}
      {tab === "docs" && <TabsContent value="docs">Docs view</TabsContent>}
      {tab === "scheduler" && <TabsContent value="scheduler">Scheduler view</TabsContent>}
      {tab === "operations" && <TabsContent value="operations">Operations view</TabsContent>}
      {tab === "modules" && <TabsContent value="modules">Modules view</TabsContent>}
      {tab === "analytics" && <TabsContent value="analytics">Analytics view</TabsContent>}
    </Tabs>
  )
}

describe("usePersistedTab", () => {
  beforeEach(() => {
    resetLocalStorage()
  })

  it("defaults to the fallback when nothing is stored", () => {
    const { result } = renderHook(() => usePersistedTab(APP_NAV_KEYS.appTab, APP_TABS, "home"))
    expect(result.current[0]).toBe("home")
  })

  it("restores a stored tab after mount without clobbering it with the fallback", () => {
    localStorage.setItem(APP_NAV_KEYS.appTab, "docs")
    render(<Probe />)
    expect(screen.getByTestId("tab")).toHaveTextContent("docs")
    expect(readStoredTab(APP_NAV_KEYS.appTab, APP_TABS, "home")).toBe("docs")
  })

  it("persists tab changes", async () => {
    const { result } = renderHook(() => usePersistedTab(APP_NAV_KEYS.appTab, APP_TABS, "home"))
    await act(async () => {
      result.current[1]("docs")
    })
    expect(readStoredTab(APP_NAV_KEYS.appTab, APP_TABS, "home")).toBe("docs")
  })
})

describe("persisted tablist after refresh", () => {
  beforeEach(() => {
    resetLocalStorage()
  })

  it("indents only the restored tab, not the Home fallback", () => {
    localStorage.setItem(APP_NAV_KEYS.appTab, "docs")
    render(<AppTabStrip />)

    expect(screen.getByRole("tab", { name: "Docs" })).toHaveAttribute("data-state", "active")
    expect(screen.getByRole("tab", { name: "Home" })).toHaveAttribute("data-state", "inactive")
    expect(screen.getByText("Docs view")).toBeVisible()
  })

  it("does not clobber a stored tab under StrictMode double-mount", () => {
    localStorage.setItem(APP_NAV_KEYS.appTab, "docs")
    render(
      <StrictMode>
        <AppTabStrip />
      </StrictMode>,
    )
    expect(screen.getByRole("tab", { name: "Docs" })).toHaveAttribute("data-state", "active")
    expect(screen.getByRole("tab", { name: "Home" })).toHaveAttribute("data-state", "inactive")
    expect(readStoredTab(APP_NAV_KEYS.appTab, APP_TABS, "home")).toBe("docs")
  })

  it("keeps a single active tab after clicking another tab post-restore", async () => {
    localStorage.setItem(APP_NAV_KEYS.appTab, "docs")
    const user = userEvent.setup()
    render(<AppTabStrip />)

    await user.click(screen.getByRole("tab", { name: "Scheduler" }))

    expect(screen.getByRole("tab", { name: "Scheduler" })).toHaveAttribute("data-state", "active")
    expect(screen.getByRole("tab", { name: "Home" })).toHaveAttribute("data-state", "inactive")
    expect(screen.getByRole("tab", { name: "Docs" })).toHaveAttribute("data-state", "inactive")
  })

  it("hydrates without leaving Home indented when another tab was stored", async () => {
    localStorage.setItem(APP_NAV_KEYS.appTab, "docs")
    const html = renderToString(<AppTabStrip />)
    const container = document.createElement("div")
    container.innerHTML = html
    document.body.appendChild(container)

    let root: Root
    await act(async () => {
      root = hydrateRoot(container, <AppTabStrip />)
    })

    const tabs = container.querySelectorAll('[role="tab"]')
    const home = [...tabs].find((el) => el.textContent === "Home")
    const docs = [...tabs].find((el) => el.textContent === "Docs")
    expect(docs).toHaveAttribute("data-state", "active")
    expect(home).toHaveAttribute("data-state", "inactive")
    expect(container.textContent).toContain("Docs view")

    await act(async () => {
      root.unmount()
    })
    container.remove()
  })
})
