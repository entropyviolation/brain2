/**
 * components/Home/ToDo/parking-lot/garage-cars.ts — the nine toy cars of the Night garage
 *
 * Ported from parking-lot-mockups/3-night-garage.html. A kit holds the shared
 * procedural textures, materials and geometries; `dispose()` frees them all.
 * Each built car lists what it owns (`own`) so a rebuild can free just that.
 * Hex colors go through `lin()` so the r128 look survives color management.
 */
import * as THREE from "three"

export const GARAGE_MODELS = ["xj", "volvo", "bronco", "sl", "panda", "r5", "olds", "van", "samurai"] as const
export type GarageModel = (typeof GARAGE_MODELS)[number]

export const lin = (h: number) => new THREE.Color().setHex(h, THREE.LinearSRGBColorSpace)

export function cvs(w: number, h: number, draw: (g: CanvasRenderingContext2D, w: number, h: number) => void) {
  const c = document.createElement("canvas")
  c.width = w
  c.height = h
  draw(c.getContext("2d")!, w, h)
  return c
}

export type BuiltCar = {
  g: THREE.Group
  hlM: THREE.MeshStandardMaterial
  tlM: THREE.MeshStandardMaterial
  rvM: THREE.MeshStandardMaterial
  beamM: THREE.MeshBasicMaterial
  beams: THREE.Mesh[]
  wheels: THREE.Group[]
  name: string
  H: number
  R: number
  len: number
  own: { geos: THREE.BufferGeometry[]; mats: THREE.Material[] }
}

type P2 = [number, number]
type Spec = {
  name: string; L: number; W: number; H: number; R: number; tw: number; yb: number; wb: P2
  color?: number; holo?: P2; plate: string; int?: number | "tan"; frame?: string; doors?: number; flaps?: number; ant?: number
  seams?: number[]; decals?: [string, number, number, number, number][]
  body: P2[]; gh?: P2[]; ghw?: number; roof?: [number, number, number]; roofM?: string; bp: number; mir: P2; zw?: number
  bump: [string, number, number]; grille: [number, number, number, string]; slots?: number
  hl: [string, number, number, number, number]; tl: [number, number, number, number]; rim: string
  ex?: (b: THREE.Group, o: { W: number; F: number }) => void
}
type Draw = (g: CanvasRenderingContext2D, w: number, h: number) => void

