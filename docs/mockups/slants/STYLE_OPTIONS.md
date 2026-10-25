# Hipgnosis and retrofuturism inside the house style

Options for the To do tab (and later rooms) that borrow from Hipgnosis and from retrofuturism while keeping `docs/DESIGN_STYLE.md`. The full slant, where the house rules are off, stays in `hipgnosis/HIPGNOSIS_SLANT.md`.

Research behind this file:
- `hipgnosis/research.md` (covers, devices, palette)
- `hipgnosis/research-2-hipgnosis.md` (process, quotes, deep cuts, craft, 20 UI translations)
- `retrofuturism/research.md` (eras, film interfaces, type, palettes, 20 UI patterns)

## Why the two fit the house already

`DESIGN_STYLE.md` already asks for "retrofuturistic esoteric technology": racks with something living wired into them, stones set where solder would be, a scrying glass. That is a Hipgnosis sentence. Storm Thorgerson said of *Presence* that he wanted to "tamper with nostalgic pictures of the '30s and '40s with an object from the future" (source in `research-2-hipgnosis.md`). Brain2's beige-and-silver machine is the nostalgic picture. The strange object is what we add.

Shared ground:
- **One object carries the idea.** Hipgnosis put one staged object on a sleeve. The house puts one photographed object in a chrome well (willpower gem, list orb).
- **Do it for real.** Storm: "I don't fake it." The house: a motion must be a verb, a picture must carry data.
- **Small text, set on the panel.** Hipgnosis kept type off the image. The house engraves short nameplates on the mill.

## Your references, read for UI

The images you attached in the thread (the files `0017`–`0032` are catalogued in `retrofuturism/research.md` §1):

| Reference | The lesson for Brain2 |
|---|---|
| BYTE, March 1981 (Robert Tinney): a code printout becomes a bridge over a valley | Make the data the object. A list of tasks can be a physical thing in a place. |
| Macintosh "Test drive" ad, 1984 | One warm word on a calm screen. Cream plastic, generous margins, a serif headline outside the machine. |
| Madonna statue wired into an open rack of boards and a green CRT | The house's own "something living wired into the rack", literally. A photographed figure in the machine is allowed. |
| Personal Computer World, Aug 1985: sky and a question mark inside the monitor, the monitor on the sea | Nature inside the screen. Hipgnosis and retrofuturism meet here. |
| Sony aibo ad: "Which do you love?" | Two objects, one question. A pair picker drawn as two machines. |
| Y2K gadget catalogue (Oakley Time Bomb, Casio Protrek, Motorola writer, iMac Flower Power) | Translucent and pearly plastics, small printed captions with a flag, a catalogue grid with arrows to labels. |
| Robotics Age 1982: a red arm bursts out of a ledger CRT | A machine that reaches out of the screen. Use once, for a real event. |
| S_SOUL: grey upholstered console, vector CRT, round green lamp wells | Soft grey felt instead of metal. Round phosphor wells in a curved panel. |
| Room with stacked AV decks facing a glacier window | Warm lamp, cool landscape. A CRT that shows the sunset the window does not. |
| Apple IIe with a full green screen | One flat phosphor field, one short word, one green lamp on the key. |
| Sony Walkman WM-FX244 with a "40 presets / 25H playback" sticker | Oval glass well inside a silver body. A loud printed sticker for one fact. |
| Intecolor 3621 ad, "Putting color to work in computers" | Colour-coded keycap blocks by role. Bars on a dark CRT. |
| Koss Porta Pro | Two-tone beige and brushed steel, a slider with printed FIRM · · · LIGHT stops. |

## The rules that bind the options

These come from `DESIGN_STYLE.md`. Every option below keeps them.

- Lights are green `#7dffc4`, ice blue `#9ad7ff` or violet `#7e14ff` / `#7d6bb8`. No orange or amber light.
- Warm red marks one thing, an estimate overrun. Red light is also the now line and a true fault.
- No "should". Labels state facts: "Pushed ×3", "Waiting since Tue". No "overdue", no nudges.
- Motion is a verb, and reduced motion snaps to the end.
- Doors stay visible. No floating cards. Three type sizes.
- Metal is silver, never gold.
- A quote on screen is real and carries a source.
- A number the app filled in wears `~` and an **est.** chip.

Several ideas in the research break one of these. They are swapped below and listed in **Slant only** at the end.

## Options that fit today

