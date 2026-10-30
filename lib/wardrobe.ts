/**
 * lib/wardrobe.ts — Outfits and the pieces they are made of
 *
 * A look is one photo (`idb:` URI) plus the piece ids worn in it. Wear counts
 * are queries over those ids. Pieces are not Tasks. Outfits are not time-grid
 * rows. `compositions` are saved mix-and-match boards, not wears.
 * Storage: `brain2-wardrobe`. Version 2 adds `compositions: []` for old saves.
 */
"use client"

import { create } from "zustand"
import { persist } from "zustand/middleware"
import { createCogsJSONStorage } from "@/lib/persist-storage"
import { persistKey } from "@/lib/storage-keys"

export const WARDROBE_STORAGE_KEY = persistKey("wardrobe")

export const PIECE_CATEGORIES = ["top", "layer", "bottom", "shoes", "bag", "accessory", "makeup", "other"] as const

export type PieceCategory = (typeof PIECE_CATEGORIES)[number]

export const PIECE_CATEGORY_LABEL: Record<PieceCategory, string> = {
  top: "Tops",
  layer: "Layers",
  bottom: "Bottoms",
  shoes: "Shoes",
  bag: "Bags",
  accessory: "Accessories",
  makeup: "Makeup",
  other: "Other",
}

const DATE_KEY = /^\d{4}-\d{2}-\d{2}$/

export interface Piece {
  id: string
  name: string
  category: PieceCategory
  subtype?: string
  imageUri?: string
}

export interface Outfit {
  id: string
  dayKey: string
  startMin: number
  clockCertainty?: "estimated" | "unknown"
  photoUri: string
  pieceIds: string[]
  note?: string
  source?: "desk" | "bim"
}

export interface PieceDraft {
  name: string
  category: PieceCategory
  subtype?: string
  imageUri?: string
}

export interface OutfitDraft {
  dayKey: string
  startMin: number
  clockCertainty?: "estimated" | "unknown"
  photoUri: string
  pieceIds?: string[]
  note?: string
  source?: "desk" | "bim"
}

/** One placed cutout. `x` and `y` are 0..1 within the mix-and-match board. */
export interface CompositionSlot {
  pieceId: string
  x: number
  y: number
}

/** A saved arrangement of pieces. Not a wear (`Outfit`) and not a calendar day. */
export interface OutfitComposition {
  id: string
  name: string
  pieceIds: string[]
  slots: CompositionSlot[]
  createdAt: number
}

export interface CompositionDraft {
  name: string
  slots: CompositionSlot[]
  createdAt?: number
}

