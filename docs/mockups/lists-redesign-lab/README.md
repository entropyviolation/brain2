# Lists redesign lab

_Last mapped: 2026-11-02_

A standalone mockup page. It proposes a new skin for the Lists tab, driven by 19 reference images. It reads no app code and writes no app data.

Open `index.html` in a browser, or see the published Artifact. `orbs/`, `folders/` and `w95fa.woff` are copies sized for the page (240px orbs).

**What it has.** One mock Lists window with four views (Icons, List, Details, Cards), seven slants (Today, Chrome Slab, Specimen Wall, Sea Mosaic, Dusk Terminal, Vapor Foil, Phosphor Plates) and about 90 controls: frame, wall, glass texture, orb shadow / contact shadow / reflection / gloss / tilt / pedestal / depth of field, keys, sidebar, inspector, type, motion. The Export tab copies the settings as JSON.

**Scope.** Proof of concept. Not built: list settings sheet, dialogs, phone layout, Spreadsheet and Gallery displays.

**Planned.** Pick a slant, then port the chosen tokens into `components/Lists/filemanager98.css`.

Mockups may break `docs/DESIGN_STYLE.md` on purpose.
