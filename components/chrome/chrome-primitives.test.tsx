import { readFileSync } from "node:fs"
import { join } from "node:path"
import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"

import { CrtWell, Fascia, Keycap, Nameplate } from "."

describe("chrome primitives", () => {
  it("keycap opts out of the Win95 button skin and names its plastic", () => {
    render(<Keycap plastic="mod">Sort</Keycap>)
    const key = screen.getByRole("button", { name: "Sort" })
    expect(key).toHaveClass("b2-keycap")
    expect(key).toHaveAttribute("data-no95")
    expect(key).toHaveAttribute("data-plastic", "mod")
    expect(key).toHaveAttribute("type", "button")
  })

  it("silver is the default and sets no plastic", () => {
    render(<Keycap>Add</Keycap>)
    expect(screen.getByRole("button", { name: "Add" })).not.toHaveAttribute("data-plastic")
  })

  it("a latched key reports on or off, and a word key that stays on is pressed", () => {
    render(
      <>
        <Keycap latched>Week</Keycap>
        <Keycap latched={false}>Day</Keycap>
        <Keycap on>Show</Keycap>
      </>,
    )
    expect(screen.getByRole("button", { name: "Week" })).toHaveAttribute("data-latch", "on")
    expect(screen.getByRole("button", { name: "Day" })).toHaveAttribute("data-latch", "off")
    expect(screen.getByRole("button", { name: "Show" })).toHaveAttribute("aria-pressed", "true")
  })

  it("fascia, CRT well and nameplate render as the element asked for", () => {
    render(
      <Fascia as="section" finish="mill" aria-label="Bay">
        <Nameplate as="h3" lamp="on" face="smooth">
          Week 47
        </Nameplate>
        <CrtWell size="small">12</CrtWell>
      </Fascia>,
    )
    const bay = screen.getByRole("region", { name: "Bay" })
    expect(bay).toHaveClass("b2-fascia")
    expect(bay).toHaveAttribute("data-finish", "mill")
    const plate = screen.getByRole("heading", { name: "Week 47" })
    expect(plate).toHaveClass("b2-nameplate")
    expect(plate).toHaveAttribute("data-lamp", "on")
    expect(plate).toHaveAttribute("data-face", "smooth")
    expect(screen.getByText("12")).toHaveClass("b2-crt")
  })

  it("paints only from the shared tokens, never the raw phosphor or scope", () => {
    const css = readFileSync(join(process.cwd(), "components/chrome/chrome-primitives.css"), "utf8")
    expect(css).not.toMatch(/#7dffc4|#070c0a|#2a2c2e|125,\s*255,\s*196/i)
  })
})

describe("chrome tokens", () => {
  it("define the shared metal once, on :root", () => {
    const tokens = readFileSync(join(process.cwd(), "app/chrome-tokens.css"), "utf8")
    for (const name of ["--crt-phosphor", "--crt-scope", "--plate-ink", "--mill-lines-16", "--key-gloss", "--keycap-top", "--fascia-key-face", "--fascia-crt-glass"]) {
      expect(tokens).toContain(`${name}:`)
    }
    const win = readFileSync(join(process.cwd(), "app/win95.css"), "utf8")
    expect(win).not.toMatch(/^:root\s*\{/m)
  })
})
