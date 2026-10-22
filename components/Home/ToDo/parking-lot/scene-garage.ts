/**
 * components/Home/ToDo/parking-lot/scene-garage.ts — the Night garage parking lot
 *
 * Ported from parking-lot-mockups/3-night-garage.html: a rooftop lot at blue
 * hour, one toy car per parked session. Car models go to sessions by index
 * (`GARAGE_MODELS[i % 9]`), bays by a fixed order. Labels are a name pill that
 * opens to car model and time left on hover. Select zooms to the car; resume
 * lights the headlamps, reverses out and drives down the ramp.
 */
import * as THREE from "three"
import { LOT_TIER_COLOR, type LotCar, type MountLot } from "./types"
import { GARAGE_MODELS, createGarageKit, cvs, lin, type BuiltCar } from "./garage-cars"

const LW = 16, LD = 11.4, SLOPE = 3.6 / 6.4, BAYW = 1.15
const BAYX = (i: number) => -5.4 + i * BAYW
const BAYS = [3, 5, 7, 9, 1, 10, 12, 14, 16, 2, 6, 18, 11, 15, 4, 8, 13, 17]
const ISO = new THREE.Vector3(11, 12, 11), PITCH = Math.atan(12 / Math.hypot(11, 11))
const hex = (n: number) => "#" + n.toString(16).padStart(6, "0")

type Parked = BuiltCar & { id: string; bay: number; home: THREE.Vector3; rot: number; label: HTMLButtonElement; parts: { dot: HTMLElement; title: HTMLElement; meta: HTMLElement } }
type Drive = { c: Parked; t: number; P0: THREE.Vector3; P1: THREE.Vector3; P2: THREE.Vector3; last: THREE.Vector3; done: () => void; resolved: boolean }

