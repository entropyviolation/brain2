# `components/ui/clock-picker/` — Shared clock

One control for every place a clock is chosen. The closed field is a sunken bevel that paints a 12-hour face (`09:00 AM`). The value it stores and reports is still `HH:MM` at minute precision, the same string the platform time input used. Opening it shows hour, minute, and AM/PM in a CRT well on a milled bay, and a console face under those drums that keeps the same time. The lamp on one cell is the cursor. Phosphor is the house green. There is no platform time popup.

While the hour or minute lamp is on, the page stays still. The wheel and the trackpad step that drum. The lock lets go on Enter, on a click outside, on Escape, and when the lamp moves to AM/PM. It also lets go if the clock unmounts. The page is not locked just because the panel is open.

The closed field accepts a typed time (`4:02 AM`, `04:02`, `16:02`, `4.02pm`) and stores `HH:MM`. Opening the panel shows that time on the drums and the face. Double-click the armed hour or the armed minute to type that part; Enter or blur sets it and returns to the drum. The other part stays.

## Files

| File | Purpose |
|------|---------|
| `clock-picker.tsx` | `ClockPicker`. Click or Arrow Up/Down opens the panel. Arrow keys move the cursor. Digits and `a`/`p` type a time (`09:15`, `15:47`, `9:15p`, `4:02 PM`, `4.02pm`). An armed hour or minute holds page scroll and takes the wheel. Double-click that drum to type the part. Enter and a click outside confirm. Escape restores the time from when the panel opened. |
| `clock-picker.css` | Sunken field, bay, CRT well, cursor lamp, console face. |
| `clock-picker.test.tsx` | Open, pick, confirm the `HH:MM` sent to `onChange`. Escape restores. Typing a clock sets it, including `4:02 PM` → `16:02`. An armed minute wheel steps the minute and does not scroll the page. Double-click minute accepts a typed minute. The face reports the same hour and minute. |

Pass `className` when a caller needs a different size or a room’s field class (`itinerary-time-input`, `habit95-input`). Do not add a second picker.
