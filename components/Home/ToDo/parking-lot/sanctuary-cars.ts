/**
 * components/Home/ToDo/parking-lot/sanctuary-cars.ts — concept cars for the Solarpunk sanctuary
 *
 * Ported from docs/mockups/solarpunk-sanctuary/solarpunk-cars.js (concept style
 * only; the retro cars live in the classic garage). Eight 1980s concept studies
 * in metres, facing +Z, sitting on y=0. A kit caches textures, materials and
 * geometries; `dispose()` frees them. Each car owns only its lamp materials.
 * Hex colors go through `lin()` so the r128 look survives color management.
 */
import * as THREE from "three"

export const lin = (h: number) => new THREE.Color().setHex(h, THREE.LinearSRGBColorSpace)

export function cvs(w: number, h: number, draw: (g: CanvasRenderingContext2D, w: number, h: number) => void) {
  const c = document.createElement("canvas")
  c.width = w
  c.height = h
  draw(c.getContext("2d")!, w, h)
  return c
}

export const CONCEPT_PALETTE = [0xf2f0ea, 0xb9bdc0, 0xd8c7a3, 0x9fae8f, 0xb7765c, 0x6f7a82, 0xe9e2d2, 0xc9b28c, 0x8d9a84]

type P2 = [number, number]
type Lamp = { t: "bar" | "split" | "pillars"; y: number; z: number; w: number; h: number; x?: number; tilt?: number }
type Pop = { t: "popup"; pz: number; px: number }
type ExCtx = { W: number; F: number; L: number; s: CSpec; topAt: (z: number) => number; P: THREE.Material }
type CSpec = {
  name: string; L: number; W: number; R: number; tw: number; yb: number; wb: P2; c: number; clad: number; clY: number; nose: number; nt: number; smooth?: 1
  body: P2[]; gh?: P2[]; ghw?: number; tk?: number; roof: "paint" | "glass" | "solar" | "open"; rf?: P2; bp?: number; seams: number[]; hood?: number[]
  belt?: number; zw?: number; hl: Lamp | Pop; fog?: { y: number; z: number; w: number; x: number }; tl: Lamp
  cover: "turbine" | "slots" | "disc"; cc: number; int: number; seats: 2 | 4; stripe?: [number, number, number, number]
  skirt?: 1; rack?: 1; flares?: 1; ex?: (b: THREE.Group, c: ExCtx) => void
}

const CP = { white: 0xf0efe9, silver: 0xc3c8cc, sand: 0xd6c39c, sage: 0x9aa98a, clay: 0xb57655, slate: 0x5f6b75, khaki: 0x8c8068, bone: 0xe6e0d0 }

export type ConceptCar = {
  g: THREE.Group
  hlM: THREE.MeshStandardMaterial
  tlM: THREE.MeshStandardMaterial
  exO: THREE.Object3D
  wheels: THREE.Group[]
  setPopups: (t: number) => void
  name: string
  len: number
  wid: number
  own: THREE.Material[]
}

