# `components/chrome/` — the shared metal

_Last mapped: 2026-11-21_

Four primitives for the pieces every room used to re-derive. They paint only
from the tokens in `app/chrome-tokens.css`. Rooms stay feral: each rule is one
class deep, so a room rule wins, and a room changes the look by setting a few
locals instead of re-typing gradients.

| File | Role |
|------|------|
| `keycap.tsx` | `Keycap`: the house word key ([Keycaps](../../docs/DESIGN_STYLE.md#keycaps)). Pale silver by default. `plastic` is `mod`, `primary`, `seafoam` or `cornflower`. `latched` makes a room switcher key: a dim lamp at rest, CRT glass and the green lamp when `true`. `on` keeps a word key dropped (`aria-pressed`). Press is the 2px drop. Carries `data-no95`, so the Win95 button skin in `app/win95.css` leaves it alone. Locals: `--cap-top`, `--cap-top2`, `--cap-skirt`, `--cap-edge`, `--cap-legend`. |
| `fascia.tsx` | `Fascia`: the brushed bay a row of instruments sits in (`--fascia-bay` + `--fascia-bay-ring`). `finish="mill"` is the raised mill strip the period navs use. A flex row. Locals: `--fascia-face`, `--fascia-edge`. |
| `crt-well.tsx` | `CrtWell`: a value in black glass, phosphor with its glow, bloom at the top, gunmetal ring ([Phosphor](../../docs/DESIGN_STYLE.md#phosphor)). `size="small"` for a tight readout. Locals: `--crt-ink`, `--crt-pad`. |
| `nameplate.tsx` | `Nameplate`: engraved uppercase label, ink `--plate-ink`. `face="smooth"` adds the light lip (never on a pixel face). `lamp="on" \| "off"` leads with the round power lamp. Locals: `--plate-face`, `--plate-size`, `--plate-tracking`. |
| `chrome-primitives.css` | The paint for all four (`.b2-keycap`, `.b2-fascia`, `.b2-crt`, `.b2-nameplate`). Imported by each component. |
| `index.ts` | Barrel. `import { Keycap, Fascia, CrtWell, Nameplate } from "@/components/chrome"`. |
| `chrome-primitives.test.tsx` | Attributes and classes for each primitive, that the paint has no raw phosphor, scope or plate ink, and that the tokens live in `app/chrome-tokens.css`, not `win95.css`. |

## How rooms use the tokens

Already done across 70+ stylesheets (2026-11-21), value for value:

- `#7dffc4` → `var(--crt-phosphor)`; `rgba(125, 255, 196, a)` → `rgba(var(--crt-phosphor-rgb), a)`.
- `#070c0a` → `var(--crt-scope)`; `#2a2c2e` → `var(--plate-ink)`.
- The 1px mill hairlines → `var(--mill-lines-16|18|20|28)`; the key's specular lip → `var(--key-gloss)`; the phosphor bloom → `var(--crt-bloom)`.
- A whole `box-shadow` / `background` / `text-shadow` that equalled a recipe → `var(--fascia-key-ring)`, `var(--fascia-crt-ring)`, `var(--fascia-crt-glass)`, `var(--crt-glow)`, and so on.
- Room keycap aliases (`--todo-cap-*`, `--cap-*`, `--ses-cap-*`, `--qa-cap-*`) → `var(--keycap-*)`.

Left as literals on purpose: comments, `url()` data, `@property` initial
values, and whole-recipe swaps in `components/Home/dash/dash.css` (it sets its
own `--chrome-face`) and `components/Settings/` (its warmth preview writes
`--chrome-*` inline on the dialog). A token with a `var()` inside resolves on
`:root`, so it would not follow either.

**Planned:** move the existing room skins (`.todo-cap`, `.b2-keycap-tab`,
`.trk-keycap`, `.id-keycap`, the `.hpp95` CRT title) onto these primitives one
room at a time, keeping each room's locals. No room has been moved yet.
