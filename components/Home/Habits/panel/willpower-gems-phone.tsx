/**
 * components/Home/Habits/panel/willpower-gems-phone.tsx — phone physics copy
 *
 * Mobile shell only. Desktop equations and Explain strings stay on
 * `willpower-gems.tsx` / `WILLPOWER_PHYSICS_FIELDS`. A bit is either words
 * or one KaTeX figure. The lead is the short layer. Explain opens the nest.
 */
export type PhoneBit = { text: string; tex?: string }

const g = (text: string, tex?: string): PhoneBit => (tex ? { text, tex } : { text })

export const PHONE_GRAB_REACH = 2.4

export const PHONE_FIELD_TEX: Record<string, string> = {
  g: "g",
  restitution: "e",
  mass: "m",
  dishK: "\\kappa",
  friction: "\\mu N",
  linearDrag: "b",
  quadDrag: "c",
  stirHop: "\\Delta v_z",
  stirSpeed: "\\Delta \\mathbf{v}_{xy}",
  magnus: "C_M",
  chaos: "\\xi",
  repulsion: "k",
  wallRestitution: "e_w",
}

export const PHONE_UNIT_TEX: Record<string, string> = {
  g: "\\mathrm{px}/\\mathrm{s}^{2}",
  dishK: "\\mathrm{s}^{-2}",
  friction: "\\mathrm{px}/\\mathrm{s}^{2}",
  linearDrag: "\\mathrm{s}^{-1}",
  quadDrag: "\\mathrm{px}^{-1}",
  stirHop: "\\mathrm{px}/\\mathrm{s}",
  stirSpeed: "\\mathrm{px}/\\mathrm{s}",
}

export type PhoneLayer = { lead: PhoneBit[]; deeper: PhoneBit[] }

