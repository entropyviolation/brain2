# Design refs — Divine Machinery / Computer Angel / Y2K

Moodboard inventory. Source folder: [`designrefs/`](../designrefs/)
(49 stills: 47 `.jpg`, 1 `.png`, 1 `.webp`, plus `babyanimals/` and one running-app
screenshot that is not a motif). The folder has no caption text files. This
document is how to read the stills.

[`DESIGN_STYLE.md`](DESIGN_STYLE.md) is the house order: failures, then layout,
then a palette. These stills support that palette. They are ingredients for
**more** magical interaction, a Nintendo DSi feel (pixel type, hard pixel
edges, small glowing indicator lights), and a retrofuturistic esoteric-technology
vibe. Major redesigns are planned. A still is not a template that freezes the
app as one costume, and it is not an instruction to stay plain.

Habits Daily and Lists turned out well using some of these pictures. They are
examples, not rooms to clone. A new room may invent furniture when the layout
rules hold and the four failures are avoided. The interactions the redesign
should make more of are named in
[`DESIGN_STYLE.md`](DESIGN_STYLE.md): willpower gems
(`willpower-gems.tsx`, `lib/willpower-physics.ts`), Lists orbs
(`FolderViewIcons.tsx`), and the Habit-form sand close
(`useWindowSandClose`). None of those motions is a still in this folder.

Every still is tagged as one or more of:

| Lane | Meaning |
|------|---------|
| **Idea** | A composition or mechanic that could be used. Steal the thought, not the pixels. |
| **Direct** | A photograph that could be shown in the UI as an asset (desktop plate, orb/gem, overlay, living picture). Knock out or copy; do not redraw as a generic line icon. |
| **Apply** | Visual language to rebuild in CSS: materials, lamps, CRTs, metal, pixel type, small lights. |

> **How to use a still.** Read it as a machine you could hold, as a painting,
> or as an ancestor. Then add the motion the picture cannot show. Pasting one
> still onto every window is a costume. Being magical, pixel, or esoteric is
> the direction, not a defect.

## How to read every still

Each file is a frozen picture. Read it as one or more of these, then add the
motion the picture cannot show.

| Register | What the still is for | What the app adds |
|----------|----------------------|-------------------|
| **Machine** | A device you could hold or sit at: silver handheld, phosphor console, word processor, oscilloscope, camera LCD, patch bay | Chunky keys, stylus glass, milled rims, nested wells, small indicator lamps. The frame feels held. |
| **Art** | A circuit, cursor, voltage, mushroom, or stone that is already a drawing | Sigils, lace, living pictures, flocks, jewels set where solder would be. The room may be esoteric. |
| **Ancestor** | A Windows dialog or beige workstation UI | Bevel, navy, inset field, pixel font — a quote inside the machine, not the costume, and not a File menu to copy. |
| **Impossible** | None of these stills move | Dissolve, melt, flock, sand, the willpower stir. Rare, on a real verb. |

Pixel-game UI and photoreal surrealism are both wanted. A window may pass
from one into the other. A DSi-like screen is pixel type plus a few glowing
lamps, not a second copy of the TENO screenshot.

**Leave in place** Plan chip opalescence, the Analytics light-instrument
canvases, hairline texture, and the willpower plate (`willpower-gems.tsx`):
small photographed crystal, Settings changes the photograph, plate click is
physics stir, the crystal PNG occludes gems that pass behind it. Those are
rooms and interactions that turned out well, not a kit to spread by force.

## Gaps

What this folder does **not** contain. A later redesign is not blocked by a
missing still. The running components are the reference for motion. Notes
below are only for files opened while writing this section. The catalog
further down describes the rest of the inventory; do not treat an unopened
row as a new eyewitness citation.

- **No Nintendo DSi.** No dual screen, no DSi font specimen, no DSi power or
  wireless LED. Closest lights actually opened: Tek 465B’s green POWER lamp
  and red trigger lamp (`a898e04c534aeed3017938c701efdb2f.jpg`); TENO’s tiny
  orange and green lamps and nixie digits
  (`5d58e7b46cf9bd493eb09f761340fb17.jpg`); the Kyocera Finecam’s green SET UP
  lamp (`117ebb9171f51c2bd7a913a12489fea9.jpg`); the Sony editor’s green and
  red pixel type (`ffa2396fc4af38ae8e97e646029c2e2e.jpg`); the gadget wall’s
  many small glowing readouts (`6586d2eaaa241117d4612337591d5563.jpg`).
  Closest pixel: TENO, the cursor angel
  (`2902904327ee778cd54eb65ae0c231ec.jpg`), the Sony editor, the flower CRTs
  (`9d225800a3f631bc7559c83d11f1aaa2.jpg`), and the pixel forest inside the
  Display Properties monitor (`60d7202cb958e11734ce0567eb382868.jpg`).
- **No still of the three shipped interactions.** Willpower-gem physics, Lists
  orb drag and auto-organize, and the collapsing-sand close are in code
  ([`DESIGN_STYLE.md`](DESIGN_STYLE.md)). Do not wait on a reference photograph
  of them.
- **Stills do not move.** Dissolve, melt, flock, sand, and bounce are not
  pictured. The cursor angel is the flock standing still.
- **`babyanimals/`.** `babyfox.jpg` was opened: a cutout fox kit on white,
  cabinet stock, not a machine. These were not opened, so they are not
  described here: `images.png`, `physics_bowling_19.png`,
  `Analyzing-Bowling-Ball-Path.webp`, `babylamb.webp`.
- **Running-app shot, not a motif.** `Screenshot 2026-09-21 at 2.49.46 PM.png`
  shows the BRAIN2 header with Friend, Review, System, and Capture as visible
  groups — doors, not a File menu — over a lace-and-circuit desktop with a
  kitten. Evidence that the doors are the chrome. Not a template to redraw.

## Conflicts

Read these as ancestors, not templates.

- **Win95 MDI** (`2a0002d93dfba067de848caec9951b23.jpg`). Four nature photos in
  child windows, and a menu bar: File, Edit, Search, Help. The photos sitting
  in windows are the useful part. The menu bar conflicts with the first
  failure: do not hide working doors behind a File / Capture / Review menu.
  Do not take the gray frame as the costume for a new room.
- **Display Properties** (`60d7202cb958e11734ce0567eb382868.jpg`). A gray
  dialog whose monitor holds a pixel forest. The useful part is picture-in-glass
  and pixel treatment. The dialog as the whole face would freeze a Win95-only
  costume.
- **TENO** (`5d58e7b46cf9bd493eb09f761340fb17.jpg`) and the **gadget wall**
  (`6586d2eaaa241117d4612337591d5563.jpg`) support pixel type, small lights,
  and dense esoteric instruments. Pasting either picture as the app skin
  would be a costume. Read them for lamps and pixel, then invent.
- **No opened still is a stack of floating white cards.** Nothing in the
  files opened for this pass authorizes restacking an instrument into SaaS
  cards. That restack is a failure in [`DESIGN_STYLE.md`](DESIGN_STYLE.md),
  not a look this folder is missing.
