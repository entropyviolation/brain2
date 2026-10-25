/**
 * Attribute editor — schema/value helpers and editors.
 */
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { resetAllStores, resetLocalStorage } from "@/tests/test-utils"
import { useTaskStore } from "@/lib/task-store"
import {
  AttributeSchemaEditor,
  AttributeValuesEditor,
  formatAttributeValue,
  mergeListAttributes,
} from "./attribute-editor"
import { TypeSpecificSchemaFields } from "./attributes/AttributeSchemaEditor"
import type { AttributeDefinition, List } from "@/lib/types"

const sampleCategories: List[] = [
  {
    id: "cat-a",
    name: "Reading",
    color: "#3B82F6",
    description: "",
    createdAt: new Date(),
    itemAttributes: [
      { id: "author", name: "Author", type: "string" },
      { id: "done", name: "Finished", type: "boolean" },
    ],
  },
  {
    id: "cat-b",
    name: "Other",
    color: "#EF4444",
    description: "",
    createdAt: new Date(),
    itemAttributes: [{ id: "author", name: "Author", type: "string" }],
  },
]

describe("attribute-editor helpers", () => {
  beforeEach(() => {
    resetLocalStorage()
  })

  it("mergeListAttributes deduplicates by id across lists", () => {
    const merged = mergeListAttributes(sampleCategories, ["cat-a", "cat-b"])
    expect(merged).toHaveLength(2)
    expect(merged.map((d) => d.id).sort()).toEqual(["author", "done"])
  })

  it("formatAttributeValue renders booleans as Yes/No", () => {
    const def: AttributeDefinition = { id: "done", name: "Done", type: "boolean" }
    expect(formatAttributeValue(def, true)).toBe("Yes")
    expect(formatAttributeValue(def, false)).toBe("No")
  })
})

describe("AttributeSchemaEditor", () => {
  it("renders empty state", () => {
    render(<AttributeSchemaEditor value={[]} onChange={vi.fn()} />)
    expect(screen.getByText(/No attributes/)).toBeInTheDocument()
    expect(screen.getByRole("button", { name: /Add attribute/i })).toBeInTheDocument()
  })

  it("calls onChange when adding an attribute", async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(<AttributeSchemaEditor value={[]} onChange={onChange} />)
    await user.click(screen.getByRole("button", { name: /Add attribute/i }))
    expect(onChange).toHaveBeenCalledWith([
      expect.objectContaining({ name: "New attribute", type: "string" }),
    ])
  })

  it("does not ask an item reference to pick a list first", () => {
    render(
      <TypeSpecificSchemaFields
        def={{ id: "host", name: "Host", type: "item" }}
        onPatch={vi.fn()}
      />,
    )
    expect(screen.queryByRole("textbox", { name: "Scope list" })).not.toBeInTheDocument()
  })

  it("shows the chosen scope list above the search", async () => {
    resetAllStores()
    useTaskStore.getState().addList({
      id: "reading",
      name: "Reading",
      color: "#3B82F6",
      description: "",
      createdAt: new Date(),
      order: 0,
    })
    const user = userEvent.setup()
    const onPatch = vi.fn()
    const { rerender } = render(
      <TypeSpecificSchemaFields def={{ id: "pack", name: "Packing", type: "list" }} onPatch={onPatch} />,
    )
    await user.click(screen.getByRole("button", { name: "Reading" }))
    expect(onPatch).toHaveBeenCalledWith({ refListId: "reading" })
    rerender(
      <TypeSpecificSchemaFields
        def={{ id: "pack", name: "Packing", type: "list", refListId: "reading" }}
        onPatch={onPatch}
      />,
    )
    expect(screen.getByRole("button", { name: "Remove Reading" })).toBeInTheDocument()
  })

  it("picks a list reference scope from the searchable list picker", async () => {
    const user = userEvent.setup()
    const onPatch = vi.fn()
    render(
      <TypeSpecificSchemaFields
        def={{ id: "pack", name: "Packing", type: "list" }}
        onPatch={onPatch}
      />,
    )
    expect(screen.getByRole("button", { name: "Any list" })).toBeInTheDocument()
    expect(screen.getByRole("textbox", { name: "Scope list" })).toBeInTheDocument()
    await user.click(screen.getByRole("button", { name: "Any list" }))
    expect(onPatch).toHaveBeenCalledWith({ refListId: undefined })
  })

  it("single mode hides add/remove chrome for the column-header popup", () => {
    render(
      <AttributeSchemaEditor
        value={[{ id: "actualSec", name: "Actual", type: "number", unit: "s" }]}
        onChange={vi.fn()}
        single
      />,
    )
    expect(screen.getByDisplayValue("Actual")).toBeInTheDocument()
    expect(screen.queryByRole("button", { name: /Add attribute/i })).not.toBeInTheDocument()
  })
})

describe("AttributeValuesEditor", () => {
  it("renders fields for each definition", () => {
    const defs: AttributeDefinition[] = [{ id: "title", name: "Title", type: "string" }]
    render(<AttributeValuesEditor definitions={defs} values={{}} onChange={vi.fn()} />)
    expect(screen.getByText("Title")).toBeInTheDocument()
  })
})
