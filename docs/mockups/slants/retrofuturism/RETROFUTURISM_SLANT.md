# Retrofuturism style mockup slant instructions

_Last mapped: 2026-10-21_

How to make a "retrofuturism slant" version of any Brain2 mockup: the future as some past decade imagined it.

Example canvas: [Style lab](https://claude.ai/artifact/8o4MiAbSTdfpHdFdnrX36W). 15 boards across dial levels 0 to 4, retrofuturism and Hipgnosis mixed.

Research beside this file: `research.md` (the reference images `0017` to `0032`, eras, film interfaces, type, palettes, 20 UI patterns). Options that keep the house rules: `../STYLE_OPTIONS.md`. Sister slant: `../hipgnosis/HIPGNOSIS_SLANT.md`.

## Scope: read this first

- This protocol applies only when someone asks for a retrofuturism style or retrofuturism slant mockup.
- Inside a slant, the designer does not have to follow `docs/DESIGN_STYLE.md`, `docs/DESIGN_REFS.md`, any `*_REDESIGN.md` look, or any other house rule. Follow one only if it helps the picture. The dial below says how many to drop.
- It changes nothing outside the slant. Never edit other mockups, style docs, or app code because of it. A slant is always a new, separate artifact; the base mockup stays as it was.
- Keep the feature itself. Same data, same actions, same states as the base mockup. The slant changes how it looks and feels, not what it does.

## The one idea

Brain2 already looks like retro hardware: milled panels, CRT phosphor, pixel type, keycaps and lamps. A retrofuturism slant pushes that into one era's full belief in the machine. Make the tab feel like a real instrument from a future that never shipped.

Ask: if this screen were a device built in that year, what would its panel say, and what would its one screen show? Then build that panel.

Most of the references are a cream or white object with one glowing screen. The screen shows one shape or a few big numbers. Busy references frame a calm centre with data at the edges.

## Eras to pick from

Pick one era per mockup. Do not mix eras on one board; mixing reads as a costume shop.

| Era | Look | Key references |
| --- | --- | --- |
| Atomic and space age, 1950s to 60s | Chrome, swoops, starbursts, screen as a head on a sculpted neck | `0022` videophone, `0023` teak-and-chrome computer, *Tekhnika Molodezhi* |
| Mission control, 1966 to 75 | Grid-first, red and white, verb-noun commands, caution lamps | Apollo DSKY, NASA Graphics Standards Manual (1975), *2001* |
| Space colony, 1975 to 77 | Calm sunny cutaways of a future that works | NASA Ames colony paintings, *Space: 1999* white sets |
| Cassette futurism, 1979 to 87 | Chunky analogue tech, green CRTs, rocker switches, stencilled labels | *Alien* Nostromo (Ron Cobb), `0026`/`0031` render, `0027` oscilloscope |
| Airbrush brochure, early to mid 80s | Glow, grid floors, floating spheres, chrome heads, beams | Robert Tinney BYTE covers, `0019`, `0028`, `0032` IBM ad |
| Beige box, 1981 to 97 | Office beige and grey, one green or amber screen, printed keys | Apple IIe, `0020` intercom, `0029` keycaps |
| Y2K and Frutiger Aero, 1998 to 2006 | Translucent blue, pearl, bubbles, sky-and-water | iMac G3, aibo, `0021` Sotagi, `0024` egg pod |
| Modern heirs | Hard limits, one small screen, a theory printed on the panel | Teenage Engineering OP-1, `0030` Programma 900, Playdate |

## Moves, in order of weight

1. **One glowing screen per panel.** It shows one shape or two big numbers. Everything else is the panel around it.
2. **Every panel has a job and a label.** Ron Cobb's rule on *Alien*: a plausible engineering label on every surface (`QUEUE 14`, `SPAN`, `LOAD`, `COUPLING`). The labels sell the world. They can carry counts.
3. **Instruments carry real data.** DSKY span readout (`SPAN 01 DAY`), caution-lamp grid lit by real counts, load as an oscilloscope trace against a capacity rule, a big-number pair (`64% / 83%`).
4. **Physical controls with one job each.** Rocker keys for grouping, keycaps for spans, one orange key for the main action, two-tone caps by role (pale for verbs, dark for modes).
5. **The panel explains itself.** Printed lines link controls to what they change (Programma 900). In a detail view, dotted signal lines join a task to its project and blockers.
6. **Wear and glow are seasoning.** Scanlines, bloom, curvature, scuffs: one or two, softly. Never at the cost of reading.

## Palettes

Working values picked by eye, not specs. Use one family per mockup.

| Family | Hex |
| --- | --- |
| Office beige | plastic `#D9CDB4`, aged `#C8B994`, shadow `#A69A7E`, cream panel `#E9E3D2` |
| Office grey | warm `#B8B4AA`, cool `#8E9196`, charcoal `#3A3B3D` |
| Green phosphor | P1 `#33FF66`, dim `#1A7F33`, glass `#0B140D` |
| Amber phosphor | P3 `#FFB000`, dim `#7F5800`, glass `#140C00` |
| Other glows | lime render `#C6F24A`, white-blue vector `#9FD4FF` |
| Intecolor, softened | red `#E8463A`, green `#4CD964`, yellow `#F2D43A`, blue `#3A5BE8`, magenta `#D946C9`, cyan `#3ADBE8` |
| Y2K | Bondi blue `#0095B6`, ice `#BFE3EE`, lavender `#8C8FE0`, pearl `#EEF0F4`, silver `#C9CCD1` |
| Accents | `=` key orange `#E8641E`, TE orange `#FF5A1F`, NASA red `#FC3D21`, sticker yellow `#FFD200` |
| Lamps | red `#E5322D`, yellow `#F5C518`, green `#4CC84A` |

One orange key per screen. Lamp colours keep fixed meanings within a mockup.

## Type

Use one wide face for caps labels, one mono face for data with tabular figures, and a segment or bitmap face only inside screens. Two or three faces feel engineered (*2001*).

| Classic | Google Fonts stand-in |
| --- | --- |
| Eurostile / Microgramma | Michroma, Orbitron, Audiowide |
| Futura | Jost, League Spartan |
| ITC Avant Garde | Questrial, Didact Gothic |
| Helvetica / Univers | Inter, Archivo |
| Helvetica Ultra Compressed (LCARS) | Antonio, Oswald, Big Shoulders Display |
| OCR-B, terminal type | Space Mono, VT323, IBM Plex Mono, Share Tech Mono |
| Chicago bitmap | Silkscreen, Pixelify Sans |
| DSKY 7-segment | Draw segments in SVG (DSEG7 is not on Google Fonts) |

Caps labels tracked out, about `letter-spacing: .14em`.

## Motion

Mechanical, not floaty. Things click, step and warm up.
- Keys: a 60 to 90ms press, then a hard stop. Rockers snap.
- Screens: a CRT warm-up (a bright line opens to full, 300 to 500ms) instead of a spinner.
- Change in steps you can watch, as the Blade Runner Esper does: span changes zoom with grid lines and a readout ("ENHANCE 2x").
- Phosphor persistence: old values fade over about 1s instead of vanishing.
- Lamps light, they do not blink. Always wrap motion in `prefers-reduced-motion`.

## Copy voice

Terse engineering plate. Nouns and numbers, upper case on panels. "SPAN 01 DAY." "QUEUE 14." "NO OPEN ITEMS." Menus can be friendly in the IBM-ad way: "GOOD MORNING. Select one: 1 Plan today 2 Review yesterday 3 Show the list." No exclamation marks, no sales lines.

## Film and TV interfaces

| Source | Take this |
| --- | --- |
| *2001* (1968) | A type system of two or three faces: Eurostile Bold Extended, Futura, Univers |
| *Alien* (1979) | Green text on black CRT, stencilled functional signage, a label on everything |
| *Blade Runner* (1982) | Show the process: a slow, readable change beats a jump cut |
| *Star Trek: TNG* LCARS (1987 on) | A frame of rounded coloured bars that is also the navigation |
| *Space: 1999* (1975) | A calmer, whiter mission control |
| *Moon* (2009) | GERTY: one small glyph carries tone |
| *Severance* (2022 on) | A spare terminal works best with live data running on it |
| *Andor* (2022 to 25) | Black, white and a touch of red; hardware shape sets the layout |

## Blending with Hipgnosis

Both put one strange object in a calm, real place. Storm on *Presence*: he wanted to "tamper with nostalgic pictures of the '30s and '40s with an object from the future." Brain2's beige machine is the nostalgic picture; the strange object is the addition.

- Keep one idea per screen. A blended board has one staged object and one instrument at most.
- Good meeting points: the obelisk on a CRT time strip, *Technical Ecstasy* robots on a phosphor escalator, *Go 2* text on green glass, light trails as phosphor afterglow, a sky inside a monitor (PCW 1985, `0019`), a Tinney-style object in a landscape.
- Pick which style leads. Hipgnosis leads: film page, grain, a screen as a prop in the scene. Retrofuturism leads: the panel, with one staged image inside the CRT well.

## Rule-break dial

Every slant mockup sits at one level. State the level on each board or screen ("Dial 2"), so readers know which house rules it drops. The style lab shows each level.

| Level | What it does | Retrofuturism example |
| --- | --- | --- |
| 0 | Keeps every house rule | DSKY span readout, caution lamps in house colours, coupling rockers, two-tone caps |
| 1 | Adds new furniture the house allows | Sky in the CRT, felt console Load drawer, pair picker as two machines |
| 2 | Breaks a few named rules, and says which | Amber phosphor or an orange action key, a serif headline, a mood face (GERTY) |
| 3 | Re-skins the whole tab. Layout and actions stay | LCARS elbow frame, a full beige-box green-screen tab, Y2K translucent shell |
| 4 | Breaks everything. Only data, actions and states survive | Esper zoom navigation, a Tinney-painted hero, disc-step stairs as the whole layout |

House rules most often dropped (from `docs/DESIGN_STYLE.md`): no orange or amber light; warm red for overrun only; no "should" or alarm wording; doors visible, no floating cards; three type sizes; silver, never gold. At level 2, list the rules you break. At levels 3 and 4, list the rules you keep. For level 0 and 1 options already vetted, see `../STYLE_OPTIONS.md`.

## How to make one

1. Read the base mockup. List every element and state it shows.
2. Pick the dial level and one era. If no one named them, ask, or make two boards.
3. Read `research.md` §1 and §8. Give each element an instrument or panel from that era that carries its real value.
4. Build a new artifact. Desktop first, then phone, then a board of states (empty, missed, over, done, loading).
5. Keep every action reachable. A control that looks like hardware still needs a label and focus state.
6. Publish as a new artifact titled "<Feature> · Retrofuturism slant". Do not touch the base.

## Check before publishing

- The dial level and the era are stated on each board, with the rules broken or kept.
- One glowing screen per panel; few, large numbers.
- Every label is short, factual and earns its place.
- Instruments run on real data; nothing glows for decoration only.
- One orange key at most; lamp colours mean one thing each.
- Effects are subtle and text stays readable. Reduced motion respected.
- Same data, actions and states as the base mockup.
- Nothing outside the new artifact changed.
