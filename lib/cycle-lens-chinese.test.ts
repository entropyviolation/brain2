import { describe, expect, it } from "vitest"
import type { CyclePhase } from "./cycle-phase"
import {
  CHINESE_LENS_LINE,
  chineseEncyclopedia,
  chineseLensSections,
  tcmSources,
  type LensSectionId,
} from "./cycle-lens-chinese"

const PHASES: readonly CyclePhase[] = ["menstrual", "follicular", "ovulatory", "luteal", "unknown"]
const SECTION_IDS: readonly LensSectionId[] = [
  "physiology",
  "typical",
  "worth-doing",
  "worth-not-doing",
]
const SECTION_TITLES = ["The phase", "What's typical", "Worth doing", "Worth not doing"] as const
const CJK = /[\u3400-\u9fff]/
const PINYIN_PAREN = /\([^)]*[āáǎàēéěèīíǐìōóǒòūúǔùǖǘǚǜ][^)]*\)/

describe("cycle-lens-chinese", () => {
  it("keeps four short sections on every phase", () => {
    expect(CHINESE_LENS_LINE).toMatch(/traditional reading/i)
    expect(CHINESE_LENS_LINE).toMatch(/Not a prescription/)
    expect(CHINESE_LENS_LINE).toMatch(/not a diagnosis/i)
    for (const phase of PHASES) {
      const sections = chineseLensSections[phase]
      expect(sections).toHaveLength(4)
      expect(sections.map((section) => section.id)).toEqual([...SECTION_IDS])
      expect(sections.map((section) => section.title)).toEqual([...SECTION_TITLES])
      for (const section of sections) {
        expect(section.paragraphs.length).toBeGreaterThanOrEqual(1)
        expect(section.paragraphs.length).toBeLessThanOrEqual(2)
        const body = section.paragraphs.join("\n")
        if (CJK.test(body)) expect(body).toMatch(PINYIN_PAREN)
      }
      expect(sections[3]?.paragraphs.join(" ")).toMatch(/practitioner who can see the person/)
    }
  })

  it("resolves every source and herb, and shows pinyin in a title", () => {
    const sourceIds = new Set(tcmSources.map((source) => source.id))
    expect(sourceIds.size).toBe(tcmSources.length)
    const titles: string[] = []
    expect(chineseEncyclopedia.length).toBeGreaterThan(0)
    for (const chapter of chineseEncyclopedia) {
      expect(chapter.id.length).toBeGreaterThan(0)
      expect(chapter.entries.length).toBeGreaterThan(0)
      titles.push(chapter.title)
      for (const entry of chapter.entries) {
        titles.push(entry.title)
        expect(entry.paragraphs.length).toBeGreaterThan(0)
        expect(entry.sourceIds.length).toBeGreaterThan(0)
        for (const sourceId of entry.sourceIds) expect(sourceIds.has(sourceId)).toBe(true)
        const body = `${entry.title}\n${entry.paragraphs.join("\n")}`
        if (CJK.test(body)) expect(body).toMatch(PINYIN_PAREN)
        for (const herb of entry.herbs ?? []) {
          expect(herb.chinese.length).toBeGreaterThan(0)
          expect(herb.name.length).toBeGreaterThan(0)
          expect(herb.traditionalRole.length).toBeGreaterThan(0)
          expect(herb.pinyin).toMatch(/[āáǎàēéěèīíǐìōóǒòūúǔùǖǘǚǜ]/)
          expect(sourceIds.has(herb.sourceId)).toBe(true)
          expect(entry.sourceIds).toContain(herb.sourceId)
          expect(herb.traditionalRole).not.toMatch(/\d+\s*(g|gram|grams|qian|錢|钱)\b/i)
          expect(herb.traditionalRole.toLowerCase()).not.toMatch(/take this|\bdecoct\b|水煎/)
        }
      }
    }
    expect(titles.some((title) => PINYIN_PAREN.test(title))).toBe(true)
  })
})
