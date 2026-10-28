# Brain2 mobile style

_Last mapped: 2026-10-28._

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