export const PHONE_CARDS: Record<string, PhoneLayer> = {
  "eq-g": {
    lead: [
      g("A gem tossed up comes back. Each step changes upward speed by gravity plus the vertical part of air drag. Why doesn’t a harder toss just hang there?"),
    ],
    deeper: [
      g("The dish pulls sideways only. Air drag "),
      g("a_d = -(b + c|v|) v", "\\mathbf{a}_d = -(b + c|\\mathbf{v}|)\\,\\mathbf{v}"),
      g(" rides on the whole velocity, so it tugs the vertical part too. The graph is that same step, not a straight vacuum drop. Raise "),
      g("g", "g"),
      g(" and the hop dies sooner. You are back at the toss: it comes home because of that law."),
    ],
  },
  "eq-vz": {
    lead: [
      g("This is how fast the tracked gem is rising or falling right now. Is that just “start speed, minus gravity, times time”?"),
    ],
    deeper: [
      g("Not once air is in the step. Vertical acceleration is "),
      g("v-dot_z = -g - (b + c|v|) v_z", "\\dot{v}_z = -g - (b + c|\\mathbf{v}|)\\, v_z"),
      g(". Drag steals more from a fast gem than a slow one. Let go of the gem and this number is the speed the next step will change."),
    ],
  },
  "eq-z": {
    lead: [
      g("Height above the dish. On screen the sprite sits higher than its dish position, because the painter lifts it by height times a small perspective factor."),
    ],
    deeper: [
      g("The height graph uses the same free-flight step as the gems: gravity and full-vector drag. The dish and plate friction do not change "),
      g("z-double-dot", "\\ddot{z}"),
      g(". So the curve you see is the hop the integrator is actually taking."),
    ],
  },
  "eq-e": {
    lead: [
      g("The floor does not hand the speed back whole. It flips vertical speed and multiplies by this gem’s bounciness. Why do the gems eventually sit still?"),
    ],
    deeper: [
      g("Below about "),
      g("28 px/s", "28\\,\\mathrm{px}/\\mathrm{s}"),
      g(" of rebound, effective bounciness becomes 0. That rest cutoff is why a pile can sleep. Chaos can give each gem its own "),
      g("e", "e"),
      g(". The hop you started with ends as a quiet gem, not an endless clink."),
    ],
  },
  "eq-k": {
    lead: [
      g("The tracked gem is the one in your hand, or else the one carrying the most kinetic energy. Where does that energy go?"),
    ],
    deeper: [
      g("A stir adds it. Drag, friction, a bounce with "),
      g("e < 1", "e < 1"),
      g(", the rest cutoff, spin damping, and the speed caps spend it. The number beside "),
      g("K", "K"),
      g(" is that budget for the gem you are watching."),
    ],
  },
  "eq-u": {
    lead: [
      g("Higher up, or farther out in the bowl, the gem stores more potential. Why doesn’t everything slide into the crystal?"),
    ],
    deeper: [
      g("Potential is "),
      g("U = m g z + 1/2 m κ r^2", "U = mgz + \\tfrac12 m \\kappa r^2"),
      g(". Its slope is the dish acceleration inward and gravity down. Static friction wins inside a dead disk, "),
      g("r ≤ μN/κ", "r \\le \\mu N/\\kappa"),
      g(", so the pile stops there instead of on the crystal."),
    ],
  },
  "held:eq-g": {
    lead: [
      g("Your finger is the law. The integrator skips this gem until you let go."),
    ],
    deeper: [
      g("Release keeps this height and the pointer’s velocity. Gravity and drag start on the next step. There is no hidden hop. The toss you feel is the one you gave it."),
    ],
  },
  "held:eq-vz": {
    lead: [g("Vertical speed is whatever your finger is doing, not a free-flight prediction.")],
    deeper: [
      g("On release, that speed becomes the free-flight start. The step "),
      g("v-dot_z = -g - (b + c|v|) v_z", "\\dot{v}_z = -g - (b + c|\\mathbf{v}|)\\, v_z"),
      g(" takes over from there."),
    ],
  },
  "held:eq-z": {
    lead: [g("Height follows the pointer. Dragging above the dish lifts the gem so it stays under your finger.")],
    deeper: [
      g("Let go and this height is the start of the hop. The dish does not add a secret boost."),
    ],
  },
  "held:eq-e": {
    lead: [g("Bounciness waits for the landing. It does nothing while you hold the gem.")],
    deeper: [
      g("After release, the floor uses "),
      g("v_z^+ = -e v_z^-", "v_z^{+} = -e\\, v_z^{-}"),
      g(" until the rebound is tiny, and then it just stops."),
    ],
  },
  "held:eq-k": {
    lead: [g("While you hold it, kinetic energy is the speed of your finger.")],
    deeper: [
      g("A fast flick stores more "),
      g("K = 1/2 m |v|^2", "K = \\tfrac12 m |\\mathbf{v}|^2"),
      g(". Mass does not change the flick. It changes how much energy that speed is worth."),
    ],
  },
  "held:eq-u": {
    lead: [g("Lift it and potential climbs with height. Slide it out and the bowl stores more too.")],
    deeper: [
      g("That is "),
      g("U = m g z + 1/2 m κ r^2", "U = mgz + \\tfrac12 m \\kappa r^2"),
      g(". Release, and the slope of that hill is the acceleration the step will apply."),
    ],
  },
  "eq-extra": {
    lead: [g("These extra numbers are the whole crowd, not a second physics engine.")],
    deeper: [
      g("Total energy adds kinetic, potential, and spin. Momentum is the vector sum of "),
      g("m v", "m\\mathbf{v}"),
      g(". Energy falls because bounces lose some, and because of drag, friction, spin damping, and the speed caps. Slow motion only shrinks the timestep so you can watch the same laws."),
    ],
  },
}

