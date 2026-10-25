# Retrofuturism for Brain2: imagery and interfaces

_Researched: 2026-10-21_

This note is for the Brain2 To-do tab redesign. Brain2 already looks like retro hardware: milled grey and beige fascia panels, CRT phosphor screens, pixel fonts, keycaps and lamps. The question is what retrofuturism adds, and which parts fit that look.

Companion research: `todo-tab/hipgnosis/` (surreal staged photography).

---

## 1. The reference images

**Note:** the 16 files on disk do not match the list in the brief. The brief named a BYTE 1981 cover, a Macintosh ad, a PCW Amiga cover, an aibo ad, an Apple IIe, a Walkman and a Koss Porta Pro. None of those are in files 0017 to 0032. Those files may live under other numbers. Below is what the files actually show.

| File | What it is | Era | Lesson for UI |
|---|---|---|---|
| `0017` | Book cover, *The Architect & the American Country House* (Mark Alan Hewitt, photos by Richard Cheek). Wright-style interior with a banded brick column and glowing timber ceiling. | 1990 book, 1930s building | Not retrofuturist. Warm horizontal banding and amber uplight. One serif title over a rich photo. Shows how warmth can sit inside a "machine" layout. |
| `0018` | Glam sci-fi photo. Two figures in silver lamé and perspex rings, lit with star-filter flares. | Late 1970s | Specular highlight as decoration. Cross-star glints on edges. Use rarely, for a "done" moment. |
| `0019` | Photo-composite: a sunrise over the sea, framed by vector plots, CRT monitors and graph panels. | Early-mid 1980s ad or cover | A real-world image in the middle, data screens around it. Thin orange, cyan and magenta rules on black. A model for a "Today" hero with stats around the edge. |
| `0020` | Cream wall intercom with a small CRT showing one glowing blue vector triangle. Grey keypad with eye icons. Coiled black cord. | 1980s object, likely restyled as art | Beige plastic plus one glowing vector shape. The screen shows one thing only. Icons printed on keys. |
| `0021` | "Sotagi" clamshell phone, a 3D concept render. White and lavender-blue plastic, round screen, pill buttons, green LED dot arcs. | Y2K revival, 2020s render | Soft inflated forms. LED dots in arcs as progress. Round screen. A bold departure for Brain2. |
| `0022` | Space-age TV or videophone in polished aluminium on a swooping stand. Rounded CRT. | Late 1950s to 1960s | The screen as a head on a sculpted neck. The bezel is a frame with depth. |
| `0023` | Panalina render of an imagined 1960s computer. Teak-red shell, chrome oval screen surround, cream keyboard deck with two dials. | Modern render, 1960s style | Wood, chrome and cream together. Oval screen bezel. Labels engraved around knobs. |
| `0024` | Silver egg pod with a bubble window and floating disc stairs. | Late 1990s to 2000s interior | Iridescent pearl metal. Circles as steps, which suggests a stepped progress path. |
| `0025` | Steel sphere hung in a hall. Inside is a CRT showing a huge eye, with the time `15:31` in white 7-segment digits on the pupil. | Public clock art, date unknown | Time on a face. A clock that watches. A strong image for a focus timer. |
| `0026`, `0031` | 3D render of a cream oscilloscope-style device in cassette-futurist style. Lime phosphor screens with a line graph and `64% / 83%`. Rocker switches, a specimen jar, a calculator keypad with an orange `=` key, red, yellow and green lamps. Labels: `COUPLING`, `AUTO`, `NORM`, `CAT. II 400V MAX`. | 2020s render, 1979 style | The closest match to Brain2. Every panel has an engineering label. Numbers are big and few. The lime screen glows against worn cream. One orange key marks the main action. |
| `0027` | Crotech 3132 20 MHz dual trace oscilloscope. Grey panel, blue screen, cyan sine wave, green accent strips, labelled knob scales. | 1980s real instrument | Real gear is quieter than film props. Scales printed around knobs. Coloured bands group the controls. |
| `0028` | Airbrushed brochure art. A chrome head in a tunnel of rings sends pink laser beams to beige computers and printers. | Mid 1980s | Airbrush glow, concentric rings and a halo around objects. One mind linking many devices: a "second brain" image. |
| `0029` | Modern custom computer. A white hooded case with a round screen showing a blue globe. Beige and grey keycaps with lowercase legends. | 2020s maker build | A round screen in a hood. Two-tone keycaps: beige for letters, grey for modifiers. |
| `0030` | Destiny Plus Programma 900 synthesizer. Cream panel printed with equations, graphs and dotted signal lines. Black knobs, white and amber LEDs. Green ASCII digits in one corner. | 2024 instrument | The panel itself is a diagram. Printed lines link controls to what they change. LED grids show state. |
| `0032` | IBM PC education ad. A green screen reads "GOOD MORNING CLASS— Select One of the Following: 1 Vocabulary 2 Computer Science 3 Recess / Your Choice". A hand holds a floppy disk. Wireframe grid floor, teal spheres, streaks. | c. 1982-83 | A numbered menu on a green CRT is friendly, not cold. The greeting plus three choices is a model for a morning prompt. |

