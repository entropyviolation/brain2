/**
 * lib/pen-place-actions.ts — Write a Location pen's place, and file it by address
 *
 * `setPenPlace` stores `TrackPen.place` (undo-able through `updatePen`).
 * `fileUnderAddress` reads the view's level categories broadest first
 * (Country › State › City › Neighborhood, or the person's own names — see
 * `partForLevelName`) and walks the address parts down them: each rung finds
 * the pen with that name (under the rung above, or on that level), or creates
 * it, puts it on the level, and nests it under the rung above. The place pen
 * then counts as the deepest rung found. Parents that are not level pens stay.
 * A rung the address does not name is skipped, never invented.
 *
 * `fileNewGpsPen` is the GPS path: a pen the bot just made for an unknown
 * point is reverse-geocoded, given that point as its pin, and filed.
 */
import { reverseGeocode } from "@/lib/geo-address"
import { penParentIds } from "@/lib/pen-tree"
import { penLevelId, scopeLevels } from "@/lib/pen-levels"
import { partForLevelName, type AddressParts, type PenPlace } from "@/lib/pen-place"
import { PEN_PALETTE, useTimeTrackingStore, type TrackPen } from "@/lib/time-tracking-store"

const LOCATION = "location"

function scopeOf(scopeId: string) {
  return useTimeTrackingStore.getState().scopes.find((s) => s.id === scopeId)
}

export function setPenPlace(scopeId: string, penId: string, place: PenPlace | undefined): void {
  const pen = scopeOf(scopeId)?.pens.find((p) => p.id === penId)
  if (!pen) return
  const next: TrackPen = { ...pen, editedAt: Date.now() }
  if (place && hasAnything(place)) next.place = place
  else delete next.place
  useTimeTrackingStore.getState().updatePen(scopeId, next)
}

function hasAnything(place: PenPlace): boolean {
  return Boolean(place.address || place.zip || place.coords?.length || place.lat !== undefined)
}

const norm = (s: string) => s.trim().toLowerCase()

/**
 * Nest `penId` under the deepest level pen its address names, creating the
 * ladder as needed. Returns the names filed under, broad first.
 */
export function fileUnderAddress(scopeId: string, penId: string, parts: AddressParts): string[] {
  const store = useTimeTrackingStore.getState()
  let scope = scopeOf(scopeId)
  if (!scope) return []
  const levels = scopeLevels(scope)
  const rungs = levels
    .map((level) => ({ level, name: partForLevelName(level.name, parts) }))
    .filter((rung): rung is { level: (typeof levels)[number]; name: string } => Boolean(rung.name))
  const self = scope.pens.find((p) => p.id === penId)
  if (!self || !rungs.length) return []
  const selfLevel = penLevelId(scope, self)
  const filed: string[] = []
  let parentId: string | undefined
  for (const rung of rungs) {
    // A pen on this rung's level, or broader, is the place itself — stop above it.
    if (selfLevel && levels.findIndex((l) => l.id === selfLevel) <= levels.findIndex((l) => l.id === rung.level.id)) break
    if (norm(rung.name) === norm(self.name)) break
    scope = scopeOf(scopeId)!
    const candidates = scope.pens.filter((p) => p.id !== penId && norm(p.name) === norm(rung.name))
    const match =
      candidates.find((p) => parentId && penParentIds(p).includes(parentId)) ??
      candidates.find((p) => penLevelId(scope, p) === rung.level.id) ??
      candidates.find((p) => !penLevelId(scope, p))
    let id = match?.id
    if (!id) {
      id = store.addPen(scopeId, { name: rung.name, color: PEN_PALETTE[scope.pens.length % PEN_PALETTE.length]! })
      if (!id) break
    }
    const fresh = scopeOf(scopeId)!.pens.find((p) => p.id === id)!
    if (penLevelId(scopeOf(scopeId), fresh) !== rung.level.id) store.setPenLevel(scopeId, id, rung.level.id)
    if (parentId && !penParentIds(fresh).includes(parentId)) {
      store.setPenParents(scopeId, id, [parentId, ...penParentIds(fresh).filter((p) => !isLevelPen(scopeId, p))])
    }
    parentId = id
    filed.push(rung.name)
  }
  if (parentId) {
    const current = scopeOf(scopeId)!.pens.find((p) => p.id === penId)
    const keep = penParentIds(current ?? {}).filter((p) => p !== parentId && !isLevelPen(scopeId, p))
    store.setPenParents(scopeId, penId, [parentId, ...keep])
  }
  return filed
}

function isLevelPen(scopeId: string, penId: string): boolean {
  const scope = scopeOf(scopeId)
  const pen = scope?.pens.find((p) => p.id === penId)
  const level = penLevelId(scope, pen)
  if (!level || !scope) return false
  return scopeLevels(scope).some((l) => l.id === level && partForLevelName(l.name, { country: "x", state: "x", county: "x", city: "x", neighborhood: "x", postcode: "x" }))
}

/** A pen the GPS path just created for an unknown point: pin it there and file it. */
export async function fileNewGpsPen(penId: string, lat: number, lng: number): Promise<void> {
  const found = await reverseGeocode(lat, lng)
  const pen = scopeOf(LOCATION)?.pens.find((p) => p.id === penId)
  if (!pen) return
  setPenPlace(LOCATION, penId, {
    ...pen.place,
    lat,
    lng,
    ...(found ? { address: found.label, parts: found.parts } : {}),
  })
  if (found) fileUnderAddress(LOCATION, penId, found.parts)
}
