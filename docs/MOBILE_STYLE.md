# Brain2 mobile style

_Last mapped: 2026-10-29._

This document is the style for the iOS / mobile app only. Desktop rules in
`docs/DESIGN_STYLE.md` do not apply here. Mobile does not inherit desktop
type, color, chrome, density, or decoration. When they conflict, mobile wins
on compact / Capacitor / phone layouts, and desktop wins on desktop layouts.

Brain2 on the phone is a personal knowledge and productivity app: tasks,
habits, tracking, lists, modules, and search. Aim at a modern phone app. A
shrunk desktop is the wrong shape.

## Rules

1. **Content first.** Drop desktop chrome on the phone: persistent multi-pane
   sidebars, multi-row toolbars, and dense status bars.

2. **Progressive disclosure.** The primary action stays visible. Secondary
   tools live in a sheet, a menu, or a long-press. Do not cram the desktop
   feature set onto one screen.

3. **Fluid layout.** No hardcoded widths that overflow a phone. Honor safe
   areas for the Dynamic Island, the notch, and the home indicator. Critical
   controls stay out of those insets.

4. **Touch.** Targets are at least 44×44 points. No hover-only actions.

5. **Type that can grow.** No fixed-height boxes that clip longer text.
   Inputs are at least 16px so iOS does not zoom on focus and trap the user.

6. **Pinch zoom stays on.** Do not disable pinch zoom. No `user-scalable=no`.
   No `maximum-scale` lock.

7. **Structure before decoration.** Spacing and hierarchy decide the screen
   before decoration does. Mobile may use a more modern palette, type, and
   elevation than the desktop. Do not prescribe desktop tokens here.

   Visual identity may diverge from the desktop. It is not chosen yet, except
   the page field: the iOS shell uses the default Snowflake plate
   (`/pcb/mint.jpg`). A later pass would set type, color, elevation, and motion.

8. **Desktop layouts stay as they are.** A mobile change must not rewrite the
   desktop screen to match.

9. **Close controls stay in the safe area.** _Last mapped: 2026-10-28._
   Do not place the X (close) of a popup above the battery, the status bar,
   the notch, or the Dynamic Island. The control has to sit in the tappable
   area: `env(safe-area-inset-top)` plus the mobile shell chrome. A sheet may
   put the close in the scrolling content only when the sheet actually scrolls
   and the user can bring that control fully below the status bar. Otherwise
   pin it inside the safe area. A close that sits under the status bar is
   stuck: iOS will not deliver the tap.

10. **Every phone sheet can be closed.** _Last mapped: 2026-10-28._
    A sheet, detail view, or popup that opens on the phone must dismiss
    without leaving the app. The close control is the one that sheet already
    uses (the corner key, or the word Close in the header). It has to be
    wired, at least 44×44 points, and below the status bar. The dimmed page
    behind the sheet dismisses a dialog that already listens for the overlay.
    Escape dismisses a dialog that already listens for it. Do not pin a sheet
    to `100dvh` with the close at the top of the screen. In the iOS shell the
    safe-area inset can be 0 while the status bar still covers the page, so
    `env()` alone leaves that key in the bar and the tap never arrives.
    `--phone-sheet-top` in `components/Mobile/mobile.css` is that inset, and
    at least 59px when the inset is 0. The Latest award handheld shipped with
    the key in the status bar.

11. **No lace on pixel type.** _Last mapped: 2026-10-29._
    Pixel fonts (Silkscreen, DotGothic16, and the rest) are filled glyphs only,
    in this phone / iOS app and in the web app. Do not put a white, cream, or
    light outline, lace, halo, or stroke on them. No `-webkit-text-stroke` /
    `text-stroke`, no `paint-order` stroke, and no multi-offset `text-shadow`
    or `drop-shadow` filter used to trace the glyph in a light color. A
    one-pixel white lip (`text-shadow: 0 1px 0 rgba(255, 255, 255, …)`) is the
    same lace; Habits period tabs such as “Season (2)” were an example. `w95fa`
    has one real weight. `font-weight` above that weight (600, 700, bold) makes
    WebKit paint a light fringe around the glyphs. That fringe is the same
    lace. On pixel faces set `font-synthesis: none` (and do not use a light
    `-webkit-text-stroke`). Do not “bold” a pixel face by synthesis. A dark
    shadow for depth is a different thing. The Dash word glow stays the ink’s
    own bloom. The web app states the same ban under DSi pixel and lights in
    `docs/DESIGN_STYLE.md`. The rest of that file still does not apply here.

12. **The typing keyboard is keycaps.** _Last mapped: 2026-10-29._
    On the phone shell, typing uses the in-app deck (`components/Mobile/keyboard/`),
    not the system keyboard. Letter keys are the pale silver keycap. Shift,
    delete, 123, ABC, space, hide, and return are the darker modifier cap.
    A locked shift is the black CRT with a green legend. Do not draw a flat
    or pill key on that deck.