**What the set says.** Most images are cream or white objects with one glowing screen. The screens show one shape or a few big numbers. The busier images (0019, 0026) frame a calm centre with data at the edges.

---

## 2. Eras and sub-styles

**1950s-60s atomic and space age.** Boomerangs, starbursts, chrome, swoops. Objects like `0022` put the screen on a sculpted stand. Soviet magazines such as *Tekhnika Molodezhi* pushed the same optimism with rockets and satellite-shaped furniture. The Moscow Design Museum's *Soviet Space Graphics* (Alexandra Sankova, Phaidon) collects this work.

**1970s space colonies and sci-fi art.** NASA Ames ran summer studies in 1975-77. Rick Guidotti and Don Davis painted the Stanford torus and other colonies. These are calm, sunny cutaways of a future that works. Syd Mead and Chris Foss pushed a more industrial look.

**NASA Graphics Standards Manual (1975).** Danne & Blackburn designed the "worm" logotype in 1974. It replaced the 1959 "meatball". It was dropped in 1992. The manual is a grid-first, red-and-white system. Jesse Reed and Hamish Smyth reissued it in 2015.

**Apollo DSKY.** A green electroluminescent 7-segment display. Three lines: `PROG`, `VERB`/`NOUN`, then registers `R1`, `R2` and `R3`. A grid of caution lamps with plain labels: `UPLINK ACTY`, `TEMP`, `KEY REL`, `OPR ERR`, `PROG`, `RESTART`. `COMP ACTY` lights while the computer works. Commands are verb plus noun numbers.

**1970s-80s computer ads and covers.** Robert Tinney painted over 100 BYTE covers, from 1975 to 1990, in acrylic and airbrush. He used visual metaphor, like a balloon for Smalltalk (1981). Corporate brochures (`0028`, `0032`) used airbrushed glow, grid floors and floating spheres.

**Cassette futurism.** The 1979-87 look of chunky analogue tech: CRTs, rocker switches, cassettes, warning stencils. Alien's Nostromo is the core text. Ron Cobb gave every panel a plausible job and drew real safety signage for it. Modern renders like `0026` live here.

**Beige box era.** Desktops were beige, off-white and grey because offices were the main market. Neutral plastic matched cubicles and hid yellowing. The Apple eMate 300 (1997) broke the beige box. Its translucency led to Jony Ive's iMac G3 (1998), which came in 13 colours from Bondi Blue to Flower Power.

**Y2K and Frutiger Aero.** Translucent blue plastic, glossy bubbles, sky-and-water imagery, aibo silver. `0021` and `0024` belong here.

**Modern heirs.** Teenage Engineering builds around limits. The OP-1 is one small screen and four knobs. Each knob owns one on-screen value. Its palette is five colours: orange, black, white, aluminium grey and screen green. The Programma 900 (`0030`) prints its theory on the panel.

---

## 3. Film and TV interfaces

