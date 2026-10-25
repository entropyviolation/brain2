/**
 * ItemPicker — search, single choice, and a cap when the catalog is long.
 */
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { useState } from "react"
import { describe, expect, it, vi } from "vitest"
import { ItemPicker, type ItemChoice } from "./item-picker"

function choice(id: string, title: string): ItemChoice {
  return { id, title }
}

function Controlled({ choices, mode = "single" }: { choices: ItemChoice[]; mode?: "single" | "multi" }) {
  const [selected, setSelected] = useState<string[]>([])
  return <ItemPicker choices={choices} selected={selected} onChange={setSelected} mode={mode} />
}

describe("ItemPicker", () => {
  const choices = [choice("a", "Pack books"), choice("b", "Buy milk")]

  it("filters by the search and reports a single id", async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(<ItemPicker choices={choices} selected={[]} onChange={onChange} mode="single" />)
    await user.type(screen.getByRole("textbox", { name: "Search items" }), "milk")
    expect(screen.getByRole("button", { name: "Buy milk" })).toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "Pack books" })).not.toBeInTheDocument()
    await user.click(screen.getByRole("button", { name: "Buy milk" }))
    expect(onChange).toHaveBeenCalledWith(["b"])
  })

  it("ticks several items in multi mode", async () => {
    const user = userEvent.setup()
    render(<Controlled choices={choices} mode="multi" />)
    await user.click(screen.getByRole("checkbox", { name: "Pack books" }))
    await user.click(screen.getByRole("checkbox", { name: "Buy milk" }))
    expect(screen.getByText("Selected (2)")).toBeInTheDocument()
  })

  it("asks for more typing instead of drawing the whole catalog", () => {
    const many = Array.from({ length: 80 }, (_, i) => choice(`id-${i}`, `Item ${String(i).padStart(3, "0")}`))
    render(<ItemPicker choices={many} selected={[]} onChange={vi.fn()} />)
    expect(screen.getByText(/more — keep typing/)).toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "Item 079" })).not.toBeInTheDocument()
  })
})