export function createSanctuaryKit() {
  const TXC = new Map<string, THREE.Texture>(), MC = new Map<string, THREE.Material>(), GEO = new Map<string, THREE.BufferGeometry>()
  const geo = <T extends THREE.BufferGeometry>(k: string, f: () => T): T => (GEO.get(k) as T) ?? (GEO.set(k, f()), GEO.get(k) as T)
  const mat = <T extends THREE.Material>(k: string, f: () => T): T => (MC.get(k) as T) ?? (MC.set(k, f()), MC.get(k) as T)
  const std = (c: number, o: THREE.MeshStandardMaterialParameters = {}) => new THREE.MeshStandardMaterial({ color: lin(c), roughness: 0.5, metalness: 0, ...o })
  function ctex(key: string, w: number, h: number, draw: (g: CanvasRenderingContext2D, w: number, h: number) => void, o: { rep?: P2; data?: 1 } = {}) {
    const hit = TXC.get(key); if (hit) return hit
    const t = new THREE.CanvasTexture(cvs(w, h, draw))
    if (o.rep) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(o.rep[0], o.rep[1]) }
    if (!o.data) t.colorSpace = THREE.SRGBColorSpace
    t.anisotropy = 4; TXC.set(key, t); return t
  }
  function rr(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
    g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath()
  }
  const R_ = Math.random
  const flakeN = () => ctex("fn", 256, 256, (g) => { const d = g.createImageData(256, 256)
    for (let i = 0; i < 65536; i++) { const a = R_() * 6.283, m = R_() < 0.3 ? R_() * 80 : R_() * 16, j = i * 4; d.data[j] = 128 + Math.cos(a) * m; d.data[j + 1] = 128 + Math.sin(a) * m; d.data[j + 2] = 255; d.data[j + 3] = 255 }
    g.putImageData(d, 0, 0) }, { rep: [4, 4], data: 1 })
  const treadT = () => ctex("tr", 512, 64, (g, w, h) => { g.fillStyle = "#0f1013"; g.fillRect(0, 0, w, h); g.fillStyle = "#25272d"
    for (let i = 0; i < 32; i++) { const x = i * 16; g.beginPath(); g.moveTo(x, 4); g.lineTo(x + 10, 4); g.lineTo(x + 16, h / 2 - 3); g.lineTo(x + 6, h / 2 - 3); g.fill()
      g.beginPath(); g.moveTo(x + 6, h / 2 + 3); g.lineTo(x + 16, h / 2 + 3); g.lineTo(x + 10, h - 4); g.lineTo(x, h - 4); g.fill() } })
  const wallT = () => ctex("wl", 256, 256, (g) => { g.fillStyle = "#131418"; g.fillRect(0, 0, 256, 256); g.translate(128, 128)
    g.strokeStyle = "#2b2d34"; g.lineWidth = 3; [88, 122].forEach((r) => { g.beginPath(); g.arc(0, 0, r, 0, 7); g.stroke() })
    g.fillStyle = "#7d828f"; g.font = "700 15px DM Sans, sans-serif"; g.textAlign = "center"; g.textBaseline = "middle"
    const t = "SUNGRIP ★ 205/60 R15 ★ ALL-DAY ★ ", n = t.length
    for (let i = 0; i < n; i++) { g.save(); g.rotate((i / n) * 6.2832); g.translate(0, -105); g.fillText(t[i], 0, 0); g.restore() } })
  const coverT = (t: string) => ctex("cv" + t, 256, 256, (g) => { g.translate(128, 128)
    const gr = g.createRadialGradient(-30, -40, 10, 0, 0, 128); gr.addColorStop(0, "#ffffff"); gr.addColorStop(0.7, "#dfe1e2"); gr.addColorStop(1, "#a9adb1")
    g.fillStyle = gr; g.beginPath(); g.arc(0, 0, 128, 0, 7); g.fill()
    g.strokeStyle = "rgba(0,0,0,.35)"; g.lineWidth = 4; g.beginPath(); g.arc(0, 0, 120, 0, 7); g.stroke()
    g.fillStyle = "#1a1c20"; g.strokeStyle = "#1a1c20"
    if (t === "turbine") for (let i = 0; i < 16; i++) { g.save(); g.rotate((i * Math.PI) / 8); g.beginPath(); g.moveTo(0, -42); g.quadraticCurveTo(34, -70, 22, -108)
      g.lineTo(10, -108); g.quadraticCurveTo(20, -72, -6, -44); g.closePath(); g.fill(); g.restore() }
    else if (t === "slots") for (let i = 0; i < 8; i++) { g.save(); g.rotate((i * Math.PI) / 4); rr(g, -9, -104, 18, 44, 8); g.fill(); g.restore() }
    else { g.lineWidth = 3; g.beginPath(); g.arc(0, 0, 86, 0, 7); g.stroke()
      for (let i = 0; i < 3; i++) { g.save(); g.rotate(i * 2.094 + 0.4); g.beginPath(); g.ellipse(0, -100, 22, 6, 0, 0, 7); g.fill(); g.restore() } }
    const hub = g.createRadialGradient(-6, -6, 2, 0, 0, 30); hub.addColorStop(0, "#f4f5f6"); hub.addColorStop(1, "#7d8288")
    g.fillStyle = hub; g.beginPath(); g.arc(0, 0, 30, 0, 7); g.fill(); g.strokeStyle = "rgba(0,0,0,.4)"; g.lineWidth = 2; g.stroke() })
  const barT = (red: boolean) => ctex("lb" + red, 256, 32, (g, w, h) => { g.fillStyle = red ? "#3a0508" : "#14171b"; g.fillRect(0, 0, w, h)
    for (let x = 4; x < w; x += red ? 6 : 16) { const gr = g.createLinearGradient(0, 4, 0, h - 4)
      if (red) { gr.addColorStop(0, "#ff6a72"); gr.addColorStop(0.5, "#d3182a"); gr.addColorStop(1, "#6a0812"); g.fillStyle = gr; g.fillRect(x, 3, 4, h - 6) }
      else { gr.addColorStop(0, "#ffffff"); gr.addColorStop(1, "#bcd0e4"); g.fillStyle = gr; rr(g, x, 7, 12, h - 14, 3); g.fill() } }
    g.fillStyle = "rgba(255,255,255,.3)"; g.fillRect(0, 2, w, 2) })
  const solarT = () => ctex("so", 256, 256, (g) => { g.fillStyle = "#c9ccd0"; g.fillRect(0, 0, 256, 256)
    for (let y = 0; y < 4; y++) for (let x = 0; x < 4; x++) { const gr = g.createLinearGradient(x * 64, y * 64, x * 64 + 64, y * 64 + 64)
      gr.addColorStop(0, "#1d2d4a"); gr.addColorStop(1, "#0e1a2e"); g.fillStyle = gr; g.fillRect(x * 64 + 2, y * 64 + 2, 60, 60)
      g.fillStyle = "rgba(190,205,225,.35)"; [20, 42].forEach((q) => g.fillRect(x * 64 + q, y * 64 + 2, 1, 60)) } }, { rep: [2, 1] })
  const ventT = () => ctex("vt", 128, 32, (g, w, h) => { g.fillStyle = "#08090b"; g.fillRect(0, 0, w, h); g.fillStyle = "#3b4047"; for (let y = 3; y < h; y += 6) g.fillRect(0, y, w, 2) })
  const stripeT = () => ctex("st", 512, 32, (g, w) => { ["#b5603f", "#d6a35a", "#8fa07c"].forEach((c, i) => { g.fillStyle = c; g.fillRect(0, 2 + i * 10, w, i === 0 ? 8 : 5) }) })
  const dashT = () => ctex("da", 128, 32, (g, w, h) => { g.fillStyle = "#050807"; g.fillRect(0, 0, w, h); g.fillStyle = "#7dffc4"
    g.font = "700 16px monospace"; g.fillText("88", 8, 22); for (let i = 0; i < 14; i++) g.fillRect(44 + i * 5, 24 - i, 3, i + 2); g.fillText("42", 104, 22) })

  const seam = std(0x040509, { roughness: 0.8 })
  const CM = {
    gloss: std(0x0b0c0e, { roughness: 0.14, metalness: 0.3 }), satin: std(0xb9bec4, { metalness: 0.9, roughness: 0.25 }), dash: std(0x1d1f22, { roughness: 0.7 }),
    glass: new THREE.MeshPhysicalMaterial({ color: lin(0x26332f), metalness: 0.1, roughness: 0.03, clearcoat: 1, clearcoatRoughness: 0.02, transparent: true, opacity: 0.38, envMapIntensity: 1.6, depthWrite: false }),
  }
  const TM = {
    tread: () => mat("tread", () => std(0xffffff, { map: treadT(), roughness: 0.92 })),
    wall: () => mat("wall", () => std(0xffffff, { map: wallT(), roughness: 0.85 })),
    cover: (t: string, c: number) => mat("cvm" + t + c, () => std(c, { map: coverT(t), metalness: 0.55, roughness: 0.22 })),
    vent: () => mat("vent", () => std(0xffffff, { map: ventT(), roughness: 0.6 })),
    solar: () => mat("solar", () => new THREE.MeshPhysicalMaterial({ map: solarT(), roughness: 0.15, metalness: 0.3, clearcoat: 1, clearcoatRoughness: 0.03 })),
    stripe: () => mat("stripe", () => std(0xffffff, { map: stripeT(), roughness: 0.3, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 })),
    dash: () => mat("dash", () => new THREE.MeshBasicMaterial({ map: dashT() })),
  }
  const paintC = (c: number) => mat("cp" + c, () => { const hsl = { h: 0, s: 0, l: 0 }; new THREE.Color(c).getHSL(hsl)
    return new THREE.MeshPhysicalMaterial({ color: lin(c), metalness: hsl.s < 0.08 ? 0.6 : 0.25, roughness: 0.3, clearcoat: 1, clearcoatRoughness: 0.04,
      normalMap: flakeN(), normalScale: new THREE.Vector2(0.1, 0.1), envMapIntensity: 1.25 }) })
  const cladM = (c: number) => mat("cl" + c, () => new THREE.MeshPhysicalMaterial({ color: lin(c), roughness: 0.5, metalness: 0.1, clearcoat: 0.4, clearcoatRoughness: 0.3 }))
  const intM = (c: number) => mat("ci" + c, () => std(c, { roughness: 0.85 }))
  const PLANE = geo("plane", () => new THREE.PlaneGeometry(1, 1))

  function B(g: THREE.Object3D, w: number, h: number, d: number, m: THREE.Material, x: number, y: number, z: number) {
    const o = new THREE.Mesh(geo(`b${w},${h},${d}`, () => new THREE.BoxGeometry(w, h, d)), m); o.position.set(x, y, z); g.add(o); return o
  }
  function C(g: THREE.Object3D, r: number, len: number, m: THREE.Material, x: number, y: number, z: number, axis: "x" | "z" | null, seg = 20) {
    const gm = geo(`c${r},${len},${axis},${seg}`, () => { const q = new THREE.CylinderGeometry(r, r, len, seg); if (axis === "x") q.rotateZ(Math.PI / 2); if (axis === "z") q.rotateX(Math.PI / 2); return q })
    const o = new THREE.Mesh(gm, m); o.position.set(x, y, z); g.add(o); return o
  }
  function poly(p: P2[]) { const s = new THREE.Shape(); s.moveTo(p[0][0], p[0][1]); p.slice(1).forEach((q) => s.lineTo(q[0], q[1])); s.closePath(); return s }
  function extG(shape: THREE.Shape, W: number, bev: number, seg = 3) {
    const g = new THREE.ExtrudeGeometry(shape, { depth: W - 2 * bev, bevelEnabled: true, bevelThickness: bev, bevelSize: bev, bevelSegments: seg, curveSegments: 24 })
    g.rotateY(-Math.PI / 2); g.translate(W / 2 - bev, 0, 0); return g
  }
  function bandShapes(s: CSpec, F: number, a: number, clY: number) {
    const [zr, zf] = s.wb, R = s.R, y0 = s.yb - 0.03, t1 = Math.asin(Math.max(-1, Math.min(1, (clY - R) / a))), dz = a * Math.cos(t1), out: THREE.Shape[] = []
    let q = new THREE.Shape(); q.moveTo(zf + a, y0); q.lineTo(F + 0.02, y0); q.lineTo(F + 0.02, clY); q.lineTo(zf + dz, clY); q.absarc(zf, R, a, t1, 0, true); q.closePath(); out.push(q)
    q = new THREE.Shape(); q.moveTo(zr + a, y0); q.lineTo(zf - a, y0); q.lineTo(zf - a, R); q.absarc(zf, R, a, Math.PI, Math.PI - t1, true); q.lineTo(zr + dz, clY); q.absarc(zr, R, a, t1, 0, true); q.closePath(); out.push(q)
    q = new THREE.Shape(); q.moveTo(-F - 0.02, y0); q.lineTo(zr - a, y0); q.lineTo(zr - a, R); q.absarc(zr, R, a, Math.PI, Math.PI - t1, true); q.lineTo(-F - 0.02, clY); q.closePath(); out.push(q)
    return out
  }
  function lampBox(b: THREE.Object3D, w: number, h: number, m: THREE.Material, x: number, y: number, z: number, tilt = 0, back = false) {
    const q = new THREE.Group(); q.position.set(x, y, z); q.rotation.set(tilt, back ? Math.PI : 0, 0); b.add(q)
    B(q, w + 0.03, h + 0.03, 0.025, CM.gloss, 0, 0, 0); B(q, w, h, 0.02, m, 0, 0, 0.008); return q
  }
  function cwheel(g: THREE.Object3D, R: number, tw: number, x: number, z: number, cover: string, cc: number) {
    const w = new THREE.Group(); w.position.set(x, R, z); g.add(w)
    w.add(new THREE.Mesh(geo(`t${R},${tw}`, () => new THREE.CylinderGeometry(R, R, tw, 32).rotateZ(Math.PI / 2)), [TM.tread(), TM.wall(), TM.wall()]))
    C(w, R * 0.76, tw + 0.006, CM.gloss, 0, 0, 0, "x", 28)
    const cm = TM.cover(cover, cc)
    w.add(new THREE.Mesh(geo(`cv${R},${tw}`, () => new THREE.CylinderGeometry(R * 0.72, R * 0.72, tw + 0.014, 32).rotateZ(Math.PI / 2)), [CM.satin, cm, cm]))
    return w
  }

  const CSPEC: Record<string, CSpec> = {
    wedge: { name: "Arrow Zero", L: 4.2, W: 1.9, R: 0.33, tw: 0.27, yb: 0.2, wb: [-1.3, 1.25], c: CP.white, clad: 0x4b545c, clY: 0.36, nose: 0.16, nt: 1.0,
      body: [[-2.1, 0.22], [-2.12, 0.78], [-1.2, 0.86], [0.2, 0.82], [2.05, 0.48], [2.12, 0.4], [2.1, 0.22]],
      gh: [[-1.3, 0.84], [-0.9, 1.12], [-0.2, 1.14], [0.5, 0.77]], ghw: 0.8, tk: 0.22, roof: "paint", rf: [-0.9, -0.2], bp: -0.55, seams: [0.42, -0.95], hood: [0.62],
      hl: { t: "popup", pz: 1.42, px: 0.58 }, fog: { y: 0.29, z: 2.17, w: 0.42, x: 0.55 }, tl: { t: "bar", y: 0.64, z: -2.175, w: 1.62, h: 0.09, tilt: 0.04 },
      cover: "turbine", cc: 0xe9e9e4, int: 0x3b3f44, seats: 2, stripe: [0.5, -0.95, 0.9, 0.05],
      ex(b, c) { for (let i = 0; i < 7; i++) { const z = -1.95 + i * 0.09; B(b, 1.18, 0.018, 0.06, CM.gloss, 0, c.topAt(z) + 0.02, z).rotation.x = 0.35 }
        ;[-1, 1].forEach((sd) => B(b, 0.012, 0.08, 0.36, CM.gloss, sd * (c.W / 2 + 0.004), 0.66, -0.75)); B(b, 1.2, 0.05, 0.012, TM.vent(), 0, 0.43, 2.17) } },
    aero: { name: "Probe Eolienne", L: 4.3, W: 1.86, R: 0.32, tw: 0.25, yb: 0.2, wb: [-1.35, 1.3], c: CP.silver, clad: 0x8b9095, clY: 0.3, nose: 0.18, nt: 0.9, smooth: 1,
      body: [[-2.12, 0.26], [-2.17, 0.6], [-1.95, 0.8], [-1.1, 0.88], [0.2, 0.83], [1.3, 0.64], [2.02, 0.46], [2.15, 0.36], [2.14, 0.26]],
      gh: [[-1.92, 0.78], [-1.45, 1.04], [-0.7, 1.19], [-0.05, 1.2], [0.62, 0.74]], ghw: 0.84, tk: 0.2, roof: "glass", bp: -0.6, seams: [0.5, -0.85], hood: [],
      hl: { t: "bar", y: 0.43, z: 2.13, w: 1.3, h: 0.05, tilt: -0.6 }, tl: { t: "bar", y: 0.69, z: -2.14, w: 1.5, h: 0.06, tilt: 0.5 },
      cover: "disc", cc: 0xf2f2ee, int: 0x6f7378, seats: 2, skirt: 1 },
    space: { name: "Megaspazio", L: 4.25, W: 1.88, R: 0.32, tw: 0.24, yb: 0.22, wb: [-1.25, 1.35], c: CP.sand, clad: 0x6d6250, clY: 0.4, nose: 0.1, nt: 1.2,
      body: [[-2.1, 0.26], [-2.12, 0.96], [-1.95, 1.01], [0.6, 1.0], [1.95, 0.74], [2.13, 0.62], [2.12, 0.26]],
      gh: [[-2.06, 0.99], [-2.0, 1.62], [-0.2, 1.68], [0.4, 1.63], [1.7, 0.8]], ghw: 0.88, tk: 0.1, roof: "solar", rf: [-1.85, 0.15], bp: -0.3, seams: [0.55, -0.45], hood: [],
      hl: { t: "bar", y: 0.56, z: 2.19, w: 1.5, h: 0.08, tilt: -0.2 }, tl: { t: "pillars", y: 0.72, z: -2.175, w: 0.1, h: 0.42, x: 0.8 },
      cover: "slots", cc: 0xe6e2d8, int: 0xc8b48c, seats: 4, rack: 1 },
    sedan: { name: "Aerodyne 100", L: 4.4, W: 1.86, R: 0.32, tw: 0.24, yb: 0.22, wb: [-1.35, 1.35], c: CP.sage, clad: 0x56614d, clY: 0.38, nose: 0.1, nt: 1.3,
      body: [[-2.18, 0.28], [-2.2, 0.82], [-2.02, 0.88], [-1.1, 0.9], [0.5, 0.88], [2.05, 0.66], [2.2, 0.54], [2.18, 0.28]],
      gh: [[-1.75, 0.9], [-1.15, 1.34], [0.05, 1.37], [0.75, 0.86]], ghw: 0.86, tk: 0.16, roof: "paint", rf: [-1.1, 0.05], bp: -0.5, seams: [0.72, -0.45, -1.4], hood: [0.85],
      hl: { t: "split", y: 0.47, z: 2.25, w: 0.55, h: 0.09, x: 0.52, tilt: -0.15 }, tl: { t: "bar", y: 0.75, z: -2.255, w: 1.7, h: 0.1, tilt: 0.08 },
      cover: "turbine", cc: 0xdcdcd4, int: 0x8a6a4a, seats: 4, stripe: [0.56, -1.0, 0.95, 0.04] },
    kamm: { name: "Kamm GT", L: 3.84, W: 1.8, R: 0.31, tw: 0.23, yb: 0.2, wb: [-1.18, 1.2], c: CP.clay, clad: 0x3a3330, clY: 0.36, nose: 0.12, nt: 1.0,
      body: [[-1.9, 0.26], [-1.93, 0.88], [-1.86, 0.92], [0.4, 0.9], [1.8, 0.64], [1.94, 0.52], [1.92, 0.26]],
      gh: [[-1.85, 0.9], [-1.72, 1.34], [-0.2, 1.42], [0.55, 0.86]], ghw: 0.86, tk: 0.18, roof: "paint", rf: [-1.68, -0.15], bp: -0.62, seams: [0.52, -0.62], hood: [0.7],
      hl: { t: "split", y: 0.46, z: 1.99, w: 0.48, h: 0.1, x: 0.5, tilt: -0.2 }, tl: { t: "bar", y: 0.74, z: -1.985, w: 1.5, h: 0.1, tilt: 0.03 },
      cover: "slots", cc: 0xe9e9e4, int: 0x2b2b2e, seats: 4, stripe: [0.5, -0.75, 0.75, 0.05],
      ex(b, c) { const ws = c.W * (c.s.ghw ?? 1) * (1 - (c.s.tk ?? 0)); B(b, ws + 0.08, 0.03, 0.3, CM.gloss, 0, 1.39, -1.68).rotation.x = -0.12 } },
    pyramid: { name: "Karin Prisma", L: 3.9, W: 1.9, R: 0.32, tw: 0.25, yb: 0.22, wb: [-1.2, 1.25], c: CP.slate, clad: 0x2f3438, clY: 0.36, nose: 0.12, nt: 1.0,
      body: [[-1.95, 0.26], [-1.97, 0.8], [-1.86, 0.86], [0.2, 0.86], [1.85, 0.64], [1.97, 0.52], [1.95, 0.26]],
      gh: [[-1.75, 0.86], [-0.6, 1.38], [-0.25, 1.4], [0.95, 0.8]], ghw: 0.88, tk: 0.5, roof: "paint", rf: [-0.62, -0.22], seams: [0.9, -0.5], hood: [1.0],
      hl: { t: "bar", y: 0.48, z: 2.025, w: 1.6, h: 0.07, tilt: -0.2 }, tl: { t: "bar", y: 0.7, z: -2.025, w: 1.6, h: 0.08, tilt: 0.05 },
      cover: "disc", cc: 0xd9dadc, int: 0xb9a37a, seats: 2 },
    targa: { name: "Spyder Sole", L: 4.0, W: 1.84, R: 0.32, tw: 0.26, yb: 0.2, wb: [-1.22, 1.25], c: CP.bone, clad: 0xa4553a, clY: 0.34, nose: 0.15, nt: 0.9,
      body: [[-2.0, 0.26], [-2.02, 0.8], [-1.25, 0.84], [-0.3, 0.8], [1.95, 0.52], [2.02, 0.42], [2.0, 0.26]],
      roof: "open", belt: 0.82, zw: 0.3, seams: [0.25, -0.9], hood: [0.45],
      hl: { t: "popup", pz: 1.3, px: 0.6 }, fog: { y: 0.28, z: 2.07, w: 0.4, x: 0.55 }, tl: { t: "bar", y: 0.66, z: -2.075, w: 1.5, h: 0.08, tilt: 0.05 },
      cover: "turbine", cc: 0xece8dc, int: 0xa4553a, seats: 2 },
    rover: { name: "Terra Wedge", L: 4.24, W: 1.92, R: 0.38, tw: 0.3, yb: 0.44, wb: [-1.25, 1.3], c: CP.khaki, clad: 0x34322e, clY: 0.72, nose: 0.05, nt: 1.4,
      body: [[-2.1, 0.48], [-2.12, 1.08], [0.5, 1.1], [1.95, 0.92], [2.12, 0.84], [2.12, 0.48]],
      gh: [[-2.08, 1.08], [-2.0, 1.66], [-0.1, 1.7], [0.62, 1.06]], ghw: 0.88, tk: 0.1, roof: "solar", rf: [-1.9, -0.25], bp: -0.55, seams: [0.55, -0.55], hood: [0.75],
      hl: { t: "split", y: 0.79, z: 2.18, w: 0.5, h: 0.08, x: 0.55, tilt: 0 }, tl: { t: "pillars", y: 0.9, z: -2.175, w: 0.1, h: 0.3, x: 0.82 },
      cover: "slots", cc: 0x8d9196, int: 0x5a5146, seats: 4, rack: 1, flares: 1 },
  }

  function build(kind: ConceptKind, color?: number): ConceptCar {
    const s = CSPEC[kind], g = new THREE.Group(), b = new THREE.Group(); g.add(b)
    const { L, W, R, tw, yb } = s, F = L / 2, [zr, zf] = s.wb, a = R + 0.06, BV = 0.05, P = paintC(color ?? s.c)
    const p = s.body, top = p.slice(1, -1)
    const topAt = (z: number) => { for (let i = 0; i < top.length - 1; i++) { const [z0, y0] = top[i], [z1, y1] = top[i + 1]; if ((z - z0) * (z - z1) <= 0) return y0 + ((y1 - y0) * (z - z0)) / (z1 - z0 || 1) + BV }
      return Math.max(...top.map((q) => q[1])) + BV }
    const tap = (z: number) => z > s.nt ? 1 - s.nose * Math.pow(Math.min(1, (z - s.nt) / (F - s.nt)), 2) : z < -F + 0.5 ? 1 - 0.05 * Math.pow(Math.min(1, (-F + 0.5 - z) / 0.5), 2) : 1
    const taper = (gm: THREE.BufferGeometry, y0 = 0, y1 = 1, tk = 0) => { const pa = gm.attributes.position
      for (let i = 0; i < pa.count; i++) { let k = tap(pa.getZ(i)); if (tk) k *= 1 - tk * Math.max(0, Math.min(1, (pa.getY(i) - y0) / (y1 - y0))); pa.setX(i, pa.getX(i) * k) }
      return gm }
    const halfAt = (z: number) => (W / 2) * tap(z)
    const hlM = std(0xffffff, { map: barT(false), emissive: lin(0xeef6ff), emissiveMap: barT(false), emissiveIntensity: 0.15, roughness: 0.1, metalness: 0.2 })
    const tlM = std(0xffffff, { map: barT(true), emissive: lin(0xff2a3c), emissiveMap: barT(true), emissiveIntensity: 0.3, roughness: 0.15 })
    // body: wedge side profile with wheel arches
    b.add(new THREE.Mesh(geo("cb" + kind, () => { const sh = new THREE.Shape(); sh.moveTo(p[0][0], p[0][1])
      if (s.smooth) sh.splineThru(top.map((q) => new THREE.Vector2(q[0], q[1]))); else top.forEach((q) => sh.lineTo(q[0], q[1]))
      const e = p[p.length - 1]; sh.lineTo(e[0], e[1]); sh.lineTo(zf + a, yb); sh.absarc(zf, R, a, 0, Math.PI, false); sh.lineTo(zr + a, yb); sh.absarc(zr, R, a, 0, Math.PI, false)
      sh.lineTo(zr - a, yb); sh.closePath(); return taper(extG(sh, W, BV, 4)) }), P))
    // two-tone lower cladding
    const CL = cladM(s.clad)
    bandShapes(s, F, a, s.clY).forEach((q, i) => b.add(new THREE.Mesh(geo("cc" + kind + i, () => taper(extG(q, W + 0.03, 0.035))), CL)))
    let belt: number, zw: number
    if (s.gh) { const gw = W * (s.ghw ?? 1), tk = s.tk ?? 0, ys = s.gh.map((q) => q[1]), yl = Math.min(...ys), yt = Math.max(...ys); belt = yl; zw = s.gh[s.gh.length - 1][0]
      const ghp = s.gh
      b.add(new THREE.Mesh(geo("cg" + kind, () => taper(extG(poly(ghp), gw, 0.03), yl, yt, tk)), CM.glass))
      const rw = gw * (1 - tk) + 0.03, ry = yt + 0.045
      if (s.roof !== "glass" && s.rf) { const [z0, z1] = s.rf; B(b, rw, 0.03, z1 - z0, P, 0, ry, (z0 + z1) / 2)
        if (s.roof === "solar") B(b, rw - 0.12, 0.012, z1 - z0 - 0.12, TM.solar(), 0, ry + 0.02, (z0 + z1) / 2) }
      else B(b, rw * 0.3, 0.012, 1.2, CM.gloss, 0, ry - 0.01, -0.7)
      if (s.bp != null) { const bp = s.bp; [-1, 1].forEach((sd) => { const h = yt - yl, o = B(b, 0.02, h, 0.12, CM.gloss, sd * ((gw / 2) * (1 - tk / 2) + 0.032), (yl + yt) / 2 + 0.02, bp); o.rotation.z = sd * Math.atan((tk * gw) / 2 / h) }) }
      if (s.rack && s.rf) { const rf = s.rf; [-1, 1].forEach((sd) => B(b, 0.04, 0.05, rf[1] - rf[0] + 0.3, CM.satin, sd * (rw / 2 - 0.04), ry + 0.07, (rf[0] + rf[1]) / 2))
        ;[rf[0] + 0.05, rf[1] - 0.05].forEach((z) => B(b, rw - 0.06, 0.025, 0.05, CM.satin, 0, ry + 0.1, z)) }
      B(b, W * 0.42, 0.015, 0.03, CM.gloss, -0.1, topAt(zw + 0.12) + 0.01, zw + 0.12).rotation.y = 0.12
    } else { belt = s.belt ?? 0.8; zw = s.zw ?? 0.3; const ws = new THREE.Group(); ws.position.set(0, belt, zw); ws.rotation.x = -0.95; b.add(ws)
      B(ws, W * 0.8, 0.42, 0.02, CM.glass, 0, 0.21, 0); B(ws, W * 0.82, 0.03, 0.035, CM.gloss, 0, 0.43, 0); [-1, 1].forEach((sd) => B(ws, 0.035, 0.44, 0.035, CM.gloss, sd * W * 0.41, 0.22, 0))
      const hoop = new THREE.Mesh(geo("hoop", () => new THREE.TorusGeometry(0.66, 0.045, 8, 24, Math.PI)), P); hoop.position.set(0, belt - 0.05, -0.85); hoop.scale.y = 0.62; b.add(hoop)
      B(b, W * 0.78, 0.008, 1.3, intM(0x2a2522), 0, belt - 0.005, -0.35) }
    // interior
    const IM = intM(s.int), sx = W * 0.22, zs = zw - 1.0
    const rows = s.seats === 4 && s.gh && zs - 0.8 > s.gh[0][0] + 0.1 ? [zs, zs - 0.8] : [zs]
    rows.forEach((z) => [-1, 1].forEach((sd) => { const x = sd * sx
      B(b, 0.44, 0.1, 0.44, IM, x, belt - 0.02, z); B(b, 0.44, 0.5, 0.1, IM, x, belt + 0.2, z - 0.25).rotation.x = -0.22; B(b, 0.26, 0.14, 0.08, IM, x, belt + 0.52, z - 0.31).rotation.x = -0.22 }))
    B(b, 0.16, 0.1, 0.8, CM.dash, 0, belt + 0.01, zs + 0.15)
    B(b, W * 0.76, 0.12, 0.28, CM.dash, 0, belt + 0.06, zw - 0.32)
    const gp = new THREE.Mesh(PLANE, TM.dash()); gp.scale.set(0.34, 0.085, 1); gp.position.set(sx, belt + 0.15, zw - 0.47); gp.rotation.set(-0.3, Math.PI, 0); b.add(gp)
    const sw = new THREE.Mesh(geo("csw", () => new THREE.TorusGeometry(0.15, 0.016, 8, 24)), CM.dash); sw.position.set(sx, belt + 0.2, zw - 0.62); sw.rotation.x = -0.45; b.add(sw)
    B(sw, 0.016, 0.15, 0.016, CM.dash, 0, -0.075, 0)
    // seams, handles, hood shut line, fuel flap
    const inArch = (z: number) => Math.abs(z - zf) < a || Math.abs(z - zr) < a
    ;[-1, 1].forEach((sd) => { s.seams.forEach((z, i) => { const y0 = inArch(z) ? R + a + 0.03 : s.clY + 0.02, y1 = belt - 0.03, x = sd * (halfAt(z) + 0.002)
        if (y1 > y0) B(b, 0.008, y1 - y0, 0.01, seam, x, (y0 + y1) / 2, z); if (i === 1) B(b, 0.012, 0.025, 0.14, CM.gloss, sd * (halfAt(z) + 0.004), belt - 0.1, z + 0.12) })
      if (sd < 0) C(b, 0.06, 0.008, seam, -halfAt(zr) - 0.002, belt - 0.12, zr, "x", 16) })
    ;(s.hood ?? []).forEach((z) => B(b, 2 * halfAt(z) * 0.92, 0.006, 0.012, seam, 0, topAt(z) + 0.001, z))
    // mirrors
    ;[-1, 1].forEach((sd) => { const x = sd * (halfAt(zw) + 0.07), my = belt + 0.1
      B(b, 0.1, 0.025, 0.04, CM.gloss, sd * (halfAt(zw) + 0.02), my - 0.02, zw - 0.15)
      const h = new THREE.Mesh(geo("cmir", () => new THREE.SphereGeometry(0.07, 14, 8)), P); h.scale.set(1.3, 0.6, 0.7); h.position.set(x, my, zw - 0.16); b.add(h) })
    // lamps
    const popups: { obj: THREE.Group; closed: number; open: number }[] = [], hl = s.hl, tl = s.tl
    if (hl.t === "popup") { const slope = Math.atan2(topAt(hl.pz - 0.05) - topAt(hl.pz + 0.05), 0.1)
      ;[-1, 1].forEach((sd) => { const pod = new THREE.Group(), d = 0.3; pod.position.set(sd * hl.px, topAt(hl.pz) - 0.004, hl.pz); pod.rotation.x = slope; b.add(pod)
        B(pod, 0.46, 0.002, d + 0.02, CM.gloss, 0, 0.006, d / 2); B(pod, 0.44, 0.1, d, P, 0, -0.042, d / 2); B(pod, 0.38, 0.055, 0.012, hlM, 0, -0.04, d + 0.004)
        popups.push({ obj: pod, closed: slope, open: slope - 0.8 }) })
      const f = s.fog; if (f) [-1, 1].forEach((sd) => lampBox(b, f.w, 0.05, hlM, sd * f.x, f.y, f.z, 0)) }
    else if (hl.t === "split") { const hx = hl.x ?? 0.5; [-1, 1].forEach((sd) => lampBox(b, hl.w, hl.h, hlM, sd * hx, hl.y, hl.z, hl.tilt)); B(b, 2 * hx - hl.w - 0.06, hl.h * 0.7, 0.02, TM.vent(), 0, hl.y, hl.z - 0.005).rotation.x = hl.tilt ?? 0 }
    else lampBox(b, hl.w, hl.h, hlM, 0, hl.y, hl.z, hl.tilt)
    if (tl.t === "pillars") { const tx = tl.x ?? 0.8; [-1, 1].forEach((sd) => lampBox(b, tl.w, tl.h, tlM, sd * tx, tl.y, tl.z, 0, true)) }
    else lampBox(b, tl.w, tl.h, tlM, 0, tl.y, tl.z, tl.tilt, true)
    // wheels with aero covers; rear skirts; flares
    const wheels: THREE.Group[] = [], wx = W / 2 - tw / 2 - 0.01
    ;[zr, zf].forEach((z) => [-1, 1].forEach((sd) => wheels.push(cwheel(b, R, tw, sd * wx * tap(z), z, s.cover, s.cc))))
    if (s.skirt) [-1, 1].forEach((sd) => { const m = new THREE.Mesh(geo("skirt" + kind, () => { const q = new THREE.Shape(); q.moveTo(zr - a, yb); q.lineTo(zr + a, yb); q.lineTo(zr + a, R)
        q.absarc(zr, R, a, 0, Math.PI, false); q.closePath(); return extG(q, 0.04, 0.012) }), P); m.position.x = sd * (W / 2 - 0.012); b.add(m) })
    if (s.flares) [zr, zf].forEach((z) => [-1, 1].forEach((sd) => { const f = new THREE.Mesh(geo("flare", () => new THREE.TorusGeometry(a + 0.02, 0.05, 6, 18, Math.PI)), CL)
      f.rotation.y = Math.PI / 2; f.scale.z = 1.6; f.position.set(sd * (W / 2 + 0.01), R, z); b.add(f) }))
    for (let i = -2; i <= 2; i++) B(b, 0.012, 0.08, 0.22, CM.gloss, i * 0.22, yb + 0.02, -F - 0.02)
    const exO = new THREE.Object3D(); exO.position.set(-W * 0.28, yb + 0.08, -F - 0.15); b.add(exO)
    if (s.stripe) { const [y, z0, z1, h] = s.stripe; [-1, 1].forEach((sd) => { const d = new THREE.Mesh(PLANE, TM.stripe()); d.scale.set(z1 - z0, h, 1)
      d.position.set(sd * (W / 2 + 0.004), y, (z0 + z1) / 2); d.rotation.y = (sd * Math.PI) / 2; b.add(d) }) }
    s.ex?.(b, { W, F, L, s, topAt, P })
    b.traverse((o) => { const m = o as THREE.Mesh; if (m.isMesh && m.material !== CM.glass) { m.castShadow = true; m.receiveShadow = true } })
    const setPopups = (t: number) => popups.forEach((q) => (q.obj.rotation.x = q.closed + (q.open - q.closed) * t))
    return { g, hlM, tlM, exO, wheels, setPopups, name: s.name, len: L + 0.1, wid: W, own: [hlM, tlM] }
  }

  function dispose() {
    GEO.forEach((x) => x.dispose()); MC.forEach((x) => x.dispose()); TXC.forEach((x) => x.dispose())
    seam.dispose(); Object.values(CM).forEach((x) => x.dispose())
    GEO.clear(); MC.clear(); TXC.clear()
  }

  return { build, dispose }
}

export const CONCEPT_KINDS = ["wedge", "aero", "space", "sedan", "kamm", "pyramid", "targa", "rover"] as const
export type ConceptKind = (typeof CONCEPT_KINDS)[number]