- **2001: A Space Odyssey (1968).** Screen graphics were rear-projected film loops. Type is mostly Eurostile Bold Extended for HAL's screens and the Pan Am flight deck. Futura for title cards and many labels. Univers on the moon map and hibernation screens. Source: *Typeset in the Future* (Dave Addey). Lesson: a type system made from two or three faces feels engineered.
- **Alien (1979).** Production design by Ron Cobb and others. Green text on black CRTs with mechanical sounds. Signage is functional and stencilled. The title is broken-apart Helvetica Black by R/Greenberg Associates. Lesson: the panel labels sell the world.
- **Blade Runner (1982).** The Esper machine zooms and pans a photo by voice command. The film shows each step instead of cutting. The vid-phone uses a backlit red, white, pink and green display. Lesson: show the process. A slow, readable change beats a jump.
- **Star Trek: TNG LCARS (1987 on).** Michael Okuda designed it. Gene Roddenberry asked for panels that were not busy. Rounded "elbow" bars, flat colour blocks, tall condensed type, often cited as Helvetica Ultra Compressed. Buttons carried crew initials ("Okudagrams"). Lesson: a frame made of coloured bars can be the navigation.
- **Space: 1999 (1975-77).** Clean white sets, rows of monitors with simple graphics. Useful as a calmer, whiter take on mission control.
- **Moon (2009).** Gavin Rothery did concept design, including GERTY. GERTY's mood is a simple emoticon on a small screen. Lesson: one glyph can carry tone.
- **Severance (2022 on).** Production designer Jeremy Hindle. Touch-screen CRTs, a huge trackball and a chunky keyboard. He wanted "a device that doesn't make a lot of sense". The on-screen numbers ran live, not as CGI. Lesson: a spare, eerie terminal works best with real data running on it.
- **Andor (2022-25).** Luke Hull led production design. BLIND LTD did the Season 2 screen graphics. The Empire OS is mostly black and white with touches of red. Desks use dials and backlit buttons, not keyboards. Tablet layouts follow the device shape, not a grid. Lesson: a strict palette reads as order. Hardware form can set the layout.

---

## 4. Typography

| Classic face | Where it shows up | Free or Google Fonts stand-in |
|---|---|---|
| Eurostile / Microgramma | 2001, NASA hardware, 1960s-70s gear | Michroma (extended), Orbitron (more geometric), Audiowide |
| Futura | 2001 labels, Apollo plaques | Jost, League Spartan |
| ITC Avant Garde | 1970s ads, magazine heads | Didact Gothic, Questrial |
| Serif Gothic | 1970s sci-fi and film posters | No close Google match. Use sparingly as an image, not a UI face. |
| Univers / Helvetica | 2001, Alien titles, NASA manual | Inter, Archivo, Roboto Flex |
| Helvetica Ultra Compressed | LCARS | Antonio, Oswald, Big Shoulders Display |
| OCR-A / OCR-B | Bank cheques, 1970s machine type | OCR-A is free from several open sources. Space Mono works as a soft substitute. |
| Westminster | 1960s "computer" lettering | Novelty only. Avoid in UI. |
| DSKY 7-segment | Apollo, clocks, `0025` | DSEG7 (open source, not on Google Fonts), or draw segments in SVG |
| Chicago / Geneva bitmap | Classic Mac OS | Silkscreen, Pixelify Sans, ChiKareGo-style open ports |
| Terminal fonts | VT100, IBM 3270, Apple II | VT323, IBM Plex Mono, Share Tech Mono, Major Mono Display |

**Rules worth keeping.** Use one wide face for labels in caps. Use one mono face for data, with tabular figures. Use a 7-segment or bitmap face only inside screens. Keep caps labels tracked out, as Teenage Engineering does.

---

## 5. Palettes

These are working values picked by eye from reference photos. They are not official specs.

**Office beige and grey.**
- Beige plastic `#D9CDB4`, aged beige `#C8B994`, shadow `#A69A7E`
- IBM / Olivetti warm grey `#B8B4AA`, cool grey `#8E9196`, dark charcoal `#3A3B3D`
- Cream panel (`0026`, `0030`) `#E9E3D2`

**Phosphor.**
- P1 green `#33FF66`, dim `#1A7F33`, background `#0B140D`
- P3 amber `#FFB000`, dim `#7F5800`, background `#140C00`
- Lime render glow (`0026`) `#C6F24A`
- White-blue vector glow (`0020`) `#9FD4FF`

