import { fireEvent, render, screen } from "@testing-library/react"
import { beforeEach, describe, expect, it } from "vitest"
import { useLogKeywordsStore } from "@/lib/log-keywords-store"
import { LogKeywordsSettings } from "./log-keywords-settings"

describe("LogKeywordsSettings", () => {
  beforeEach(() => {
    localStorage.clear()
    useLogKeywordsStore.setState({ keywords: [] })
  })

  it("adds, renames, and removes a keyword", () => {
    render(<LogKeywordsSettings />)
    const field = screen.getByLabelText("New log keyword")
    expect(field).toBeInTheDocument()
    fireEvent.change(field, { target: { value: "went outside" } })
    fireEvent.click(screen.getByRole("button", { name: "Add keyword" }))
    expect(useLogKeywordsStore.getState().keywords).toEqual(["went outside"])
    expect(screen.getByLabelText("Edit went outside")).toHaveValue("went outside")

    const edit = screen.getByLabelText("Edit went outside")
    fireEvent.change(edit, { target: { value: "drank water" } })
    fireEvent.blur(edit)
    expect(useLogKeywordsStore.getState().keywords).toEqual(["drank water"])

    fireEvent.click(screen.getByRole("button", { name: "Remove" }))
    expect(useLogKeywordsStore.getState().keywords).toEqual([])
    expect(screen.getByLabelText("New log keyword")).toBeInTheDocument()
  })
})