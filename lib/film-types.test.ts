import { describe, expect, it } from "vitest"
import type { List } from "@/lib/types"
import {
  FILM_TYPE_ID,
  ensureFilmTypeOnFilmsLists,
  getFilmTypeDefinition,
  withFilmType,
  withFilmTypeOnList,
} from "@/lib/film-types"

describe("withFilmType", () => {
  it("appends Film when missing and is idempotent", () => {
    const once = withFilmType([])
    expect(once.some((t) => t.id === FILM_TYPE_ID)).toBe(true)
    expect(withFilmType(once)).toBe(once)
  })

  it("ships catalog metadata", () => {
    const def = getFilmTypeDefinition()
    expect(def.name).toBe("Film")
    expect(def.kind).toBe("catalog")
    expect(def.attributes?.some((a) => a.id === "poster")).toBe(true)
  })
})

describe("ensureFilmTypeOnFilmsLists", () => {
  const films: List = {
    id: "films-1",
    name: "Films",
    color: "#f80",
    createdAt: new Date("2026-01-01"),
  }

  it("assigns film type to Films by name", () => {
    const next = ensureFilmTypeOnFilmsLists([films])
    expect(next[0].itemTypeId).toBe(FILM_TYPE_ID)
    expect(next[0].itemTypeIds).toEqual([FILM_TYPE_ID])
  })

  it("is idempotent", () => {
    const once = withFilmTypeOnList(films)
    expect(withFilmTypeOnList(once)).toBe(once)
  })

  it("patches by filmsCategoryId", () => {
    const other: List = { ...films, id: "xyz", name: "My shelf" }
    const next = ensureFilmTypeOnFilmsLists([other], ["xyz"])
    expect(next[0].itemTypeId).toBe(FILM_TYPE_ID)
  })
})
