import { describe, it, expect } from "vitest"
import { buildModuleTemplate, MODULE_TEMPLATES } from "./module-templates"

describe("buildModuleTemplate", () => {
  it("exposes the expected templates", () => {
    expect(MODULE_TEMPLATES.map((t) => t.id)).toEqual([
      "itinerary",
      "cleaning",
      "budget",
      "book-tasting",
      "filmrecs",
      "blank",
    ])
  })

  it("builds a coherent itinerary workspace", () => {
    const built = buildModuleTemplate("itinerary", 1)
    expect(built.module.kind).toBe("workspace")
    expect(built.module.templateId).toBe("itinerary")
    expect(built.module.enablePrint).toBe(true)
    expect(built.module.config.tripItinerary?.days?.length).toBeGreaterThan(0)
    expect(built.module.config.itineraryUiVersion).toBe(3)
    // every view that needs a list points at a real category in this template.
    const catIds = new Set(built.lists.map((c) => c.id))
    for (const v of built.module.views ?? []) {
      if (v.config.categoryId) expect(catIds.has(v.config.categoryId)).toBe(true)
    }
    // seed tasks reference real categories (note docs have empty lists).
    for (const t of built.seedTasks) {
      t.lists.forEach((cid) => expect(catIds.has(cid)).toBe(true))
    }
  })

  it("generates unique ids per template instance", () => {
    const a = buildModuleTemplate("budget", 1)
    const b = buildModuleTemplate("budget", 2)
    expect(a.module.id).not.toBe(b.module.id)
    expect(a.lists[0].id).not.toBe(b.lists[0].id)
  })

  it("budget summary views reference attributes that exist on their source list", () => {
    const built = buildModuleTemplate("budget", 3)
    for (const v of built.module.views ?? []) {
      if (v.kind !== "summary") continue
      const cat = built.lists.find((c) => c.id === v.config.categoryId)!
      const attrIds = new Set((cat.itemAttributes ?? []).map((a) => a.id))
      if (v.config.groupAttrId) expect(attrIds.has(v.config.groupAttrId)).toBe(true)
      if (v.config.valueAttrId) expect(attrIds.has(v.config.valueAttrId)).toBe(true)
    }
  })

  it("cleaning workspace includes a randomizer, timer, notes, and a systems list", () => {
    const built = buildModuleTemplate("cleaning", 4)
    const kinds = (built.module.views ?? []).map((v) => v.kind)
    expect(kinds).toContain("randomizer")
    expect(kinds).toContain("timer")
    expect(kinds).toContain("notes")
    expect(built.lists.some((c) => c.name === "Systems")).toBe(true)
    // Gamification workflow present.
    expect((built.workflows ?? []).length).toBeGreaterThan(0)
  })

  it("itinerary ships self-contained days + doc + trip-map (no Costs/Flights tabs)", () => {
    const built = buildModuleTemplate("itinerary", 7)
    const kinds = (built.module.views ?? []).map((v) => v.kind)
    const titles = (built.module.views ?? []).map((v) => v.title)
    expect(kinds).toContain("doc")
    expect(kinds).toContain("itinerary-doc")
    expect(kinds).toContain("trip-map")
    expect(titles).not.toContain("Costs")
    expect(titles).not.toContain("Flights")
    expect(titles).not.toContain("Entries")
    expect(built.module.config.planDocId).toBeTruthy()
    expect(built.module.config.itineraryUiVersion).toBe(3)
    expect(built.module.config.tripItinerary?.startDate).toBe("2026-07-10")
    expect(built.module.config.tripItinerary?.days.some((d) => d.cityMode === "travel")).toBe(true)
    expect(built.lists.some((c) => c.name === "City Places")).toBe(true)
    expect(built.seedTasks.some((t) => t.id === built.module.config.planDocId)).toBe(true)
  })

  it("budget ships a dashboard whose cards reference real lists + numeric attributes", () => {
    const built = buildModuleTemplate("budget", 8)
    const dash = (built.module.views ?? []).find((v) => v.kind === "dashboard")!
    expect(dash).toBeTruthy()
    const cards = dash.config.cards ?? []
    expect(cards.length).toBeGreaterThanOrEqual(4)
    const catById = new Map(built.lists.map((c) => [c.id, c]))
    for (const card of cards) {
      const cat = catById.get(card.categoryId)
      expect(cat).toBeTruthy()
      const numIds = new Set((cat!.itemAttributes ?? []).map((a) => a.id))
      expect(numIds.has(card.attrId)).toBe(true)
      if (card.includeAttrId) expect(numIds.has(card.includeAttrId)).toBe(true)
      if (card.subtract) {
        const subCat = catById.get(card.subtract.categoryId)
        expect(subCat).toBeTruthy()
        const subIds = new Set((subCat!.itemAttributes ?? []).map((a) => a.id))
        expect(subIds.has(card.subtract.attrId)).toBe(true)
      }
    }
    // The net-worth card subtracts debts from assets (optional-inclusion gated).
    expect(cards.some((c) => c.subtract)).toBe(true)
  })

  it("builds a book-tasting workspace with matcher + quiz + sample books and PDFs", () => {
    const built = buildModuleTemplate("book-tasting", 9)
    expect(built.module.templateId).toBe("book-tasting")
    const views = built.module.views ?? []
    const matcher = views.find((v) => v.kind === "matcher")!
    const quiz = views.find((v) => v.kind === "quiz")!
    expect(matcher).toBeTruthy()
    expect(quiz).toBeTruthy()

    const catIds = new Set(built.lists.map((c) => c.id))
    // matcher links PDFs → books.
    expect(catIds.has(matcher.config.categoryId!)).toBe(true)
    expect(catIds.has(matcher.config.matchTargetCategoryId!)).toBe(true)
    // quiz draws prompts from the PDF list.
    expect(catIds.has(quiz.config.quizSourceCategoryId!)).toBe(true)

    const books = built.lists.find((c) => c.name === "Reading List")!
    const pdfs = built.lists.find((c) => c.name === "PDF Shelf")!
    const bookItems = built.seedTasks.filter((t) => t.lists.includes(books.id))
    const pdfItems = built.seedTasks.filter((t) => t.lists.includes(pdfs.id))
    expect(bookItems.length).toBeGreaterThanOrEqual(4)
    expect(pdfItems.length).toBeGreaterThanOrEqual(3)
    // Seeded PDFs carry extracted text so the quiz/matcher work immediately.
    const withText = pdfItems.filter((t) => {
      const f = t.attributes?.file as { extractedText?: string } | undefined
      return !!f?.extractedText
    })
    expect(withText.length).toBeGreaterThanOrEqual(3)

    // The "on PDF added → match, else throw" workflow is seeded + scoped to PDFs.
    const wf = (built.workflows ?? [])[0]
    expect(wf.actions.some((a) => a.kind === "throw")).toBe(true)
    expect(wf.scope?.listIds).toContain(pdfs.id)
  })

  it("builds a filmrecs workspace with Film DNA view + seeded catalog", () => {
    const built = buildModuleTemplate("filmrecs", 12)
    expect(built.module.templateId).toBe("filmrecs")
    expect(built.module.config.filmsCategoryId).toBeTruthy()
    const kinds = (built.module.views ?? []).map((v) => v.kind)
    expect(kinds).toContain("film-dna")
    expect(kinds).toContain("spreadsheet")
    expect(kinds).toContain("gallery")
    const films = built.lists.find((c) => c.name === "Films")!
    expect(films).toBeTruthy()
    expect(films.itemAttributes?.some((a) => a.id === "poster" && a.type === "image")).toBe(true)
    expect(built.seedTasks.length).toBeGreaterThan(50)
    expect(built.seedTasks.every((t) => t.lists.includes(films.id))).toBe(true)
    const liked = built.seedTasks.filter((t) => t.attributes?.liked === true)
    expect(liked.length).toBeGreaterThan(20)
  })

  it("every view + workflow across all templates references real categories", () => {
    for (const meta of MODULE_TEMPLATES) {
      const built = buildModuleTemplate(meta.id, 11)
      const catIds = new Set(built.lists.map((c) => c.id))
      for (const v of built.module.views ?? []) {
        for (const id of [v.config.categoryId, v.config.matchTargetCategoryId, v.config.quizSourceCategoryId]) {
          if (id) expect(catIds.has(id)).toBe(true)
        }
        for (const card of v.config.cards ?? []) {
          expect(catIds.has(card.categoryId)).toBe(true)
          if (card.subtract) expect(catIds.has(card.subtract.categoryId)).toBe(true)
        }
      }
      for (const w of built.workflows ?? []) {
        for (const cid of w.scope?.listIds ?? []) expect(catIds.has(cid)).toBe(true)
        expect(w.moduleId).toBe(built.module.id)
      }
    }
  })
})
