/**
 * lib/photo-types.ts — Built-in **Photo** item type.
 *
 * A picture with the usual Apple Photos / EXIF facts as attributes. Notes live
 * in the item body (`"body"` panel). People in the photo link with `depicts`,
 * the place with `taken-at` (`lib/person-relations.ts`). A day gets photos
 * through `lib/day-photos-store.ts`; `takenAt` also places a photo on its day.
 *
 * Pure + serializable. Registered via `withPhotoType()` in `lib/item-types.ts`.
 * A list that allows this type offers the Gallery display.
 */
import type { AttributeDefinition, ItemTypeDefinition } from "@/lib/types"

export const PHOTO_TYPE_ID = "photo"

export const PHOTO_ATTR = {
  image: "photoImage",
  takenAt: "takenAt",
  place: "photoPlace",
  latitude: "photoLatitude",
  longitude: "photoLongitude",
  album: "photoAlbum",
  favorite: "photoFavorite",
  camera: "cameraModel",
  lens: "lensModel",
  focalLength: "focalLengthMm",
  aperture: "apertureF",
  shutter: "shutterSpeed",
  iso: "isoSpeed",
  width: "pixelWidth",
  height: "pixelHeight",
  appleId: "appleLocalIdentifier",
} as const

const PHOTO_ATTRIBUTES: AttributeDefinition[] = [
  { id: PHOTO_ATTR.image, name: "Photo", type: "image" },
  { id: PHOTO_ATTR.takenAt, name: "Taken", type: "datetime" },
  { id: PHOTO_ATTR.place, name: "Place", type: "string" },
  { id: PHOTO_ATTR.latitude, name: "Latitude", type: "number", allowFloat: true },
  { id: PHOTO_ATTR.longitude, name: "Longitude", type: "number", allowFloat: true },
  { id: PHOTO_ATTR.album, name: "Album", type: "string" },
  { id: PHOTO_ATTR.favorite, name: "Favorite", type: "boolean" },
  { id: PHOTO_ATTR.camera, name: "Camera", type: "string" },
  { id: PHOTO_ATTR.lens, name: "Lens", type: "string" },
  { id: PHOTO_ATTR.focalLength, name: "Focal length", type: "number", allowFloat: true, unit: "mm" },
  { id: PHOTO_ATTR.aperture, name: "Aperture", type: "number", allowFloat: true, unit: "f/" },
  { id: PHOTO_ATTR.shutter, name: "Shutter", type: "string" },
  { id: PHOTO_ATTR.iso, name: "ISO", type: "number" },
  { id: PHOTO_ATTR.width, name: "Width", type: "number", unit: "px" },
  { id: PHOTO_ATTR.height, name: "Height", type: "number", unit: "px" },
  { id: PHOTO_ATTR.appleId, name: "Apple Photos ID", type: "string" },
]

export function getPhotoTypeDefinition(): ItemTypeDefinition {
  return {
    id: PHOTO_TYPE_ID,
    name: "Photo",
    pluralName: "Photos",
    itemLabel: "photo",
    description:
      "A picture with its date, place and camera facts. Notes go in the body; link people it shows and the place it was taken.",
    builtin: true,
    kind: "catalog",
    color: "#4a6f8f",
    attributes: PHOTO_ATTRIBUTES,
    displayedAttributes: [PHOTO_ATTR.takenAt, PHOTO_ATTR.place],
    detailPanels: ["details", "body"],
    capabilities: { completable: false },
  }
}

/** Idempotent: appends Photo when missing. */
export function withPhotoType(existing: ItemTypeDefinition[]): ItemTypeDefinition[] {
  if (existing.some((t) => t.id === PHOTO_TYPE_ID)) return existing
  return [...existing, getPhotoTypeDefinition()]
}

/** `YYYY-MM-DD` (local) of a photo's `takenAt`, or null. */
export function photoDayKey(takenAt: unknown): string | null {
  if (typeof takenAt !== "string" && typeof takenAt !== "number") return null
  const d = new Date(takenAt)
  if (Number.isNaN(d.getTime())) return null
  const p = (n: number) => String(n).padStart(2, "0")
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}

/** Whether a list takes Photo items (so it offers the Gallery display). */
export function listAllowsPhotos(list: { itemTypeId?: string; itemTypeIds?: string[] } | null | undefined): boolean {
  if (!list) return false
  return list.itemTypeIds ? list.itemTypeIds.includes(PHOTO_TYPE_ID) : list.itemTypeId === PHOTO_TYPE_ID
}
