/**
 * lib/film-types.ts — Catalog **Film** item type
 *
 * Letterboxd / Film DNA rows: year, shelf, source, likes, rating, poster, etc.
 * Attribute ids match `FILM_ATTR` in `lib/filmrecs-types.ts` so Films-list
 * schemas and the Film type share one vocabulary. Catalog seed: registered if
 * missing; user edits persist.
 *
 * Pure + serializable. Wired via `withFilmType()` in `lib/item-types.ts`.
 */
import type { AttributeDefinition, ItemTypeDefinition, List } from "@/lib/types"
import { FILM_ATTR, FILMRECS_SHELVES } from "@/lib/filmrecs-types"
import { assignTypeToList } from "@/lib/list-item-types"

/** Stable item-type id. */
export const FILM_TYPE_ID = "film"

const FILM_ATTRIBUTES: AttributeDefinition[] = [
  { id: FILM_ATTR.year, name: "Year", type: "number", allowFloat: false },
  {
    id: FILM_ATTR.shelf,
    name: "Shelf",
    type: "selection",
    optionSource: "manual",
    options: [...FILMRECS_SHELVES],
  },
  {
    id: FILM_ATTR.source,
    name: "Source",
    type: "selection",
    optionSource: "manual",
    options: ["watchlist", "likes", "both", "watched", "added"],
  },
  { id: FILM_ATTR.liked, name: "Liked", type: "boolean", booleanDisplay: "checkbox" },
  { id: FILM_ATTR.favorited, name: "Favorited", type: "boolean", booleanDisplay: "checkbox" },
  { id: FILM_ATTR.rating, name: "Rating", type: "number", allowFloat: true },
  { id: FILM_ATTR.genres, name: "Genres", type: "multistring" },
  { id: FILM_ATTR.poster, name: "Poster", type: "image" },
  { id: FILM_ATTR.letterboxdUrl, name: "Letterboxd", type: "string" },
  { id: FILM_ATTR.overview, name: "Overview", type: "string" },
  { id: FILM_ATTR.watchedDate, name: "Watched", type: "string" },
]

/** The Film item-type definition (catalog seed; user-editable after first load). */
export function getFilmTypeDefinition(): ItemTypeDefinition {
  return {
    id: FILM_TYPE_ID,
    name: "Film",
    pluralName: "Films",
    itemLabel: "film",
    description:
      "A Letterboxd-style film record: poster, year, shelf, rating, and watch status. Not a task — no Schedule tab by default.",
    builtin: true,
    kind: "catalog",
    color: "#c2410c",
    attributes: FILM_ATTRIBUTES,
    defaultAttributeValues: {
      [FILM_ATTR.liked]: false,
      [FILM_ATTR.favorited]: false,
      [FILM_ATTR.source]: "watchlist",
    },
    displayedAttributes: [
      FILM_ATTR.year,
      FILM_ATTR.shelf,
      FILM_ATTR.source,
      FILM_ATTR.liked,
      FILM_ATTR.rating,
      FILM_ATTR.poster,
    ],
    detailPanels: ["details"],
    detailLayout: {
      heroImageAttrId: FILM_ATTR.poster,
      featuredAttributeIds: [FILM_ATTR.year, FILM_ATTR.rating, FILM_ATTR.shelf],
    },
    capabilities: {},
  }
}

export const FILM_TYPE_IDS = [FILM_TYPE_ID] as const

/** Append Film if missing (idempotent; preserves existing definition). */
export function withFilmType(existing: ItemTypeDefinition[]): ItemTypeDefinition[] {
  if (existing.some((t) => t.id === FILM_TYPE_ID)) return existing
  return [...existing, getFilmTypeDefinition()]
}

/**
 * Assign the Film catalog type as default + allowlist entry on a Films list.
 * Idempotent when already set.
 */
export function withFilmTypeOnList(list: List): List {
  if (list.itemTypeId === FILM_TYPE_ID && list.itemTypeIds?.includes(FILM_TYPE_ID)) return list
  return assignTypeToList(list, FILM_TYPE_ID, true)
}

/**
 * Patch Films lists (by Film DNA config id, exact name, or existing film default)
 * so they carry the Film type allowlist + default. Returns the same array when
 * nothing changes.
 */
export function ensureFilmTypeOnFilmsLists(
  lists: List[],
  filmsListIds: Iterable<string> = [],
): List[] {
  const wanted = new Set(
    [...filmsListIds].filter((id) => typeof id === "string" && id.trim()),
  )
  let changed = false
  const next = lists.map((list) => {
    const isFilms =
      wanted.has(list.id) ||
      list.name === "Films" ||
      list.itemTypeId === FILM_TYPE_ID ||
      (list.itemTypeIds ?? []).includes(FILM_TYPE_ID)
    if (!isFilms) return list
    const patched = withFilmTypeOnList(list)
    if (patched !== list) changed = true
    return patched
  })
  return changed ? next : lists
}