export const mount: MountLot = (host, { onPick, reducedMotion: RM }) => {
  let seed = 11
  const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647
  const V3 = THREE.Vector3

  /* ---------- renderer, sky, fog ---------- */
  const canvas = document.createElement("canvas")
  canvas.style.cssText = "position:absolute;inset:0;width:100%;height:100%;display:block"
  host.appendChild(canvas)
  const layer = document.createElement("div")
  layer.className = "pl-garage-labels"
  layer.style.cssText = "position:absolute;inset:0;pointer-events:none;overflow:hidden;font-family:inherit"
  host.appendChild(layer)
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true })
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2))
  renderer.toneMapping = THREE.ACESFilmicToneMapping
  renderer.toneMappingExposure = 1.05
  renderer.shadowMap.enabled = true
  renderer.shadowMap.type = THREE.PCFSoftShadowMap
  const scene = new THREE.Scene()
  const bgTex = new THREE.CanvasTexture(cvs(2, 256, (g) => { const r = g.createLinearGradient(0, 0, 0, 256)
    r.addColorStop(0, "#0a1130"); r.addColorStop(0.42, "#1f2e5e"); r.addColorStop(0.7, "#2a3c72"); r.addColorStop(1, "#16214a"); g.fillStyle = r; g.fillRect(0, 0, 2, 256) }))
  bgTex.colorSpace = THREE.SRGBColorSpace
  scene.background = bgTex
  scene.fog = new THREE.Fog(lin(0x1e2c5a), 30, 66)
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 140)
  const camT = new V3(), camGoal = new V3()
  let zoom = 1.15, zoomGoal = 1.15

  // environment map: blue-hour dome with a few cool light panels, so paint, chrome and glass reflect
  const envRT = (() => {
    const env = new THREE.Scene(), sg = new THREE.SphereGeometry(50, 32, 16), pos = sg.attributes.position, col: number[] = []
    const top = lin(0x0c1638), hor = lin(0x5670b4), gnd = lin(0x070b18), c = new THREE.Color()
    for (let i = 0; i < pos.count; i++) { const y = pos.getY(i) / 50
      if (y < 0) c.copy(hor).lerp(gnd, Math.min(1, -y * 6)); else c.copy(hor).lerp(top, Math.pow(Math.min(1, y * 2.2), 0.7)); col.push(c.r, c.g, c.b) }
    sg.setAttribute("color", new THREE.Float32BufferAttribute(col, 3))
    const dm = new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide })
    env.add(new THREE.Mesh(sg, dm))
    const pm = new THREE.MeshBasicMaterial({ color: new THREE.Color().setRGB(3, 3.4, 4, THREE.LinearSRGBColorSpace) })
    const pg: THREE.BufferGeometry[] = []
    ;[[-14, 22, 6, 10, 1.2], [12, 20, -10, 8, 1], [0, 26, 0, 14, 0.8], [22, 6, 4, 1.2, 6], [-20, 5, -12, 1.2, 5]].forEach(([x, y, z, w, d]) => {
      const bg = new THREE.BoxGeometry(w, 0.4, d); pg.push(bg); const p = new THREE.Mesh(bg, pm); p.position.set(x, y, z); p.lookAt(0, 0, 0); env.add(p) })
    const pmrem = new THREE.PMREMGenerator(renderer)
    const rt = pmrem.fromScene(env, 0.02)
    pmrem.dispose(); sg.dispose(); dm.dispose(); pm.dispose(); pg.forEach((x) => x.dispose())
    return rt
  })()
  scene.environment = envRT.texture

  const kit = createGarageKit()
  const { M, B, C, poly, std } = kit

  /* ---------- the lot ---------- */
  scene.add(new THREE.HemisphereLight(lin(0x8aa2e0), lin(0x10162e), 0.55 * Math.PI))
  const moon = new THREE.DirectionalLight(lin(0xb8ccff), 0.5 * Math.PI); moon.position.set(-7, 15, 6)
  moon.castShadow = true; moon.shadow.mapSize.set(2048, 2048); moon.shadow.bias = -0.0005; moon.shadow.normalBias = 0.02
  Object.assign(moon.shadow.camera, { left: -13, right: 13, top: 13, bottom: -13, near: 1, far: 45 }); scene.add(moon)

  // wet asphalt: roughness map with puddles, so lamp light and sky sheen pick out the wet patches
  const rough = new THREE.CanvasTexture(cvs(512, 512, (g) => { g.fillStyle = "rgb(165,165,165)"; g.fillRect(0, 0, 512, 512)
    for (let i = 0; i < 5000; i++) { const v = (130 + rnd() * 70) | 0; g.fillStyle = `rgb(${v},${v},${v})`; g.fillRect(rnd() * 512, rnd() * 512, 2, 2) }
    for (let i = 0; i < 34; i++) { const x = rnd() * 512, y = rnd() * 512, r = 20 + rnd() * 60, gr = g.createRadialGradient(x, y, 0, x, y, r)
      gr.addColorStop(0, "rgba(20,20,20,.95)"); gr.addColorStop(0.6, "rgba(40,40,40,.6)"); gr.addColorStop(1, "rgba(165,165,165,0)")
      g.save(); g.translate(x, y); g.scale(1.6, 0.7); g.translate(-x, -y); g.fillStyle = gr; g.beginPath(); g.arc(x, y, r, 0, 7); g.fill(); g.restore() } }))
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(LW, LD), std(0x262e4a, { roughness: 1, roughnessMap: rough, metalness: 0.25, envMapIntensity: 0.9 }))
  ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true; scene.add(ground)
  B(scene, LW, 0.5, LD, std(0x1b2340), 0, -0.26, 0)
  // garage body under the roof, with dim cool strip lights on the facades
  B(scene, LW + 0.6, 4, LD + 0.6, std(0x1c2545, { roughness: 0.9 }), 0, -2.5, 0)
  const stripM = new THREE.MeshBasicMaterial({ color: lin(0x9ad7ff), transparent: true, opacity: 0.35 })
  ;[-1.4, -2.9].forEach((y) => { B(scene, LW - 0.4, 0.05, 0.02, stripM, 0, y, LD / 2 + 0.31); B(scene, 0.02, 0.05, LD - 0.4, stripM, LW / 2 + 0.31, y, 0) })
  // parapets with the ramp gap on the right
  const GAP = 1.6, seg = LD / 2 - GAP
  ;[B(scene, LW, 0.5, 0.25, M.wall, 0, 0.25, -LD / 2), B(scene, LW, 0.5, 0.25, M.wall, 0, 0.25, LD / 2), B(scene, 0.25, 0.5, LD, M.wall, -LW / 2, 0.25, 0),
    B(scene, 0.25, 0.5, seg, M.wall, LW / 2, 0.25, -(GAP + seg / 2)), B(scene, 0.25, 0.5, seg, M.wall, LW / 2, 0.25, GAP + seg / 2)].forEach((w) => { w.castShadow = true; w.receiveShadow = true })
  const ramp = new THREE.Group(); ramp.position.set(LW / 2, -0.1, 0); ramp.rotation.z = -Math.atan(SLOPE); scene.add(ramp)
  B(ramp, 6.8, 0.2, 3, std(0x232b47, { roughness: 0.6, metalness: 0.2 }), 3.4, 0, 0); [-1, 1].forEach((sd) => B(ramp, 6.8, 0.4, 0.14, M.wall, 3.4, 0.25, sd * 1.57))

  // bays: 9 per row, back row 1–9 (noses to the back wall), front row 10–18
  const bayPos = (n: number) => ({ x: BAYX((n - 1) % 9), row: n <= 9 ? -1 : 1 })
  function numTex(t: string) { const tx = new THREE.CanvasTexture(cvs(128, 64, (g) => { g.fillStyle = "rgba(205,218,245,.85)"; g.font = "700 40px DM Sans, sans-serif"
    g.textAlign = "center"; g.textBaseline = "middle"; g.fillText(t, 64, 34) })); tx.colorSpace = THREE.SRGBColorSpace; return tx }
  const numG = new THREE.PlaneGeometry(0.62, 0.31)
  ;[-1, 1].forEach((row) => {
    for (let i = 0; i <= 9; i++) B(scene, 0.05, 0.012, 2.6, M.line, BAYX(i) - BAYW / 2, 0.006, row * 4.0)
    for (let i = 0; i < 9; i++) { const n = i + 1 + (row > 0 ? 9 : 0)
      const p = new THREE.Mesh(numG, new THREE.MeshStandardMaterial({ map: numTex(String(n).padStart(2, "0")), transparent: true, depthWrite: false, roughness: 0.6 }))
      p.rotation.set(-Math.PI / 2, 0, row > 0 ? Math.PI : 0); p.position.set(BAYX(i), 0.014, row * 3.0); p.receiveShadow = true; scene.add(p)
      const cs = B(scene, 0.7, 0.1, 0.14, M.conc, BAYX(i), 0.05, row * 5.08); cs.castShadow = cs.receiveShadow = true }
  })
  for (let x = -6; x < 5.5; x += 1.1) B(scene, 0.5, 0.012, 0.06, M.line, x, 0.006, 0)
  const arrow = new THREE.Mesh(new THREE.ShapeGeometry(poly([[0, -0.28], [0.5, 0], [0, 0.28], [0, 0.1], [-0.5, 0.1], [-0.5, -0.1], [0, -0.1]])), M.line)
  arrow.rotation.x = -Math.PI / 2; arrow.position.set(6.3, 0.008, 0); scene.add(arrow)

  // planters with small trees
  const leafG = [0.5, 0.36, 0.34].map((r) => new THREE.IcosahedronGeometry(r, 1))
  function planter(x: number, z: number) {
    const p = B(scene, 1.3, 0.42, 1.3, M.conc, x, 0.21, z); p.castShadow = p.receiveShadow = true; B(scene, 1.15, 0.02, 1.15, M.soil, x, 0.42, z)
    C(scene, 0.06, 1.0, M.bark, x, 0.9, z, null, 8).castShadow = true
    ;[[0, 1.55, 0], [0.22, 1.35, 0.15], [-0.2, 1.4, -0.12]].forEach(([dx, y, dz], i) => {
      const c = new THREE.Mesh(leafG[i], M.leaf); c.position.set(x + dx, y, z + dz); c.castShadow = true; scene.add(c) })
  }
  planter(-7.1, -4.6); planter(-7.1, 4.6); planter(5.6, -4.4); planter(5.6, 4.4); planter(7.2, -4.4)

  // lamp posts: cool white, with a light pool and a wet streak toward the viewer
  const GLOW = new THREE.CanvasTexture(cvs(128, 128, (g) => { const r = g.createRadialGradient(64, 64, 0, 64, 64, 64)
    r.addColorStop(0, "rgba(225,240,255,.95)"); r.addColorStop(0.25, "rgba(170,210,255,.38)"); r.addColorStop(1, "rgba(150,190,255,0)"); g.fillStyle = r; g.fillRect(0, 0, 128, 128) }))
  const addM = (opacity: number) => new THREE.MeshBasicMaterial({ map: GLOW, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, opacity })
  const poolM = addM(0.28), streakM = addM(0.2), bulbM = new THREE.MeshBasicMaterial({ color: lin(0xeaf5ff) })
  const spriteM = new THREE.SpriteMaterial({ map: GLOW, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true })
  const poolG = new THREE.CircleGeometry(2, 28), streakG = new THREE.PlaneGeometry(0.55, 3.4)
  function lampPost(x: number, z: number, dx: number, dz: number) {
    C(scene, 0.05, 2.8, M.pole, x, 1.4, z, null, 10).castShadow = true
    B(scene, Math.abs(dx) * 0.7 + 0.06, 0.06, Math.abs(dz) * 0.7 + 0.06, M.pole, x + dx * 0.33, 2.78, z + dz * 0.33)
    const bx = x + dx * 0.66, bz = z + dz * 0.66; B(scene, 0.3, 0.05, 0.3, bulbM, bx, 2.72, bz)
    const s = new THREE.Sprite(spriteM); s.scale.set(2.2, 2.2, 1); s.position.set(bx, 2.68, bz); scene.add(s)
    const pl = new THREE.PointLight(lin(0xd2e8ff), 1.25 * Math.PI, 8.5, 0); pl.position.set(bx, 2.5, bz); scene.add(pl)
    const pool = new THREE.Mesh(poolG, poolM); pool.rotation.x = -Math.PI / 2; pool.position.set(bx, 0.016, bz); scene.add(pool)
    const st = new THREE.Mesh(streakG, streakM); st.rotation.set(-Math.PI / 2, 0, Math.PI / 4); st.position.set(bx + 1.1, 0.018, bz + 1.1); scene.add(st)
  }
  lampPost(-2.5, -5.5, 0, 1); lampPost(2.1, -5.5, 0, 1); lampPost(-2.5, 5.5, 0, -1); lampPost(2.1, 5.5, 0, -1); lampPost(7.6, -2.3, -1, 0)

  // skyline silhouette behind the lot, a few lit windows
  function winTex() { const t = new THREE.CanvasTexture(cvs(64, 256, (g) => { g.fillStyle = "#111a3a"; g.fillRect(0, 0, 64, 256)
    for (let y = 6; y < 250; y += 10) for (let x = 5; x < 60; x += 9) { const v = rnd(); g.fillStyle = v < 0.025 ? "#e8f3ff" : v < 0.075 ? "#8fc8f0" : "#172150"; g.fillRect(x, y, 5, 5) } }))
    t.colorSpace = THREE.SRGBColorSpace; return t }
  const wmats = [0, 1, 2, 3].map(() => new THREE.MeshBasicMaterial({ map: winTex() }))
  const vd = new V3(-1, 0, -1).normalize(), pr = new V3(1, 0, -1).normalize()
  ;[[19, 6.2, 2.2], [26, 7.2, 2.6]].forEach(([d0, top, vr]) => {
    for (let s = -32; s < 32; s += 2.2 + rnd() * 1.8) { const d = d0 + rnd() * 3, w = 1.6 + rnd() * 2.4, h = 30
      const ty = (top + rnd() * vr - d * Math.sin(PITCH)) / Math.cos(PITCH), p = vd.clone().multiplyScalar(d).addScaledVector(pr, s)
      const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, 1.6 + rnd() * 2), wmats[(rnd() * 4) | 0]); m.position.set(p.x, ty - h / 2, p.z); m.rotation.y = Math.PI / 4; scene.add(m) }
  })

  /* ---------- cars + labels ---------- */
  const hlLight = new THREE.PointLight(lin(0xdcefff), 0, 6, 0); scene.add(hlLight)
  let parked: Parked[] = []
  let selected: string | null = null
  let drive: Drive | null = null
  let size = { w: 1, h: 1 }, half = 8

  const pillBase = "position:absolute;left:0;top:0;transform:translate(-50%,-100%);pointer-events:auto;cursor:pointer;background:rgba(14,22,46,.62);border:1px solid rgba(190,214,255,.18);color:#eef3ff;backdrop-filter:blur(6px);-webkit-backdrop-filter:blur(6px);white-space:nowrap;text-align:left;font:inherit;transition:opacity .3s;margin:0;"
  function setOpen(el: HTMLButtonElement, open: boolean) {
    el.style.borderRadius = open ? "10px" : "999px"
    el.style.padding = open ? "5px 9px 6px" : "3px 8px"
    el.style.zIndex = open ? "2" : "1"
    el.querySelectorAll<HTMLElement>(".pl-more").forEach((x) => (x.style.display = open ? "block" : "none"))
  }
  function makeLabel(id: string, model: string) {
    const el = document.createElement("button")
    el.type = "button"
    el.className = "pl-garage-label"
    el.style.cssText = pillBase + (RM ? "transition:none;" : "")
    const head = document.createElement("b"); head.style.cssText = "display:block;font-size:11.5px;font-weight:500"
    const dot = document.createElement("i"); dot.style.cssText = "display:inline-block;width:7px;height:7px;border-radius:50%;margin-right:6px;vertical-align:1px"
    const title = document.createElement("span"); head.append(dot, title)
    const em = document.createElement("em"); em.className = "pl-more"; em.textContent = model; em.style.cssText = "font-style:normal;font-size:10.5px;color:#a9b6d6"
    const meta = document.createElement("span"); meta.className = "pl-more"; meta.style.cssText = "font-size:11px;color:#a9b6d6;font-variant-numeric:tabular-nums"
    el.append(head, em, meta)
    setOpen(el, false)
    el.addEventListener("mouseenter", () => setOpen(el, true)); el.addEventListener("mouseleave", () => setOpen(el, false))
    el.addEventListener("focus", () => setOpen(el, true)); el.addEventListener("blur", () => setOpen(el, false))
    el.addEventListener("click", () => onPick(id))
    layer.appendChild(el)
    return { el, parts: { dot, title, meta } }
  }
  function fillLabel(c: Parked, car: LotCar) {
    c.parts.dot.style.background = hex(LOT_TIER_COLOR[car.tier])
    c.parts.title.textContent = car.title
    c.parts.meta.textContent = `${car.leftLabel} · bay ${String(c.bay).padStart(2, "0")}`
    c.label.setAttribute("aria-label", `${car.title}, ${car.leftLabel}`)
  }
  function headlights(c: Parked, on: boolean) {
    c.hlM.emissiveIntensity = on ? 2.6 : 0.12; c.tlM.emissiveIntensity = on ? 1.1 : 0.3; c.beamM.opacity = on ? 0.2 : 0; c.beams.forEach((b) => (b.visible = on))
    if (on) { c.g.add(hlLight); hlLight.position.set(0, 0.35, c.len / 2 + 1.2); hlLight.intensity = 1.6 * Math.PI }
    else if (hlLight.parent === c.g) { hlLight.intensity = 0; scene.add(hlLight) }
  }
  function park(c: Parked) {
    c.g.visible = true; c.g.position.copy(c.home); c.g.rotation.set(0, c.rot, 0); headlights(c, false); c.rvM.emissiveIntensity = 0
  }
  function clearCars() {
    if (drive) { drive.done(); drive = null }
    parked.forEach((c) => {
      if (hlLight.parent === c.g) { hlLight.intensity = 0; scene.add(hlLight) }
      scene.remove(c.g); c.own.geos.forEach((x) => x.dispose()); c.own.mats.forEach((x) => x.dispose()); c.label.remove()
    })
    parked = []
  }
  function buildCars(cars: LotCar[]) {
    clearCars()
    parked = cars.slice(0, BAYS.length).map((car, i) => {
      const b = kit.buildCar(GARAGE_MODELS[i % GARAGE_MODELS.length]), bay = BAYS[i], { x, row } = bayPos(bay)
      const { el, parts } = makeLabel(car.id, b.name)
      const c: Parked = Object.assign(b, { id: car.id, bay, home: new V3(x, 0, row * (4.98 - b.len / 2)), rot: row < 0 ? Math.PI : 0, label: el, parts })
      c.g.traverse((o) => (o.userData.sid = car.id)); scene.add(c.g); park(c)
      return c
    })
  }

  /* ---------- camera ---------- */
  function aim(id: string) { const c = parked.find((p) => p.id === id); if (!c) return overview(); camGoal.copy(c.g.position); zoomGoal = 2.6 }
  function overview() { camGoal.set(0, 0, 0); zoomGoal = 1.15 }
  function resize() {
    const w = Math.max(1, host.clientWidth), h = Math.max(1, host.clientHeight), a = w / h
    size = { w, h }; renderer.setSize(w, h, false)
    half = Math.max(8.2, 13.5 / a)
    camera.left = -half * a; camera.right = half * a; camera.top = half; camera.bottom = -half; camera.updateProjectionMatrix()
  }
  const ro = new ResizeObserver(resize); ro.observe(host); resize()

  function select(id: string | null) {
    selected = id && parked.some((c) => c.id === id) ? id : null
    if (!drive) { if (selected) aim(selected); else overview() }
    parked.forEach((c) => { const off = c.id === selected || drive?.c === c
      c.label.style.opacity = off ? "0" : "1"; c.label.style.pointerEvents = off ? "none" : "auto" })
  }

  /* ---------- resume: headlights on, reverse out, turn, drive down the ramp ---------- */
  const T0 = 0.2, TR = 0.9, TP = 0.05
  function spin(d: Drive, sg: number) { const m = d.c.g.position.distanceTo(d.last); d.last.copy(d.c.g.position); d.c.wheels.forEach((w) => (w.rotation.x += (sg * m) / d.c.R)) }
  function stepDrive(dt: number) {
    const d = drive!, g = d.c.g; d.t += dt
    if (d.t < T0) return // a beat with the lights on
    const u = (d.t - T0) / TR
    if (u < 1) { // reverse out of the bay, swinging the tail so the nose ends up facing the ramp
      d.c.rvM.emissiveIntensity = 2.2
      const e = u * u * (3 - 2 * u), a = 1 - e
      g.position.set(0, 0, 0).addScaledVector(d.P0, a * a).addScaledVector(d.P1, 2 * a * e).addScaledVector(d.P2, e * e)
      const D = new V3().addScaledVector(d.P1.clone().sub(d.P0), a).addScaledVector(d.P2.clone().sub(d.P1), e)
      if (D.lengthSq() > 1e-8) g.rotation.set(0, Math.atan2(-D.x, -D.z), 0)
      spin(d, -1)
      return
    }
    d.c.rvM.emissiveIntensity = 0
    const tb = d.t - T0 - TR - TP; if (tb < 0) return
    const x = d.P2.x + tb * 3 + tb * tb * 9, onR = x > LW / 2, y = onR ? -(x - LW / 2) * SLOPE : 0
    g.position.set(x, y, 0); g.rotation.set(0, Math.PI / 2, 0); if (onR) g.rotateX(Math.atan(SLOPE))
    spin(d, 1)
    camGoal.set(Math.min(x, LW / 2) * 0.55, 0, 0)
    if (x > LW / 2 + 1.5) d.done()
    if (x > LW / 2 + 6.5) { g.visible = false; headlights(d.c, false); drive = null; if (selected) aim(selected); else overview() }
  }
  function playResume(id: string): Promise<void> {
    const c = parked.find((p) => p.id === id)
    if (RM || !c || drive) return Promise.resolve()
    return new Promise<void>((resolve) => {
      c.label.style.opacity = "0"; c.label.style.pointerEvents = "none"
      headlights(c, true)
      const h = c.home
      const d: Drive = { c, t: 0, P0: h.clone(), P1: new V3(h.x, 0, 0), P2: new V3(h.x - 1.25, 0, 0), last: h.clone(), resolved: false,
        done: () => { if (!d.resolved) { d.resolved = true; resolve() } } }
      drive = d
      camGoal.set(h.x * 0.5 + 2, 0, h.z * 0.3); zoomGoal = 1.3
    })
  }

  function setCars(cars: LotCar[], selectedId: string | null) {
    const same = cars.length === parked.length && cars.every((c, i) => parked[i].id === c.id)
    if (!same) buildCars(cars)
    else if (!drive) parked.forEach(park)
    cars.forEach((car, i) => parked[i] && fillLabel(parked[i], car))
    select(selectedId)
  }

  /* ---------- picking ---------- */
  const ray = new THREE.Raycaster(), ndc = new THREE.Vector2()
  const carGroups = () => parked.filter((c) => c.g.visible).map((c) => c.g)
  const hitAt = (e: PointerEvent) => {
    const r = canvas.getBoundingClientRect()
    ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1); ray.setFromCamera(ndc, camera)
    return ray.intersectObjects(carGroups(), true)[0]
  }
  let downAt: [number, number] | null = null
  const onDown = (e: PointerEvent) => { downAt = [e.clientX, e.clientY] }
  const onMove = (e: PointerEvent) => { canvas.style.cursor = !drive && hitAt(e) ? "pointer" : "default" }
  const onUp = (e: PointerEvent) => {
    if (!downAt || Math.hypot(e.clientX - downAt[0], e.clientY - downAt[1]) > 6 || drive) return
    downAt = null
    const hit = hitAt(e); const sid = hit?.object.userData.sid
    if (typeof sid === "string") onPick(sid)
  }
  canvas.addEventListener("pointerdown", onDown); canvas.addEventListener("pointermove", onMove); canvas.addEventListener("pointerup", onUp)

  /* ---------- loop ---------- */
  const tmp = new V3()
  function placeLabels() {
    parked.forEach((c) => {
      if (!c.g.visible) { c.label.style.visibility = "hidden"; return }
      c.label.style.visibility = "visible"
      tmp.copy(c.g.position); tmp.y += c.H + 0.15; tmp.project(camera)
      c.label.style.left = ((tmp.x + 1) / 2) * size.w + "px"; c.label.style.top = ((1 - tmp.y) / 2) * size.h + "px"
    })
  }
  camera.position.copy(ISO); camera.lookAt(0, 0, 0)
  let last = performance.now(), raf = 0
  function frame(now: number) {
    raf = requestAnimationFrame(frame)
    const dt = Math.min(0.05, (now - last) / 1000); last = now
    if (document.hidden) return
    const k = RM ? 1 : 1 - Math.exp(-dt * 3.2)
    camT.lerp(camGoal, k); zoom += (zoomGoal - zoom) * k
    camera.position.copy(camT).add(ISO); camera.lookAt(camT); camera.zoom = zoom; camera.updateProjectionMatrix()
    if (drive) stepDrive(dt)
    placeLabels()
    renderer.render(scene, camera)
  }
  raf = requestAnimationFrame(frame)

  function dispose() {
    cancelAnimationFrame(raf); ro.disconnect()
    clearCars()
    canvas.removeEventListener("pointerdown", onDown); canvas.removeEventListener("pointermove", onMove); canvas.removeEventListener("pointerup", onUp)
    const geos = new Set<THREE.BufferGeometry>(), mats = new Set<THREE.Material>(), texs = new Set<THREE.Texture>()
    scene.traverse((o) => {
      const m = o as THREE.Mesh
      if (m.geometry) geos.add(m.geometry)
      const ms = m.material ? (Array.isArray(m.material) ? m.material : [m.material]) : []
      ms.forEach((x) => { mats.add(x); const r = x as THREE.MeshStandardMaterial
        ;[r.map, r.emissiveMap, r.normalMap, r.roughnessMap].forEach((t) => t && texs.add(t)) })
    })
    geos.forEach((x) => x.dispose()); mats.forEach((x) => x.dispose()); texs.forEach((x) => x.dispose())
    bgTex.dispose(); envRT.dispose(); kit.dispose(); moon.shadow.map?.dispose()
    renderer.dispose()
    canvas.remove(); layer.remove()
  }

  return { setCars, select, playResume, dispose }
}
