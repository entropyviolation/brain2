# `components/ui/clock-picker/` — Shared clock

One control for every place a clock is chosen. The closed field is a sunken bevel that paints a 12-hour face (`09:00 AM`). The value it stores and reports is still `HH:MM` at minute precision, the same string the platform time input used. Opening it shows hour, minute, and AM/PM in a CRT well on a milled bay. The lamp on one cell is the cursor. Phosphor is the house green. There is no platform time popup.

## Files

| File | Purpose |
|------|---------|
| `clock-picker.tsx` | `ClockPicker`. Click or Arrow Up/Down opens the panel. Arrow keys move the cursor. Digits and `a`/`p` type a time (`09:15`, `15:47`, `9:15p`). Enter and a click outside confirm. Escape restores the time from when the panel opened. |
| `clock-picker.css` | Sunken field, bay, CRT well, cursor lamp. |
| `clock-picker.test.tsx` | Open, pick, confirm the `HH:MM` sent to `onChange`. Escape restores. Typing a clock sets it. |

Pass `className` when a caller needs a different size or a room’s field class (`itinerary-time-input`, `habit95-input`). Do not add a second picker.