export const PHONE_KNOBS: Record<string, PhoneLayer> = {
  g: {
    lead: [g("This slider is the downward acceleration in the free-flight step.")],
    deeper: [
      g("Each step adds "),
      g("-g", "-g"),
      g(" to vertical speed, then the vertical part of "),
      g("a_d", "\\mathbf{a}_d"),
      g(". The dish does not pull up or down. A bigger "),
      g("g", "g"),
      g(" brings the hop home sooner."),
    ],
  },
  restitution: {
    lead: [g("How much vertical speed the floor gives back. Turn it down and the pile settles sooner.")],
    deeper: [
      g("The landing is "),
      g("v_z^+ = -e v_z^-", "v_z^{+} = -e\\, v_z^{-}"),
      g(". Under about "),
      g("28 px/s", "28\\,\\mathrm{px}/\\mathrm{s}"),
      g(" of rebound, effective "),
      g("e", "e"),
      g(" is 0 so the gems can rest. You still threw the same hop. The floor just kept less of it."),
    ],
  },
  mass: {
    lead: [g("A heavier gem stores more motion at the same speed, and shoves a light neighbor harder. Does it fall faster?")],
    deeper: [
      g("No. Fall, slide, and the dish are accelerations, so mass does not change them. A collision uses reduced mass. A stir is a velocity impulse, not a push that scales with "),
      g("m", "m"),
      g("."),
    ],
  },
  dishK: {
    lead: [g("The bowl is a spring toward the crystal. Steeper curve, stronger pull. Why is the pile not glued to the middle?")],
    deeper: [
      g("Dish acceleration is "),
      g("a_dish = -κ r", "\\mathbf{a}_{\\mathrm{dish}} = -\\kappa\\, \\mathbf{r}"),
      g(". Static friction freezes a gem when that pull is weaker than "),
      g("μN", "\\mu N"),
      g(", a dead disk, not the bottom of the hill."),
    ],
  },
  friction: {
    lead: [g("While a gem is on the dish, friction drags its sideways slide. A hop does not grease the plate.")],
    deeper: [
      g("Grounded Coulomb drag is "),
      g("a_f = -μN v-hat_xy", "\\mathbf{a}_f = -\\mu N\\, \\hat{\\mathbf{v}}_{xy}"),
      g(" only when height is about 0. If the dish pull is smaller than that friction, the gem stops. That is the quiet pile."),
    ],
  },
  wallRestitution: {
    lead: [g("The chrome rim is a wall. This is how lively a sideways hit on it is.")],
    deeper: [
      g("The normal speed flips: "),
      g("v_n^+ = -e_w v_n^-", "v_n^{+} = -e_w\\, v_n^{-}"),
      g(". A very soft closing speed is killed, same low-speed fade as gem-on-gem contacts. On the phone that rim is the oval you can see."),
    ],
  },
  linearDrag: {
    lead: [g("Air resists in proportion to speed. It tamps a throw without changing the bounce rule.")],
    deeper: [
      g("Linear "),
      g("b", "b"),
      g(" is the first term in "),
      g("a_d = -(b + c|v|) v", "\\mathbf{a}_d = -(b + c|\\mathbf{v}|)\\,\\mathbf{v}"),
      g(", and that vector includes vertical speed. The hop still comes from gravity. Drag just shortens it."),
    ],
  },
  quadDrag: {
    lead: [g("The fastest throws meet a stronger wind. That is the quadratic part of the same drag.")],
    deeper: [
      g("Coefficient "),
      g("c", "c"),
      g(" multiplies speed inside "),
      g("a_d", "\\mathbf{a}_d"),
      g(". It clips a scatter-bomb stir. A gentle hop barely feels it. You are still in the one drag law."),
    ],
  },
  magnus: {
    lead: [g("A spinning gem drifts sideways. The lift is perpendicular to its slide, so it does not feed the speed budget.")],
    deeper: [
      g("Spin acceleration is "),
      g("a_M proportional to ω × v_xy", "\\mathbf{a}_M \\propto \\boldsymbol{\\omega} \\times \\mathbf{v}_{xy}"),
      g(". Spin also damps each step. The hop’s height is still gravity and drag."),
    ],
  },
  stirHop: {
    lead: [g("Pressing the well, not grabbing a gem, kicks vertical speed. The default hop clears about a gem’s height.")],
    deeper: [
      g("It is a velocity impulse, "),
      g("Δv_z", "\\Delta v_z"),
      g(", then the free-flight step takes over. Grabbing a gem does not press the well and does not add this kick."),
    ],
  },
  stirSpeed: {
    lead: [g("The same press shoves gems around the crystal. Stronger near the finger.")],
    deeper: [
      g("Sideways impulse "),
      g("Δv_xy", "\\Delta \\mathbf{v}_{xy}"),
      g(" is tangential, not "),
      g("p = m v", "p = m v"),
      g(". Mass does not scale it. The whirl you see is that shove, then drag and the dish."),
    ],
  },
  chaos: {
    lead: [g("A little mess in the stir, and a spread of mass and bounciness from gem to gem.")],
    deeper: [
      g("Low "),
      g("ξ", "\\xi"),
      g(" is a clean whirl. High is a mess. It does not keep injecting random speed after the pile has settled."),
    ],
  },
  repulsion: {
    lead: [g("Gems do not fuse. A thin cushion sits just outside contact, and a real overlap is a hard hit.")],
    deeper: [
      g("The cushion scales like "),
      g("(1 - d/d_0)^2 / m", "(1 - d/d_0)^{2} / m"),
      g(". Fast hits look glassy. At rest the push goes quiet, so a full plate can settle."),
    ],
  },
}

export function phoneCardLayer(id: string, held: boolean): PhoneLayer | undefined {
  return PHONE_CARDS[held ? `held:${id}` : id] ?? PHONE_CARDS[id]
}
