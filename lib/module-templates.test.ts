import { describe, it, expect } from "vitest"
import { buildModuleTemplate, MODULE_TEMPLATES } from "./module-templates"

describe("buildModuleTemplate", () => {
  it("exposes the expected templates", () => {
    expect(MODULE_TEMPLATES.map((t) => t.id)).toEqual([
      "itinerary",
      "cleaning",
      "budget",
      "book-tasting",
      "blank",
    ])
  })

  it("builds a coherent itinerary workspace", () => {
    const built = buildModuleTemplate("itinerary", 1)
    expect(built.module.kind).toBe("workspace")
    expect(built.module.templateId).toBe("itinerary")
    expect(built.module.enablePrint).toBe(true)
    // plan-sync targets the trip-plan list + its date/status attributes.
    expect(built.module.planSync?.dateAttrId).toBe("day")
    expect(built.module.planSync?.statusValue).toBe("Finalized")
    expect(built.lists.some((c) => c.id === built.module.planSync?.categoryId)).toBe(true)
    // every view that needs a list points at a real category in this template.
    const catIds = new Set(built.lists.map((c) => c.id))
    for (const v of built.module.views ?? []) {
      if (v.config.categoryId) expect(catIds.has(v.config.categoryId)).toBe(true)
    }
    // seed tasks reference real categories.
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

  it("itinerary seeds flights with layovers/booking/cost and a timeline + schedule sync", () => {
    const built = buildModuleTemplate("itinerary", 7)
    const kinds = (built.module.views ?? []).map((v) => v.kind)
    expect(kinds).toContain("timeline")
    // Flights list seeded with structured flight data.
    const flightCat = built.lists.find((c) => c.name === "Flights")!
    const flightItems = built.seedTasks.filter((t) => t.lists.includes(flightCat.id))
    expect(flightItems.length).toBeGreaterThanOrEqual(2)
    expect(flightItems.some((f) => Array.isArray(f.attributes?.layovers))).toBe(true)
    expect(flightItems.some((f) => typeof f.attributes?.cost === "number")).toBe(true)
    expect(flightItems.some((f) => f.attributes?.bookingNumber)).toBe(true)
    // scheduleSync maps finalized dated activities onto the global timeline.
    expect(built.module.scheduleSync?.dateAttrId).toBe("day")
    expect(built.module.scheduleSync?.statusValue).toBe("Finalized")
    expect(built.lists.some((c) => c.id === built.module.scheduleSync?.categoryId)).toBe(true)
    // Finalized → sync workflow seeded.
    expect((built.workflows ?? []).some((w) => w.actions.some((a) => a.kind === "syncPlan"))).toBe(true)
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