**Intecolor / Compucolor 8 colours (1976).** The machines used an RCA delta-gun CRT with eight colours. Raw RGB: black `#000000`, red `#FF0000`, green `#00FF00`, yellow `#FFFF00`, blue `#0000FF`, magenta `#FF00FF`, cyan `#00FFFF`, white `#FFFFFF`. On screen they read softer. Try red `#E8463A`, green `#4CD964`, yellow `#F2D43A`, blue `#3A5BE8`, magenta `#D946C9`, cyan `#3ADBE8`.

**Y2K translucent.**
- Bondi-style blue `#0095B6`, ice `#BFE3EE`, lavender plastic (`0021`) `#8C8FE0`, pearl white `#EEF0F4`
- aibo / chrome silver `#C9CCD1`, highlight `#F5F6F8`, shade `#7D828A`

**Sticker and safety accents.**
- Walkman-style sticker yellow `#FFD200`, sticker red `#E3242B`
- Calculator `=` orange (`0026`) `#E8641E`, Teenage Engineering-style orange `#FF5A1F`
- NASA red `#FC3D21`
- Lamp red `#E5322D`, lamp yellow `#F5C518`, lamp green `#4CC84A`

---

## 6. Modern work that gets it right

- **Teenage Engineering OP-1.** Each mode fills the screen. Four values on screen map to four colour-coded knobs. The animations are playful: tape reels turn and levels bounce. Mono type everywhere. *Right:* a hard limit on what shows at once.
- **Panic Playdate.** A 1-bit screen and a crank. Dithering for tone. *Right:* constraint makes a recognisable style, and physical input has a clear job.
- **Severance Lumon terminals.** Bare type on a blue-grey field, real numbers moving. *Right:* emptiness feels deliberate when the data is live.
- **Andor Empire OS.** Black, white and red only. *Right:* palette discipline.
- **Cool Retro Term.** A terminal emulator with curvature, bloom and scanlines. *Right:* proves the effect, but shows how heavy it gets. Use one or two effects, softly.
- **Cassette-futurism renders (`0026`).** *Right:* every surface has a label, a reason and wear.
- **Programma 900 (`0030`).** *Right:* the panel explains itself with printed lines and formulas.
- **Hackers-style UI.** Neon wireframes and fly-throughs. *Mostly wrong for Brain2:* fun, but noisy and hard to read for daily use.

---

## 7. Where retrofuturism meets Hipgnosis

Both put a strange object in a calm, real place.

- **Tinney's BYTE covers** turn an abstract idea into one physical object in a landscape. A code printout becomes a bridge.
- **The sky-in-a-monitor cover** (PCW 1985, from the brief) and `0019` put nature inside or around a screen. Hipgnosis did the same with objects out of place.
- **Hipgnosis, *Technical Ecstasy* (Black Sabbath, 1976).** Storm Thorgerson with George Hardie. Two robots meet on an escalator. Hardie designed the robots and Richard Manning drew them. The machines have character and gesture.
- **`0028`** links one head to many machines with beams. That is the "second brain" idea drawn literally.

**For Brain2:** use one staged image per empty state. A single real object, like a calendar page, a cassette or a lamp, placed in a calm scene or inside a CRT. Keep it rare.

---

## 8. UI patterns for the To-do tab

**Fit** = suits the current beige and grey milled hardware with CRT screens. **Bold** = a larger departure.

