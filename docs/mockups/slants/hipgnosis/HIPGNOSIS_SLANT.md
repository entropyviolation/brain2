# Hipgnosis style mockup slant instructions

_Last mapped: 2026-10-21_

How to make a "Hipgnosis slant" version of any Brain2 mockup. First used on the To do tab.

Example canvases:
- [To do · Hipgnosis slant](https://claude.ai/artifact/2PVkeHC7SWAZPcQ585sSHT), slanted from [To do redesign mockup](https://claude.ai/artifact/AhZ7M3tfBx1ahrGzTG4xH6). A full level 4 slant.
- [Style lab](https://claude.ai/artifact/8o4MiAbSTdfpHdFdnrX36W). 15 boards across dial levels 0 to 4, Hipgnosis and retrofuturism mixed. Look here first to see what each level means.

Research beside this file: `research.md` (covers, devices, palette, CSS recipes) and `research-2-hipgnosis.md` (process, quotes, deep cuts, craft, 20 UI translations). Options that keep the house rules: `../STYLE_OPTIONS.md`. Sister slant: `../retrofuturism/RETROFUTURISM_SLANT.md`.

## Scope: read this first

- This protocol applies only when someone asks for a Hipgnosis style or Hipgnosis slant mockup.
- Inside a slant, the designer does not have to follow `docs/DESIGN_STYLE.md`, `docs/DESIGN_REFS.md`, any `*_REDESIGN.md` look, or any other house rule. Follow one only if it helps the picture. The dial below says how many to drop.
- It changes nothing outside the slant. Never edit other mockups, style docs, or app code because of it. A slant is always a new, separate artifact; the base mockup stays as it was.
- Keep the feature itself. Same data, same actions, same states as the base mockup. The slant changes how it looks and feels, not what it does.

## The one idea

Hipgnosis (Storm Thorgerson, Aubrey "Po" Powell, later Peter Christopherson, London 1968 to 1983) put one strange, staged, photographed idea on the sleeve instead of the band. Do the same: give each screen one central visual metaphor that *is* the data, not decoration next to it.

Ask: what object, placed in a real landscape, would show this number? Then build that object.

## How Storm worked

Copy the process, not only the look. Quotes are verified in `research-2-hipgnosis.md` §1; cite them with their source if one goes on screen.

1. **Idea first, band second.** Sell a concept, not a portrait. The feature is the band. Its data stays; its usual face does not have to appear.
2. **Pun from the title.** Read the screen's name and labels literally. *Technical Ecstasy* became two robots meeting on an escalator. *Force It* became a bathroom full of taps. So "Push" can be a hand on a heavy door, "Inbox" a tray, "Someday" a horizon.
3. **Several roughs, one quick yes.** Sketch two or three ideas per screen. Keep the one that reads in a second.
4. **Do it for real.** "What I do is set someone on fire or build a statue and photograph it." (Creative Review). In UI terms: the object measures something real. A decorative robot that measures nothing breaks the idea.
5. **Shorthand.** "All I try to do is represent the music." (Creative Review). One object, not a scene full of props.
6. **No explanation offered.** "I like pictures that don't necessarily have an explanation off pat." (Q, 1992). Do not caption the metaphor. The data label is enough.
7. **Box clever.** Storm worked inside budgets. Work inside CSS and SVG; no stock photos needed.

## Moves, in order of weight

1. **One staged photograph as the header.** A low horizon (about 64% down), a bleached or infrared-pink sky, a dark field, a vignette. One object stands in it and carries the key number.
2. **Visual puns that hold real data.** From the To do slant:
   - *Presence* obelisk: its height is the time promised, its shadow is the time left. Click it to open the load detail.
   - *Dark Side of the Moon* prism: one white beam of time splits into Day, Week, Month, Season, Other. Each ray is a button.
   - *Wish You Were Here* fire: only an estimate overrun burns.
   - Splashless diver at Mono Lake: an empty band. "Not a ripple."
   - *Atom Heart Mother* cow: an empty day, with no caption.
   - Peter Gabriel's smeared SX-70 Polaroid: a missed task.
3. **Photographic objects for lists.** A list is a contact sheet: film edge print in orange, sprocket holes, frame numbers, red grease-pencil rings for what is picked out. A detail view is a print or a Polaroid. Done items are prints in a pile.
4. **Packaging as interaction.** "Gatefold LPs were a place to exercise our magic." (Seconds #46). Sleeves slide out (Add task), gatefolds unfold sideways (task detail), round shrink-wrap stickers carry counts, black shrink-wrap seals the done list.
5. **Hide the text.** Titles small, letterspaced, in a corner. Counts on stickers. Secondary meta fades in on hover or focus. Faces never shown: figures from behind, masked, small, far away.
6. **Film surface on everything.** Grain over the whole page, vignette on photographs, sepia or hand-tinted colour, a slight rotation on prints.

## The technology covers

These are the bridge to a retrofuturism slant. Storm on *Presence*: he wanted to "tamper with nostalgic pictures of the '30s and '40s with an object from the future" (Q, 1992).

| Cover | The idea | UI use, with the data it carries |
| --- | --- | --- |
| Black Sabbath, *Technical Ecstasy* (1976) | Two robots, one curved, one angular, meet on an escalator | Up-next queue on a diagonal stair; the top step is next. Or a rare toast when two tasks link |
| Alan Parsons Project, *I Robot* (1977) | A painted robot with an atom brain over real airport escalator tubes | Automation rules page; orbit count is the number of active rules |
| Wishbone Ash, *Argus* (1972) | A helmeted figure from behind watches a craft rise over a gorge | Deadline glyph that rises over a low horizon as the due date nears |
| Black Sabbath, *Never Say Die!* (1978) | Masked pilots by a vintage trainer plane | Private mode: masked avatar slot, redacted title until hover, count in the header |
| XTC, *Go 2* (1978) | All text: "This is a RECORD COVER. This writing is the DESIGN upon the record cover." | Self-describing empty state that names the real list and the real key |
| Genesis, *...And Then There Were Three...* (1978) | Time-lapse light trails tell the story | Task history as one afterglow strip; brightness is time in each state. Or a focus timer whose trail is elapsed time |

Also: *Going for the One* (coloured lines across a photo: one line per active filter), *ELO 2* (a bulb as a spaceship: an idea-inbox count), *Animals* and *Quark* (power-station chimneys: smoke height is open tasks per area).

## Craft: airbrush on photo

Richard Manning retouched the prints. His aim was "to improve the photograph": "softly bleaching dark areas and opening up what is already there," "with a sable brush and photo dyes" (Ultimate Classic Rock). For *Technical Ecstasy* he masked all but the escalator glass, bleached it, washed in yellow ochre, then airbrushed each robot in masked segments onto a dye-transfer print (richardmanning.co.uk). So the machine look is paint on a real photo, not a drawing on blank paper.

In CSS: build the scene first (gradient sky, ground, vignette). Then lay the object over it with soft `radial-gradient` highlights and a blurred `drop-shadow`, not hard vector edges. Mask with `mask-image` to "bleach" one area pale. George Hardie's line art (prism, robots, Deco logo) is the one exception: single-weight technical lines, as on a drafting sheet.

## Best UI translations

Pick from `research-2-hipgnosis.md` §5. The strongest, beyond the table above:
- **Storyboard grid** (*The Lamb*): weekly review as seven monochrome frames; today's frame steps forward and lights.
- **Retoucher's mask** (Manning): edit mode washes everything pale except the field being edited.
- **Element in a box** (*Deadlines*): a panel fills with tint as time passes. Fill level is real days.
- **Many of one thing** (*Elegy*): a streak field, one red ball per done day on a dune baseline; gaps are missed days.
- **Billiard balls** (*Venus and Mars*): "Which first?" as two balls; pick one and the other rolls away.

## Palette

Near-black ground with one hot accent at a time.

| Role | Hex |
| --- | --- |
| Ground | `#0e0d0c` |
| Panel / film base | `#16161a`, `#1c1712` |
| Text, bone | `#ece6da` |
| Text, dust (secondary) | `#a39c90` |
| Bleached sky | `#d9d6cc`, `#c9c3b7` |
| Infrared pink, horizon | `#d9a9a6`, `#b9787e` |
| Sepia | `#8a6a4a`, `#3b2a1e` |
| Houses hand-tint | amber `#d98a3a`, violet `#7a5a8c` |
| Manning ochre wash (by eye) | `#c9a45c` |
| Film edge print | `#d68a46` |
| Grease pencil | `#e04a3a` |
| Fire (overrun only) | `#e2552b`, text `#f08a4b` |
| Dark Side spectrum | `#d0453a` `#e08a3a` `#e2c24c` `#5fa36c` `#5a7fc4` |

The spectrum is for the prism only. Fire is for one meaning only.

## Type

- Sans: **Archivo** (variable width; wide and letterspaced for labels, narrow for big numbers). Inter Tight also works.
- Captions: **Cormorant Garamond** italic, in a dry, slightly dark voice.
- Credits and quotes: **IBM Plex Mono**, small ("Photography: A. Powell").
- Labels: 10 to 11px, uppercase, `letter-spacing: .28em`. Big numbers light (weight 300), not bold.

## Copy voice

Short, quiet, a little ironic. Say what is true and stop. "Pushed once. It came back." "Required. Not a ripple." "Three, so far." Never cheerful, never a sales line. A quote on screen is real and carries its source.

## Motion

Slow and physical. 0.7 to 1.1s, `cubic-bezier(.2,.7,.1,1)`.
- Gatefold: `perspective(1200px) rotateY(-70deg)` to flat.
- Develop: `brightness(2.2) contrast(.3) sepia(1) blur(3px)` to none. Use it instead of a spinner.
- Sleeve: slide down 28px and fade in. Drift: the sun or particles move a few pixels over 10 to 15s.
- Always wrap motion in `prefers-reduced-motion`.

## Techniques with no photos

- Grain: an inline SVG `feTurbulence` (`baseFrequency .85`, desaturated) at `opacity .22`, `mix-blend-mode: overlay`, `pointer-events: none`.
- Scene: one `linear-gradient` with a hard stop at the horizon, plus a radial vignette.
- Obelisk: a narrow black block with a side gradient; shadow is a `clip-path` wedge on the ground.
- Prism: SVG triangle, a glowing white line in, ray polygons out. Compute ray points in script so each ray ends at its button.
- Contact sheet: `repeating-linear-gradient` sprocket strips. Grease pencil: a loose SVG ellipse, round caps.
- Fire: a radial gradient from one corner plus an inset edge line. Smear: skewed, blurred stripes over the print.
- Polaroid: cream frame, thick bottom edge, italic serif caption, rotate 2 to 3 degrees.
- Light trail: a long SVG path with a `linear-gradient` stroke that fades toward the past.

## Rule-break dial

Every slant mockup sits at one level. State the level on each board or screen ("Dial 2"), so readers know which house rules it drops. See the style lab for examples of each.

| Level | What it does | Hipgnosis example |
| --- | --- | --- |
| 0 | Keeps every house rule. A Hipgnosis idea in house materials | Obelisk on the time well, self-describing empty band, develop-in instead of a spinner |
| 1 | Adds new furniture the house allows: a room may invent its own when the layout holds | Escalator up-next column, storyboard week, contact-sheet frame numbers on the mill |
| 2 | Breaks a few named rules, and says which | Orange or amber light, a serif caption, a face (a mood glyph, a masked figure) |
| 3 | Re-skins the whole tab. Layout and actions stay | The black film page with grain, prism span picker, contact-sheet list |
| 4 | Breaks everything. Only data, actions and states survive | The full To do slant: staged header scene, fire, gatefolds, shrink-wrap |

House rules most often dropped (from `docs/DESIGN_STYLE.md`): no orange or amber light; warm red for overrun only; no "should"; doors visible, no floating cards; three type sizes; silver, never gold. At level 2, list the rules you break. At levels 3 and 4, list the rules you keep.

## How to make one

1. Read the base mockup. List every element and state it shows.
2. Pick the dial level. If no one named one, ask, or make two boards at different levels.
3. Read both research files. Read each screen's labels literally and pun from them. Pick one cover or device per element; prefer one that carries the element's real value.
4. Build a new artifact. Desktop first, then phone, then a board of states (empty, missed, over, done, loading).
5. Keep every action reachable. Stark is fine; lost is not.
6. Publish as a new artifact titled "<Feature> · Hipgnosis slant". Do not touch the base.

## Check before publishing

- The dial level is stated on each board, with the rules broken or kept.
- One central metaphor per screen, and it carries data.
- Near-black ground, one hot accent visible at a time (levels 3 and 4).
- Text is small and placed in corners; nothing shouts.
- Grain on, prints rotated, motion slow, reduced motion respected.
- Every quote on screen is real and sourced.
- Same data, actions and states as the base mockup.
- Nothing outside the new artifact changed.