Small, can go into the To do redesign as drawn in [To do redesign mockup](https://claude.ai/artifact/AhZ7M3tfBx1ahrGzTG4xH6).

1. **Obelisk on the time well.** *Presence*. The load instrument's day scale gets a small black slab at now, in place of the violet triangle. Its shadow on the scale runs to the end of the promised work. Data: now, estimate remaining.
2. **DSKY span readout.** Apollo DSKY. The Day / Week / Month / Season / Other keys keep their Tek legends. The CRT above shows `SPAN 01  DAY` in segment digits with ghost 8s, using `SegDigits` from Dash. Data: the span and its open count.
3. **Prism legend on the span keys.** *Dark Side of the Moon*, kept to house lights. A hairline beam enters the Span nameplate and splits into five short lines, one per key. Only the live key's line is lit, in phosphor green. Data: which span.
4. **Caution-lamp panel.** DSKY, `0026`. A 2×3 block of labelled lamps under the load needle: `PUSHED`, `NO EST.`, `LOCKED`, `REQUIRED`, `IN PROGRESS`, `OVER EST.`. Lamps are green, blue or violet; only `OVER EST.` may be warm red. Each lights from a count and filters on click. Data: real counts. The labels state facts.
5. **Coupling rockers for grouping.** `0026` COUPLING / AUTO / NORM. Three `HabitBarRocker` plates pick grouping: Priority, Time, Manual. Data: list order.
6. **Big-number pair.** `0026` (`64% / 83%`). The closed load line becomes two figures only: done this span, and est ÷ left. Segment digits, small legends under. Data: completion, load ratio.
7. **Light-trail history in the drawer.** *...And Then There Were Three...*. The open card's Time fold shows one phosphor afterglow strip. Each status change leaves a trace; brightness is time spent. Data: the task's own history.
8. **Self-describing empty band.** XTC *Go 2*. When a band is empty the ledger shows plain pixel text on CRT glass: "This is the Required band. Nothing is in it. Mark a task Required to put it here." Names the real key. Data: band name, count 0.
9. **Inspection stickers for flags.** Walkman sticker, Alien signage. Required and Prioritized become small printed paper stickers on the card edge (paper, not light), with the date set: `REQUIRED · you marked 18 Oct`. Data: flag and when it was set.
10. **Contact-sheet frame numbers.** Hipgnosis contact sheets. Each closed row carries a tiny engraved frame number on the mill (`01`, `02`). Prioritized rows get a hand-drawn ring in violet grease pencil. Data: order, priority.
11. **Two-tone keycaps by role.** Shipped. `0029`, Intecolor, Porta Pro. Verbs are the pale silver cap; mode and view keys (Show, Sort, Span) are the darker grey modifier. Allie likes this button and wants more of the silver ones. Seafoam (`.is-seafoam`) and cornflower (`.is-cornflower`) are the only extra plastics. Not beige, cream, yellow, or orange. See [`DESIGN_STYLE.md` → Keycaps](../../../DESIGN_STYLE.md#keycaps).
12. **Develop instead of a spinner.** Polaroid and darkroom. While the list loads, rows fade up from overexposed to true, about 1s, once. Reduced motion shows them at once. It is the verb "load".

## Options where To do invents furniture

Bigger, still legal. The house allows a room its own furniture when the layout holds.

13. **Sky in the CRT.** PCW 1985 cover, `0019`, the glacier room. The header CRT shows a tiny pixel landscape whose light follows the day: dawn at the first task, dusk at the end of the working day. The title and count sit on the glass as now. Data: time of day and left-in-day.
14. **Escalator up-next.** *Technical Ecstasy*, *I Robot*. A narrow column at the right edge of the ledger: steps drawn as stacked 1px phosphor lines, the next three tasks riding them. Finishing one moves the stair one step. Data: queue order.
15. **The thing in the rack.** The Madonna rack, the house's "something living wired into the rack". When the ledger is clear for the span, the CRT well shows one photographed object (from the orbs or gems folders) sitting among drawn boards and wires. Data: count 0. The object is the person's own.
16. **Tinney bridge for Week.** BYTE 1981. In Week span, the day columns are drawn as a printout-paper bridge with sprocket holes, each day a segment, tasks printed on it. Data: tasks per day.
17. **Felt console for the Load drawer.** S_SOUL. The Load drawer trades brushed mill for soft grey felt with round phosphor wells: time, comfort, scope. Same readings, softer material, still one instrument.
18. **Pair picker as two machines.** aibo "Which do you love?". When two tasks tie on priority, "Which first?" shows them as two small machines, silver and graphite, each with its task name on a sticker. Picking one sets the order. Data: the two tasks.

## Slant only

These break a house rule. Use them in a Hipgnosis or retrofuturist slant mockup, not in the house.

- Orange action key, amber oscilloscope trace, amber phosphor (no orange light).
- Red `DO NOT SKIP` sticker, overdue fill box, "nudge to triage" bulb (no should, no alarm colour).
- Worried mood face over 110% load (judges the person's day).
- Black near-blank page with grain, as in the Hipgnosis slant (sands the machine away).
- Burning rows for anything but an overrun.
- Esper zoom, LCARS elbows, disc-step stairs as whole-tab frames (full re-skins).

## My pick

If only three go in: **1 Obelisk on the time well**, **4 Caution-lamp panel**, **8 Self-describing empty band**. Each carries real data, each is small, and together they add one Hipgnosis object, one DSKY instrument and one *Go 2* joke without changing the machine.