1. **DSKY span switcher.** _Fit._ Source: Apollo DSKY. A small 7-segment readout shows `SPAN 01 DAY` and a `VERB`/`NOUN` style label. Keycaps step Day, Week, Month, Season and Other. The `PROG` slot shows the active span number. Data: the selected span and the open count in it.
2. **Caution lamp grid.** _Fit._ Source: DSKY lamps, `0026` lamps. A 3x3 grid of labelled lamps: `OVERDUE`, `DUE TODAY`, `NO DATE`, `BLOCKED`, `OVER LOAD`, `SYNC`. Each lights from real counts. A click filters the list.
3. **Load meter as an oscilloscope trace.** _Fit._ Source: Crotech `0027`, `0026` graph. Planned hours per day drawn as a phosphor line against a capacity rule. Above the rule the trace turns amber. Data: estimated minutes per day across the span.
4. **Big-number readout pair.** _Fit._ Source: `0026` (`64% / 83%`). Two large figures only: done this span, and load. Small caps labels under each. Data: completion ratio and load ratio.
5. **Coupling selector for grouping.** _Fit._ Source: `0026` `COUPLING / AUTO / NORM` rockers. Three rocker keys pick the list grouping: by project, by due date, or manual. Data: changes sort and section headers.
6. **Green-screen morning menu.** _Fit._ Source: IBM ad `0032`. On first open each day: "GOOD MORNING — Select one: 1 Plan today 2 Review yesterday 3 Just show the list". Number keys pick. Data: yesterday's carry-over count shown on line 2.
7. **Eye clock focus timer.** _Fit for the screen, Bold if made big._ Source: `0025`. A 7-segment countdown sits in a round CRT window. The bezel is a milled steel ring. Data: the running timer and the task it belongs to.
8. **Printed signal lines in the drawer.** _Fit._ Source: Programma 900 `0030`. In the detail drawer, dotted lines link a task to its project, its parent and its blockers, printed on the panel. Data: real links from the task record.
9. **Stencilled panel labels.** _Fit._ Source: Alien / Ron Cobb, `0026`. Every panel gets a short engineering label, like `QUEUE`, `SPAN`, `LOAD`, `CAT. II`. Keep them small caps and tracked. Data: the label can carry a count, like `QUEUE 14`.
10. **One orange action key.** _Fit as research, not the house._ Source: `0026` orange `=` key, Teenage Engineering orange. Only "Add task" or "Start timer" gets the orange cap. Everything else is beige or grey. Data: none, it marks the main action. The house primary is the silver cap with a navy lamp. See the house decision under Rules of thumb.
11. **Two-tone keycaps by role.** _Fit. Shipped in silver, not beige._ Source: `0029`, beige letters and grey modifiers. The house took the two tones as pale silver for word keys and darker grey for mode and view. Allie likes the silver cap and wants more of it. Seafoam and cornflower are the spare plastics. Data: makes the role of each control readable.
12. **Vector-glyph empty state.** _Fit._ Source: intercom `0020`. When a span is clear, the CRT shows one slow-rotating vector triangle and "NO OPEN ITEMS". Data: shown only when the open count is 0.
13. **Mood glyph.** _Fit._ Source: GERTY in Moon. A tiny emoticon on the status screen reacts to load: calm under 80%, worried over 110%. Data: load ratio.
14. **Inspection sticker badges.** _Fit._ Source: Walkman stickers (brief), Alien safety signage. Rectangular stickers on cards: yellow `CHECKED`, red `DO NOT SKIP`, white `QC 21-10`. Use for priority, recurring and reviewed. Data: task flags and last-reviewed date.
15. **Esper-style zoom between spans.** _Bold._ Source: Blade Runner Esper. Changing span zooms in steps with grid lines and a readout ("ENHANCE 2x"), Month to Week to Day. Data: the same tasks at each scale.
16. **LCARS elbow frame.** _Bold._ Source: Okuda's LCARS. Coloured bars with rounded elbows frame the list. Bars are the span tabs. Data: each bar shows its span's count.
17. **Data around a calm centre.** _Bold._ Source: `0019`. A hero image or today's one task sits in the middle. Load trace, lamps and counts sit on the frame edges. Data: today's focus task plus summary stats.
18. **LED dot arc progress.** _Bold._ Source: Sotagi phone `0021`, `0030` LED grid. A ring of LED dots around a round screen fills as subtasks finish. Data: subtask completion.
19. **Disc-step path for a project.** _Bold._ Source: egg pod stairs `0024`. Milestones as floating discs climbing up and right. Data: milestone dates and status.
20. **Tinney-style staged hero art.** _Bold._ Source: Tinney BYTE covers, Hipgnosis. One painted or staged image per span, such as Season shown as a CRT in a field. Data: changes with the span. Use only on the header, never behind text.

**Rules of thumb.** One glowing screen per panel. Few, large numbers. Every label earns its place. Wear and glow are seasoning, not the meal. Effects like scanlines and bloom stay subtle and must not hurt legibility.

**House decision (2026-10-24).** The shipped word key is the pale silver keycap, with a darker grey modifier. The primary key is that silver cap with a navy lamp, not the orange key in item 10. Seafoam and cornflower are the spare plastics. Beige, cream, yellow, and orange caps are not the house. Allie likes the silver cap and wants more of it. See `docs/DESIGN_STYLE.md` → Keycaps.

