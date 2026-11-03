/**
 * lib/doc-retrieval/fixture.ts — A made-up appliance manual and labelled questions
 *
 * The right answers are known, so a retriever can be scored. Each `answer` is a
 * phrase found in exactly one section. `exact` questions share a rare word with
 * it; `paraphrase` questions share none, which is where keywords fail and
 * embeddings should help. Add real documents' questions here as they come.
 */
import type { DocPage, EvalCase } from "./types"

const SECTIONS: [heading: string, body: string[]][] = [
  ["1. SAFETY", [
    "Read all instructions before using the Arden KX-400 espresso machine. Do not immerse the base, cord or plug in water or other liquid. Close supervision is needed when the machine is used near children.",
    "Unplug the machine from the wall when it is not in use and before cleaning. Allow it to cool for thirty minutes before removing parts. Never operate the machine with a damaged cord or after a malfunction.",
  ]],
  ["2. FIRST USE", [
    "Rinse the water tank and fill it to the MAX line. Run two empty cycles with the portafilter locked in place to flush the brew path. Discard the water from both cycles.",
    "The machine heats for about forty seconds. The ready light turns solid green when the boiler reaches brewing temperature. Do not start a brew while the light is blinking.",
  ]],
  ["3. GRINDER SETTINGS", [
    "The built-in burr grinder has sixteen settings. Setting 1 is the finest and setting 16 the coarsest. For a standard double shot start at setting 5 and adjust one step at a time.",
    "If the shot runs faster than twenty seconds the grind is too coarse; move down one setting. If the shot drips for more than thirty-five seconds the grind is too fine; move up one setting.",
  ]],
  ["4. MILK FROTHING", [
    "Purge the steam wand for two seconds before and after every use. Hold the pitcher so the tip of the wand sits just under the surface of the milk until it begins to stretch, then lower the tip to roll the milk.",
    "Whole milk gives the thickest foam. Oat drinks froth well if labelled barista blend. Stop at sixty-five degrees Celsius; hotter milk loses its sweetness and can scald.",
  ]],
  ["5. DESCALING", [
    "Descale every three months, or every two months if your water is hard. Mix one descaling sachet with five hundred millilitres of water and pour it into the tank. Press and hold the clean button for three seconds to start the program.",
    "The descaling cycle takes about twenty-five minutes and uses the entire tank. Afterward rinse the tank and run a full tank of fresh water through the group head and the steam wand.",
  ]],
  ["6. TROUBLESHOOTING", [
    "Error E17 means the water tank is not seated. Remove the tank and press it firmly into the base until it clicks. Error E42 means the boiler is too hot; switch the machine off and wait fifteen minutes.",
    "If coffee leaks around the portafilter, check the gasket for coffee grounds and clean it with the brush. A gasket that is cracked or hardened should be replaced; the part number is KX-GSK-58.",
  ]],
  ["7. CLEANING", [
    "Rinse the drip tray and the grounds bin daily. The portafilter, baskets and tank are dishwasher safe on the top rack only. Wipe the steam wand with a damp cloth immediately after frothing so milk does not dry on it.",
    "Once a week soak the portafilter and baskets in a solution of espresso machine cleaner. Never use bleach, abrasive pads or steel wool on any surface of the machine.",
  ]],
  ["8. WARRANTY", [
    "The Arden KX-400 carries a limited warranty of twenty-four months from the date of purchase. Keep your receipt; the warranty is void without proof of purchase. Wear parts such as gaskets and baskets are covered for ninety days.",
    "To make a claim contact Arden support with the serial number printed on the underside of the base. Damage from descaling with vinegar or from running the machine dry is not covered.",
  ]],
  ["9. SPECIFICATIONS", [
    "Power 1450 watts, 230 volts, 50 hertz. Pump pressure fifteen bar. Water tank capacity 1.8 litres. Bean hopper holds 250 grams. Weight 9.4 kilograms. Cord length 1.2 metres.",
    "The machine is rated for domestic use. Continuous use in an office or shop shortens the life of the pump and is outside the scope of the warranty.",
  ]],
]

/** One section per page, and each section's text repeated with a different page-footer so pages are not identical. */
export const FIXTURE_PAGES: DocPage[] = SECTIONS.map(([heading, body], i) => ({
  page: i + 1,
  text: `${heading}\n\n${body.join("\n\n")}\n\nArden KX-400 user manual, page ${i + 1}`,
}))

export const FIXTURE_CASES: EvalCase[] = [
  { question: "what does error E42 mean", answer: "Error E42 means the boiler is too hot", kind: "exact" },
  { question: "part number for the replacement gasket", answer: "KX-GSK-58", kind: "exact" },
  { question: "how many bar is the pump", answer: "Pump pressure fifteen bar", kind: "exact" },
  { question: "how often should I descale with hard water", answer: "every two months if your water is hard", kind: "exact" },
  { question: "which grinder setting should I start at", answer: "start at setting 5", kind: "exact" },
  { question: "how long is the warranty", answer: "limited warranty of twenty-four months", kind: "exact" },
  { question: "my espresso comes out too quickly and tastes sour", answer: "the grind is too coarse", kind: "paraphrase" },
  { question: "the machine says the water container is loose", answer: "Error E17 means the water tank is not seated", kind: "paraphrase" },
  { question: "can I put the parts in the dishwasher", answer: "dishwasher safe on the top rack only", kind: "paraphrase" },
  { question: "what is the best temperature for steaming oat milk", answer: "Stop at sixty-five degrees Celsius", kind: "paraphrase" },
  { question: "is it ok to use vinegar to clean out limescale", answer: "descaling with vinegar", kind: "paraphrase" },
  { question: "can I use this in my cafe all day", answer: "Continuous use in an office or shop", kind: "paraphrase" },
]