- **Instructions that fought the vision.** Older lines in this file told
  agents to copy Habits onto the next room, to keep copy plain, or to treat
  decoration as the thing to avoid. Those are withdrawn. Magical, esoteric,
  beautiful interaction is wanted. A teaching caption is welcome when the
  line is real and sourced (failure 4 in [`DESIGN_STYLE.md`](DESIGN_STYLE.md)).
  One still pasted on every window is still a costume. That limit is not a
  ban on magic.

Stills opened for the gaps and conflicts above, and read as support rather
than costume: mushroom desk (a living thing wired into the racks,
`6cabaec24a39680944ab58f2989afd7e.jpg`), jewel PCB (stones as solder on nacre,
`f54430419ed206fa1bea7b27a4ff6a9e.jpg`), crystal-ball cat (a scrying orb,
`308a1c67d85e5e4f0e903e2dce6b8baf.jpg`), lightning seraph (engraved voltage, a
gesture, `39846df63bc1eb54a7b7e2fbcd6566a1.jpg`), flower CRTs (pixel flowers
on three equal phosphor screens), cursor angel, and the handhelds Pocket PC,
hiptop, Motorola flip, Sharp 書院, Kyocera Finecam, and Sony editor — held
machines with a picture in glass. They are kin to a DSi’s object. They are
not a DSi photograph.

---

## Phase split (now vs later)

