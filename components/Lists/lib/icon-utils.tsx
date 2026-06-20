import { ORB_PATHS } from "@/lib/orbs-manifest"
import { hashString } from "@/lib/string-utils"

export function orbFor(id: string): string {
  return ORB_PATHS[hashString(id) % ORB_PATHS.length]
}

/** Resolve the icon for an entity: explicit custom icon, else a stable orb. */
export function iconFor(id: string, custom?: string): string {
  return custom || orbFor(id)
}

export function FolderGlyph({ size = 56, color }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 40" aria-hidden>
      <path d="M2 8a3 3 0 0 1 3-3h12l4 4h22a3 3 0 0 1 3 3v3H2V8Z" fill="#d6a800" />
      <path
        d="M2 13h46v23a3 3 0 0 1-3 3H5a3 3 0 0 1-3-3V13Z"
        fill={color || "#ffd54a"}
        stroke="#9a7b00"
        strokeWidth="1"
      />
      <path d="M2 13h46v3H2v-3Z" fill="#fff2bf" />
    </svg>
  )
}
