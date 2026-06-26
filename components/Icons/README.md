# Icons

The single shared module for COGS's icon/orb system. Consolidates what used to live
in `components/Lists/lib/icon-utils.tsx`, `components/Lists/dialogs/OrbPickerDialog.tsx`,
`lib/orbs-manifest.ts`, and `lib/lists-icon-grid.ts`.

## Files

| File | Responsibility |
| --- | --- |
| `Icon.tsx` | Icon resolution + rendering helpers: `orbFor(id)`, `iconFor(id, custom?)`, and the `FolderGlyph` SVG. |
| `OrbPicker.tsx` | `OrbPickerDialog` — orb gallery + custom upload (background removed via `lib/remove-background`) + search; an "Edit gallery" mode hides/restores orbs, and your uploads live in a personal library. Hidden orbs + the uploaded library persist in `lib/lists-ui-store`. Exports `OrbPickerDialogProps`. |
| `icon-registry.ts` | Central data registry: re-exports the orb manifest (`ORB_IMAGES`, `ORB_PATHS`) and the freeform grid layout (`computeIconGridPositions`). |
| `index.ts` | Barrel exporting the public surface. |

## Public surface

```ts
import {
  orbFor, iconFor, FolderGlyph,
  OrbPickerDialog, type OrbPickerDialogProps,
  ORB_IMAGES, ORB_PATHS, computeIconGridPositions,
} from "@/components/Icons"
```

## Barrel strategy (zero behavioral change)

This module is the canonical implementation, but every previous import path still
works so the refactor is non-breaking:

- `components/Lists/lib/icon-utils.tsx` → re-exports `orbFor`, `iconFor`, `FolderGlyph` from `@/components/Icons/Icon`.
- `components/Lists/dialogs/OrbPickerDialog.tsx` → re-exports `OrbPickerDialog` + `OrbPickerDialogProps` from `@/components/Icons/OrbPicker`.
- `lib/orbs-manifest.ts` and `lib/lists-icon-grid.ts` remain the source of truth for
  their data (the manifest is auto-generated and must not be hand-edited);
  `icon-registry.ts` re-exports from them, so both old and new import paths resolve to
  the same symbols.

When writing new code, import from `@/components/Icons`. The deprecated barrels exist
only to avoid churn in existing consumers.
