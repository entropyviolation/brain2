import { useState } from "react"
import { afterEach, describe, expect, it, vi } from "vitest"
import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { ItemResourcesPanel } from "./ItemResourcesPanel"
import { linkedResource, type FileLinkBridge, type LinkStat } from "@/lib/resource-links"
import type { ItemResource } from "@/lib/types"

const psd: LinkStat = { path: "/Users/me/Design/Big.psd", name: "Big.psd", isDir: false, size: 2e9, fileId: "1:2" }

function installBridge(over: Partial<FileLinkBridge> = {}): FileLinkBridge {
  const bridge: FileLinkBridge = {
    pathForFile: vi.fn(() => ""),
    pick: vi.fn(async () => []),
    stat: vi.fn(async () => null),
    resolve: vi.fn(async () => ({ status: "ok" as const })),
    open: vi.fn(async () => ""),
    reveal: vi.fn(),
    extractText: vi.fn(async () => ""),
    previewUrl: vi.fn(async () => ""),
    ...over,
  }
  ;(window as unknown as { desktop?: unknown }).desktop = { platform: "darwin", fileLinks: bridge }
  return bridge
}

function Harness({ initial, onChange }: { initial?: ItemResource[]; onChange?: (r: ItemResource[] | undefined) => void }) {
  const [resources, setResources] = useState(initial)
  return (
    <ItemResourcesPanel
      resources={resources}
      onChange={(next) => {
        setResources(next)
        onChange?.(next)
      }}
    />
  )
}

afterEach(() => {
  delete (window as unknown as { desktop?: unknown }).desktop
})

describe("ItemResourcesPanel links", () => {
  it("has no link controls on the web", () => {
    render(<Harness />)
    expect(screen.queryByRole("radiogroup", { name: "How to attach" })).toBeNull()
    expect(screen.queryByRole("button", { name: /Link folder/ })).toBeNull()
  })

  it("links a dropped big file instead of copying it", async () => {
    const bridge = installBridge({
      pathForFile: vi.fn(() => psd.path),
      stat: vi.fn(async () => psd),
      extractText: vi.fn(async () => "layer names"),
    })
    const onChange = vi.fn()
    render(<Harness onChange={onChange} />)
    const file = new File(["x"], "Big.psd")
    fireEvent.drop(screen.getByTestId("resource-tray"), { dataTransfer: { files: [file] } })
    await waitFor(() => expect(screen.getByTestId("resource-path")).toHaveTextContent("~/Design/Big.psd"))
    const added = onChange.mock.calls[0][0][0] as ItemResource
    expect(added.uri).toMatch(/^link:/)
    expect(added.link?.path).toBe(psd.path)
    await waitFor(() => expect(onChange.mock.calls.at(-1)?.[0][0].extractedText).toBe("layer names"))
    expect(screen.getAllByText("Linked").length).toBeGreaterThan(0)
    fireEvent.click(screen.getByRole("button", { name: /Show in Finder/ }))
    expect(bridge.reveal).toHaveBeenCalledWith(psd.path)
  })

  it("links folders from the picker", async () => {
    installBridge({
      pick: vi.fn(async () => [{ path: "/Users/me/code/app", name: "app", isDir: true, size: 10, fileCount: 3 }]),
    })
    render(<Harness />)
    fireEvent.click(screen.getByRole("button", { name: /Link folder/ }))
    await waitFor(() => expect(screen.getByText(/Folder · 3 files/)).toBeInTheDocument())
  })

  it("follows a moved file when the tab opens", async () => {
    const r = linkedResource(psd)
    const onChange = vi.fn()
    installBridge({
      resolve: vi.fn(async () => ({ status: "moved" as const, how: "fileId", link: { ...psd, path: "/Users/me/Archive/Big.psd" } })),
    })
    render(<Harness initial={[r]} onChange={onChange} />)
    await waitFor(() => expect(screen.getByTestId("resource-path")).toHaveTextContent("~/Archive/Big.psd"))
    expect(onChange.mock.calls[0][0][0]).toMatchObject({ id: r.id, link: { path: "/Users/me/Archive/Big.psd" } })
  })

  it("shows Missing without dirtying the draft, and Locate relinks", async () => {
    const r = linkedResource(psd)
    const onChange = vi.fn()
    installBridge({
      resolve: vi.fn(async () => ({ status: "missing" as const })),
      pick: vi.fn(async () => [{ ...psd, path: "/Volumes/Backup/Big.psd" }]),
    })
    render(<Harness initial={[r]} onChange={onChange} />)
    await waitFor(() => expect(screen.getAllByText("Missing").length).toBeGreaterThan(0))
    expect(onChange).not.toHaveBeenCalled()
    fireEvent.click(screen.getByTestId("resource-locate"))
    await waitFor(() => expect(screen.getByTestId("resource-path")).toHaveTextContent("/Volumes/Backup/Big.psd"))
    expect(screen.queryByText("Missing")).toBeNull()
  })

  it("explains a link made on another computer", () => {
    render(<Harness initial={[linkedResource(psd)]} />)
    expect(screen.getByText(/Linked on another computer/)).toBeInTheDocument()
    expect(screen.queryByRole("button", { name: /Open/ })).toBeNull()
  })
})
