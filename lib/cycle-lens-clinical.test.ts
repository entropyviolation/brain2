import { describe, expect, it } from "vitest"
import type { CyclePhase } from "./cycle-phase"
import {
  CLINICAL_EDUCATION_LINE,
  clinicalLensSections,
  clinicalReference,
  clinicalSources,
  type LensSectionId,
} from "./cycle-lens-clinical"

const PHASES: readonly CyclePhase[] = ["menstrual", "follicular", "ovulatory", "luteal", "unknown"]

const SECTION_IDS: readonly LensSectionId[] = ["physiology", "typical", "worth-doing", "worth-not-doing"]

const SECTION_TITLES = ["Physiology", "What's typical", "Worth doing", "Worth not doing"] as const

describe("clinical lens reference", () => {
  it("keeps the education line and four sections on every phase", () => {
    expect(CLINICAL_EDUCATION_LINE).toMatch(/not a diagnosis/)
    expect(CLINICAL_EDUCATION_LINE).toMatch(/fertility guarantee/)
    for (const phase of PHASES) {
      const sections = clinicalLensSections[phase]
      expect(sections.map((section) => section.id)).toEqual([...SECTION_IDS])
      expect(sections.map((section) => section.title)).toEqual([...SECTION_TITLES])
      for (const section of sections) {
        expect(section.paragraphs.length).toBeGreaterThanOrEqual(1)
        expect(section.paragraphs.length).toBeLessThanOrEqual(2)
        for (const paragraph of section.paragraphs) expect(paragraph.trim().length).toBeGreaterThan(0)
      }
    }
  })

  it("points every topic at a source that exists", () => {
    const sourceIds = new Set(clinicalSources.map((source) => source.id))
    expect(sourceIds.size).toBe(clinicalSources.length)
    const topicIds = new Set<string>()
    expect(clinicalReference.length).toBeGreaterThan(0)
    for (const chapter of clinicalReference) {
      expect(chapter.topics.length).toBeGreaterThan(0)
      for (const topic of chapter.topics) {
        expect(topicIds.has(topic.id)).toBe(false)
        topicIds.add(topic.id)
        expect(topic.paragraphs.length).toBeGreaterThan(0)
        expect(topic.sourceIds.length).toBeGreaterThan(0)
        for (const sourceId of topic.sourceIds) expect(sourceIds.has(sourceId)).toBe(true)
        for (const paragraph of topic.paragraphs) expect(paragraph.trim().length).toBeGreaterThan(0)
      }
    }
    for (const source of clinicalSources) {
      expect(source.citation.trim().length).toBeGreaterThan(0)
      expect(source.id.trim().length).toBeGreaterThan(0)
    }
  })
})
