import { fireEvent, render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import { CycleEncyclopedia } from "./cycle-encyclopedia"

describe("CycleEncyclopedia", () => {
  it("scrolls a contents entry to its chapter heading", () => {
    render(
      <CycleEncyclopedia
        tone="tcm"
        lensLabel="Chinese medicine"
        sources={[{ id: "suwen", citation: "Suwen, treatise 1" }]}
        chapters={[
          {
            id: "vessels",
            title: "Vessels",
            entries: [
              {
                id: "chong",
                title: "Chong and Ren",
                paragraphs: ["The sea of blood fills and empties."],
                sourceIds: ["suwen"],
              },
            ],
          },
          {
            id: "movements",
            title: "Four movements",
            entries: [
              {
                id: "open",
                title: "Opening",
                paragraphs: ["The period opens the cycle."],
                sourceIds: ["absent"],
              },
            ],
          },
        ]}
      />,
    )

    fireEvent.click(screen.getByRole("link", { name: "Four movements" }))
    expect(screen.getByRole("heading", { level: 4, name: "Four movements" })).toBeInTheDocument()
    expect(screen.getByRole("link", { name: "Four movements" })).toHaveAttribute("aria-current", "true")
    expect(screen.getByRole("img", { name: /Five phases/ })).toBeInTheDocument()
  })

  it("omits the five-phases plate on the clinical tone", () => {
    render(
      <CycleEncyclopedia
        tone="clinical"
        lensLabel="Clinical"
        sources={[{ id: "fehring-2006", citation: "Fehring 2006" }]}
        chapters={[
          {
            id: "ovarian",
            title: "The ovarian cycle",
            entries: [
              {
                id: "days",
                title: "The days before ovulation vary",
                paragraphs: ["The stretch before ovulation moves."],
                sourceIds: ["fehring-2006"],
              },
            ],
          },
        ]}
      />,
    )

    expect(screen.getByRole("article", { name: "Clinical" })).toHaveClass("cycle-encyclopedia-clinical")
    expect(screen.queryByRole("img", { name: /Five phases/ })).not.toBeInTheDocument()
  })
})