| When | Surface | Who | Steal from (nicknames below) |
|------|---------|-----|------------------------------|
| **Now (shipped)** | App-wide desktop field | — | Default **teal** (classic Win95). Optional photoreal PCB plates: ceramic, mint snowflake, ice, x-ray, FR4. Settings → **Desktop**. Copies in `public/pcb/`. Saved plates are never migrated onto teal. |
| **Now (shipped)** | Daily Habits interior — one room that turned out well, not a template | Fawn | Jewel PCB, TENO console, gadget wall, Tek scope, silver book, iridescent bloom, crystal-ball cat, EQ sliders. Lightning-seraph *gesture* on 100% bars only — not a seraph logo. **Willpower gems shipped** (satellites, invert, pin, stir, PNG occlusion, Settings-only crystal; **Small LEDs** rocker) |
| **Parallel (shipped)** | App-wide gunmetal gray (slow slider on the existing patina) | Colt | Gadget wall, TENO, IRIX workstation, Display Properties (cool face, not yellow-gray) |
| **Later** | Home TOP leftover **square widgets** (review, affirmation, **weather instrument**, user add/hide) | Home lane | IRIX cattle + gadget wall: **equal-height modules**; analog meters as weather, not a forecast card. See [Visual language to APPLY](#visual-language-to-apply) |
| **Shipped, and in bounds** | Global header cabinet (BRAIN2 caption + friend well + Friend / Review / System / optional **now** well / Capture groupboxes) | Shell | Home window + **Tek POWER lamp**, fieldset legends, TENO milled keys, phosphor counts. Optional **now** well between System and Capture for live Working sessions. The caption stays readable type, not a Lucide set and not one pasted cockpit. The fascia may still become silver key-wells and may dissolve — [easy alignments](DESIGN_STYLE.md#easy-alignments-not-started). Today's friend sits in the Friend groupbox. Top tabs still later. |
| **Later** | Top tabs | not this wave | Quoted folder tabs may become pixel-game lamps (TENO mode keys). Labels stay. Do not hide them in a modern tab bar, and do not reskin the whole shell as one console screenshot. |
| **Allowed** | Lists / Plan / Scheduler *frames*, and any new room | — | Machine, art, pixel, small lights, one dissolve. See [Do not costume](#do-not-costume-the-whole-app). Lists orbs, Plan chips, and Habits gems stay their own objects. |

CRT / interlace is an **optional overlay** (scanlines, phosphor glow on a bezel),
not a chart that fakes precision. Empty axes still get a sentence, not a
cross-hatch performing science.

---

## Ideas that could be used

Steal the thought. Do not paste these compositions onto every window — that is a costume. Use them as fuel for pixel, lights, and esoteric interaction.

| Idea | From | Could become |
|------|------|----------------|
| Jewelry as solder — rhinestones sitting on nacre traces | **Jewel PCB** | More cabinet gems; WILLPOWER kin (already an orb, not a board) |
| Packed pixel cockpit: patch cables, nixie digits, CRT stills, analog throws | **TENO console** | The 8-bit register. Habits wells (shipped packing). Header keys and tab lamps may speak this pixel. Not a single skin pasted on every window |
| Y2K instrument collage: clocks, analog meters, LCDs, chrome pipes, cassette | **Gadget wall** | Home leftover squares as **weather instruments**. The Tracking pen well is plain steel (not this collage, and not a photographed plate) |
| Living picture inside a CRT, nested instrument wells around it | **IRIX cattle** | Today's friend nest (shipped, tiny). Home TOP as stacked **equal-height modules** |
| Real oscilloscope: green sine in a bezel, POWER LED, BNC, knobs | **Tek 465B** | Habits / Home CRT wells (shipped phosphor). Analytics optional bezel. Never fake-precision axes |
| Animal drawn in copper on a board | **Cat traces** | Engraved hairlines (shipped on Habits grid). Tracking pen well is plain steel; this plate is a retired reference |
| Body + board + radial heatsink jewel | **Viscera collage** | Density for Needs Attention (lace won). Radial jewel as a gem crop |
| Wireframe glove meeting flesh at a circuit star; operator at a mushroom desk | **Mesh hands**, **Mushroom desk** | Feral module energy. Ribbon cable as mycelium on table *edges* (deferred) |
| Connector encyclopedia | **Ports chart** | Tracking pen-well mouths later. Not a toolbar |
| Liquid-silver seraph border around aqua glass | **Tribal chrome frame** | A well's frame when the room is being art. Not a replacement for a readable caption |
| Winged voltage over mountains | **Lightning seraph** | 100% bar *gesture* only — not a logo |
| Landscape crucifix of stacked speakers | **Speaker cross** | Motif only — not a toolbar icon |
| Win cursors flocking into a figure | **Cursor angel** | The 8-bit register as a body. A flock on organize or close — identity as motion, not a logo |
| White cat with a scrying orb on a pewter stand | **Crystal-ball cat** | WILLPOWER orb-on-stand kinship (shipped). Optional orb crop |
| Triple CRT of pixel flowers; cockpit chair; exposed cable | **Flower CRTs** | Operations / Habits phosphor botanicals. Equal-height screens |
| Botanical catalog HUD around a mountain photo | **Botanical HUD** | Green terminal type as *readout*, not a SaaS overlay |
| Operator under a wired mushroom | **Mushroom desk** | Installed-module feral interiors (Tidy / Film DNA already do this) |
| Winamp-class player with analog EQ and playlist | **OSD AMP** | Overview sliders (shipped bloom). **Do not** steal the EQ for row percents |
| Holy-card lace stuffed with club flyers | **Lace + rave** | Sacred + nightlife lining. A teaching caption is welcome when the line is real and sourced |
| Kitten on a keyboard in a nest of beige CRTs and mylar | **CRT kitten** | Mood for today's friend. Click the photo for a Stardew chat bubble (mission nudge). Click the bubble for details. Not a caption-bar restyle |

---

## Images that could be used DIRECTLY

Photographs to **show** in the UI (copy, crop, or knock out). Moodboard files
stay in `designrefs/`; shipped copies live under `public/`.

### Already served

| File | Nickname | Shipped as | Where it shows |
|------|----------|------------|----------------|
| `cfd93985b7a2a76aa69823561c8525d1.jpg` | Ceramic PCB | `public/pcb/ceramic.jpg` | Settings → **Desktop** |
| `d09ee9b9432fa21ba8db4f1400a533e9.jpg` | Snowflake circuitry | `public/pcb/mint.jpg` | same |
| `07e703d6f9fda08564ed32ba1eea8295.jpg` | Ice PCB | `public/pcb/ice.jpg` | same (stock watermark is veiled in CSS) |
| `2dc0e2cd6390065e28da01f96665db4a.jpg` | X-ray PCB | `public/pcb/xray.jpg` | Settings → **Desktop**; also a retired Tracking pen-well plate (`public/pen-tray/xray.jpg`) |
| `5f3b8feaa2e9037ae0323d6635e28bb5.jpg` | FR4 classic | `public/pcb/fr4.jpg` | Settings → **Desktop**; also a retired Tracking pen-well plate (`public/pen-tray/fr4.jpg`) |
| `e624b3aca52ff4d3f8cfe5fe476d3a7e.jpg` | Cat traces | `public/pen-tray/cat.jpg` | Retired pen-well plate. The well is plain steel |
| `28003c286757ff410d03de24bc24c898.jpg` | Silver book | `public/pen-tray/pewter.jpg` | Retired Tracking pen-well plate |
| `f54430419ed206fa1bea7b27a4ff6a9e.jpg` | Jewel PCB | `public/pen-tray/jewel.jpg` | Retired Tracking pen-well plate |
| `5934b2e94f44ba6bdf53382877091c3c.jpg` | Iridescent bloom | `public/pen-tray/bloom.jpg` | Retired Tracking pen-well plate |

### Now — Time Grid plot

The Time Grid plot uses Tek 465B (paper inside a bezel; phosphor only on the live occupancy figure), Pocket PC (the glass fills the lip), TENO (one packed toolbar row, a shorter ghost row), and FR4 hairlines (ticks, fainter after now). This pass does not restore the retired pen-tray photographs.

### Now — Tracking pen well (plain steel)

The palette well is plain steel, not a photograph and not velvet. Retired
plates (Cat traces / Pewter / Jewel PCB / Bloom / FR4 / X-ray) stay in
[`public/pen-tray/`](../public/pen-tray/) and are not painted. Beads default
to one row; **Expand** (right of Tree) unwraps them and reads **Conceal**
while open. **+ New pen** sits under the beads while expanded. Collapsed, a
search that matches nothing offers **Create new pen** with that query as the
name.

Do not paste a PCB onto Lists/Plan window chrome or the Habits grid — those
rooms already have their own materials. The PCB is the *estate*, not the furniture.

### Cabinet stock (knock out later — Phase D)

Personal objects, not a matching vector set. Same pipeline as orbs/gems
(`lib/remove-background.ts`).

| File | Nickname | Direct use |
|------|----------|------------|
| `f54430419ed206fa1bea7b27a4ff6a9e.jpg` | Jewel PCB | Crop rhinestones / AB crystal as extra gems |
| `5934b2e94f44ba6bdf53382877091c3c.jpg` | Iridescent bloom | Orb or Plan-chip kin (nacre flower) |
| `b26bfd50f829f8dfaa1266da07c16d93.jpg` | Sky jewel-case | CD-tray orb (aqua plastic + clouds) |
| `b35614e58aefaebb40839e94ac6c1257.jpg` | UV rabbit | Phosphor-animal orb on black |
| `c000168519a7bcab944ab3c95b9229bc.jpg` | Mandelbrot | Recursive mint sigil as an orb |
| `308a1c67d85e5e4f0e903e2dce6b8baf.jpg` | Crystal-ball cat | Crop the glass orb on the pewter stand |
| `e624b3aca52ff4d3f8cfe5fe476d3a7e.jpg` | Cat traces | Board-as-trinket photo (navy + gold cat) |
| `3691d9640986678a27262b1989b89c29.jpg` | Bare FR4 | Undressed mint board as a cabinet object |
| `e1356c71dd528d820ba3bd40774fc2c9.jpg` | Phosphor spiral | CRT-well slug / nebula fill (already kin to Home overview) |
| `download.png` | CRT kitten | Optional **today's friend** gallery still — living picture, not chrome |
| `designref1.jpg` | IRIX cattle | Fractal pasture as a *picture inside a CRT well*, never a full-page wallpaper |

### Overlay stills (interiors only)

| File | Nickname | Direct use |
|------|----------|------------|
| `204a5f9b8f15aa8c411d21a93592743c.jpg` | Tribal chrome frame | PNG frame around a Habits / module *well* — never a Lists caption |
| `4fac4805754805418d608371a0f3eaaa.jpg` | Oval holy card | Lace lining bitmap (Needs Attention is CSS today: `.hab-na`) |
| `68ba1f33b0fc2672abbe5538ca345720.jpg` | Arched lace | same |
| `79d20e2c416a102496722d3a742d2ae6.jpg` | Heart Madonna | same |
| `a043e8a27ff07b747e9ba679dfeb1df9.jpg` | Child + cross | same |
| `a37a2f36fce73d8a106cf0ca8865be31.jpg` | Floral urn | same |
| `d206bbff071d39c4b5a5dead89542a0b.jpg` | Gothic lace | same |
| `3b6e176372e1f27b844344b888d43a86.jpg` | Lace + rave | Lined well with nightlife type *inside* the lace, not on the title bar |

Noble-gas stills (`61ildG1qWDL.jpg`, `w3caho3pypz61.jpg`,
`Screenshot-2024-07-03-201409.webp`) are **reference photos for plasma hue and
dome shape**, not rasters to paste. Grade meters are CSS/SVG in
`noble-gas-tube.tsx` (hemispherical dome like the fan of tubes, not a pointed
ampoule).

---

## Visual language to APPLY

Rebuild in furniture. Copy materials and packing, not screenshots.

### Materials

| Material | From | Apply as |
|----------|------|----------|
| Nacre / pearl / oil-slick | Jewel PCB, iridescent bloom, sky jewel-case | Habits console field, Plan chip wash, WILLPOWER plate |
| FR4 / ceramic / ice / x-ray solder mask | Five desktop plates + bare FR4 + cat traces | Desktop estate; **hairline traces** as engraved rules on grids — not a PCB pasted on the table |
| Pewter / gunmetal / olive enamel | Silver book, TENO, gadget wall, IRIX | `--chrome-face` cool bias; WILLPOWER oval cartouche; Habits metal (`--hab-metal`, never `#c5c3bc`) |
| Aqua plastic / mylar | Sky jewel-case, CRT kitten | Cabinet objects; CRT nest lining |
| Cream paper-lace | Holy cards | Needs Attention *lining* (shipped `.hab-na`) — cream on metal |
| Glass / plasma | Noble-gas rack, ampoule grid, fan of tubes | Grade finger-tubes (shipped) |
| Velvet stays Lists | — | Do not paint Lists velvet gunmetal |

### Lamps

| Lamp | From | Apply as |
|------|------|----------|
| Tek POWER LED + TENO tiny LED strips + FR4 via rows | Tek 465B, TENO, ceramic / x-ray / snowflake pads | Yes/No **panel lamps** (`habit-led-lamp.tsx`); **glass percent tube** (`percent-led-bar.tsx`) |
| Jewel lamp on a rocker | TENO / gadget wall | Cockpit switch jewel (`cockpit-switch.tsx`) |
| Nixie-like digits | TENO | Numeric 5×7 luminaire when Loading Bar is off (`percent-led.tsx`) |
| Smoked circular well, visible die | Gadget wall LCDs / TENO | Recessed lamp language — warm `percentLedTint`, not blast-white |

### CRTs

| CRT | From | Apply as |
|------|------|----------|
| Green phosphor sine in a bezel | Tek 465B | Home / Habits CRT wells; `--hab-crt-green: #7dffc4` + slight `--hab-crt-glow` |
| Small nested CRT readouts beside a living picture | IRIX cattle | Today's friend nest; optional overlay `.hab-crt` (off by default) |
| Triple equal-height phosphor botanicals | Flower CRTs | Operations phosphor; do not make scanlines unreadable |
| Blue phosphor + cable tangle | CRT kitten | Mood only. Interlace is a CSS overlay on a bezel, toggleable |
| Phosphor nebula slug | Phosphor spiral | Home overview CRT field (shipped kin) |

Never use CRT grain as a chart that lies about sample size.

### Metal

| Metal | From | Apply as |
|------|------|----------|
| Cool gunmetal panels, patch wells, knobs | TENO, gadget wall | Habits chassis; house patina slider (`lib/chrome-patina.ts`) |
| Beige-gray 3D furniture, nested bevels | IRIX cattle, Display Properties, Win95 MDI | **Ancestor quote** — nested wells and inset fields. Not a face to protect from silver, pixel, or a dissolve |
| Baroque pewter filigree, oval cartouche, hinges | Silver book | WILLPOWER plate (shipped) |
| Chrome pipes, cassette shells, RCA mouths | Gadget wall, ports chart | Pen-well / cable texture later — not Explorer chrome |
| Liquid tribal chrome | Tribal chrome frame | Interior frames only |

### Weather instruments

The gadget wall *is* a weather station that grew computers: circular analog
meters, bar-graph LCDs, Casio clocks, chrome pipes, tight wells. Home leftover
squares should read as **instruments**, not forecast cards.

| Steal | From | Apply as |
|-------|------|----------|
| Round analog meter in a metal well | Gadget wall | Weather widget: needle + engraved scale (temp / condition), not a SaaS chip |
| Small LCD / Casio readout | Gadget wall, Pocket PC, hiptop, Kyocera | Secondary facts as a tiny display. The glass is a picture sitting in a machine |
| Nested instrument around a living picture | IRIX cattle | Affirmation / review / weather share one console strip |
| Botanical HUD green type | Botanical HUD | Optional readout type on the weather well — still dark ink on metal |

Do not invent a white weather card on the PCB desktop. File packing stays with
[`components/Home/README.md`](../components/Home/README.md). **Landed** on Home
as an analog instrument (click opens city, beach, rain, week, tides).

### Equal-height modules

Sibling wells of one instrument share **one height**. Stack or tile; do not
stretch one pane to fill leftover width.

| Steal | From | Apply as |
|-------|------|----------|
| Right-hand stack of matching beige wells + bottom keypad / small CRT / buttons | **IRIX cattle** (canonical) | Home TOP strip leftover **square widgets**: review, affirmation, weather, user add — same module height |
| TENO panel rows of matching height | **TENO console** | Habits packed wells (shipped). Grouped rockers stay one strip |
| Three CRTs the same height | **Flower CRTs** | Multi-readout rows |
| Nine ampoules on one shelf | **Noble-gas rack** | Grade tubes as a matching row (shipped) |
| Fan of five tubes in one holder | **Fan of tubes** | Same dome language, one battery |
| Gadget-wall cells of similar visual weight | **Gadget wall** | Do not let Today's Progress or points wells go `align-items: stretch` across leftover space |

**Landed** on Home: leftover TOP-strip width is equal-height squares that wrap.
See [`DESIGN_STYLE.md`](DESIGN_STYLE.md#depth--spacing).

---

## Catalog (every file)

Nicknames are for agents. Paths are `designrefs/<filename>`. **Lane:** Idea /
Direct / Apply as above.

### Keystone (read first)

Read these as fuel for a more magical, more pixel, more esoteric room — not
as Habits-only stickers, and not as a skin to paste on the next screen.
Win95 MDI is an ancestor later in this catalog, not the first still. A file
named here may appear again below with its shipping path; the keystone row
is how to read it. Gaps and conflicts for files opened this pass are at the
top of this document.

| File | Nickname | Shows | Materials / motifs | Lane |
|------|----------|-------|-------------------|------|
| `6cabaec24a39680944ab58f2989afd7e.jpg` | **Mushroom desk** | Operator under a wired mushroom | The whole thesis in one picture: vintage racks, and a living thing that could not have been a peripheral. Ribbon cable as mycelium | Idea |
| `5d58e7b46cf9bd493eb09f761340fb17.jpg` | **TENO console** | Packed pixel workstation | The 8-bit register. Gunmetal, patch cables, knobs, phosphor, nixie, analog throws. Speak it in wells and keys; do not paste the screenshot on the app | Idea, Apply |
| `2902904327ee778cd54eb65ae0c231ec.jpg` | **Cursor angel** | Win cursors flocking into a figure | Pixel UI as a body. The impossible layer is the flock moving | Idea |
| `39846df63bc1eb54a7b7e2fbcd6566a1.jpg` | **Lightning seraph** | Winged voltage over mountains | Engraved hyperreal line. A gesture, not a logo | Idea |
| `d09ee9b9432fa21ba8db4f1400a533e9.jpg` | **Snowflake circuitry** | Mint art-print board | Traces that finish as snowflakes. Art that a window may melt into. **Shipped desktop** (`public/pcb/mint.jpg`) | Direct, Apply |
| `e624b3aca52ff4d3f8cfe5fe476d3a7e.jpg` | **Cat traces** | Cat drawn in copper on navy board | Circuit as drawing. Retired pen-well plate; the well is plain steel | Idea, Direct, Apply |
| `f54430419ed206fa1bea7b27a4ff6a9e.jpg` | **Jewel PCB** | FR4 board whose solder is jewelry | Pearl / nacre, silver traces, rhinestones. **This is the object.** | Idea, Direct, Apply |
| `36bc1715c629f42e163d54abe8741ac6.jpg` | **Pocket PC** | Silver handheld, picture in the glass, stylus | The machine you hold. Header and dialogs should feel like this object | Idea, Apply |
| `6586d2eaaa241117d4612337591d5563.jpg` | **Gadget wall** | Y2K instrument collage | Gunmetal, ribbon cable, LCDs, chrome pipes, cassette, **analog meters**, tight wells | Idea, Apply (weather, equal-height, metal, lamps) |
| `a898e04c534aeed3017938c701efdb2f.jpg` | **Tek 465B** | Real oscilloscope | Beige/gray plastic, BNC, knobs, **green phosphor sine in a bezel**, POWER LED. The same well is the wait instrument | Idea, Apply (CRT, lamps) |
| `designref1.jpg` | **IRIX cattle** | Instrument with a living picture inside | **Equal-height nested wells**, fractal cloud over pasture, small CRT readouts. Beige furniture is the ancestor; the fractal in the CRT is the art | Idea, Direct (pasture-in-CRT), Apply (equal-height) |
| `eb64e7e2716a968c513504e27d963fa2.jpg` | **Botanical HUD** | White suit, mountain, plant catalog in green type | Hyperreal photograph wearing a terminal. Readout type, not a SaaS overlay | Idea, Apply |

### Circuit-sigils & viscera

| File | Nickname | Shows | Materials / motifs | Lane |
|------|----------|-------|-------------------|------|
| `cfd93985b7a2a76aa69823561c8525d1.jpg` | **Ceramic PCB** | Rounded-rect white ceramic board | Cream/silver traces, BGA, solder pads, via arrays. **Shipped desktop** (`public/pcb/ceramic.jpg`) | Direct, Apply |
| `d09ee9b9432fa21ba8db4f1400a533e9.jpg` | **Snowflake circuitry** | Mint art-print board | Sparse silver/black traces ending in pads and snowflake nodes. **Shipped desktop** (`public/pcb/mint.jpg`) | Direct, Apply |
| `07e703d6f9fda08564ed32ba1eea8295.jpg` | **Ice PCB** | Inverted pale-blue field | Dense photoreal traces, via fields. **Shipped desktop** (`public/pcb/ice.jpg`) | Direct, Apply |
| `2dc0e2cd6390065e28da01f96665db4a.jpg` | **X-ray PCB** | Black substrate constellation | Lime-green traces, via grid. **Shipped desktop** (`public/pcb/xray.jpg`) | Direct, Apply |
| `5f3b8feaa2e9037ae0323d6635e28bb5.jpg` | **FR4 classic** | Dark green solder mask | Copper vias, dense routing. **Shipped desktop** (`public/pcb/fr4.jpg`) | Direct, Apply |
| `3691d9640986678a27262b1989b89c29.jpg` | Bare FR4 | Undressed PCB | Mint fiberglass, solder blobs, gold-ish traces, edge fingers | Direct, Apply |
| `e624b3aca52ff4d3f8cfe5fe476d3a7e.jpg` | **Cat traces** | Cat drawn in copper on navy board | Gold circuit-sigil, navy solder mask, ICs as organs | Idea, Direct, Apply |
| `046603488d7d312c0c17e2db38fb3a5a.jpg` | Viscera collage | Body + board + diagrams | Copper, green PCB, radial heatsink **jewel**, CRT face, technical ink, ribs | Idea |
| `c02f24b5335e5961501f7ad75d736eee.jpg` | Mesh hands | Wireframe + flesh meeting at a circuit star | Copper mesh glove, die photo, operator at the mushroom desk | Idea |
| `b73bd61f207c365dfa144ab70d969425.jpg` | Ports chart | Connector encyclopedia | Beige faceplate, SCSI/VGA/RCA gunmetal, ribbon-cable mouths | Idea |

### Chrome, seraph, sacred metal

| File | Nickname | Shows | Materials / motifs | Lane |
|------|----------|-------|-------------------|------|
| `204a5f9b8f15aa8c411d21a93592743c.jpg` | Tribal chrome frame | Liquid-silver seraph border, aqua glass void | Chrome, pearl wash. A well's art frame. Not a stand-in for a readable caption | Direct (overlay), Apply |
| `28003c286757ff410d03de24bc24c898.jpg` | **Silver book** | Baroque metal book cover | Gunmetal / pewter filigree, olive enamel, oval cartouche, hinges | Apply (WILLPOWER plate shipped) |
| `39846df63bc1eb54a7b7e2fbcd6566a1.jpg` | **Lightning seraph** | Winged voltage over mountains | White-gold discharge, hatched sky, CRT grain | Idea |
| `720308329cd9d64adac759fc16ddf7cc.jpg` | Speaker cross | Landscape crucifix of stacked speakers | Chrome cones, outdoor dirt. Motif only — not a toolbar icon | Idea |
| `2902904327ee778cd54eb65ae0c231ec.jpg` | Cursor angel | Win cursors flocking into a figure | CRT aqua, pixel pointers, scan texture | Idea |

### Pearl, jewel, phosphor objects (cabinet contents)

| File | Nickname | Shows | Materials / motifs | Lane |
|------|----------|-------|-------------------|------|
| `5934b2e94f44ba6bdf53382877091c3c.jpg` | **Iridescent bloom** | Glass/oil-slick flower | Pearl, chrome, gunmetal troughs, nacre | Direct, Apply |
| `308a1c67d85e5e4f0e903e2dce6b8baf.jpg` | **Crystal-ball cat** | White cat with scrying orb | Glass, pewter stand, cabinet bottles, purple tungsten | Idea, Direct (orb crop) |
| `b26bfd50f829f8dfaa1266da07c16d93.jpg` | Sky jewel-case | CD tray printed with clouds | Aqua plastic, hub, sky | Direct |
| `b35614e58aefaebb40839e94ac6c1257.jpg` | UV rabbit | Phosphor animal on black | Electric blue glow | Direct |
| `e1356c71dd528d820ba3bd40774fc2c9.jpg` | Phosphor spiral | Nebula swirl | Purple / cyan CRT glow | Direct, Apply |
| `c000168519a7bcab944ab3c95b9229bc.jpg` | Mandelbrot | Fractal coast | Mint pearl on black, recursive sigil | Direct |
| `download.png` | **CRT kitten** | Kitten on keyboard in a CRT nest | Silver mylar, beige plastic, blue phosphor, cable tangle | Idea, Direct (friend still) |
| `61ildG1qWDL.jpg` | Noble-gas rack | Nine labeled discharge ampoules on a shelf | He / Ne / Ar / … glass, black void. Habits grade-tube kinship — not a desktop plate | Apply (equal-height tubes) |
| `w3caho3pypz61.jpg` | Ampoule grid | Held discharge tubes, labeled by element | Cl / N / Xe / … plasma. Same kinship | Apply |
| `Screenshot-2024-07-03-201409.webp` | Fan of tubes | Five tubes in a dark holder | Warm wall, **rounded domes**, phosphor fingers | Apply (dome shape shipped) |

### Workstations that already *are* the two halves

| File | Nickname | Shows | Materials / motifs | Lane |
|------|----------|-------|-------------------|------|
| `6cabaec24a39680944ab58f2989afd7e.jpg` | Mushroom desk | Operator under a wired mushroom | Ribbon cable as mycelium, beige racks, green PCBs | Idea |
| `9d225800a3f631bc7559c83d11f1aaa2.jpg` | Flower CRTs | Cockpit chair, triple CRT of pixel flowers | Beige machinery, exposed cable, phosphor botanicals, **equal-height screens** | Idea, Apply (CRT, equal-height) |
| `eb64e7e2716a968c513504e27d963fa2.jpg` | Botanical HUD | White suit facing a mountain + plant catalog | Green terminal type, photo tiles, dark field | Idea, Apply (weather readout type) |
| `7735cf78c857fd9187692b8d21999ad0.jpg` | **OSD AMP** | Winamp-class player | Beige plastic, LCD, **analog EQ sliders**, playlist | Idea, Apply (overview sliders only) |

### Ancestor quotes (bevel and inset — not a face to freeze)

| File | Nickname | Shows | Materials / motifs | Lane |
|------|----------|-------|-------------------|------|
| `2a0002d93dfba067de848caec9951b23.jpg` | Win95 MDI | Four nature photos in child windows | Gray face, green captions, File/Edit/Search/Help. A quote: child windows holding pictures. The pictures are the point; the gray is optional | Idea (ancestor) |
| `60d7202cb958e11734ce0567eb382868.jpg` | Display Properties | Classic dialog + CRT mock | `#c0c0c0` face, tabs, slider, forest wallpaper *inside* the monitor. Steal picture-in-CRT. The dialog is the ancestor | Idea (ancestor), Apply (picture-in-CRT) |

### Machines you hold (Y2K silver, stylus, LCD)

A held machine: chunky, silver, a picture sitting in glass, a stylus nearby.
None of these is a Nintendo DSi. The closest lights and pixel in this group
are the Finecam’s green SET UP lamp and the Sony editor’s green and red pixel
type. See [Gaps](#gaps).

| File | Nickname | Shows | Materials / motifs | Lane |
|------|----------|-------|-------------------|------|
| `36bc1715c629f42e163d54abe8741ac6.jpg` | **Pocket PC** | Acer n10, Wikipedia on the glass, stylus beside it | Brushed silver, black bezel, D-pad, a living picture in a small LCD | Idea, Apply (header as a held machine; picture-in-glass) |
| `42ed97f9c02c9f0168d26cc793346aae.jpg` | **Motorola flip** | Clamshell closed and open, calendar on the inner screen, two styli | Silver shell, hinge, tiny outer LCD, thumb keyboard. Opened for this pass: no glowing indicator lamp was visible | Idea (a window that opens like a lid; close can fold or melt) |
| `233182978b0c64031a84ff84ec18e12e.jpg` | **Hiptop** | Two Danger hiptops, IM and news on the glass | Silver, chunky chiclet keys, thumb wheel, a screen that is already a little webpage from the past | Idea, Apply (milled key wells on the header) |
| `a272dce1d120178b12922f925b46523f.jpg` | **Sharp 書院** | Japanese word processor, icon menu, coiled pen | Beige-gray body, dense key field, side numeric pad, a screen of tiny pictures | Idea, Apply (equal-height keys; picture menu, not Lucide) |
| `117ebb9171f51c2bd7a913a12489fea9.jpg` | **Kyocera Finecam** | Silver camera back, clouds in the LCD | Magnesium body, mode lamps, a photograph sitting in a machine | Idea, Direct (sky-in-glass as a well) |
| `ffa2396fc4af38ae8e97e646029c2e2e.jpg` | **Sony editor** | Portable deck, phosphor timeline, jog wheel | Worn silver, green/red pixel type, a round black well | Idea, Apply (pixel readout + milled wheel; the impossible is the timeline melting) |

### Paper lace (holy-card frames — lining, not window chrome)

| File | Nickname | Shows | Materials / motifs | Lane |
|------|----------|-------|-------------------|------|
| `3b6e176372e1f27b844344b888d43a86.jpg` | Lace + rave | Lace cross stuffed with club flyers | White lace, Y2K type, sacred + nightlife | Idea, Direct (overlay) |
| `4fac4805754805418d608371a0f3eaaa.jpg` | Oval holy card | Filigree oval void | Cream paper-lace, floral | Direct, Apply |
| `68ba1f33b0fc2672abbe5538ca345720.jpg` | Arched lace | Arch window in lace | Cream, lattice | Direct, Apply |
| `79d20e2c416a102496722d3a742d2ae6.jpg` | Heart Madonna | Heart cartouche, stars | Cream lace, engraving | Direct, Apply |
| `a043e8a27ff07b747e9ba679dfeb1df9.jpg` | Child + cross | Oval + bottom scene | Cream lace | Direct, Apply |
| `a37a2f36fce73d8a106cf0ca8865be31.jpg` | Floral urn | Round void over bouquet | Cream lace | Direct, Apply |
| `d206bbff071d39c4b5a5dead89542a0b.jpg` | Gothic lace | Pointed-arch void | Cream lace, mesh | Direct, Apply |

---

## How to use them

### Now — App desktop (shipped)

The fresh default is classic Win95 teal (`--w95-desktop` / `pcbMode: "teal"`).
Settings → **Desktop** can pick ceramic / mint / ice / x-ray / FR4 photographs.
Plates are the stills above, copied to [`public/pcb/`](../public/pcb/). CSS only
veils and grains photographed plates so chrome stays readable. Do not paste a
PCB onto Lists/Plan window chrome or the Habits grid — those rooms already have
their own materials. The PCB is the *estate*, not the furniture. A saved plate
is never rewritten to teal.

### Now — Daily Habits interior — a room that turned out well

This is one place the catalog has been applied: control panel, analog
furniture, willpower gems, CRT phosphor, panel lamps. It is not a template
for Plan, To Do, Goals, Tracking, Lists, or the next room. Do not clone
`.hab95`. Object chrome is a material a precious object may use
([`DESIGN_STYLE.md`](DESIGN_STYLE.md#chrome-and-black-mirror)), not a quota.

The room is a metal console on nacre (`.hab95`). More magical interaction
belongs here and in other rooms. The global header stays a header: its doors
stay visible (failure 1).

| Habits surface | Steal | How (smallest true shape) | Status |
|----------------|-------|---------------------------|--------|
| **Table / grid** | TENO console, gadget wall, IRIX cattle | Nested bevels already exist — pack cells as instrument wells. Hairline traces like Bare FR4 / Cat traces as *engraved rules*, not a PCB background image pasted on the grid. | **Shipped** — packed wells + FR4 hairlines |
| **Willpower gems** | Jewel PCB, crystal-ball cat, silver-book oval | Keep the small user crystal (`willpowerImage`). Seat it in a photoreal **chrome + black-mirror** oval (milled silver rim, black-lacquer well, photograph in the cavity). This interaction is the one to make more of. It is not a plate to stamp on every control. Default compact; open **Physics** to enlarge the same handful on a larger oval still centered on the crystal. Do not replace the photo with Lucide. Pin the oval plate to the **control panel foot**, centered in the well. Plate click = bouncing-ball stir (a short whirl, not a scatter bomb); a gem grab must not also press or stir the well. Photograph change is Settings-only. Each weekday completion adds **one small copy** of that habit’s gem around the plate; gems bounce off the crystal (no tunneling); the row gem **inverts** while any hit this week remains; the crystal PNG occludes stones that pass behind it. Press stirs; grab/lift throws (works off the plate and in the lab; equations follow z). Gems paint past the rim. **Physics** opens a Win95 popup lab with a mapped twin plate, CRT wells, and live sliders (no idle 60fps). | **Shipped** — control panel, photoreal chrome oval button, black-mirror well, week satellites, invert, pin, stir, grab/lift (no ghost stir), crystal solid, overflow, PNG occlusion, Settings field, Physics popup (mapped twin, CRT wells, memo knobs). Canonical: [`DESIGN_STYLE.md`](DESIGN_STYLE.md#willpower-gems--example-of-perfect-design) + [chrome and black mirror](DESIGN_STYLE.md#chrome-and-black-mirror) |
| **Progress** | Tek 465B POWER LED, TENO tiny LED strips, FR4 / x-ray / ceramic via rows, snowflake-circuitry pads. Grade tubes: noble-gas ampoule rack + **fan of tubes** (rounded dome). Overview sliders: OSD AMP + iridescent bloom. | **Grade meters** (Week / Span grade + Perfect output): photoreal glass **finger-tubes** (hemispherical dome, not a pointed ampoule) — plasma column clipped to percent (`noble-gas-tube.tsx`); plasma hue from `gradeTubeColor` / `outputGradeTubeColor` (defaults week-grade green `#508b51` / perfect-output navy `#25366a`). Spreadsheet **row/col %** default to a **thin glass thermometer** (`percent-led-bar.tsx`, Loading bar ON) plus a text %; OFF is the smaller numeric LED. Same tube for rows and column totals. Not a toy equalizer (do **not** steal OSD AMP’s EQ), not pastel bars, not Yes/No cell lamps reused as percents. Home overview strip keeps analog OSD bloom + vertical Tek spark. Interlace, if any, is a CSS overlay on the bezel, toggleable. | **Shipped** — noble-gas grade tubes (still photo, per-grade hue); quiet 10-pip loading channel default; table OSD bloom; overview 2×2 + vertical Tek well. CRT overlay (`.hab-crt`) is off by default |
| **Needs Attention** | Paper lace (one), viscera collage (density), CRT kitten (urgency glow) | A lace *lining* or filigree rule around the well — cream on metal, not a holy-card skin on the Home window. A teaching caption is welcome when it is real and sourced. Expand when count > 0 is still open layout ([`UI_NEXT.md`](UI_NEXT.md)). | **Shipped** — lace lining (`.hab-na`). Home `#fff` cards killed |

Cockpit rockers stay (Heatmap View, **Day View** = today column + week % only, Hide Completed Today, **Loading Bar**, and **Small LEDs** — not a rename of Loading Bar). **Sort Habits** stays **above** that group. Type/score gems stay 12–16px; row **edit jewels** are 18px set stones (36 cutouts), far-left, no dark disc — no gem before the title. Streak / × under the wrapping title. Week satellites around WILLPOWER stay **smaller** than the row jewel. Yes/No cells stay recessed panel lamps (on-color = `percentLedTint`, dim/warm, not blast-white; **Small LEDs** ON = 15px, OFF = fill the cell). Ink stays dark on pearl/metal. Furniture metal is `--chrome-face` / `--hab-metal`, never `#c5c3bc`.

**Still deferred (not this wave):** seraph-wing *logo*, ruby Quick Add, beetle-wing photo, ribbon-cable table edges, barrel-distortion CRT. The global header may become a held machine (silver keys, pixel lamps, one dissolve) — see [Easy alignments](DESIGN_STYLE.md#easy-alignments-not-started). Do not freeze it as a Windows toolbar. Home leftover **weather instrument** + **equal-height square modules** are later (Home lane), not a Habits-only trick.

### Later — header / tabs / Quick Add

`designref1.jpg` is the reminder that a living picture sits inside an instrument.
Display Properties is only the ancestor of that trick (wallpaper inside a
monitor). The CRT kitten and gadget wall are the machine's atmosphere, not a
brief to Lucide the caption buttons or restyle Quick Add as Winamp.

Habits’ interior and the gunmetal slider have shipped. Header and tab work
can go further into pixel lamps and a held-machine feel. Keep the capture
doors visible — denser grouping, not a File menu
([`PLAN_OF_ACTION.md`](PLAN_OF_ACTION.md) Wave 7). A new picture language is
allowed when the layout holds. Do not hide the doors.

### App-wide gunmetal (Colt)

Bias `lib/chrome-patina.ts` toward the cool faces in TENO / gadget wall / IRIX
(not Habits yellow-gray, not SaaS slate). **Slow slider.** One mix for the
house. Lists furniture stays honest `#c0c0c0`-family; it may patina cooler.
Do not paint Lists velvet or Plan chips gunmetal.

### Other rooms

Each room already has its own furniture. A redesign may push it further into
pixel, small lights, and esoteric interaction. It does not clone Habits, and
it does not paste one still onto the window. The four failures live in
[`DESIGN_STYLE.md`](DESIGN_STYLE.md).

| Room | Already its own | Would fight the room |
|------|-----------------|----------------------|
| **Lists** | Orbs and jewels; sky jewel-case / UV rabbit / Mandelbrot as *optional* orb photos. Frame may take silver, a pixel throw, or a dissolve on organize/close | Tribal chrome *as the caption*; paper-lace replacing the title; one Winamp or TENO skin as the whole window; replacing orbs with a line-icon font |
| **Plan** | Opalescent chips (iridescent bloom is kin). Crystal-ball as an event mark (**shipped** on `+N more` and Day all-day banners). Rail capacity pips + habit gems. Roomy period toolbar, navy field focus (`win95.css`), nested metal wells. Frame may leave pure gray | A calendar field that hides the chips; a CRT grid that fakes precision; restacking the month into floating cards |
| **To Do** | Instrument window (caption orb, mill toolbar, packed list well, period keys). Same verbs as before. Pixel lamps and a close-dissolve are in bounds. Layout still open: the push-count legend ([`UI_NEXT.md`](UI_NEXT.md)) | One TENO screenshot pasted on the table; a PCB as the table; hiding the rows behind a menu |
| **Goals** | Packed objective list, 10-pip goal progress, gold priority chips, Direction CRT + pewter drift tape. Layout still open: chunky steppers ([`UI_NEXT.md`](UI_NEXT.md)) | A full cockpit costume of another room |
| **Scheduler** | Instrument frame. Contents may gem. A bucket drag may leave a cursor-flock | Hiding the buckets |
| **Analytics** | Tek bezel / phosphor optional on chart chrome; canvases stay the light-instrument studio | CRT axes that fake precision; restyling Lists to match the studio |
| **Tracking** | Milled frame, power lamps, plain steel pen well, white paper in a bezel, pens as the chroma. Phosphor only on the live occupancy figure | Replacing paint with the gadget-wall collage; removing the now line or sun lines; pasting retired pen-tray photos back behind the chips |
| **Home top strip** | Equal-height modules; gadget-wall weather instruments in leftover squares | Floating white cards; one well stretched across the leftover width |
| **Operations** | Milled frame, metal keys, phosphor. Flower CRTs / Tek are kin for wells. Layout still open: empty-state objects ([`UI_NEXT.md`](UI_NEXT.md)) | Scanlines that make the type unreadable |
| **Modules** | Interiors may stay feral (mushroom-desk energy). Layout still open: orbs on the board ([`UI_NEXT.md`](UI_NEXT.md)) | Sanding an interior into `components/ui/` |

---

## Improvement plan (phased, not a dump)

**Phase A — Habits interior (now).** Fawn. **Landed** in `habit-chrome.css`:
jewel-PCB WILLPOWER cartouche; table as packed wells with FR4 hairlines;
progress as analog/phosphor-in-bezel + nacre bloom sliders; Home overview as
one 2×2 + vertical CRT instrument (Tek field, nebula slug, last-point
crosshair); Needs Attention lace lining (`.hab-na`). CRT overlay is CSS-ready
(`.hab-crt`) and off. `aspect-square` is gone from that file (`aspect-ratio: 1`)
— the parse fail had let Home’s inset `#fff` cards (Needs Attention) show through.
Grade meters are **noble-gas tubes**; WILLPOWER is an **orb**; today is a solid
fill; heatmap is a light Daily sidebar mosaic. **Landed (working tree):**
15px recessed Yes/No panel lamps (tint as on-color, not blast-white); **Loading Bar** default ON (thin glass tube + % text on one row; OFF = smaller numeric LED);
**Day View** rocker (today + week %); far-left 18px set-stone gem/edit (no dark
disc; no gem before the title; streak/× under the name); WILLPOWER crystal
scaled inside the same oval plate; Habits Settings already has
`WillpowerGemsSettingsField`;
Delete-in-settings; jewelry heatmap cells; **Sort Habits** above grouped
rockers. **Landed:** **Small LEDs** rocker (default ON = 15px Yes/No lamps;
OFF = fill the cell); week-complete gems collect small around WILLPOWER; row
gem inverts when contributing; plate pinned to the rail foot; plate click
= physics stir (crystal PNG occludes stones behind it; photograph door is
Settings). Cute lab-instrument skeuomorph from this folder; do not change
completion math. Colocated file list stays with
[`components/Home/Habits/README.md`](../components/Home/Habits/README.md)
(implementer).
**Deferred:** seraph-wing logo, ruby Quick Add, beetle-wing photo, ribbon-cable
table edges, barrel-distortion CRT. No PNG recapture this pass.

**Phase B — Gunmetal slider (parallel).** Colt. Cool-bias the existing
`--chrome-*` family. One mix for the current face. Do not retint orbs. A
later redesign may leave this slider; it is not a freeze.

**Phase C — After A+B survive Lists.** Header/tabs/Quick Add density only.
Optional CRT overlay token (off by default) for Habits bezels and Operations
phosphor — never as a chart that lies about sample size.

**Phase D — Cabinet stock.** Add photographed jewels (Jewel PCB crop, sky
jewel-case, UV rabbit, iridescent bloom, Mandelbrot, crystal-orb crop, cat-traces
board, bare FR4) to the orb/gem library if they knock out cleanly. CRT kitten as
an optional today's-friend still. Personal cabinet, not a matching vector set.

**Phase E — Home equal-height weather modules.** IRIX cattle packing + gadget-wall
analog meters: leftover TOP-strip squares (review, affirmation, weather, user
add/hide) share one module height. Weather is an instrument, not a card. Home
implementer; see [`DESIGN_STYLE.md`](DESIGN_STYLE.md#depth--spacing).

---

## Do not costume the whole app

These stills are ingredients for a more magical, more pixel, more esoteric
house. Pasting one of them onto every title bar makes a costume. Freezing
every title bar as the Win95 MDI menu bar makes the other costume, and it
hides doors (failure 1). Neither reading is the redesign.

Read as ancestor, not template:

- Win95 MDI (`2a0002d93…`) — child windows holding pictures. Not its File menu.
- Display Properties (`60d7202cb…`) — a picture inside a machine. Not the gray dialog as the product.
- TENO (`5d58e7b46…`), the gadget wall (`6586d2eaaa…`), and Winamp (`7735cf78…`) — pixel, lamps, and instruments to steal from. Not a skin pasted on every window.
- Tribal chrome (`204a5f9b…`) and the paper-lace holy cards — a well’s frame or lining. Not a replacement for a readable caption.
- The speaker cross — a picture, not a toolbar icon.
- The oscilloscope and the ports chart — lamps, bezels, and cable mouths. Not the file manager’s only face.

Do:

- Let keys, tab lamps, and wells take TENO pixel, hiptop silver, and small glowing lights. More of this, including a DSi-like lamp the folder does not contain ([Gaps](#gaps)).
- Let a close, an auto-organize, a gem stir, or a sand collapse **move**. The cursor angel and the snowflake plate are the stills; the motion is the app’s.
- Keep Lists velvet and orbs, Plan’s opalescent chips, and the willpower plate as rooms that turned out well. A new room may invent the next object.
- Keep Win95 bevels as a quote inside the machine when a room wants them. A room may leave them.

---

## File map

| Path | Role |
|------|------|
| `designrefs/` | Raw moodboard (not shipped assets, except the five desktop PCB stills copied to `public/pcb/`) |
| This file | Catalog, plus how to read the stills under the redesign (gaps and conflicts at the top) |
| [`public/pcb/`](../public/pcb/) | Served desktop plates |
| [`DESIGN_STYLE.md`](DESIGN_STYLE.md) | Failures, layout, palette. Magical interaction, DSi pixel and lights, esoteric technology. Habits and Lists are examples, not templates |
| [`UI_NEXT.md`](UI_NEXT.md) | Open layout tasks |
| [`PLAN_OF_ACTION.md`](PLAN_OF_ACTION.md) | Combined work order (not edited from this pass) |
| `components/Home/Habits/habit-chrome.css` | Current Daily console |
| `components/Home/Habits/habits-control-panel.tsx` | Home Dashboard Habits Tab Control Panel (compact 196px) |
| `components/Home/Habits/willpower-gems.tsx` | Willpower gems chrome button + Settings field (week satellites, invert, press-stir, grab/lift/throw, overflow, PNG occlusion, Physics popup with live twin plate) |
| `lib/willpower-physics.ts` | Shallow-dish gravity + bounce + whirl; crystal is a solid in XY (gems do not tunnel) and a PNG occluder (Y-sort) |
| `lib/chrome-patina.ts` | Gunmetal slider target |