---

## Sources

- Typeset in the Future, *2001: A Space Odyssey*: https://typesetinthefuture.com/2001-a-space-odyssey/
- Gizmodo, guide to analogue control panels in sci-fi: https://gizmodo.com/the-ultimate-guide-to-analog-control-panels-in-scifi-mo-1709949467
- John Coulthart, Ron Cobb obituary: https://www.johncoulthart.com/feuilleton/2020/09/22/ron-cobb-1937-2020/
- Domus, Alien and Nostromo design (2025): https://www.domusweb.it/it/notizie/2025/09/19/alien-design-nostromo.html
- Typeroom, Alien title typography: https://www.typeroom.eu/article/alien-seven-7-times-typography-ruled-silver-screen
- Boing Boing, MU/TH/UR 6000 recreation: https://boingboing.net/2025/08/11/recreation-of-muthur-6000-computer-system-from-alien.html
- HUDs+GUIs, Blade Runner: https://www.hudsandguis.com/home/2010/12/12/blade-runner
- HUDs+GUIs, Andor Season 2: https://www.hudsandguis.com/home/2026/andor-s2
- StarWars.com, Andor concept to screen: https://starwars.com/news/andor-concept-to-screen
- Wikipedia, LCARS: https://en.wikipedia.org/wiki/LCARS
- Fonts In Use, Helvetica Compressed: https://www.fontsinuse.com/typefaces/7751/helvetica-compressed
- /Film, Severance computers: https://slashfilm.com/838690/severances-computers-were-actually-functional-including-the-numbers-on-screen
- Creative Bloq, Severance prop designs: https://creativebloq.com/entertainment/movies-tv-shows/5-perfect-severance-prop-designs-that-shaped-the-apple-series
- Wikipedia, Gavin Rothery: https://en.wikipedia.org/wiki/Gavin_Rothery_(filmmaker)
- Wikipedia, Robert Tinney: https://en.wikipedia.org/wiki/Robert_Tinney
- Vintage Computing and Gaming, Tinney interview: https://www.vintagecomputing.com/?p=169
- NASSP, Apollo DSKY: https://nassp.space/index.php/DSKY
- Creative Review, NASA worm logo: https://www.creativereview.co.uk/nasa-worm-logo/
- Space.com, NASA manual reissue: https://space.com/30434-nasa-worm-logo-kickstarter.html
- Public Domain Review, 1970s space colony art: https://publicdomainreview.org/collection/space-colony-art-from-the-1970s/
- NSS, NASA Ames 1970s colony art: https://nss.org/settlement/nasa/70sArtHiRes/70sArt/art.html
- It's Nice That, Soviet Space Graphics: https://www.itsnicethat.com/articles/alexandra-sankova-soviet-space-graphics-phaidon-publication-310320
- The Henry Ford, from beige to Bondi Blue: https://www.thehenryford.org/explore/blog/from-beige-to-bondi-blue-changing-colors-in-computer-design/
- Wikipedia, Compucolor / Intecolor: https://en.wikipedia.org/wiki/Compucolor
- Blake Crosley, Teenage Engineering design guide: https://blakecrosley.com/guides/design/teenage-engineering
- Wikipedia, Teenage Engineering OP-1: https://en.wikipedia.org/wiki/Teenage_Engineering_OP-1
- Matrixsynth, Destiny Plus Programma 900: https://www.matrixsynth.com/2024/05/destiny-plus-introduces-programma-900.html
- Wikipedia, Technical Ecstasy: https://en.wikipedia.org/wiki/Technical_Ecstasy
- Wikipedia, Hipgnosis: https://en.wikipedia.org/wiki/Hipgnosis
- Wikipedia, Eurostile: https://en.wikipedia.org/wiki/Eurostile
- Google Fonts, Orbitron: https://fonts.google.com/specimen/Orbitron/about

**Confidence notes.** Hex values are eyeballed working values, not specs. Facts not confirmed by the sources above and marked "often cited" or left general: LCARS typeface; 2001 screens made as rear-projected film; Guidotti and Davis as torus painters; Reed and Smyth as reissue editors; Luke Hull's role on Andor (from search results only).
