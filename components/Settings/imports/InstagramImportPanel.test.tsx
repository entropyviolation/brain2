/**
 * components/Settings/InstagramImportPanel.test.tsx — Steps and the shared importer
 */
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it } from "vitest"
import { InstagramImportPanel } from "@/components/Settings/InstagramImportPanel"
import { IG_USERNAME } from "@/lib/instagram-export"
import { findInstagramFollowersList, findInstagramFollowingList } from "@/lib/instagram-lists"
import { useTaskStore } from "@/lib/task-store"
import { resetAllStores } from "@/tests/test-utils"

function exportFile(name: string, body: unknown) {
  return new File([JSON.stringify(body)], name, { type: "application/json" })
}

function person(username: string) {
  return {
    title: "",
    string_list_data: [{ href: `https://www.instagram.com/${username}`, value: username, timestamp: 10 }],
  }
}

describe("InstagramImportPanel", () => {
  beforeEach(() => {
    resetAllStores()
  })

  it("states the download steps", () => {
    render(<InstagramImportPanel />)
    const section = screen.getByTestId("instagram-import-settings")
    expect(screen.getByRole("heading", { name: "Import from Instagram data" })).toBeInTheDocument()
    expect(section.textContent).toContain("Settings and activity")
    expect(section.textContent).toContain("Your activity")
    expect(section.textContent).toContain("Download your information")
    expect(section.textContent).toContain("Followers and following")
    expect(section.textContent).toContain("connections/followers_and_following/")
    expect(section.textContent).toContain("followers_and_following/")
    expect(section.textContent).toContain("This app does not unzip")
    expect(section.textContent).toContain("does not ask for a password")
    expect(section.textContent).toContain("Follower count is not in the official file")
  })

  it("writes a following file through the existing importer and names the blank side", async () => {
    const user = userEvent.setup()
    render(<InstagramImportPanel />)
    await user.upload(
      screen.getByLabelText("Instagram files"),
      exportFile("following.json", { relationships_following: [person("ada")] }),
    )
    expect(
      await screen.findByText(
        "Extracted 1 following row and 0 follower rows. Added 1. Updated 0. Follows me back stays blank until a followers file is included.",
      ),
    ).toBeInTheDocument()
    expect(findInstagramFollowingList(useTaskStore.getState().lists)).toBeTruthy()
    expect(findInstagramFollowersList(useTaskStore.getState().lists)).toBeTruthy()
    expect(useTaskStore.getState().tasks.some((task) => task.attributes?.[IG_USERNAME] === "ada")).toBe(true)
  })
})
