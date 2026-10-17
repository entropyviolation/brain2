import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { resetAllStores } from "@/tests/test-utils"
import type { AttributeDefinition, List } from "@/lib/types"
import { ItemAttributesSection } from "./ItemAttributesSection"
import { AttributeCreator } from "./AttributeCreator"

const readingList: List = {
  id: "reading",
  name: "Reading",
  color: "#3b82f6",
  createdAt: new Date("2026-01-01"),
  order: 0,
  scheduleable: true,
  itemAttributes: [{ id: "author", name: "Author", type: "string" }],
}

describe("ItemAttributesSection", () => {
  beforeEach(() => resetAllStores())

  it("creates an item-only attribute without touching list schema", async () => {
    const user = userEvent.setup()
    const onCreate = vi.fn()
    render(
      <ItemAttributesSection
        attributes={{ author: "Ada" }}
        itemCategoryIds={["reading"]}
        categories={[readingList]}
        itemAttributeDefinitions={[]}
        onChangeValues={vi.fn()}
        onChangeItemAttributeDefinitions={vi.fn()}
        onCreateAttribute={onCreate}
      />,
    )

    expect(screen.queryByPlaceholderText("e.g. ISBN")).not.toBeInTheDocument()
    await user.click(screen.getByRole("button", { name: /add attribute/i }))
    await user.type(screen.getByPlaceholderText("e.g. ISBN"), "ISBN")
    await user.click(screen.getByRole("button", { name: /^create$/i }))

    expect(onCreate).toHaveBeenCalledWith(
      expect.objectContaining({ name: "ISBN", type: "string" }),
      "",
      null,
    )
  })

  it("sends string keys live and commits once on blur", async () => {
    const user = userEvent.setup()
    const onChangeValues = vi.fn()
    const onLiveValue = vi.fn()
    render(
      <ItemAttributesSection
        attributes={{ author: "" }}
        itemCategoryIds={["reading"]}
        categories={[readingList]}
        onChangeValues={onChangeValues}
        onLiveValue={onLiveValue}
        onCreateAttribute={vi.fn()}
      />,
    )
    await user.type(screen.getByLabelText("Author"), "Ada")
    expect(onLiveValue).toHaveBeenCalledTimes(3)
    expect(onLiveValue).toHaveBeenLastCalledWith("author", "Ada")
    expect(onChangeValues).not.toHaveBeenCalled()
    await user.tab()
    expect(onChangeValues).toHaveBeenCalledTimes(1)
    expect(onChangeValues).toHaveBeenCalledWith(expect.objectContaining({ author: "Ada" }))
  })

  it("opens the creator above the attribute grid, not below it", async () => {
    const user = userEvent.setup()
    render(
      <ItemAttributesSection
        attributes={{ author: "Ada" }}
        itemCategoryIds={["reading"]}
        categories={[readingList]}
        onChangeValues={vi.fn()}
        onCreateAttribute={vi.fn()}
      />,
    )
    await user.click(screen.getByRole("button", { name: /add attribute/i }))
    const creator = screen.getByTestId("attribute-creator")
    const cell = screen.getByTestId("attr-cell-author")
    expect(creator.compareDocumentPosition(cell) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })

  it("labels each attribute with its type glyph and where it comes from", () => {
    render(
      <ItemAttributesSection
        attributes={{ author: "Ada" }}
        itemCategoryIds={["reading"]}
        categories={[readingList]}
        onChangeValues={vi.fn()}
        onCreateAttribute={vi.fn()}
      />,
    )
    const cell = screen.getByTestId("attr-cell-author")
    expect(cell).toHaveTextContent("Aa")
    expect(cell).toHaveTextContent("Reading")
    expect(screen.getByText("1/1")).toBeInTheDocument()
  })

  it("shows an empty-state sentence when nothing defines attributes", () => {
    render(
      <ItemAttributesSection
        attributes={{}}
        itemCategoryIds={[]}
        categories={[]}
        onChangeValues={vi.fn()}
        onCreateAttribute={vi.fn()}
      />,
    )
    expect(screen.getByText(/No attributes yet/)).toBeInTheDocument()
  })

  it("shows item-only definitions with typed editors", () => {
    const itemOnly: AttributeDefinition[] = [{ id: "isbn", name: "ISBN", type: "string" }]
    render(
      <ItemAttributesSection
        attributes={{ author: "Ada", isbn: "978-0" }}
        itemCategoryIds={["reading"]}
        categories={[readingList]}
        itemAttributeDefinitions={itemOnly}
        onChangeValues={vi.fn()}
        onChangeItemAttributeDefinitions={vi.fn()}
        onCreateAttribute={vi.fn()}
      />,
    )

    expect(screen.getByRole("button", { name: /remove isbn/i })).toBeInTheDocument()
    expect(screen.getByDisplayValue("978-0")).toBeInTheDocument()
  })

  it("hides attribute ids edited on another panel of the same view", () => {
    const itemOnly: AttributeDefinition[] = [
      { id: "birthday", name: "Birthday", type: "datetime", datetimeMode: "date" },
      { id: "notes", name: "Notes", type: "string" },
      { id: "city", name: "City", type: "string" },
    ]
    render(
      <ItemAttributesSection
        attributes={{ birthday: "1990-10-12", notes: "Soup", city: "London" }}
        itemCategoryIds={[]}
        categories={[]}
        itemAttributeDefinitions={itemOnly}
        omitAttributeIds={["birthday", "notes"]}
        onChangeValues={vi.fn()}
        onChangeItemAttributeDefinitions={vi.fn()}
        onCreateAttribute={vi.fn()}
      />,
    )

    expect(screen.queryByDisplayValue("1990-10-12")).not.toBeInTheDocument()
    expect(screen.queryByDisplayValue("Soup")).not.toBeInTheDocument()
    expect(screen.getByDisplayValue("London")).toBeInTheDocument()
    expect(screen.queryByRole("button", { name: /remove birthday/i })).not.toBeInTheDocument()
    expect(screen.getByRole("button", { name: /remove city/i })).toBeInTheDocument()
  })
})

describe("AttributeCreator", () => {
  it("creates a selection with its options from the type palette", async () => {
    const user = userEvent.setup()
    const onCreate = vi.fn()
    render(<AttributeCreator categories={[]} itemCategoryIds={[]} existingIds={[]} onCreate={onCreate} />)

    await user.click(screen.getByRole("radio", { name: /Selection/ }))
    expect(screen.getByText(/Pick one \(or several\)/)).toBeInTheDocument()
    await user.type(screen.getByPlaceholderText("e.g. ISBN"), "Status")
    const options = screen.getByText("Options (comma-separated)").parentElement!.querySelector("input")!
    await user.type(options, "to-read, reading, read")
    await user.tab()
    await user.click(screen.getByRole("button", { name: /^create$/i }))

    expect(onCreate).toHaveBeenCalledWith(
      expect.objectContaining({ name: "Status", type: "selection", options: ["to-read", "reading", "read"] }),
      "",
      null,
    )
  })

  it("offers file and file-list types", () => {
    render(<AttributeCreator categories={[]} itemCategoryIds={[]} existingIds={[]} onCreate={vi.fn()} />)
    expect(screen.getByRole("radio", { name: "File" })).toBeInTheDocument()
    expect(screen.getByRole("radio", { name: /File list/ })).toBeInTheDocument()
  })

  it("defaults to this item only when the item has no lists", async () => {
    const user = userEvent.setup()
    const onCreate = vi.fn()
    render(
      <AttributeCreator
        categories={[]}
        itemCategoryIds={[]}
        existingIds={[]}
        onCreate={onCreate}
      />,
    )

    await user.type(screen.getByPlaceholderText("e.g. ISBN"), "Secret note")
    await user.click(screen.getByRole("button", { name: /create/i }))

    expect(onCreate).toHaveBeenCalledWith(
      expect.objectContaining({ name: "Secret note" }),
      "",
      null,
    )
  })

  it("defaults to item-only and shows an add-to picker when lists exist", () => {
    render(
      <AttributeCreator
        categories={[readingList]}
        itemCategoryIds={["reading"]}
        existingIds={["author"]}
        onCreate={vi.fn()}
      />,
    )

    expect(screen.getByText("Add to")).toBeInTheDocument()
    expect(screen.getByText("Stored on just this item.")).toBeInTheDocument()
  })
})
