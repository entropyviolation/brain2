# Mockup slants

_Last mapped: 2026-10-26_

A slant is a mockup pushed hard toward one outside style. Slants are opt-in. Use one only when someone asks for that slant by name.

Scope:
- Inside a slant, the designer may ignore `docs/DESIGN_STYLE.md`, `docs/DESIGN_REFS.md`, any `*_REDESIGN.md` look, and every other house rule. The slant's own file says how.
- Nothing here changes the house style, other mockups, or app code. A slant is always a new, separate mockup.
- A slant keeps the feature: same data, same actions, same states.

| Folder | What it holds |
|---|---|
| `hipgnosis/` | `HIPGNOSIS_SLANT.md` (how to make one), `research.md`, `research-2-hipgnosis.md`, and `canvas/`, the To do Hipgnosis mockup (desktop, phone, states). |
| `retrofuturism/` | `RETROFUTURISM_SLANT.md` and `research.md`. |
| `style-lab/` | 15 To do mockups across the rule-break dial, level 0 (keeps every house rule) to level 4 (breaks everything). |
| `time-grid-lab/` | Time Grid studio: 17 boards for Home → Tracking → Time Grid, dial 0 to 4, plus a parts bin of eight key families. Source in `src/`, built by `build.sh`. See its README. |
| `../experimental/` | Not a slant. Experimental concepts, for example the chemistry lab that used to sit on the Day Tubes page. |
| `../ui-lab/` | Not a slant. Nine room pages (habits, plan, todo, goals, tracking, lists, docs, scheduler, operations), served with the app’s real CSS. `npm run ui-lab`. See [`../ui-lab/README.md`](../ui-lab/README.md). |
| `STYLE_OPTIONS.md` | 18 ways to use Hipgnosis and retrofuturism while keeping `DESIGN_STYLE.md`. This is the only file here meant for house work. |

The `.dc.html` files and `canvas.json` are sources for Claude Design canvases. They need that editor's runtime (`support.js`) and do not open as plain pages. Live copies:
- Hipgnosis slant: https://claude.ai/artifact/2PVkeHC7SWAZPcQ585sSHT
- Style lab: https://claude.ai/artifact/8o4MiAbSTdfpHdFdnrX36W
- Time Grid studio: https://claude.ai/artifact/K2Sri9GSvwZNzTeyBTCZhu
- Base mockup the slants start from: https://claude.ai/artifact/AhZ7M3tfBx1ahrGzTG4xH6

The To do redesign is resolved in `docs/TODO_REDESIGN.md` (2026-10-27). It is not an open plan.
