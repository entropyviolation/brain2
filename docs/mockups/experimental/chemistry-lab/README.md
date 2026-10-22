# Chemistry lab (experimental)

_Last mapped: 2026-10-22_ **Planned.** Not built in the app. Moved here from the Day Tubes page so the liquid and sand tubes stay separate from it.

- `chemistry-lab.html` is the built page. Run `./build.sh` after editing `src/`. It reuses `../../slants/time-grid-lab/src/` files (`00-head.html`, `02-engine.js`, `24-sim.js`, `26-tubeview.js`), so the particle fluid has one source.
- `src/50-chem.js` is the engine (reactive particle fluid, species, reactions, thermochemistry, pH, colour). `src/51-chemlab.js` is the view and controls. `src/chem-body.html` is the page shell.

## What it does

Pick two aqueous reagents, strengths and volumes, a bath temperature, an indicator, an optional KI catalyst and a chemistry speed. Pour A under B, then mix by holding Stir, or by tilting and shaking the tube. Seven presets: vinegar and baking soda, copper sulfate and NaOH, HCl and NaOH with phenolphthalein, silver nitrate and salt, hydrogen peroxide with and without a catalyst, calcium chloride and sodium carbonate, a vinegar and NaOH buffer. Each has what to watch, why, and things to change.

## Model

Each particle of the liquid is a parcel of solution carrying 24 species concentrations and a temperature. Parcels move with the flow, exchange species by diffusion (real coefficients, conservative pair sum) and heat by conduction, react, and warm or cool by enthalpy (dT = -dH xi / 4180 J/(L K)).

- Instant ionic steps: H+ with OH-, CO3 2-, HCO3-; acetic acid with OH-; HCO3- with OH-.
- Rate laws with Arrhenius k(T): vinegar with bicarbonate, peroxide decomposition with an iodide path.
- Precipitation to the Ksp equilibrium (Cu(OH)2, AgCl, CaCO3), which also redissolves.
- Gas: dissolved CO2 and O2 above Henry's-law solubility (falling as T rises) become bubbles that rise and leave at the surface, paying their dissolution enthalpy.
- Readouts: clock, mean and peak temperature, bulk pH (Henderson–Hasselbalch, weak-acid and Ksp equilibria), gas released (ideal gas), solid mass, heat released, amounts now against a perfectly mixed batch, concentration and temperature plots, element conservation (relative drift about 1e-14 in tests). Show the math prints each equation.

## Honest limits

Enthalpies are rounded textbook values. Slow-reaction rate constants are calibrated for a readable time scale, not measured. Fast reactions are limited by mixing, as in a real tube. Colours use Beer–Lambert with tuned absorptivities. pH ignores activity. Settling speed is exaggerated. Pairs that would form other solids are flagged as not modelled. 2D side view. About 10 ms per frame.

**Not done:** sealed tube with pressure, solid reagents (magnesium), gas-phase equilibria, a heat source besides the bath, a three.js renderer. The engine does not depend on the renderer, so a 3D version can reuse it.
