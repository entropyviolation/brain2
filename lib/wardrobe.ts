/**
 * lib/wardrobe.ts — Outfits and the pieces they are made of
 *
 * A look is one photo (`idb:` URI) plus the piece ids worn in it. Wear counts
 * are queries over those ids. Pieces are not Tasks. Outfits are not time-grid
 * rows. Storage: `brain2-wardrobe`.
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

export function sanitizeWardrobe(value: unknown): { pieces: Piece[]; outfits: Outfit[] } {
  const root = value && typeof value === "object" ? (value as { pieces?: unknown; outfits?: unknown }) : {}
  const pieces: Piece[] = []
  const outfits: Outfit[] = []
  const seenPieces = new Set<string>()
  const seenOutfits = new Set<string>()
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
  return { pieces, outfits }
}

interface WardrobeState {
  pieces: Piece[]
  outfits: Outfit[]
  addPiece: (draft: PieceDraft) => string | null
  addOutfit: (draft: OutfitDraft) => string | null
  updateOutfit: (id: string, patch: Partial<Pick<Outfit, "startMin" | "clockCertainty" | "note" | "pieceIds" | "dayKey">>) => boolean
  removeOutfit: (id: string) => void
  removePiece: (id: string) => void
}

export const useWardrobeStore = create<WardrobeState>()(
  persist(
    (set, get) => ({
      pieces: [],
      outfits: [],
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
        }),
    }),
    {
      name: WARDROBE_STORAGE_KEY,
      version: 1,
      storage: createCogsJSONStorage(),
      partialize: (state) => ({ pieces: state.pieces, outfits: state.outfits }),
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