export function createGarageKit() {
  const TXC: Record<string, THREE.Texture> = {}, MC: Record<string, THREE.Material> = {}, GEO: Record<string, THREE.BufferGeometry> = {}
  const R_ = Math.random
  const geo = <G extends THREE.BufferGeometry>(k: string, f: () => G): G => (GEO[k] as G) || (GEO[k] = f()) as G
  const mat = <M extends THREE.Material>(k: string, f: () => M): M => (MC[k] as M) || (MC[k] = f()) as M

  function std(c: number, o?: THREE.MeshStandardMaterialParameters) {
    return new THREE.MeshStandardMaterial(Object.assign({ color: lin(c), roughness: 0.5, metalness: 0 }, o || {}))
  }
  const M: Record<string, THREE.MeshStandardMaterial> = {
    chrome: std(0xe8eef6, { metalness: 1, roughness: 0.1 }), rubber: std(0x121317, { roughness: 0.9 }), trim: std(0x17191f, { roughness: 0.55 }),
    tan: std(0xc9a676, { roughness: 0.72 }), grille: std(0x07080b, { roughness: 0.7 }),
    steel: std(0xb4bdc9, { metalness: 0.85, roughness: 0.28 }), white: std(0xe6e9e4, { metalness: 0.15, roughness: 0.3 }), gray: std(0x4d5259, { roughness: 0.6 }),
    vinyl: std(0x2a1119, { roughness: 0.85 }), conc: std(0x5d6886, { roughness: 0.9 }), wall: std(0x46517a, { roughness: 0.85 }),
    pole: std(0x6a769c, { metalness: 0.6, roughness: 0.4 }), leaf: std(0x24504f, { roughness: 0.85, flatShading: true }), bark: std(0x3a3442, { roughness: 0.9 }),
    soil: std(0x15161c, { roughness: 1 }), line: std(0xc8d4ee, { roughness: 0.55 }),
    seam: std(0x040509, { roughness: 0.8 }), gold: std(0xe0b85c, { metalness: 0.9, roughness: 0.3 }),
  }
  // tinted see-through glass so the interiors show
  M.glass = new THREE.MeshPhysicalMaterial({ color: lin(0x2a3b5c), metalness: 0.1, roughness: 0.04, clearcoat: 1, clearcoatRoughness: 0.03, transparent: true, opacity: 0.42, envMapIntensity: 1.6, depthWrite: false })

  /* ---------- procedural texture pack ---------- */
  function ctex(key: string, w: number, h: number, draw: Draw, o?: { rep?: P2; data?: boolean }) {
    if (TXC[key]) return TXC[key]
    o = o || {}
    const t = new THREE.CanvasTexture(cvs(w, h, draw))
    if (o.rep) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(o.rep[0], o.rep[1]) }
    if (!o.data) t.colorSpace = THREE.SRGBColorSpace
    t.anisotropy = 4
    return (TXC[key] = t)
  }
  function rr(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
    g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath()
  }
  function star(g: CanvasRenderingContext2D, x: number, y: number, r: number, c: string) {
    g.beginPath()
    for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + (i * Math.PI) / 5, q = i % 2 ? r * 0.45 : r; g.lineTo(x + Math.cos(a) * q, y + Math.sin(a) * q) }
    g.closePath(); g.fillStyle = c; g.fill(); g.lineJoin = "round"; g.lineWidth = 5; g.strokeStyle = "rgba(30,24,60,.55)"; g.stroke()
  }
  function pix(w: number, h: number, f: (d: Uint8ClampedArray, i: number) => void): Draw {
    return (g) => { const d = g.createImageData(w, h); for (let i = 0; i < w * h; i++) f(d.data, i * 4); g.putImageData(d, 0, 0) }
  }
  const T = {
    flakeN: () => ctex("fn", 256, 256, pix(256, 256, (d, i) => { const a = R_() * 6.283, m = R_() < 0.3 ? R_() * 80 : R_() * 16
      d[i] = 128 + Math.cos(a) * m; d[i + 1] = 128 + Math.sin(a) * m; d[i + 2] = 255; d[i + 3] = 255 }), { rep: [4, 4], data: true }),
    flakeR: () => ctex("fr", 256, 256, pix(256, 256, (d, i) => { const v = 170 + R_() * 85; d[i] = d[i + 1] = d[i + 2] = v; d[i + 3] = 255 }), { rep: [3, 3], data: true }),
    tread: () => ctex("tr", 512, 64, (g, w, h) => { g.fillStyle = "#0f1013"; g.fillRect(0, 0, w, h); g.fillStyle = "#25272d"
      for (let i = 0; i < 32; i++) { const x = i * 16; g.beginPath(); g.moveTo(x, 4); g.lineTo(x + 10, 4); g.lineTo(x + 16, h / 2 - 3); g.lineTo(x + 6, h / 2 - 3); g.fill()
        g.beginPath(); g.moveTo(x + 6, h / 2 + 3); g.lineTo(x + 16, h / 2 + 3); g.lineTo(x + 10, h - 4); g.lineTo(x, h - 4); g.fill() } }),
    wall: () => ctex("wl", 256, 256, (g) => { g.fillStyle = "#131418"; g.fillRect(0, 0, 256, 256); g.translate(128, 128)
      g.strokeStyle = "#2b2d34"; g.lineWidth = 3; [88, 122].forEach((r) => { g.beginPath(); g.arc(0, 0, r, 0, 7); g.stroke() })
      g.fillStyle = "#7d828f"; g.font = "700 15px DM Sans, sans-serif"; g.textAlign = "center"; g.textBaseline = "middle"
      const t = "MOONGRIP ★ 185/70 R13 ★ ALL-NIGHT ★ ", n = t.length
      for (let i = 0; i < n; i++) { g.save(); g.rotate((i / n) * 6.2832); g.translate(0, -105); g.fillText(t[i], 0, 0); g.restore() } }),
    refl: () => ctex("rf", 128, 128, (g) => { const gr = g.createRadialGradient(64, 64, 4, 64, 64, 64)
      gr.addColorStop(0, "#ffffff"); gr.addColorStop(0.45, "#e2ecff"); gr.addColorStop(0.8, "#9aaccc"); gr.addColorStop(1, "#56658a"); g.fillStyle = gr; g.fillRect(0, 0, 128, 128)
      g.strokeStyle = "rgba(255,255,255,.4)"; g.lineWidth = 2; for (let r = 14; r < 64; r += 10) { g.beginPath(); g.arc(64, 64, r, 0, 7); g.stroke() }
      g.strokeStyle = "rgba(70,90,130,.25)"; for (let i = 0; i < 16; i++) { const a = (i * Math.PI) / 8; g.beginPath(); g.moveTo(64, 64); g.lineTo(64 + Math.cos(a) * 64, 64 + Math.sin(a) * 64); g.stroke() }
      g.fillStyle = "#fff"; g.beginPath(); g.ellipse(42, 40, 11, 8, -0.5, 0, 7); g.fill() }),
    lens: () => ctex("ln", 128, 64, (g, w, h) => { g.fillStyle = "#4a0610"; g.fillRect(0, 0, w, h)
      for (let y = 0; y < h; y += 10) for (let x = ((y / 10) % 2) * 6 - 6; x < w; x += 12) { const gr = g.createLinearGradient(x, y, x, y + 9)
        gr.addColorStop(0, "#ff7486"); gr.addColorStop(0.4, "#d01a34"); gr.addColorStop(1, "#6e0a18"); g.fillStyle = gr; g.fillRect(x + 1, y + 1, 10, 8) }
      g.fillStyle = "rgba(255,220,220,.35)"; g.fillRect(0, h * 0.15, w, 3) }),
    grille: () => ctex("gr", 64, 64, (g) => { g.fillStyle = "#06070a"; g.fillRect(0, 0, 64, 64); g.strokeStyle = "#3a404c"; g.lineWidth = 2
      for (let i = -64; i < 128; i += 8) { g.beginPath(); g.moveTo(i, 0); g.lineTo(i + 64, 64); g.stroke(); g.beginPath(); g.moveTo(i, 64); g.lineTo(i + 64, 0); g.stroke() } }, { rep: [6, 2] }),
    glow: () => ctex("gl", 64, 64, (g) => { const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32)
      gr.addColorStop(0, "rgba(255,255,255,1)"); gr.addColorStop(0.3, "rgba(255,255,255,.35)"); gr.addColorStop(1, "rgba(255,255,255,0)"); g.fillStyle = gr; g.fillRect(0, 0, 64, 64) }),
    rim: (t: string) => ctex("rim" + t, 256, 256, (g) => { g.translate(128, 128)
      g.fillStyle = ({ chrome: "#eef2f8", steel: "#bcc4cf", white: "#f0f0ea", gray: "#80868f" } as Record<string, string>)[t]; g.beginPath(); g.arc(0, 0, 128, 0, 7); g.fill()
      g.strokeStyle = "rgba(0,0,0,.3)"; g.lineWidth = 7; g.beginPath(); g.arc(0, 0, 116, 0, 7); g.stroke()
      g.strokeStyle = "rgba(255,255,255,.6)"; g.lineWidth = 3; g.beginPath(); g.arc(0, 0, 124, 3.6, 5.4); g.stroke()
      g.fillStyle = "#16181e"
      if (t === "chrome") for (let i = 0; i < 12; i++) { g.save(); g.rotate((i * Math.PI) / 6); g.beginPath(); g.ellipse(0, -78, 9, 28, 0, 0, 7); g.fill(); g.restore() }
      else if (t === "white") for (let i = 0; i < 5; i++) { g.save(); g.rotate(i * Math.PI * 0.4); rr(g, -15, -106, 30, 52, 12); g.fill(); g.restore() }
      else { const n = t === "steel" ? 5 : 4; for (let i = 0; i < n; i++) { g.save(); g.rotate((i * 6.2832) / n + 0.3); g.beginPath(); g.arc(0, -74, 17, 0, 7); g.fill(); g.restore() } }
      g.fillStyle = "rgba(0,0,0,.45)"; for (let i = 0; i < 5; i++) { const a = i * Math.PI * 0.4; g.beginPath(); g.arc(Math.cos(a) * 36, Math.sin(a) * 36, 6, 0, 7); g.fill() } }),
    plate: (txt: string) => ctex("pl" + txt, 256, 64, (g, w, h) => { g.fillStyle = "#1b2550"; rr(g, 0, 0, w, h, 10); g.fill(); g.fillStyle = "#ece6d2"; rr(g, 4, 4, w - 8, h - 8, 8); g.fill()
      g.textAlign = "center"; g.fillStyle = "#4a58a0"; g.font = "700 10px DM Sans, sans-serif"; g.fillText("★ NIGHT GARAGE ☾", w / 2, 16)
      g.fillStyle = "#1b2550"; g.font = "800 32px DM Sans, sans-serif"; g.fillText(txt, w / 2, 52) }),
    decal: (t: string) => ctex("dc" + t, 256, t === "stripes" ? 64 : 256, (g, w) => {
      if (t === "stripes") ["#ff8a3d", "#ffd24a", "#ff5f7e"].forEach((c, i) => { g.fillStyle = c; g.beginPath(); g.moveTo(0, 5 + i * 19); g.lineTo(w - 34 + i * 10, 5 + i * 19); g.lineTo(w - 20 + i * 10, 20 + i * 19); g.lineTo(0, 20 + i * 19); g.fill() })
      else if (t === "moon") { g.fillStyle = "#fff1b8"; g.beginPath(); g.arc(120, 128, 92, 0, 7); g.fill()
        g.globalCompositeOperation = "destination-out"; g.beginPath(); g.arc(165, 100, 82, 0, 7); g.fill(); g.globalCompositeOperation = "source-over"
        g.fillStyle = "#3a2d4a"; g.beginPath(); g.arc(58, 118, 7, 0, 7); g.fill(); g.fillStyle = "rgba(255,140,170,.7)"; g.beginPath(); g.arc(56, 150, 10, 0, 7); g.fill()
        star(g, 200, 196, 26, "#ffd85a"); star(g, 214, 58, 14, "#bff3ff") }
      else { star(g, 92, 112, 62, "#ffd85a"); star(g, 192, 70, 34, "#ff9ad5"); star(g, 186, 186, 26, "#bff3ff") } }),
  }
  const TM = {
    tread: () => mat("tread", () => std(0xffffff, { map: T.tread(), roughness: 0.92 })), wall: () => mat("wall", () => std(0xffffff, { map: T.wall(), roughness: 0.85 })),
    rim: (t: string) => mat("rim" + t, () => std(0xffffff, { map: T.rim(t), metalness: t === "chrome" ? 1 : t === "steel" ? 0.8 : 0.3, roughness: t === "chrome" ? 0.12 : 0.3 })),
    grille: () => mat("grille", () => std(0xffffff, { map: T.grille(), roughness: 0.6, metalness: 0.4 })),
    plate: (t: string) => mat("pl" + t, () => std(0xffffff, { map: T.plate(t), roughness: 0.45, metalness: 0.15 })),
    decal: (t: string) => mat("dc" + t, () => std(0xffffff, { map: T.decal(t), transparent: true, roughness: 0.35, metalness: 0.1, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 })),
    glow: (c: number) => mat("gw" + c, () => new THREE.MeshBasicMaterial({ map: T.glow(), color: lin(c), transparent: true, opacity: 0.3, blending: THREE.AdditiveBlending, depthWrite: false })),
    int: (c: number | "tan") => (c === "tan" ? M.tan : mat("in" + c, () => std(c, { roughness: 0.85 }))),
    ant: (c: number) => mat("an" + c, () => std(c, { emissive: lin(c), emissiveIntensity: 0.35, roughness: 0.3 })),
  }

  // clear-coated metallic paint (flake normals under a glossy coat). Holo = duochrome view-angle shift + sparkle.
  // dust = faint grime near the sills. Four shader variants in all, shared across cars.
  function makePaint(s: Spec, dust: boolean) {
    const kind = (s.holo ? "h" : "p") + (dust ? "d" : ""), key = kind + (s.holo ? s.holo.join() : s.color) + (dust ? s.yb : "")
    return mat(key, () => {
      const m = new THREE.MeshPhysicalMaterial({ color: s.holo ? 0xffffff : lin(s.color!), metalness: s.holo ? 0.65 : 0.5, roughness: s.holo ? 0.24 : 0.3,
        clearcoat: 1, clearcoatRoughness: 0.06, normalMap: T.flakeN(), normalScale: new THREE.Vector2(0.18, 0.18), roughnessMap: T.flakeR(), envMapIntensity: s.holo ? 1.4 : 1.1 })
      const cA = s.holo ? new THREE.Color(s.holo[0]) : null, cB = s.holo ? new THREE.Color(s.holo[1]) : null
      let head = "", code = ""
      if (s.holo) { head += "uniform vec3 cA;\nuniform vec3 cB;\n"; code += `
        vec3 hv = isOrthographic ? vec3(0.0,0.0,1.0) : normalize(vViewPosition);
        float hf = 1.0 - clamp(abs(dot(normal, hv)), 0.0, 1.0);
        float hk = smoothstep(0.05, 0.95, hf*1.3 + 0.22*normal.x - 0.12*normal.y + 0.1);
        diffuseColor.rgb = mix(cA, cB, hk);
        float hs = fract(sin(dot(floor(vNormalMapUv*38.0)+floor(hk*6.0), vec2(12.9898,78.233)))*43758.5453);
        totalEmissiveRadiance += mix(cB, vec3(1.0), 0.5) * step(0.986, hs) * 0.8;` }
      if (dust) { head += "uniform float dTop;\nvarying float vY;\n"; code += `
        float dk = (1.0 - smoothstep(dTop-0.4, dTop, vY)) * (0.55 + 0.45*fract(sin(dot(floor(vNormalMapUv*24.0), vec2(41.3,289.1)))*43758.5)) * 0.5;
        diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.23,0.21,0.19), dk);
        roughnessFactor = mix(roughnessFactor, 0.85, dk);` }
      m.onBeforeCompile = (sh) => {
        if (cA && cB) { sh.uniforms.cA = { value: cA }; sh.uniforms.cB = { value: cB } }
        if (dust) { sh.uniforms.dTop = { value: s.yb + 0.36 }
          sh.vertexShader = "varying float vY;\n" + sh.vertexShader.replace("#include <begin_vertex>", "#include <begin_vertex>\nvY = position.y;") }
        sh.fragmentShader = head + sh.fragmentShader.replace("#include <emissivemap_fragment>", "#include <emissivemap_fragment>\n" + code)
      }
      m.customProgramCacheKey = () => "garage-" + kind
      return m
    })
  }

  function B(g: THREE.Object3D, w: number, h: number, d: number, m: THREE.Material, x: number, y: number, z: number) {
    const o = new THREE.Mesh(geo(`b${w},${h},${d}`, () => new THREE.BoxGeometry(w, h, d)), m); o.position.set(x, y, z); g.add(o); return o
  }
  function C(g: THREE.Object3D, r: number, len: number, m: THREE.Material, x: number, y: number, z: number, axis?: string | null, seg?: number) {
    const geom = geo(`c${r},${len},${axis},${seg}`, () => { const q = new THREE.CylinderGeometry(r, r, len, seg || 20)
      if (axis === "x") q.rotateZ(Math.PI / 2); if (axis === "z") q.rotateX(Math.PI / 2); return q })
    const o = new THREE.Mesh(geom, m); o.position.set(x, y, z); g.add(o); return o
  }
  function poly(p: P2[]) { const s = new THREE.Shape(); s.moveTo(p[0][0], p[0][1]); p.slice(1).forEach((q) => s.lineTo(q[0], q[1])); s.closePath(); return s }
  let own: BuiltCar["own"] = { geos: [], mats: [] }
  // extrude a side profile (shape x = forward z, shape y = up) across the car's width
  function ext(shape: THREE.Shape, W: number, m: THREE.Material, bev: number) {
    const g = new THREE.ExtrudeGeometry(shape, { depth: W - 2 * bev, bevelEnabled: true, bevelThickness: bev, bevelSize: bev, bevelSegments: 4, curveSegments: 14 })
    g.rotateY(-Math.PI / 2); g.translate(W / 2 - bev, 0, 0); own.geos.push(g); return new THREE.Mesh(g, m)
  }
  // soft rounded lamp lens; UVs remapped 0..1 across the face so reflector/lens textures fit
  function lampGeo(w: number, h: number, r: number) {
    return geo(`l${w},${h},${r}`, () => { const s = new THREE.Shape(), x = -w / 2, y = -h / 2
      s.moveTo(x + r, y); s.lineTo(x + w - r, y); s.quadraticCurveTo(x + w, y, x + w, y + r); s.lineTo(x + w, y + h - r); s.quadraticCurveTo(x + w, y + h, x + w - r, y + h)
      s.lineTo(x + r, y + h); s.quadraticCurveTo(x, y + h, x, y + h - r); s.lineTo(x, y + r); s.quadraticCurveTo(x, y, x + r, y)
      const q = new THREE.ExtrudeGeometry(s, { depth: 0.02, bevelEnabled: true, bevelThickness: 0.015, bevelSize: 0.012, bevelSegments: 3, curveSegments: 6 })
      const p = q.attributes.position, uv = q.attributes.uv; for (let i = 0; i < p.count; i++) uv.setXY(i, p.getX(i) / w + 0.5, p.getY(i) / h + 0.5); return q })
  }
  function wheel(g: THREE.Object3D, R: number, tw: number, x: number, z: number, rim: string) {
    const w = new THREE.Group(); w.position.set(x, R, z); g.add(w)
    w.add(new THREE.Mesh(geo(`t${R},${tw}`, () => new THREE.CylinderGeometry(R, R, tw, 32).rotateZ(Math.PI / 2)), [TM.tread(), TM.wall(), TM.wall()]))
    const rf = TM.rim(rim); w.add(new THREE.Mesh(geo(`r${R},${tw}`, () => new THREE.CylinderGeometry(R * 0.64, R * 0.64, tw + 0.014, 28).rotateZ(Math.PI / 2)), [M[rim], rf, rf]))
    C(w, R * 0.15, tw + 0.04, M.chrome, 0, 0, 0, "x", 12)
    return w
  }

  /* ---------- car models (metres; scaled into the lot) ---------- */
  const S = 0.4, KX = 1.04, KY = 1.1, KW = 1.1, BEV = 0.07
  const SPEC: Record<GarageModel, Spec> = {
    olds: { name: "Oldsmobile Cutlass Supreme", L: 5.1, W: 1.83, H: 1.37, R: 0.34, tw: 0.22, yb: 0.28, wb: [-1.3, 1.57], color: 0x4a1426, plate: "CUTLS 84", int: 0x5c1b29, frame: "chrome",
      body: [[-2.55, 0.32], [-2.58, 0.62], [-2.52, 0.86], [-1.25, 0.9], [0.6, 0.9], [2.45, 0.85], [2.55, 0.72], [2.55, 0.34]],
      gh: [[-1.25, 0.86], [-0.88, 1.35], [-0.05, 1.37], [0.62, 0.86]], ghw: 0.88, roof: [-0.95, 0, 1.35], roofM: "vinyl", bp: -0.35, mir: [0.45, 1.04],
      bump: ["chrome", 0.42, 0.16], grille: [0.62, 0.3, 0.64, "chrome"], slots: 9, hl: ["quad", 0.64, 0.62, 0.36, 0.11], tl: [0.66, 0.52, 0.62, 0.13], rim: "chrome",
      ex(b, { W, F }) { [-1, 1].forEach((sd) => { const x = sd * (W / 2 + 0.008); B(b, 0.02, 0.03, 4.7, M.chrome, sd * (W / 2 + 0.012), 0.88, 0); B(b, 0.02, 0.04, 1.95, M.chrome, sd * (W / 2 + 0.012), 0.36, 0.13)
          B(b, 0.012, 0.014, 4.3, M.gold, x, 0.74, 0.05); B(b, 0.012, 0.008, 3.9, M.gold, x, 0.765, 0.05) })
        B(b, 0.05, 0.07, 0.12, M.chrome, 0, 0.96, F - 0.15) } },
    volvo: { name: "Volvo 240", L: 4.79, W: 1.71, H: 1.43, R: 0.32, tw: 0.2, yb: 0.28, wb: [-1.2, 1.44], color: 0xc6d0da, plate: "BRK 240", int: 0x4a5566, doors: 4, flaps: 1,
      body: [[-2.39, 0.3], [-2.42, 0.62], [-2.36, 0.9], [-1.3, 0.93], [0.55, 0.95], [2.3, 0.9], [2.4, 0.78], [2.4, 0.32]],
      gh: [[-1.3, 0.91], [-0.98, 1.4], [0.12, 1.42], [0.6, 0.93]], ghw: 0.9, roof: [-0.98, 0.12, 1.415], bp: -0.42, mir: [0.5, 1.08],
      bump: ["trim", 0.44, 0.2], grille: [0.7, 0.28, 0.68, "chrome"], slots: 8, hl: ["rect", 0.68, 0.6, 0.34, 0.16], tl: [0.68, 0.6, 0.36, 0.24], rim: "steel",
      ex(b, { F, W }) { [F + 0.13, -F - 0.13].forEach((z) => B(b, W * 0.9, 0.03, 0.02, M.chrome, 0, 0.47, z)); B(b, 0.6, 0.035, 0.02, M.chrome, 0, 0.68, F + 0.1).rotation.z = 0.42
        ;[-1, 1].forEach((sd) => B(b, 0.02, 0.03, 4.3, M.chrome, sd * (W / 2 + 0.012), 0.92, 0)) } },
    sl: { name: "Mercedes 560 SL", L: 4.39, W: 1.79, H: 1.12, R: 0.33, tw: 0.22, yb: 0.28, wb: [-1.15, 1.31], color: 0x0a0b0e, plate: "SL 560", int: "tan", zw: 0.55, bp: -0.45,
      body: [[-2.2, 0.32], [-2.23, 0.6], [-2.16, 0.82], [-0.85, 0.86], [0.45, 0.87], [2.08, 0.8], [2.2, 0.68], [2.2, 0.34]], mir: [0.5, 1.02],
      bump: ["chrome", 0.42, 0.12], grille: [0.5, 0.32, 0.62, "chrome"], slots: 0, hl: ["stack", 0.62, 0.62, 0.26, 0.26], tl: [0.62, 0.6, 0.42, 0.18], rim: "chrome",
      ex(b, { W, F }) { // top down: tan cabin, chrome-framed windscreen, three-pointed star on the hood
        B(b, W * 0.8, 0.03, 1.3, M.tan, 0, 0.95, -0.2)
        const ws = new THREE.Group(); ws.position.set(0, 0.9, 0.55); ws.rotation.x = -0.62; b.add(ws)
        B(ws, W * 0.82, 0.4, 0.025, M.glass, 0, 0.22, 0); B(ws, W * 0.84, 0.03, 0.04, M.chrome, 0, 0.43, 0); [-1, 1].forEach((sd) => B(ws, 0.035, 0.44, 0.04, M.chrome, sd * W * 0.42, 0.22, 0))
        C(b, 0.07, 0.03, M.chrome, 0, 0.62, F + 0.1, "z")
        const orn = new THREE.Group(); orn.position.set(0, 0.92, F - 0.3); b.add(orn); C(orn, 0.025, 0.04, M.chrome, 0, 0, 0)
        const ring = new THREE.Mesh(geo("orn", () => new THREE.TorusGeometry(0.055, 0.008, 6, 24)), M.chrome); ring.position.y = 0.07; orn.add(ring)
        for (let i = 0; i < 3; i++) { const sp = B(orn, 0.008, 0.055, 0.008, M.chrome, 0, 0.07, 0); sp.rotation.z = i * 2.094; sp.translateY(0.027) }
        ;[-1, 1].forEach((sd) => B(b, 0.02, 0.03, 4.0, M.chrome, sd * (W / 2 + 0.012), 0.76, 0)) } },
    xj: { name: "Jeep Cherokee Sport", L: 4.24, W: 1.79, H: 1.63, R: 0.36, tw: 0.24, yb: 0.34, wb: [-1.2, 1.38], color: 0x0b0c0f, plate: "XJ 4X4", int: 0x2a2b30, doors: 4, flaps: 1,
      body: [[-2.12, 0.38], [-2.13, 1.0], [0.6, 1.02], [1.98, 0.98], [2.12, 0.92], [2.12, 0.4]],
      gh: [[-2.08, 0.99], [-2.04, 1.6], [0, 1.62], [0.62, 1.0]], ghw: 0.9, roof: [-2.02, 0, 1.615], bp: -0.75, mir: [0.5, 1.14],
      bump: ["trim", 0.5, 0.2], grille: [0.62, 0.24, 0.8, "trim"], slots: 7, hl: ["rect", 0.8, 0.6, 0.3, 0.17], tl: [0.78, 0.78, 0.14, 0.32], rim: "steel",
      ex(b, { W }) { [-1, 1].forEach((sd) => { B(b, 0.05, 0.05, 1.9, M.trim, sd * W * 0.36, 1.7, -1.0); B(b, 0.03, 0.12, 3.0, M.gray, sd * (W / 2 + 0.012), 0.86, -0.1)
          ;[-1.9, -0.1].forEach((z) => B(b, 0.07, 0.06, 0.1, M.trim, sd * W * 0.36, 1.66, z)) })
        ;[-1.8, -1.05, -0.3].forEach((z) => B(b, W * 0.78, 0.035, 0.05, M.trim, 0, 1.72, z)) } },
    bronco: { name: "Ford Bronco", L: 3.86, W: 1.75, H: 1.8, R: 0.38, tw: 0.24, yb: 0.46, wb: [-1.1, 1.24], color: 0x6fa9a6, plate: "BRNC 79", int: 0xb79d78, flaps: 1,
      body: [[-1.93, 0.5], [-1.93, 1.12], [0.5, 1.12], [1.86, 1.1], [1.93, 1.02], [1.93, 0.52]],
      gh: [[-1.9, 1.1], [-1.9, 1.77], [0.28, 1.77], [0.5, 1.12]], ghw: 0.92, roof: [-1.92, 0.3, 1.78], roofM: "white", bp: -0.6, mir: [0.45, 1.29],
      bump: ["chrome", 0.55, 0.14], grille: [0.9, 0.3, 0.92, "white"], slots: 0, hl: ["round", 0.92, 0.6, 0.2, 0], tl: [0.85, 0.82, 0.1, 0.18], rim: "white",
      ex(b, { W, F }) { B(b, W * 0.92 + 0.02, 0.66, 0.62, M.white, 0, 1.44, -1.58)
        const sp = wheel(b, 0.36, 0.22, 0, -F - 0.2, "white"); sp.position.y = 1.0; sp.rotation.y = Math.PI / 2; sp.scale.set(KW, KW / KY, KW / KX)
        ;[-1, 1].forEach((sd) => B(b, 0.02, 0.07, 3.0, M.white, sd * (W / 2 + 0.012), 1.04, 0)) } },
    van: { name: "VW Vanagon", L: 4.57, W: 1.84, H: 1.95, R: 0.33, tw: 0.21, yb: 0.3, wb: [-1.18, 1.28], color: 0x5b7594, plate: "VAN GO", int: 0x7a6450, flaps: 1, ant: 0x9ad7ff,
      seams: [1.25, 0.85, -0.4], decals: [["stripes", 0.05, 0.95, 4.2, 0.16], ["moon", 0.05, 0.6, 0.38, 0.38], ["stars", -0.45, 0.6, 0.32, 0.32]],
      body: [[-2.28, 0.32], [-2.3, 1.08], [2.22, 1.1], [2.3, 0.96], [2.32, 0.34]],
      gh: [[-2.26, 1.07], [-2.24, 1.9], [1.86, 1.93], [2.26, 1.1]], ghw: 0.94, roof: [-2.22, 1.84, 1.93], roofM: "white", bp: 0.9, mir: [2.0, 1.29],
      bump: ["trim", 0.4, 0.18], grille: [1.3, 0.16, 0.86, "trim"], slots: 0, hl: ["rect", 0.86, 0.58, 0.3, 0.16], tl: [0.7, 0.78, 0.16, 0.3], rim: "steel",
      ex(b, { W }) { B(b, W * 0.7, 0.18, 2.4, M.white, 0, 2.03, -0.4)
        ;[-1, 1].forEach((sd) => { B(b, 0.02, 0.12, 4.4, M.white, sd * (W / 2 + 0.012), 1.02, 0); B(b, 0.02, 0.02, 0.9, M.trim, sd * (W / 2 + 0.012), 0.7, -0.2)
          ;[0.2, -0.9].forEach((z) => B(b, 0.04, 0.8, 0.08, M.white, sd * (W * 0.47 + 0.01), 1.5, z)) }) } },
    panda: { name: "Fiat Panda", L: 3.38, W: 1.49, H: 1.46, R: 0.29, tw: 0.17, yb: 0.26, wb: [-1.0, 1.16], holo: [0x34e3d0, 0x8a52ff], plate: "PANDA 4", int: 0x3d4060, ant: 0xff9ad5,
      decals: [["stripes", 0.08, 0.45, 1.2, 0.25], ["stars", 0.35, 0.74, 0.3, 0.3]],
      body: [[-1.69, 0.3], [-1.7, 0.9], [0.55, 0.92], [1.55, 0.86], [1.69, 0.78], [1.69, 0.32]],
      gh: [[-1.67, 0.9], [-1.64, 1.44], [0.1, 1.46], [0.58, 0.92]], ghw: 0.92, roof: [-1.64, 0.1, 1.45], bp: -0.5, mir: [0.5, 1.04],
      bump: ["gray", 0.4, 0.22], grille: [0.9, 0.16, 0.72, "trim"], slots: 0, hl: ["rect", 0.72, 0.52, 0.26, 0.14], tl: [0.62, 0.6, 0.2, 0.22], rim: "gray",
      ex(b, { W }) { [-1, 1].forEach((sd) => B(b, 0.02, 0.16, 1.45, M.gray, sd * (W / 2 + 0.012), 0.38, 0.08)) } },
    r5: { name: "Renault 5", L: 3.5, W: 1.52, H: 1.4, R: 0.29, tw: 0.17, yb: 0.26, wb: [-1.05, 1.2], holo: [0xff6fc8, 0x5dffb0], plate: "CINQ 5", int: 0x5c3150, ant: 0x8ef0ff,
      decals: [["stripes", 0.07, 0.45, 1.2, 0.25], ["moon", 0.2, 0.73, 0.32, 0.32]],
      body: [[-1.75, 0.3], [-1.76, 0.88], [0.5, 0.9], [1.5, 0.84], [1.75, 0.72], [1.75, 0.32]],
      gh: [[-1.73, 0.88], [-1.52, 1.38], [0.05, 1.4], [0.55, 0.9]], ghw: 0.9, roof: [-1.5, 0.05, 1.39], bp: -0.45, mir: [0.48, 1.02],
      bump: ["gray", 0.4, 0.26], grille: [0.5, 0.1, 0.68, "trim"], slots: 0, hl: ["rect", 0.68, 0.5, 0.3, 0.15], tl: [0.82, 0.66, 0.12, 0.3], rim: "gray",
      ex(b, { W }) { [-1, 1].forEach((sd) => B(b, 0.02, 0.14, 1.5, M.gray, sd * (W / 2 + 0.012), 0.4, 0.07)) } },
    samurai: { name: "Suzuki Samurai Sport", L: 3.43, W: 1.53, H: 1.69, R: 0.34, tw: 0.2, yb: 0.42, wb: [-0.95, 1.08], color: 0x232f6c, plate: "SAM 413", int: 0x34363f, flaps: 1, ant: 0x7dffc4,
      decals: [["stars", 0.05, 0.75, 0.3, 0.3]],
      body: [[-1.6, 0.46], [-1.6, 1.02], [0.45, 1.02], [1.55, 0.98], [1.66, 0.9], [1.66, 0.48]],
      gh: [[-1.58, 1.0], [-1.58, 1.66], [0.2, 1.67], [0.48, 1.02]], ghw: 0.92, roof: [-1.58, 0.22, 1.67], roofM: "white", bp: -0.4, mir: [0.42, 1.16],
      bump: ["trim", 0.5, 0.16], grille: [0.62, 0.22, 0.82, "trim"], slots: 5, hl: ["round", 0.82, 0.5, 0.2, 0], tl: [0.75, 0.66, 0.12, 0.2], rim: "steel",
      ex(b, { W, F }) { const sp = wheel(b, 0.32, 0.2, 0, -F - 0.19, "steel"); sp.position.y = 0.95; sp.rotation.y = Math.PI / 2; sp.scale.set(KW, KW / KY, KW / KX)
        ;[-1, 1].forEach((sd) => { B(b, 0.02, 0.05, 2.6, M.white, sd * (W / 2 + 0.012), 0.86, 0); B(b, 0.02, 0.03, 2.6, M.white, sd * (W / 2 + 0.012), 0.94, 0) }) } },
  }
  const BEAMG = new THREE.ConeGeometry(1.3, 6, 18, 1, true); BEAMG.translate(0, -3, 0); BEAMG.rotateX(-Math.PI / 2)
  const BLOBM = new THREE.MeshBasicMaterial({ color: lin(0x03060f), transparent: true, opacity: 0.5, depthWrite: false })
  const BLOBG = new THREE.CircleGeometry(1, 28)
  const PLANE = new THREE.PlaneGeometry(1, 1)

  // seats, dash, steering wheel and carpet, sitting on the body top under the glass
  function interior(b: THREE.Group, s: Spec, W: number, ytop: number, zw: number) {
    const IM = TM.int(s.int || 0x2a2d35), sx = W * 0.22, zb = zw - 0.95
    ;[-1, 1].forEach((sd) => { const x = sd * sx; B(b, 0.42, 0.1, 0.4, IM, x, ytop + 0.05, zb + 0.22); B(b, 0.42, 0.34, 0.1, IM, x, ytop + 0.2, zb).rotation.x = -0.14
      if (!s.gh) B(b, 0.24, 0.14, 0.08, IM, x, ytop + 0.45, zb - 0.04) })
    if (s.gh) { const zr2 = Math.max(zb - 0.75, s.roof![0] + 0.14)
      if (zr2 < zb - 0.45) { B(b, W * 0.7, 0.1, 0.36, IM, 0, ytop + 0.05, zr2 + 0.2); B(b, W * 0.7, 0.3, 0.1, IM, 0, ytop + 0.17, zr2).rotation.x = -0.12 }
      B(b, W * s.ghw! - 0.08, 0.012, zw - s.gh[0][0] - 0.2, M.trim, 0, ytop + 0.006, (zw + s.gh[0][0]) / 2) }
    B(b, W * 0.8, 0.1, 0.2, M.trim, 0, ytop + 0.06, zw - 0.32)
    const sw = new THREE.Mesh(geo("sw", () => new THREE.TorusGeometry(0.13, 0.018, 8, 20)), M.trim); sw.position.set(sx, ytop + 0.2, zw - 0.6); sw.rotation.x = -0.5; b.add(sw)
  }

  function buildCar(k: GarageModel): BuiltCar {
    own = { geos: [], mats: [] }
    const s = SPEC[k], g = new THREE.Group(), b = new THREE.Group(), wg = new THREE.Group(); g.add(b, wg)
    b.scale.set(S * KX, S * KY, S); wg.scale.setScalar(S * KW) // wheels live in a uniform group so they stay round
    const { L, W, R, tw } = s, F = L / 2, FF = F + BEV, [zr, zf] = s.wb, a = R * KW + 0.05 + BEV
    const P = makePaint(s, true), P2m = makePaint(s, false)
    const hlM = std(0xffffff, { map: T.refl(), emissive: lin(0xe2f0ff), emissiveMap: T.refl(), emissiveIntensity: 0.12, roughness: 0.1, metalness: 0.2 })
    const tlM = std(0xffffff, { map: T.lens(), emissive: lin(0xff2a40), emissiveMap: T.lens(), emissiveIntensity: 0.3, roughness: 0.2 })
    const rvM = std(0x8d96a1, { emissive: lin(0xf2f8ff), emissiveIntensity: 0 })
    // body side profile with wheel arches, bevelled for soft toy edges
    const sh = new THREE.Shape(), p = s.body
    sh.moveTo(p[0][0], p[0][1]); p.slice(1).forEach((q) => sh.lineTo(q[0], q[1]))
    sh.lineTo(zf + a, s.yb); sh.absarc(zf, R, a, 0, Math.PI, false); sh.lineTo(zf - a, s.yb)
    sh.lineTo(zr + a, s.yb); sh.absarc(zr, R, a, 0, Math.PI, false); sh.lineTo(zr - a, s.yb); sh.closePath()
    b.add(ext(sh, W, P, BEV))
    const ytop = Math.max(...p.map((q) => q[1])) + BEV, zw = s.gh ? s.gh[s.gh.length - 1][0] : s.zw!
    // tinted glass greenhouse, roof skin, pillars and window frames
    if (s.gh) { const gw = W * s.ghw!, gh = s.gh, FR = M[s.frame || "trim"]; b.add(ext(poly(gh), gw, M.glass, 0.02))
      const [z0, z1, y] = s.roof!; B(b, gw + 0.04, 0.06, z1 - z0 + 0.04, s.roofM ? M[s.roofM] : P2m, 0, y, (z0 + z1) / 2)
      const yl = Math.min(...gh.map((q) => q[1]))
      ;[-1, 1].forEach((sd) => { const x = sd * (gw / 2 + 0.01); B(b, 0.035, y - yl, 0.09, P2m, x, (yl + y) / 2, s.bp)
        for (let i = 0; i < gh.length - 1; i++) { const [za, ya] = gh[i], [zb, yb] = gh[i + 1]
          B(b, 0.03, 0.05, Math.hypot(zb - za, yb - ya) + 0.04, FR, x, (ya + yb) / 2, (za + zb) / 2).rotation.x = -Math.atan2(yb - ya, zb - za) } })
      if (s.ant) { const ax = -gw * 0.3; C(b, 0.008, 0.5, M.chrome, ax, y + 0.27, z0 + 0.25, null, 6)
        const ball = new THREE.Mesh(geo("ball", () => new THREE.SphereGeometry(0.05, 12, 8)), TM.ant(s.ant)); ball.position.set(ax, y + 0.54, z0 + 0.25); b.add(ball) } }
    interior(b, s, W, ytop, zw)
    // mirrors (rounded housing + glass), wipers
    ;[-1, 1].forEach((sd) => { const x = sd * (W / 2 + 0.11), [mz, my] = s.mir
      B(b, 0.12, 0.03, 0.03, M.trim, sd * (W / 2 + 0.04), my - 0.04, mz)
      const h = new THREE.Mesh(geo("mirH", () => new THREE.SphereGeometry(0.08, 14, 10)), P2m); h.scale.set(1.1, 0.75, 0.55); h.position.set(x, my, mz); b.add(h)
      const mg = new THREE.Mesh(geo("mirG", () => new THREE.CircleGeometry(0.066, 16)), M.chrome); mg.scale.set(1.1, 0.7, 1); mg.position.set(x, my, mz - 0.045); mg.rotation.y = Math.PI; b.add(mg)
      B(b, W * 0.3, 0.015, 0.025, M.trim, sd * W * 0.15 - 0.05, ytop + 0.012, zw + 0.03).rotation.y = sd * 0.1 })
    // door seams + handles
    const seams = s.seams || [zw - 0.04, s.bp + 0.03].concat(s.doors === 4 ? [s.bp - 0.95] : []), inArch = (z: number) => Math.abs(z - zf) < a || Math.abs(z - zr) < a
    ;[-1, 1].forEach((sd) => seams.forEach((z, i) => { const y0 = inArch(z) ? R + a - BEV + 0.03 : s.yb + 0.06, y1 = ytop - 0.06
      B(b, 0.01, y1 - y0, 0.012, M.seam, sd * (W / 2 + 0.002), (y0 + y1) / 2, z)
      if (i) B(b, 0.025, 0.028, 0.11, M.chrome, sd * (W / 2 + 0.012), ytop - 0.14, z + 0.1) }))
    // bumpers, plates, grille mesh
    const [bm, by, bh] = s.bump; [F + 0.05, -F - 0.05].forEach((z) => B(b, W + 0.03, bh, 0.14, M[bm], 0, by, z))
    ;([[F + 0.123, 0], [-F - 0.123, Math.PI]] as P2[]).forEach(([z, r]) => { const pl = new THREE.Mesh(geo("plate", () => new THREE.PlaneGeometry(0.5, 0.13)), TM.plate(s.plate)); pl.position.set(0, by, z); pl.rotation.y = r; b.add(pl) })
    const [gw2, gh2, gy, gm] = s.grille; B(b, gw2, gh2, 0.04, gm === "white" ? M.white : TM.grille(), 0, gy, FF + 0.005)
    if (gm === "chrome") [1, -1].forEach((v) => B(b, gw2 + 0.04, 0.025, 0.05, M.chrome, 0, gy + (v * gh2) / 2, FF + 0.01))
    const slots = s.slots || 0
    for (let i = 0; i < slots; i++) B(b, 0.025, gh2 * 0.8, 0.05, gm === "chrome" ? M.chrome : M.gray, ((i - (slots - 1) / 2) * gw2) / slots, gy, FF + 0.015)
    // lamps: soft rounded lenses in chrome bezels, reflector + lens textures, faint glow
    const [ht, hy, hx, hw, hh] = s.hl, [ty, tx, tw2, th] = s.tl, glows: [number, number, number, number, number][] = []
    const lamp = (gmt: THREE.BufferGeometry, m: THREE.Material, x: number, y: number, z: number, back?: boolean) => { const o = new THREE.Mesh(gmt, m); o.position.set(x, y, z); o.scale.y = 1 / KY; if (back) o.rotation.y = Math.PI; b.add(o) }
    ;[-1, 1].forEach((sd) => { const x = sd * hx
      const ls: [number, number, number, number][] = ht === "round" ? [[x, hy, hw * 1.08, hw * 1.08]] : ht === "quad" ? [[x - hw * 0.26, hy, hw * 0.44, hh], [x + hw * 0.26, hy, hw * 0.44, hh]]
        : ht === "stack" ? [[x, hy + hh * 0.27, hw, hh * 0.44], [x, hy - hh * 0.27, hw, hh * 0.44]] : [[x, hy, hw, hh]]
      ls.forEach(([lx, ly, lw, lh]) => { const r = Math.min(lw, lh) * (ht === "round" ? 0.49 : 0.4)
        lamp(lampGeo(lw + 0.04, lh + 0.04, r + 0.02), M.chrome, lx, ly, FF - 0.005); lamp(lampGeo(lw, lh, r), hlM, lx, ly, FF + 0.01); glows.push([lx, ly, FF + 0.06, Math.max(lw, lh) * 2.4, 0xcfe4ff]) })
      lamp(lampGeo(tw2, th, Math.min(tw2, th) * 0.3), tlM, sd * tx, ty, -FF - 0.01, true)
      lamp(lampGeo(Math.min(0.1, tw2 * 0.4), Math.min(0.08, th * 0.5), 0.015), rvM, sd * (tx - tw2 / 2 + 0.06), ty, -FF - 0.03, true)
      glows.push([sd * tx, ty, -FF - 0.07, Math.max(tw2, th) * 1.8, 0xff3050]) })
    // wheels (slightly oversized), mudflaps, exhaust tip
    const wx = W / 2 - tw / 2 + 0.03, wheels: THREE.Group[] = []
    ;[zr, zf].forEach((z) => [-1, 1].forEach((sd) => wheels.push(wheel(wg, R, tw, (sd * wx * KX) / KW, z / KW, s.rim))))
    if (s.flaps) [zr, zf].forEach((z) => [-1, 1].forEach((sd) => B(b, tw * 1.1, s.yb - 0.1, 0.02, M.rubber, sd * wx, (s.yb + 0.1) / 2, z - R * KW - 0.02)))
    const ey = Math.max(0.16, by - bh / 2 - 0.05); C(b, 0.04, 0.2, M.chrome, -W * 0.28, ey, -F - 0.1, "z", 14); C(b, 0.028, 0.012, M.grille, -W * 0.28, ey, -F - 0.2, "z", 12)
    if (s.ex) s.ex(b, { W, F })
    b.traverse((o) => { if ((o as THREE.Mesh).isMesh) o.castShadow = true })
    wg.traverse((o) => { if ((o as THREE.Mesh).isMesh) o.castShadow = true })
    // non-shadow extras: stickers and lamp glow
    ;(s.decals || []).forEach(([t, z, y, w, h]) => [-1, 1].forEach((sd) => { const d = new THREE.Mesh(PLANE, TM.decal(t)); d.scale.set(w, h, 1); d.position.set(sd * (W / 2 + 0.004), y, z); d.rotation.y = (sd * Math.PI) / 2; b.add(d) }))
    glows.forEach(([x, y, z, sz, c]) => { const q = new THREE.Mesh(PLANE, TM.glow(c)); q.scale.set(sz, sz / KY, 1); q.position.set(x, y, z); if (z < 0) q.rotation.y = Math.PI; q.raycast = () => {}; b.add(q) })
    // headlight beams + contact shadow
    const beamM = new THREE.MeshBasicMaterial({ color: lin(0xdcefff), transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false })
    const beams = [-1, 1].map((sd) => { const m = new THREE.Mesh(BEAMG, beamM); m.position.set(sd * hx, hy, FF); m.visible = false; m.raycast = () => {}; b.add(m); return m })
    const blob = new THREE.Mesh(BLOBG, BLOBM); blob.rotation.x = -Math.PI / 2; blob.scale.set(W * 0.66, L * 0.58, 1); blob.position.y = 0.03; blob.raycast = () => {}; b.add(blob)
    own.mats.push(hlM, tlM, rvM, beamM)
    return { g, hlM, tlM, rvM, beamM, beams, wheels, name: s.name, H: s.H * S * KY, R: R * S * KW, len: L * S, own }
  }

  function dispose() {
    Object.values(GEO).forEach((x) => x.dispose()); Object.values(MC).forEach((x) => x.dispose()); Object.values(TXC).forEach((x) => x.dispose())
    Object.values(M).forEach((x) => x.dispose()); BEAMG.dispose(); BLOBG.dispose(); PLANE.dispose(); BLOBM.dispose()
  }

  return { buildCar, M, B, C, poly, std, dispose }
}
export type GarageKit = ReturnType<typeof createGarageKit>
