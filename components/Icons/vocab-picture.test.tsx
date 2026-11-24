import { render } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import { VocabPicture } from "@/components/Icons/vocab-picture"
import { VOCAB_PICTURE_NAMES, isVocabPictureName } from "@/lib/vocab/pictures"
import { DE_BANK } from "@/lib/vocab/de"
import { ES_BANK } from "@/lib/vocab/es"
import { FR_BANK } from "@/lib/vocab/fr"
import { IT_BANK } from "@/lib/vocab/it"
import { JA_BANK } from "@/lib/vocab/ja"
import { ZH_BANK } from "@/lib/vocab/zh"

describe("VocabPicture", () => {
  it("draws an svg for every picture name", () => {
    for (const name of VOCAB_PICTURE_NAMES) {
      const { container, unmount } = render(<VocabPicture name={name} />)
      expect(container.querySelector("svg"), name).not.toBeNull()
      unmount()
    }
  })

  it("draws nothing for an unknown name", () => {
    const { container } = render(<VocabPicture name="not-a-picture" />)
    expect(container.innerHTML).toBe("")
  })

  it("every bank picture is a known name, never an emoji", () => {
    for (const bank of [DE_BANK, ES_BANK, FR_BANK, IT_BANK, JA_BANK, ZH_BANK]) {
      for (const entries of Object.values(bank)) {
        for (const e of entries ?? []) {
          if (e.picture !== undefined) expect(isVocabPictureName(e.picture), `${e.word}: ${e.picture}`).toBe(true)
        }
      }
    }
  })
})
