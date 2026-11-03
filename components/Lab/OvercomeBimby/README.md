# components/Lab/OvercomeBimby

_Last mapped: 2026-11-03_

`OvercomeBimbyPanel.tsx`: a text box ("Rules only" skips the model, Cmd/Ctrl-Enter sends), the push with the three tactics it picked, a **Started** / **Still stuck** key on each, and the last 20 log rows. Route: `app/lab/overcome/page.tsx`. Engine: `lib/overcome-bimby/`. It is plain Tailwind for now, not yet in the To Do card style.

`OvercomeBimbyPopup.tsx` (2026-11-03): the panel as a closable popup (✕, Esc, or a click on the backdrop). The Agents desk opens it with **Open popup** on the Overcome BIMBY. The panel's header links to the node view, `/lab/bim-flow?flow=overcome`, where the pipeline is a graph you can edit, run on sample lines, critique and keep.

**Planned:** a Home / phone door that opens the popup without going through the Agents desk.

The panel also shows **Tactic tests** (offered, Started, Still stuck, rate per tactic) and sends with `explore` on, so one slot per push is a tactic tried the least. Chat lane: `lib/overcome-bimby/README.md` "In BIM chat".
