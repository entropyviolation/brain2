# Solarpunk parking lot mockup (shared brief)

The user's full spec is in the thread; summary below. Two files, built by two agents in parallel:
- `5-solarpunk.html` — world, lighting, camera, UI, post-processing (agent A)
- `solarpunk-cars.js` — car models (agent B)

## Runtime (both files)
Classic scripts, global THREE, loaded in this order by the HTML:
1. https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js
2. https://cdnjs.cloudflare.com/ajax/libs/gsap/3.12.5/gsap.min.js
3. From https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/ : shaders/CopyShader.js, shaders/LuminosityHighPassShader.js, shaders/FXAAShader.js (optional), postprocessing/EffectComposer.js, postprocessing/RenderPass.js, postprocessing/ShaderPass.js, postprocessing/UnrealBloomPass.js, objects/Water.js or objects/Reflector.js if used. SSAOPass needs SimplexNoise + SSAOShader; include it only behind a quality toggle (default off on small screens).
4. `solarpunk-cars.js` (relative path)
The sandbox can't fetch CDNs; only `node --check` your script. Viewers can.

## Car API (contract between A and B)
`window.SolarpunkCars = { KINDS: string[], build(kind, opts) => THREE.Group }`
- `opts = { style: "concept" | "retro", color?: number, envMap?: THREE.Texture }`
- Car faces +Z, sits on y=0, length ~4.2 units, width ~1.9.
- Returned group has `userData = { headlights: THREE.Material[] (emissive, set emissiveIntensity 0..3), taillights: THREE.Material[], exhaust: THREE.Object3D (point at rear, for particles), wheels: THREE.Object3D[] (spin around local X), length, width }`.
- "concept" (default): sleek 1980s concept cars, wedge shapes, pop-up/slim light bars, flush glass, aero wheel covers. Palette: white, silver, muted earth tones (sand, sage, clay, slate). ~8 distinct KINDS.
- "retro": the existing hand-built cars from `3-night-garage.html` (Oldsmobile, Volvo 240, Mercedes SL, Jeep Cherokee, Bronco, Vanagon, Panda, R5, Samurai), ported to this API. Copy their builders and textures from that file.

## World (agent A)
- Real-time day/night from `new Date()`, plus a small time scrubber (and "Live" button) so the user can preview dawn / midday / dusk / night. Sun/moon DirectionalLight arcs; ambient + hemisphere colors per phase as in spec (dawn peach + low fog, midday stark white + saturated green, dusk golden + terracotta bounce, night cool blue moonlight; bioluminescent plants glow, car lights and labels become the light sources). Procedural sky dome shader blending blue, sunset gradient and stars.
- Zoom levels with gsap tweens (buttons + scroll/pinch): 1 Car (perspective close-up on selected), 2 Structure (isometric-feel tactical view, default), 3 Forest (wide, structure inside lush jungle, waterfalls into a glowing river), 4 Macro (whole world inside a glass geodesic dome floating in a starry void, subtle reflections/fresnel). Use one PerspectiveCamera with FOV/position tweens.
- Structure: multi-level terraced white concrete parking deck, gently curved, sweeping white arches, cascading water channels, big terraced planters overflowing with ferns, monstera, hanging vines, palms; organic bays; reflective puddles. Concrete has subtle procedural texture (canvas noise + board-form lines).
- Vegetation: InstancedMesh for ferns/fronds/leaves/grass/trees; LOD: at zoom 3–4 hide high-detail plants and show instanced low-poly canopy blobs.
- Water: animated shader (scrolling normals, fresnel, emissive tint at night), waterfalls as scrolling translucent planes + mist particles.
- Labels: floating semi-transparent pill labels (dark green/black, phosphor green #7dffc4 text, monospace "JetBrains Mono" or "Space Mono" from Google Fonts) with a thin glowing leader line to each car (SVG overlay or THREE.Line). Tiny inline SVG icons (leaf, gear, signal bars). Clicking expands a label to session detail (time left, was on, lines with Min/Goal/Exc tiers) and a Resume button.
- Resume: headlights on, exhaust particles (soft, white/green, no orange), car drives a CatmullRomCurve3 spline out of its bay and off the deck, then a running clock appears with "back to the lot".
- Post: EffectComposer + RenderPass + UnrealBloomPass (stronger at night), ACESFilmic tone mapping, sRGB output. Quality toggle (High/Low) that disables bloom/SSAO and reduces instances.
- Use the sample sessions from BRIEF.md plus enough to fill ~9 bays. Toggle "Concept / Retro" cars.
- Respect prefers-reduced-motion (snap tweens, skip drive). Phone width works. Small corner tag: "5 · Solarpunk sanctuary — breaks the rules".
- Colour: the spec asks for warm dawn/dusk light and terracotta accents; that's allowed here (it's sun light and material, not LEDs). Keep UI lights green.

## Token frugality
Don't explore the repo. Read only what you need. Write once, `node --check` the script (extract inline JS to a temp file), fix, stop. Reply in two lines.
