/**
 * Attribute editor — schema/value helpers and editors.
 */
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { resetLocalStorage } from "@/tests/test-utils"
import {
  AttributeSchemaEditor,
  AttributeValuesEditor,
  formatAttributeValue,
  mergeListAttributes,
} from "./attribute-editor"
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
})

describe("AttributeValuesEditor", () => {
  it("renders fields for each definition", () => {
    const defs: AttributeDefinition[] = [{ id: "title", name: "Title", type: "string" }]
    render(<AttributeValuesEditor definitions={defs} values={{}} onChange={vi.fn()} />)
    expect(screen.getByText("Title")).toBeInTheDocument()
  })
})
