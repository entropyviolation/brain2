# `components/ui/clock-picker/` — Shared clock

One control for every place a clock is chosen. The closed field is a cream readout in a milled bay. It paints a 12-hour face (`09:00 AM`) and it is a real text field: focus it and type. Blur or Enter stores `HH:MM` at minute precision, the same string the platform time input used. A clock mark on the field opens the panel. Keystrokes stay in the field. A click in the text does not open the panel.

The panel is the same bay. Hour, minute, and AM/PM sit in a CRT well. **Now** is inside the panel: it fills the current local time and writes that `HH:MM` at once. Under the drums, the analog face is the cream ceramic clock. Ornate silver hands turn with the draft: a long minute hand with a pierced stem and a pointed tip, a shorter hour hand with an openwork club near the tip, both on a small brass cap. **Confirm** writes the time on the drums into the field and calls `onChange`. **Cancel**, Escape, and a click outside close and leave the previously committed `HH:MM`. The lamp on one drum is the cursor. Phosphor is the house green, on the armed drum. There is no platform time popup and no system blue.

A small **Dial** control switches the center painting. **Shuffle** picks another one. **Edit** hides or restores a painting for this browser. Those choices live in `localStorage`: `brain2.clock-dial` is the selected id, `brain2.clock-dial-hidden` is a JSON array of hidden ids. The PNG files stay. Ceramic is the default and cannot be hidden. A center painting sits in the ceramic well, under the hands. The list is `backgrounds/manifest.json`.

The popup is portaled above dialogs. Radix sets `pointer-events: none` on the page while a dialog is open, so the layer sets `pointer-events: auto` and a z-index above `.trk-entry`. Clicks on a drum, Now, Confirm, or the face hit the picker. A click on the backdrop closes the picker and does not fall through to the dialog.

While the hour or minute lamp is on, the page stays still. The wheel and the trackpad step that drum. The lock lets go on Confirm, on Enter, on Cancel, on a click outside, on Escape, and when the lamp moves to AM/PM. It also lets go if the clock unmounts. The page is not locked just because the panel is open.

The closed field accepts `8:00 AM`, `08:00`, `16:02`, `4.02pm`, `1pm`, and `1:00 PM`. Opening the panel shows that time on the drums and on the hands. Double-click the armed hour or the armed minute to type that part; Enter or blur sets it on the drums and returns. Confirm is what writes it. The other part stays.

## Files

| File | Purpose |
|------|---------|
| `clock-picker.tsx` | `ClockPicker`. The closed field takes a typed time (`09:15`, `16:02`, `1pm`, `4:02 PM`, `4.02pm`) and commits `HH:MM` on blur or Enter. The clock mark opens the panel. Arrow keys, digits, and `a`/`p` change the open drums without writing the field. **Now** is inside the panel and writes at once. **Confirm** writes the drums. **Cancel**, Escape, and a click outside leave the field. An armed hour or minute holds page scroll and takes the wheel. Double-click that drum to type the part. The layer keeps its own clicks inside a dialog. |
| `clock-dials.ts` | Loads `backgrounds/manifest.json`. Ceramic is the rim and the default. Other entries are center paintings. Hide/restore and the selected id persist in `localStorage`. |
| `ceramic-face.png` | The analog face. Cream ceramic rim and metal 12, 3, 6, and 9. Live hands are drawn in the component. Center paintings sit in the well. |
| `backgrounds/` | Isolated dial paintings on transparency. `manifest.json` lists `{ id, file, label }` for each, plus ceramic (`../ceramic-face.png`). |
| `clock-picker.css` | Milled bay, cream field, CRT drums, Now, Confirm, Cancel, dial control, ceramic face, silver hands. |
| `clock-picker.test.tsx` | Open from the clock mark, Confirm the `HH:MM` sent to `onChange`. Cancel and Escape leave it. A click outside closes. Typed `1:00 PM` commits `13:00`. Now is inside the popup and writes at once. The popup’s pointer events and z-index sit above `.trk-entry`. An armed minute wheel steps the minute and does not scroll the page. Hand angles for 1:00 and 6:30. Ceramic is the default dial. |

Pass `className` when a caller needs a different size or a room’s field class (`itinerary-time-input`, `habit95-input`). Do not add a second picker.
