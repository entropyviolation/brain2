import { useState } from "react"
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog"
import { UnsavedChangesDialog, unsavedDismissProps, useUnsavedGuard } from "./unsaved-changes-guard"
import { snapshotsEqual } from "@/lib/unsaved-changes"

function DirtyEditor({
  initial,
  onPersist,
}: {
  initial: string
  onPersist?: (value: string) => void
}) {
  const [open, setOpen] = useState(true)
  const [baseline] = useState(initial)
  const [value, setValue] = useState(initial)
  const persist = onPersist ?? vi.fn()
  const guard = useUnsavedGuard({
    open,
    onOpenChange: setOpen,
    isDirty: !snapshotsEqual(value, baseline),
    onSave: () => {
      persist(value)
    },
    onDiscard: () => {
      setValue(baseline)
    },
  })

  if (!open) return <div>editor closed</div>

  return (
    <>
      <Dialog open={open} onOpenChange={guard.handleOpenChange}>
        <DialogContent hideClose {...unsavedDismissProps(guard.requestClose)}>
          <DialogTitle>Edit</DialogTitle>
          <input aria-label="Draft" value={value} onChange={(e) => setValue(e.target.value)} />
          <button type="button" aria-label="Close" onClick={guard.requestClose}>
            ×
          </button>
        </DialogContent>
      </Dialog>
      <UnsavedChangesDialog {...guard.prompt} />
    </>
  )
}

describe("useUnsavedGuard", () => {
  it("closes immediately when the draft matches the baseline", async () => {
    const user = userEvent.setup()
    render(<DirtyEditor initial="Reggie's" />)
    await user.click(screen.getByRole("button", { name: "Close" }))
    expect(screen.getByText("editor closed")).toBeInTheDocument()
    expect(screen.queryByText("Unsaved changes")).not.toBeInTheDocument()
  })

  it("prompts when closing a dirty editor", async () => {
    const user = userEvent.setup()
    render(<DirtyEditor initial="" />)
    await user.type(screen.getByLabelText("Draft"), "SHOW")
    await user.click(screen.getByRole("button", { name: "Close" }))
    expect(screen.getByText("Unsaved changes")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Save changes" })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Cancel" })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Exit without saving" })).toBeInTheDocument()
  })

  it("Save changes persists then closes", async () => {
    const user = userEvent.setup()
    const onPersist = vi.fn()
    render(<DirtyEditor initial="" onPersist={onPersist} />)
    await user.type(screen.getByLabelText("Draft"), "Wilmington")
    await user.click(screen.getByRole("button", { name: "Close" }))
    await user.click(screen.getByRole("button", { name: "Save changes" }))
    expect(onPersist).toHaveBeenCalledWith("Wilmington")
    expect(screen.getByText("editor closed")).toBeInTheDocument()
  })

  it("Cancel stays in the editor with the draft", async () => {
    const user = userEvent.setup()
    render(<DirtyEditor initial="" />)
    await user.type(screen.getByLabelText("Draft"), "keep me")
    await user.click(screen.getByRole("button", { name: "Close" }))
    await user.click(screen.getByRole("button", { name: "Cancel" }))
    expect(screen.queryByText("editor closed")).not.toBeInTheDocument()
    expect(screen.getByLabelText("Draft")).toHaveValue("keep me")
    expect(screen.queryByText("Unsaved changes")).not.toBeInTheDocument()
  })

  it("Exit without saving discards and closes", async () => {
    const user = userEvent.setup()
    const onPersist = vi.fn()
    render(<DirtyEditor initial="original" onPersist={onPersist} />)
    await user.clear(screen.getByLabelText("Draft"))
    await user.type(screen.getByLabelText("Draft"), "gone")
    await user.click(screen.getByRole("button", { name: "Close" }))
    await user.click(screen.getByRole("button", { name: "Exit without saving" }))
    expect(onPersist).not.toHaveBeenCalled()
    expect(screen.getByText("editor closed")).toBeInTheDocument()
  })
})