function newId(prefix: string): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return `${prefix}_${crypto.randomUUID()}`
  }
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`
}

function cleanName(raw: string): string {
  return raw.trim().replace(/\s+/g, " ")
}

function isCategory(value: unknown): value is PieceCategory {
  return typeof value === "string" && (PIECE_CATEGORIES as readonly string[]).includes(value)
}

export function clampUnit(value: number): number {
  if (!Number.isFinite(value)) return 0
  return Math.min(1, Math.max(0, value))
}

/** Move or place one piece. The same piece keeps a single slot; coordinates clamp to 0..1. */
export function withCompositionSlot(
  slots: readonly CompositionSlot[],
  pieceId: string,
  x: number,
  y: number,
): CompositionSlot[] {
  const id = pieceId.trim()
  if (!id) return slots.map((slot) => ({ ...slot }))
  const next = { pieceId: id, x: clampUnit(x), y: clampUnit(y) }
  return [...slots.filter((slot) => slot.pieceId !== id), next]
}

function readSlots(value: unknown, live: Set<string> | null): CompositionSlot[] {
  if (!Array.isArray(value)) return []
  const byId = new Map<string, CompositionSlot>()
  for (const item of value) {
    if (!item || typeof item !== "object") continue
    const row = item as Partial<CompositionSlot>
    const pieceId = typeof row.pieceId === "string" ? row.pieceId.trim() : ""
    if (!pieceId || (live && !live.has(pieceId))) continue
    if (typeof row.x !== "number" || typeof row.y !== "number") continue
    byId.delete(pieceId)
    byId.set(pieceId, { pieceId, x: clampUnit(row.x), y: clampUnit(row.y) })
  }
  return [...byId.values()]
}

function readComposition(value: unknown, live: Set<string>): OutfitComposition | null {
  if (!value || typeof value !== "object") return null
  const row = value as Partial<OutfitComposition>
  const id = typeof row.id === "string" ? row.id.trim() : ""
  const name = typeof row.name === "string" ? cleanName(row.name) : ""
  if (!id || !name) return null
  const slots = readSlots(row.slots, live)
  const createdAt = typeof row.createdAt === "number" && Number.isFinite(row.createdAt) ? row.createdAt : 0
  return { id, name, slots, pieceIds: slots.map((slot) => slot.pieceId), createdAt }
}

/** Old wardrobe blobs have no `compositions` array. Version 2 introduces it empty. */
export function migrateWardrobe(persisted: unknown, version: number): unknown {
  const state = persisted && typeof persisted === "object" ? { ...(persisted as Record<string, unknown>) } : {}
  if (version < 2 || !Array.isArray(state.compositions)) {
    state.compositions = Array.isArray(state.compositions) ? state.compositions : []
  }
  return state
}

function readPiece(value: unknown): Piece | null {
  if (!value || typeof value !== "object") return null
  const row = value as Partial<Piece>
  const name = typeof row.name === "string" ? cleanName(row.name) : ""
  const id = typeof row.id === "string" ? row.id.trim() : ""
  if (!name || !id || !isCategory(row.category)) return null
  const subtype = typeof row.subtype === "string" ? cleanName(row.subtype) : ""
  const imageUri = typeof row.imageUri === "string" && row.imageUri.trim() ? row.imageUri.trim() : ""
  return {
    id,
    name,
    category: row.category,
    ...(subtype ? { subtype } : {}),
    ...(imageUri ? { imageUri } : {}),
  }
}

function readOutfit(value: unknown): Outfit | null {
  if (!value || typeof value !== "object") return null
  const row = value as Partial<Outfit>
  const id = typeof row.id === "string" ? row.id.trim() : ""
  const dayKey = typeof row.dayKey === "string" ? row.dayKey : ""
  const photoUri = typeof row.photoUri === "string" ? row.photoUri.trim() : ""
  if (!id || !DATE_KEY.test(dayKey) || !photoUri || typeof row.startMin !== "number" || !Number.isFinite(row.startMin)) {
    return null
  }
  const startMin = Math.floor(row.startMin)
  if (startMin < 0 || startMin > 1439) return null
  const clock = row.clockCertainty === "estimated" || row.clockCertainty === "unknown" ? row.clockCertainty : undefined
  const pieceIds = Array.isArray(row.pieceIds)
    ? [...new Set(row.pieceIds.filter((id): id is string => typeof id === "string" && id.trim().length > 0))]
    : []
  const note = typeof row.note === "string" ? row.note.trim() : ""
  const source = row.source === "desk" || row.source === "bim" ? row.source : undefined
  return {
    id,
    dayKey,
    startMin,
    photoUri,
    pieceIds,
    ...(clock ? { clockCertainty: clock } : {}),
    ...(note ? { note } : {}),
    ...(source ? { source } : {}),
  }
}

export function sanitizeWardrobe(value: unknown): { pieces: Piece[]; outfits: Outfit[]; compositions: OutfitComposition[] } {
  const root =
    value && typeof value === "object" ? (value as { pieces?: unknown; outfits?: unknown; compositions?: unknown }) : {}
  const pieces: Piece[] = []
  const outfits: Outfit[] = []
  const compositions: OutfitComposition[] = []
  const seenPieces = new Set<string>()
  const seenOutfits = new Set<string>()
  const seenCompositions = new Set<string>()
  for (const item of Array.isArray(root.pieces) ? root.pieces : []) {
    const piece = readPiece(item)
    if (!piece || seenPieces.has(piece.id)) continue
    seenPieces.add(piece.id)
    pieces.push(piece)
  }
  const live = new Set(pieces.map((piece) => piece.id))
  for (const item of Array.isArray(root.outfits) ? root.outfits : []) {
    const outfit = readOutfit(item)
    if (!outfit || seenOutfits.has(outfit.id)) continue
    seenOutfits.add(outfit.id)
    outfits.push({ ...outfit, pieceIds: outfit.pieceIds.filter((id) => live.has(id)) })
  }
  for (const item of Array.isArray(root.compositions) ? root.compositions : []) {
    const composition = readComposition(item, live)
    if (!composition || seenCompositions.has(composition.id)) continue
    seenCompositions.add(composition.id)
    compositions.push(composition)
  }
  return { pieces, outfits, compositions }
}

interface WardrobeState {
  pieces: Piece[]
  outfits: Outfit[]
  compositions: OutfitComposition[]
  addPiece: (draft: PieceDraft) => string | null
  addOutfit: (draft: OutfitDraft) => string | null
  updateOutfit: (id: string, patch: Partial<Pick<Outfit, "startMin" | "clockCertainty" | "note" | "pieceIds" | "dayKey">>) => boolean
  removeOutfit: (id: string) => void
  removePiece: (id: string) => void
  addComposition: (draft: CompositionDraft) => string | null
  updateComposition: (id: string, patch: Partial<Pick<OutfitComposition, "name" | "slots">>) => boolean
  removeComposition: (id: string) => void
}

export const useWardrobeStore = create<WardrobeState>()(
  persist(
    (set, get) => ({
      pieces: [],
      outfits: [],
      compositions: [],
      addPiece: (draft) => {
        const name = cleanName(draft.name)
        if (!name || !isCategory(draft.category)) return null
        const subtype = draft.subtype ? cleanName(draft.subtype) : ""
        const id = newId("piece")
        const piece: Piece = {
          id,
          name,
          category: draft.category,
          ...(subtype ? { subtype } : {}),
          ...(draft.imageUri?.trim() ? { imageUri: draft.imageUri.trim() } : {}),
        }
        set({ pieces: [...get().pieces, piece] })
        return id
      },
      addOutfit: (draft) => {
        const outfit = readOutfit({ ...draft, id: newId("outfit"), pieceIds: draft.pieceIds ?? [] })
        if (!outfit) return null
        const live = new Set(get().pieces.map((piece) => piece.id))
        const saved = { ...outfit, pieceIds: outfit.pieceIds.filter((id) => live.has(id)) }
        set({ outfits: [...get().outfits, saved] })
        return saved.id
      },
      updateOutfit: (id, patch) => {
        const current = get().outfits.find((row) => row.id === id)
        if (!current) return false
        const next = readOutfit({ ...current, ...patch, id })
        if (!next) return false
        const live = new Set(get().pieces.map((piece) => piece.id))
        set({
          outfits: get().outfits.map((row) => (row.id === id ? { ...next, pieceIds: next.pieceIds.filter((pieceId) => live.has(pieceId)) } : row)),
        })
        return true
      },
      removeOutfit: (id) => set({ outfits: get().outfits.filter((row) => row.id !== id) }),
      removePiece: (id) =>
        set({
          pieces: get().pieces.filter((row) => row.id !== id),
          outfits: get().outfits.map((row) => ({ ...row, pieceIds: row.pieceIds.filter((pieceId) => pieceId !== id) })),
          compositions: (get().compositions ?? []).map((row) => {
            const slots = row.slots.filter((slot) => slot.pieceId !== id)
            return { ...row, slots, pieceIds: slots.map((slot) => slot.pieceId) }
          }),
        }),
      addComposition: (draft) => {
        const name = cleanName(draft.name)
        if (!name) return null
        const live = new Set(get().pieces.map((piece) => piece.id))
        const slots = readSlots(draft.slots, live)
        if (slots.length === 0) return null
        const createdAt = typeof draft.createdAt === "number" && Number.isFinite(draft.createdAt) ? draft.createdAt : Date.now()
        const row: OutfitComposition = {
          id: newId("comp"),
          name,
          slots,
          pieceIds: slots.map((slot) => slot.pieceId),
          createdAt,
        }
        set({ compositions: [...(get().compositions ?? []), row] })
        return row.id
      },
      updateComposition: (id, patch) => {
        const current = (get().compositions ?? []).find((row) => row.id === id)
        if (!current) return false
        const name = patch.name !== undefined ? cleanName(patch.name) : current.name
        if (!name) return false
        const live = new Set(get().pieces.map((piece) => piece.id))
        const slots = patch.slots ? readSlots(patch.slots, live) : current.slots
        if (slots.length === 0) return false
        const next: OutfitComposition = { ...current, name, slots, pieceIds: slots.map((slot) => slot.pieceId) }
        set({
          compositions: (get().compositions ?? []).map((row) => (row.id === id ? next : row)),
        })
        return true
      },
      removeComposition: (id) => set({ compositions: (get().compositions ?? []).filter((row) => row.id !== id) }),
    }),
    {
      name: WARDROBE_STORAGE_KEY,
      version: 2,
      storage: createCogsJSONStorage(),
      partialize: (state) => ({ pieces: state.pieces, outfits: state.outfits, compositions: state.compositions }),
      migrate: migrateWardrobe,
      merge: (persisted, current) => ({ ...current, ...sanitizeWardrobe(persisted) }),
    },
  ),
)

export function outfitsOnDay(outfits: readonly Outfit[], dayKey: string): Outfit[] {
  return outfits.filter((row) => row.dayKey === dayKey).sort((a, b) => a.startMin - b.startMin || a.id.localeCompare(b.id))
}

export function latestOutfit(outfits: readonly Outfit[]): Outfit | null {
  if (outfits.length === 0) return null
  return [...outfits].sort((a, b) => a.startMin - b.startMin || a.id.localeCompare(b.id))[outfits.length - 1] ?? null
}
