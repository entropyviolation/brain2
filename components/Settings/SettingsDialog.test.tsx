import { fireEvent, render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it } from "vitest"
import { SettingsDialog } from "@/components/Settings/SettingsDialog"
import { resetAllStores } from "@/tests/test-utils"

function bayIds(): string[] {
  const body = document.getElementById("settings-body")
  expect(body).toBeTruthy()
  return [...body!.querySelectorAll("[data-settings-section]")].map(
    (node) => (node as HTMLElement).dataset.settingsSection ?? "",
  )
}

describe("Settings dialog body", () => {
  beforeEach(() => {
    resetAllStores()
  })

  it("renders only the selected bay in the scroll well", async () => {
    const user = userEvent.setup()
    render(<SettingsDialog />)
    await user.click(screen.getByRole("button", { name: "Settings" }))

    expect(bayIds()).toEqual(["settings-friend"])
    expect(document.getElementById("settings-home")).toBeNull()
    expect(document.getElementById("settings-points")).toBeNull()

    await user.click(screen.getByRole("button", { name: "Birthday" }))
    expect(bayIds()).toEqual(["settings-birthday"])
    expect(document.getElementById("settings-friend")).toBeNull()

    await user.click(screen.getByRole("button", { name: "You" }))
    expect(bayIds()).toEqual(["settings-friend"])

    fireEvent.change(screen.getByRole("searchbox"), { target: { value: "inbox" } })
    expect(bayIds()).toEqual(["settings-points"])
    expect(await screen.findByRole("button", { name: "Points rules" })).toBeInTheDocument()
    expect(document.getElementById("settings-birthday")).toBeNull()

    fireEvent.change(screen.getByRole("searchbox"), { target: { value: "" } })
    expect(bayIds()).toEqual(["settings-points"])
    expect(screen.getByRole("button", { name: "Baby animal friend" })).toBeInTheDocument()
    expect(document.getElementById("settings-friend")).toBeNull()
  })
})
