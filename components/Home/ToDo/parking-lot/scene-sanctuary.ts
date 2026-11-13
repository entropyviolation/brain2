/**
 * components/Home/ToDo/parking-lot/scene-sanctuary.ts — the Solarpunk sanctuary parking lot
 *
 * Ported from docs/mockups/solarpunk-sanctuary/index.html: a white terraced
 * concrete deck with arcades, planters and cascades, in a jungle under a glass
 * dome. Day and night follow the local clock. Four zoom levels (car, structure,
 * forest, macro) from the small 1–4 buttons, the wheel or a pinch. Concept cars
 * from `sanctuary-cars.ts`, one per parked session, in a fixed bay order. HUD
 * pills with leader lines show name and time left; a click calls `onPick`.
 * Resume opens the lamps, reverses out and drives down the ramp. Phone-sized
 * hosts start in low quality (no bloom, no sun shadows, fewer plants).
 */
import * as THREE from "three"
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js"
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js"
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js"
import { OutputPass } from "three/examples/jsm/postprocessing/OutputPass.js"
import { LOT_TIER_COLOR, type LotCar, type MountLot } from "./types"
import { CONCEPT_KINDS, CONCEPT_PALETTE, createSanctuaryKit, lin, type ConceptCar } from "./sanctuary-cars"

const TAU = Math.PI * 2, CZ = 40, TH = 0.46, PI = Math.PI
const MU = THREE.MathUtils, LIN = THREE.LinearSRGBColorSpace, V3 = THREE.Vector3
const hex = (n: number) => "#" + n.toString(16).padStart(6, "0")
const rnd = (a: number, b: number) => a + Math.random() * (b - a)
const pick = <T,>(a: readonly T[]) => a[(Math.random() * a.length) | 0]
const P = (r: number, a: number, y = 0) => new V3(r * Math.sin(a), y, CZ - r * Math.cos(a))

type Item = [number, number, number, number, number, number, number | [number, number, number], number]
type Slot = { li: number; k: number; rc: number; th: number; y: number; rl: number }
type Parked = ConceptCar & { id: string; slot: Slot; state: "parked" | "driving" | "gone"; label: HTMLButtonElement; nm: HTMLElement; tm: HTMLElement; dot: HTMLElement; ln: SVGLineElement }
type Drive = { c: Parked; A: THREE.CatmullRomCurve3; B: THREE.CatmullRomCurve3; t: number; prev: THREE.Vector3; done: () => void }
type PQ = { n: number; pos: Float32Array; al: Float32Array; sz: Float32Array; vel: Float32Array; life: Float32Array; max: Float32Array; g: THREE.BufferGeometry; i: number; base: number }
type Cam = { tx: number; ty: number; tz: number; dist: number; el: number; az: number; fov: number; carW: number; fogK: number }

const LV = [{ y: 0.6, rf: 26 }, { y: 4.2, rf: 36 }, { y: 7.8, rf: 46 }].map((l) => ({ ...l, rl: l.rf + 8.5 }))
const RB = 58
// bay order for 0..12 cars: the mockup's nine first, then three more
const ORDER: [number, number][] = [[1, 0], [0, 0], [2, 1], [0, -1], [1, 1], [2, -1], [0, 1], [1, -2], [2, 2], [1, -1], [0, 2], [2, 0]]
const SLOTS: Slot[] = ORDER.map(([li, k]) => { const L = LV[li], rc = L.rf + 5; return { li, k, rc, th: (k * 3.4) / rc, y: L.y, rl: L.rl } })
const ZOOM_NAMES = ["Car", "Structure", "Forest", "Macro"]

export const mount: MountLot = (host, { onPick, reducedMotion: RM }) => {
  let W = Math.max(1, host.clientWidth), H = Math.max(1, host.clientHeight)
  const HI = Math.min(W, H) >= 600, QF = HI ? 1 : 0.6

  /* ---------- DOM ---------- */
  const canvas = document.createElement("canvas")
  canvas.style.cssText = "position:absolute;inset:0;width:100%;height:100%;display:block;touch-action:pan-y"
  canvas.setAttribute("aria-label", "A white terraced parking structure in a jungle, inside a glass dome")
  host.appendChild(canvas)
  const NS = "http://www.w3.org/2000/svg"
  const svg = document.createElementNS(NS, "svg")
  svg.setAttribute("class", "pl-sanctuary-leaders"); svg.setAttribute("aria-hidden", "true")
  svg.style.cssText = "position:absolute;inset:0;width:100%;height:100%;pointer-events:none;filter:drop-shadow(0 0 3px rgba(125,255,196,.8))"
  host.appendChild(svg)
  const layer = document.createElement("div")
  layer.className = "pl-sanctuary-labels"
  layer.style.cssText = "position:absolute;inset:0;pointer-events:none;overflow:hidden;font-family:inherit;--pl-glow:0"
  host.appendChild(layer)
  const zoomBar = document.createElement("div")
  zoomBar.className = "pl-sanctuary-zoom"; zoomBar.setAttribute("role", "group"); zoomBar.setAttribute("aria-label", "Zoom")
  zoomBar.style.cssText = "position:absolute;right:10px;bottom:10px;z-index:3;display:flex;gap:2px;padding:2px;border-radius:10px;background:rgba(3,14,9,.62);border:1px solid rgba(125,255,196,.28);backdrop-filter:blur(8px);-webkit-backdrop-filter:blur(8px)"
  const zoomBtns = [1, 2, 3, 4].map((z) => { const b = document.createElement("button"); b.type = "button"; b.textContent = String(z)
    b.title = ZOOM_NAMES[z - 1]; b.setAttribute("aria-label", `Zoom: ${ZOOM_NAMES[z - 1]}`)
    b.style.cssText = "font:inherit;font-size:11px;min-width:24px;padding:3px 6px;border:0;border-radius:8px;cursor:pointer;background:transparent;color:#a9d8c4;font-variant-numeric:tabular-nums"
    b.addEventListener("click", () => setZoom(z)); zoomBar.appendChild(b); return b })
  host.appendChild(zoomBar)

  /* ---------- renderer ---------- */
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: "high-performance" })
  renderer.toneMapping = THREE.ACESFilmicToneMapping
  renderer.shadowMap.enabled = true
  renderer.shadowMap.type = THREE.PCFSoftShadowMap
  const scene = new THREE.Scene()
  scene.background = lin(0x020604)
  const fog = new THREE.FogExp2(lin(0xdde8ee), 0.003); scene.fog = fog
  const camera = new THREE.PerspectiveCamera(24, W / H, 0.3, 4000)

  /* ---------- shared uniforms + shader bits ---------- */
  const U = { time: { value: 0 }, glow: { value: 0 }, stars: { value: 0 }, mist: { value: 0 },
    sunDir: { value: new V3(0, 1, 0) }, moonDir: { value: new V3(0, 1, 0) },
    top: { value: new THREE.Color() }, hor: { value: new THREE.Color() }, sunC: { value: new THREE.Color() },
    glowC: { value: lin(0x2fe6a8) }, deep: { value: lin(0x0b3b38) } }
  const VS = `varying vec3 vW;varying vec2 vUv;varying vec3 vN;
#include <fog_pars_vertex>
void main(){vUv=uv;vec4 w=modelMatrix*vec4(position,1.);vW=w.xyz;vN=normalize(mat3(modelMatrix)*normal);
vec4 mvPosition=viewMatrix*w;gl_Position=projectionMatrix*mvPosition;
#include <fog_vertex>
}`
  const FH = `#include <fog_pars_fragment>
varying vec3 vW;varying vec2 vUv;varying vec3 vN;
uniform float time,glow,stars,mist;uniform vec3 sunDir,moonDir,top,hor,sunC,glowC,deep;
float h21(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
float vn(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(h21(i),h21(i+vec2(1,0)),f.x),mix(h21(i+vec2(0,1)),h21(i+vec2(1,1)),f.x),f.y);}
`
  const TAIL = `
#include <tonemapping_fragment>
#include <colorspace_fragment>
#include <fog_fragment>
}`
  function shMat(fs: string, opts: THREE.ShaderMaterialParameters = {}, noFog = false) {
    const fogU = noFog ? {} : THREE.UniformsUtils.clone(THREE.UniformsLib.fog)
    return new THREE.ShaderMaterial({ uniforms: { ...fogU, ...U }, vertexShader: VS, fragmentShader: FH + fs + TAIL, fog: !noFog, ...opts })
  }
  const add = <T extends THREE.Object3D>(o: T) => (scene.add(o), o)

  /* ---------- sky ---------- */
  const skyMat = shMat(`void main(){vec3 d=normalize(vW);float h=max(d.y,0.);
vec3 c=mix(hor,top,pow(h,.5));
float sd=max(dot(d,sunDir),0.);float up=smoothstep(-.12,.02,sunDir.y);
c+=sunC*(smoothstep(.9992,.9996,sd)*5.+pow(sd,14.)*.4+pow(sd,3.)*.12)*up;
float md=max(dot(d,moonDir),0.);c+=vec3(.82,.9,1.)*(smoothstep(.9993,.9996,md)*1.4+pow(md,80.)*.12)*stars;
vec3 q=floor(d*320.);float r=fract(sin(dot(q,vec3(12.9898,78.233,45.164)))*43758.5453);
c+=vec3(step(.9968,r)*(.55+.45*sin(time*1.7+r*90.))*stars*smoothstep(.02,.3,h));
float cl=vn(d.xz/(d.y+.25)*3.+time*.01)*vn(d.xz/(d.y+.25)*7.-time*.015);c=mix(c,mix(hor,vec3(1.),.5),smoothstep(.25,.6,cl)*.22*(1.-stars)*h);
gl_FragColor=vec4(c,1.);`, { side: THREE.BackSide }, true)
  const sky = add(new THREE.Mesh(new THREE.SphereGeometry(140, 64, 24, 0, TAU, 0, PI / 2), skyMat)); sky.renderOrder = -2

  /* ---------- lights (physical: legacy intensities × π) ---------- */
  const hemi = add(new THREE.HemisphereLight(0xffffff, 0x334422, 0.6 * PI))
  const sun = new THREE.DirectionalLight(0xffffff, 2 * PI)
  sun.castShadow = HI; sun.shadow.mapSize.set(2048, 2048)
  Object.assign(sun.shadow.camera, { left: -46, right: 46, top: 46, bottom: -46, near: 10, far: 260 })
  sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.03
  scene.add(sun, sun.target); sun.target.position.set(0, 3, -2)
  const spot = new THREE.SpotLight(lin(0xe8fff4), 0, 40, 0.5, 0.6, 0); spot.position.set(0, -50, 0); scene.add(spot, spot.target)

  /* ---------- day/night keys ---------- */
  // h, skyTop, skyHor, light, lightI, hemiSky, hemiGround, hemiI, fog, fogD, bloom, glow, exposure, mist
  const NIGHT = [0x030817, 0x0c1a33, 0x86a6ff, 0.5, 0x203466, 0x050a09, 0.45, 0x0b1628, 0.0032, 1.25, 1, 1.0, 0.3]
  const K: number[][] = [[0, ...NIGHT],
    [5.2, 0x07102a, 0x1d2848, 0x8aa0e8, 0.45, 0x263a6c, 0x080d0b, 0.45, 0x141c34, 0.0034, 1.15, 0.95, 1.0, 0.5],
    [6.1, 0x4a6aa0, 0xffb190, 0xffb088, 1.6, 0xffcfb4, 0x3b4630, 0.6, 0xf0c0a6, 0.0062, 0.6, 0.25, 1.0, 1],
    [7.6, 0x5b8fd0, 0xf6dccb, 0xffe2c4, 2.4, 0xdfeaff, 0x4f6334, 0.6, 0xe6e2da, 0.0035, 0.4, 0, 1.0, 0.45],
    [12, 0x2a78e0, 0xcfe8fa, 0xffffff, 3.2, 0xeef7ff, 0x5a7d2c, 0.7, 0xdcecf4, 0.002, 0.28, 0, 1.0, 0.04],
    [16.5, 0x3576cc, 0xeedcc2, 0xffe6bc, 2.6, 0xf6ecdc, 0x6a6a34, 0.65, 0xeadfcf, 0.0025, 0.35, 0, 1.0, 0.05],
    [18, 0x37508e, 0xff9452, 0xff9b4a, 1.8, 0xffb27c, 0x8c4a30, 0.65, 0xe39a74, 0.0045, 0.75, 0.35, 1.0, 0.35],
    [19, 0x121a3a, 0x5c3a5a, 0x9c8cd6, 0.5, 0x3c3c70, 0x2c1a18, 0.45, 0x2a2238, 0.0045, 1.05, 0.85, 1.0, 0.3],
    [20.5, ...NIGHT], [24, ...NIGHT]]
  const ca = new THREE.Color(), cb = new THREE.Color()
  const PH = { top: 0, hor: 0, light: 0, lightI: 0, hs: 0, hg: 0, hi: 0, fog: 0, fogD: 0, bloom: 0, glow: 0, exp: 1, mist: 0 }
  function phase(h: number) {
    let i = 0; while (i < K.length - 2 && h >= K[i + 1][0]) i++
    const a = K[i], b = K[i + 1]; let t = (h - a[0]) / (b[0] - a[0]); t = t * t * (3 - 2 * t)
    const c = (j: number) => ca.setHex(a[j], LIN).lerp(cb.setHex(b[j], LIN), t).getHex(LIN), n = (j: number) => a[j] + (b[j] - a[j]) * t
    Object.assign(PH, { top: c(1), hor: c(2), light: c(3), lightI: n(4) * 0.55, hs: c(5), hg: c(6), hi: n(7) * 0.75, fog: c(8), fogD: n(9), bloom: n(10), glow: n(11), exp: n(12) * (0.78 + 0.22 * n(11)), mist: n(13) })
    const a2 = ((h - 6) / 12) * PI
    U.sunDir.value.set(-Math.cos(a2), Math.sin(a2), 0.45).normalize()
    U.moonDir.value.set(Math.cos(a2) * 0.7, Math.max(0.15, -Math.sin(a2)), 0.55).normalize()
    return PH
  }
  const nowHours = () => { const d = new Date(); return d.getHours() + d.getMinutes() / 60 + d.getSeconds() / 3600 }

  /* ---------- textures + materials ---------- */
  const cTex = (() => {
    const c = document.createElement("canvas"); c.width = c.height = 256; const g = c.getContext("2d")!
    g.fillStyle = "#ebe7de"; g.fillRect(0, 0, 256, 256)
    const id = g.getImageData(0, 0, 256, 256), d = id.data
    for (let i = 0; i < d.length; i += 4) { const n = (Math.random() - 0.5) * 14; d[i] += n; d[i + 1] += n; d[i + 2] += n * 0.9 }
    g.putImageData(id, 0, 0)
    for (let y = 0; y < 256; y += 32) { g.fillStyle = "rgba(110,100,85,.13)"; g.fillRect(0, y, 256, 1); g.fillStyle = "rgba(255,255,255,.35)"; g.fillRect(0, y + 1, 256, 1) }
    for (let i = 0; i < 60; i++) { g.fillStyle = `rgba(120,110,95,${rnd(0.02, 0.06)})`; g.fillRect(rnd(0, 256), rnd(0, 256), rnd(20, 90), 1) }
    for (let i = 0; i < 14; i++) { g.fillStyle = "rgba(90,100,80,.05)"; g.beginPath(); g.arc(rnd(0, 256), rnd(0, 256), rnd(6, 26), 0, TAU); g.fill() }
    const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(0.12, 0.12); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t
  })()
  const sm = (c: number, o: THREE.MeshStandardMaterialParameters = {}) => new THREE.MeshStandardMaterial({ color: lin(c), ...o })
  const M = {
    concrete: sm(0xe2ddd3, { map: cTex, bumpMap: cTex, bumpScale: 0.025, roughness: 0.88 }),
    under: sm(0xcfcac0, { map: cTex, roughness: 0.95 }),
    soil: sm(0x2e2418, { roughness: 1 }),
    terra: sm(0xb8603f, { roughness: 0.8 }),
    mark: new THREE.MeshBasicMaterial({ color: lin(0xdfe9e2) }),
    puddle: sm(0x26302c, { roughness: 0.04, metalness: 0.9, envMapIntensity: 1.4 }),
    rock: sm(0x6d7466, { roughness: 0.95, flatShading: true }),
    leaf: sm(0xffffff, { roughness: 0.65, side: THREE.DoubleSide }),
    blob: sm(0xffffff, { roughness: 0.85, flatShading: true }),
    bark: sm(0x6b5a46, { roughness: 0.95 }),
    bulb: new THREE.MeshBasicMaterial({ color: 0xffffff, toneMapped: false }),
    base: sm(0x1b211d, { roughness: 0.6, metalness: 0.4 }),
  }
  const waterMat = shMat(`void main(){vec2 p=vec2(vUv.x*5.,vUv.y*3.-time*.6);
vec3 n=normalize(vec3(sin(p.x*1.7+p.y*2.3)*.18+sin(p.y*5.1+time)*.08+sin(vW.x*.9+time*1.3)*.06,1.,cos(p.y*3.1-p.x*1.3)*.18+cos(vW.z*.8-time)*.06));
vec3 V=normalize(cameraPosition-vW);float f=mix(.06,1.,pow(1.-max(dot(n,V),0.),4.));
vec3 R=reflect(-V,n);float s=pow(max(dot(R,sunDir),0.),160.)*smoothstep(-.05,.1,sunDir.y);
vec3 c=mix(deep*(.35+.65*hor),mix(hor,top,.4),f)+sunC*s*2.5;
float rip=vn(p*2.)*vn(p*5.+3.);c+=glowC*glow*(.18+.9*rip);
gl_FragColor=vec4(c,.92);`, { transparent: true })
  const fallMat = shMat(`void main(){float col=floor(vUv.x*36.);float n=h21(vec2(col,3.1));
float st=fract(vUv.y*2.5+time*(.9+n*.8)+n);float a=smoothstep(0.,.25,st)*(1.-st)*.8+.22+vn(vec2(vUv.x*20.,vUv.y*6.+time*3.))*.3;
a*=smoothstep(0.,.15,vUv.x)*smoothstep(1.,.85,vUv.x)*smoothstep(0.,.05,vUv.y);
vec3 c=mix(mix(hor,top,.3),vec3(1.),.55)*(1.-stars*.6)+glowC*glow*.7;
gl_FragColor=vec4(c,a*.78);`, { transparent: true, depthWrite: false, side: THREE.DoubleSide })
  const mistMat = shMat(`void main(){vec2 p=vW.xz*.035;float n=vn(p+vec2(time*.02,0.))*vn(p*2.3-vec2(0.,time*.03));
float r=length(vW.xz)/135.;float a=smoothstep(.15,.7,n)*mist*.55*smoothstep(1.,.75,r);
gl_FragColor=vec4(mix(hor,vec3(1.),.35),a);`, { transparent: true, depthWrite: false })

  /* ---------- the structure ---------- */
  function arcShape(r0: number, r1: number, a0: number, a1: number, n = 56) {
    const s = new THREE.Shape()
    for (let i = 0; i <= n; i++) { const a = a0 + ((a1 - a0) * i) / n, x = r1 * Math.sin(a), z = CZ - r1 * Math.cos(a); if (i) s.lineTo(x, -z); else s.moveTo(x, -z) }
    for (let i = n; i >= 0; i--) { const a = a0 + ((a1 - a0) * i) / n; s.lineTo(r0 * Math.sin(a), -(CZ - r0 * Math.cos(a))) }
    return s
  }
  function arcSlab(r0: number, r1: number, a0: number, a1: number, y0: number, y1: number, mat: THREE.Material, shadow = true) {
    const g = new THREE.ExtrudeGeometry(arcShape(r0, r1, a0, a1), { depth: y1 - y0, bevelEnabled: false })
    g.rotateX(-PI / 2); g.translate(0, y0, 0)
    const m = add(new THREE.Mesh(g, mat)); m.castShadow = shadow; m.receiveShadow = true; return m
  }
  const markG = new THREE.PlaneGeometry(0.09, 4.6), puddleG = new THREE.CircleGeometry(1, 24), pierG = new THREE.CylinderGeometry(0.25, 0.3, 1, 10)
  LV.forEach((L, i) => {
    const y0 = i === 0 ? 0 : L.y - 0.5
    arcSlab(L.rf, RB, -TH, TH, y0, L.y, M.concrete)
    arcSlab(L.rf, L.rf + 1.8, -TH, TH, L.y, L.y + 0.9, M.concrete) // planter
    arcSlab(L.rf + 0.15, L.rf + 1.65, -TH + 0.004, TH - 0.004, L.y + 0.9, L.y + 0.92, M.soil, false)
    arcSlab(L.rf - 0.04, L.rf + 0.12, -TH, TH, L.y + 0.78, L.y + 0.98, M.terra) // terracotta cap
    arcSlab(L.rf + 1.8, L.rf + 2.4, -TH, TH, L.y, L.y + 0.06, waterMat, false) // channel
    const a = TH + 0.02, S0 = P(L.rl, a, L.y), dir = new V3(Math.cos(a), 0, Math.sin(a)), len = Math.max(3, L.y * 4.2)
    const ramp = add(new THREE.Mesh(new THREE.BoxGeometry(Math.hypot(len, L.y), 0.35, 3.8), M.concrete))
    ramp.position.copy(S0).addScaledVector(dir, len / 2); ramp.position.y = L.y / 2 - 0.17
    ramp.rotation.set(0, -a, -Math.atan2(L.y, len), "YZX"); ramp.castShadow = ramp.receiveShadow = true
    for (let k = 1; k < 4 && i > 0; k++) { const c = add(new THREE.Mesh(pierG, M.concrete)), hy = L.y * (1 - k / 4); c.scale.y = hy; c.position.copy(S0).addScaledVector(dir, (len * k) / 4); c.position.y = hy / 2 - 0.2; c.castShadow = true }
    const rc = L.rf + 5
    for (let k = -2; k <= 3; k++) { const a2 = ((k - 0.5) * 3.4) / rc, ln = add(new THREE.Mesh(markG, M.mark)); ln.rotation.set(-PI / 2, 0, a2); ln.position.copy(P(rc, a2, L.y + 0.012)) }
    for (let k = 0; k < 3; k++) { const p = add(new THREE.Mesh(puddleG, M.puddle)); p.scale.set(rnd(1.2, 2), rnd(0.7, 1), 1); p.rotation.set(-PI / 2, 0, rnd(0, TAU)); p.position.copy(P(L.rl + rnd(-0.6, 0.8), rnd(-TH + 0.05, TH - 0.05), L.y + 0.014)); p.receiveShadow = true }
  })
  arcSlab(RB, RB + 0.8, -TH, TH, 0, LV[2].y + 1.2, M.concrete) // back wall
  arcSlab(LV[1].rf + 0.4, RB, -TH + 0.01, TH - 0.01, LV[1].y - 1.4, LV[1].y - 0.5, M.under, false)
  // arcades under each upper level
  { const archG = new THREE.TorusGeometry(1.55, 0.24, 10, 28, PI)
    ;[1, 2].forEach((i) => { const L = LV[i], lo = LV[i - 1], sy = (L.y - 0.5 - lo.y) / 1.75
      for (let a = -TH + 0.04; a <= TH - 0.03; a += 3.5 / L.rf) { const m = add(new THREE.Mesh(archG, M.concrete)); m.scale.set(1, sy, 1); m.position.copy(P(L.rf + 0.1, a + 1.75 / L.rf, lo.y)); m.rotation.y = -(a + 1.75 / L.rf); m.castShadow = m.receiveShadow = true } }) }
  // two sweeping ribs over the deck
  ;[-0.36, 0.36].forEach((a) => { const c = new THREE.CatmullRomCurve3([P(22, a, 0), P(30, a, 12), P(42, a, 19), P(54, a, 16), P(61, a, 0)])
    add(new THREE.Mesh(new THREE.TubeGeometry(c, 80, 0.42, 12), M.concrete)).castShadow = true })

  /* ---------- ground, river, cliffs ---------- */
  const RIV = new THREE.CatmullRomCurve3([[-84, -48], [-66, -22], [-46, 4], [-24, 22], [2, 31], [28, 27], [52, 36], [78, 58], [100, 82]].map((p) => new V3(p[0], 0.05, p[1])))
  const RS = RIV.getSpacedPoints(220)
  const riverDist = (x: number, z: number) => { let m = 1e9; for (const p of RS) { const d = (p.x - x) ** 2 + (p.z - z) ** 2; if (d < m) m = d } return Math.sqrt(m) }
  const inDeck = (x: number, z: number) => { const dz = CZ - z, r = Math.hypot(x, dz), a = Math.atan2(x, dz); return r > 23 && r < 61 && Math.abs(a) < TH + 0.07 }
  const inClear = (x: number, z: number) => inDeck(x, z) || (x > -8 && x < 74 && z > -26 && z < 18) || (x > 20 && x < 62 && z > -30 && z < 14)
  function gh(x: number, z: number) { const d = Math.hypot(x, z)
    let h = MU.smoothstep(d, 48, 118) * (7 + 5 * Math.sin(x * 0.045 + 1) * Math.cos(z * 0.05)) + Math.sin(x * 0.21) * Math.cos(z * 0.17) * 0.3
    h *= 1 - MU.smoothstep(d, 122, 139)
    const rd = riverDist(x, z); if (rd < 10) h = MU.lerp(-0.8, h, MU.smoothstep(rd, 3.6, 10))
    return h }
  { const seg = HI ? 150 : 110, g = new THREE.PlaneGeometry(280, 280, seg, seg); g.rotateX(-PI / 2)
    const p = g.attributes.position, cols = new Float32Array(p.count * 3), c = new THREE.Color(), c1 = lin(0x2a5226), c2 = lin(0x58873a), mud = lin(0x3b3a26)
    for (let i = 0; i < p.count; i++) { let x = p.getX(i), z = p.getZ(i); const d = Math.hypot(x, z); if (d > 140) { x *= 140 / d; z *= 140 / d }
      const y = gh(x, z); p.setXYZ(i, x, y, z)
      c.copy(c1).lerp(c2, 0.5 + 0.5 * Math.sin(x * 0.13) * Math.cos(z * 0.11)); if (y < -0.2) c.lerp(mud, 0.6); cols.set([c.r, c.g, c.b], i * 3) }
    g.setAttribute("color", new THREE.BufferAttribute(cols, 3)); g.computeVertexNormals()
    add(new THREE.Mesh(g, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1 }))).receiveShadow = true }
  { const n = RS.length, pos: number[] = [], uv: number[] = [], idx: number[] = []
    for (let i = 0; i < n; i++) { const p = RS[i], t = RIV.getTangentAt(i / (n - 1)), w = 3.6 + 1.4 * Math.sin(i * 0.07)
      pos.push(p.x - t.z * w, 0.05, p.z + t.x * w, p.x + t.z * w, 0.05, p.z - t.x * w); uv.push(0, i * 0.18, 1, i * 0.18)
      if (i < n - 1) { const a = i * 2; idx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3) } }
    const g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(idx); g.computeVertexNormals()
    add(new THREE.Mesh(g, waterMat)) }
  const FALLS: { x: number; y: number; z: number; w: number; yaw: number }[] = []
  function waterfall(x: number, y0: number, y1: number, z: number, w: number, yaw: number) {
    const m = add(new THREE.Mesh(new THREE.PlaneGeometry(w, y0 - y1, 1, 1), fallMat)); m.position.set(x, (y0 + y1) / 2, z); m.rotation.y = yaw; FALLS.push({ x, y: y1, z, w, yaw })
  }
  { const dir = new V3(-66 + 84, 0, -22 + 48).normalize(), yaw = Math.atan2(dir.x, dir.z), rockG = new THREE.DodecahedronGeometry(1, 1)
    for (let i = 0; i < 16; i++) { const a = rnd(-1.3, 1.3), r = rnd(10, 18), m = add(new THREE.Mesh(rockG, M.rock))
      m.position.set(-88 - Math.sin(yaw + a) * r * 0.9, rnd(2, 18), -54 - Math.cos(yaw + a) * r * 0.9); m.scale.set(rnd(7, 13), rnd(8, 16), rnd(7, 12)); m.rotation.set(rnd(0, 3), rnd(0, 3), 0); m.castShadow = m.receiveShadow = true }
    waterfall(-86, 27, 0, -51, 8, yaw); waterfall(-76, 21, 0, -58, 4.5, yaw - 0.5)
    const pool = add(new THREE.Mesh(new THREE.CircleGeometry(10, 32), waterMat)); pool.rotation.x = -PI / 2; pool.position.set(-82, 0.06, -46) }
  // cascades down the deck faces
  ;[[2, 1], [1, 0], [0, -1]].forEach(([i, j]) => { const L = LV[i], a = -0.3, yb = j < 0 ? 0 : LV[j].y, p = P(L.rf - 0.12, a, 0); waterfall(p.x, L.y + 0.9, yb, p.z, 1.3, -a) })
  { const pool = add(new THREE.Mesh(new THREE.CircleGeometry(2.6, 24), waterMat)); pool.rotation.x = -PI / 2; pool.position.copy(P(23.5, -0.3, 0.03)) }
  { const m = add(new THREE.Mesh(new THREE.CircleGeometry(136, 64), mistMat)); m.rotation.x = -PI / 2; m.position.y = 0.45; m.renderOrder = 2 }

  /* ---------- vegetation (instanced, LOD by zoom) ---------- */
  const VEG: { m: THREE.InstancedMesh; n: number; detail: boolean | null }[] = []
  const dmy = new THREE.Object3D(); dmy.rotation.order = "YXZ"; const tc = new THREE.Color()
  const GREENS = [0x2f7d3a, 0x3f9a46, 0x57ad45, 0x1f5e32, 0x6cbf52, 0x2a6e4a, 0x4d8f3a]
  function inst(geo: THREE.BufferGeometry, mat: THREE.Material, items: Item[], shadow = false, detail: boolean | null = null) {
    const m = new THREE.InstancedMesh(geo, mat, Math.max(1, items.length))
    items.forEach((o, i) => { dmy.position.set(o[0], o[1], o[2]); dmy.rotation.set(o[3], o[4], o[5]); const s = o[6]
      if (typeof s === "number") dmy.scale.setScalar(s); else dmy.scale.set(s[0], s[1], s[2])
      dmy.updateMatrix(); m.setMatrixAt(i, dmy.matrix); m.setColorAt(i, tc.setHex(o[7], LIN).offsetHSL(rnd(-0.015, 0.015), 0, rnd(-0.04, 0.04))) })
    m.count = items.length
    m.instanceMatrix.needsUpdate = true; if (m.instanceColor) m.instanceColor.needsUpdate = true
    m.castShadow = shadow; m.receiveShadow = true; scene.add(m); VEG.push({ m, n: items.length, detail }); return m
  }
  function frondGeo(L: number, Wd: number, seg: number, droop = 0.45) {
    const g = new THREE.PlaneGeometry(Wd, L, 2, seg); g.translate(0, L / 2, 0); const p = g.attributes.position
    for (let i = 0; i < p.count; i++) { const t = p.getY(i) / L, x = p.getX(i) * Math.sin(PI * Math.min(1, t * 1.05 + 0.06)); p.setX(i, x); p.setZ(i, t * t * L * droop - Math.abs(x) * 0.35) }
    g.computeVertexNormals(); return g
  }
  const dirTo = (a: THREE.Vector3, b: THREE.Vector3): [number, number, number] => { const d = b.clone().sub(a), l = d.length(); d.divideScalar(l); return [Math.acos(MU.clamp(d.y, -1, 1)), Math.atan2(d.x, d.z), l] }
  const F: Item[] = [], MON: Item[] = [], BL: Item[] = [], VN: Item[] = [], BU: Item[] = [], TR: Item[] = [], TB: Item[] = [], GR: Item[] = [], PT: Item[] = [], PF: Item[] = []
  function palm(base: THREE.Vector3, h: number) {
    const lean = rnd(0, 0.35), la = rnd(0, TAU); let prev = base.clone()
    for (let s = 1; s <= 6; s++) { const t = s / 6, q = base.clone().add(new V3(Math.cos(la) * lean * t * t * h, t * h, Math.sin(la) * lean * t * t * h)), [tx, ty, l] = dirTo(prev, q)
      PT.push([prev.x, prev.y, prev.z, tx, ty, 0, [1 - t * 0.3, l, 1 - t * 0.3], 0x8a7458]); prev = q }
    for (let j = 0; j < 12; j++) PF.push([prev.x, prev.y, prev.z, rnd(0.9, 1.75), (j / 12) * TAU + rnd(-0.2, 0.2), 0, rnd(0.85, 1.15), pick([0x3f8f3c, 0x4f9e3e, 0x2f7a36])])
  }
  LV.forEach((L, li) => {
    const yb = li ? LV[li - 1].y : 0, top = L.y + 0.9
    for (let c = 0; c < Math.round(70 * QF); c++) { const p = P(rnd(L.rf + 0.3, L.rf + 1.5), rnd(-TH + 0.02, TH - 0.02), top - 0.02), n = 6 + ((Math.random() * 4) | 0), col = pick(GREENS)
      for (let j = 0; j < n; j++) F.push([p.x, p.y, p.z, rnd(0.55, 1.3), (j / n) * TAU + rnd(-0.3, 0.3), 0, rnd(0.6, 1.15), col]) }
    for (let c = 0; c < Math.round(26 * QF); c++) { const p = P(rnd(L.rf + 0.4, L.rf + 1.4), rnd(-TH + 0.03, TH - 0.03), top); for (let j = 0; j < 5; j++) MON.push([p.x, p.y, p.z, rnd(0.35, 1.05), rnd(0, TAU), 0, rnd(1, 1.6), pick([0x1f6a35, 0x24733a, 0x2d5f2f])]) }
    for (let c = 0; c < 40; c++) { const p = P(rnd(L.rf + 0.4, L.rf + 1.4), rnd(-TH + 0.02, TH - 0.02), top + 0.2); BL.push([p.x, p.y, p.z, 0, rnd(0, 3), 0, [rnd(0.9, 1.5), rnd(0.6, 1), rnd(0.9, 1.5)], pick(GREENS)]) }
    for (let c = 0; c < Math.round(26 * QF); c++) { const p = P(rnd(L.rf + 0.4, L.rf + 1.4), rnd(-TH + 0.02, TH - 0.02), top + rnd(0.15, 0.6)); BU.push([p.x, p.y, p.z, 0, 0, 0, rnd(0.7, 1.3), pick([0x7dffc4, 0x9ad7ff, 0x7dffc4, 0xb9a8ff])]) }
    for (let s = 0; s < Math.round(55 * QF); s++) { const a = rnd(-TH + 0.02, TH - 0.02), len = rnd(0.6, Math.max(0.8, top - yb - 0.4))
      for (let d = 0; d < len; d += 0.13) { const p = P(L.rf - 0.08 - Math.random() * 0.08, a + rnd(-0.004, 0.004), top - d); VN.push([p.x, p.y, p.z, rnd(-1, 1), -a + rnd(-0.8, 0.8), rnd(0, TAU), rnd(0.6, 1.1), pick([0x2f7d3a, 0x3b8c3e, 0x4f9e3e])]) } }
    ;[[-0.38, -0.2], [-0.05, 0.22, 0.4], [-0.42, 0.3]][li].forEach((a) => palm(P(L.rf + 0.9, a, top), rnd(5, 7.5)))
  })
  for (let i = 0; i < 14; i++) { const a = rnd(0, TAU), r = rnd(30, 62), x = Math.cos(a) * r, z = Math.sin(a) * r; if (inClear(x, z) || riverDist(x, z) < 6) continue; palm(new V3(x, gh(x, z), z), rnd(6, 10)) }
  for (let c = 0; c < Math.round(160 * QF); c++) { const x = rnd(-80, 90), z = rnd(-40, 60); if (inDeck(x, z) || riverDist(x, z) < 4.5 || Math.hypot(x, z) > 95) continue; const y = gh(x, z), col = pick(GREENS)
    for (let j = 0; j < 7; j++) F.push([x, y, z, rnd(0.6, 1.3), (j / 7) * TAU, 0, rnd(0.9, 1.6), col]) }
  for (let i = 0; i < Math.round(5000 * QF); i++) { const a = rnd(0, TAU), r = Math.sqrt(Math.random()) * 75, x = Math.cos(a) * r, z = Math.sin(a) * r; if (inDeck(x, z) || riverDist(x, z) < 4) continue
    GR.push([x, gh(x, z), z, rnd(-0.25, 0.25), rnd(0, TAU), rnd(-0.25, 0.25), [1, rnd(0.6, 1.6), 1], pick([0x4f8a35, 0x5f9a3a, 0x3d7a30, 0x6aa848])]) }
  for (let i = 0; i < Math.round(260 * QF); i++) { const a = rnd(0, TAU), r = rnd(42, 128), x = Math.cos(a) * r, z = Math.sin(a) * r; if (inClear(x, z) || riverDist(x, z) < 7.5) continue
    const y = gh(x, z), h = rnd(5, 11), s = rnd(0.8, 1.3); TR.push([x, y - 0.3, z, rnd(-0.06, 0.06), 0, rnd(-0.06, 0.06), [s, h, s], 0x6b5a46])
    const bloomy = Math.random() < 0.06; for (let j = 0; j < 4; j++) TB.push([x + rnd(-2, 2) * s, y + h + rnd(-1, 2), z + rnd(-2, 2) * s, rnd(0, 3), rnd(0, 3), 0, rnd(2.4, 4.4) * (h / 8 + 0.4), bloomy && j < 2 ? 0xd98a6a : pick([0x1f5e32, 0x2a6e3a, 0x357a3a, 0x244f2c, 0x3f8a3f])]) }
  for (let i = 0; i < Math.round(110 * QF); i++) { const t = Math.random(), p = RIV.getPointAt(t), tg = RIV.getTangentAt(t), side = Math.random() < 0.5 ? -1 : 1, o = rnd(4.5, 8)
    const x = p.x - tg.z * o * side, z = p.z + tg.x * o * side; BU.push([x, gh(x, z) + rnd(0.1, 0.5), z, 0, 0, 0, rnd(1.2, 2.6), pick([0x7dffc4, 0x9ad7ff, 0xb9a8ff])]) }
  const monG = (() => { const g = new THREE.CircleGeometry(0.5, 14); g.translate(0, 0.55, 0); const p = g.attributes.position; for (let i = 0; i < p.count; i++) { const x = p.getX(i), y = p.getY(i); p.setZ(i, x * x * 0.5 + y * y * 0.25) } g.computeVertexNormals(); return g })()
  inst(frondGeo(1.5, 0.36, 6), M.leaf, F, false, true)
  inst(monG, M.leaf, MON, true, true)
  inst(new THREE.PlaneGeometry(0.22, 0.26), M.leaf, VN, false, true)
  inst(new THREE.ConeGeometry(0.05, 0.6, 3).translate(0, 0.3, 0), M.leaf, GR, false, true)
  inst(new THREE.IcosahedronGeometry(1, 1), M.blob, BL, false, false)
  inst(new THREE.CylinderGeometry(0.16, 0.22, 1, 6).translate(0, 0.5, 0), M.bark, PT, true)
  inst(frondGeo(3.4, 0.8, 8, 0.55), M.leaf, PF, true)
  inst(new THREE.CylinderGeometry(0.28, 0.5, 1, 6).translate(0, 0.5, 0), M.bark, TR, true)
  inst(new THREE.IcosahedronGeometry(1, 1), M.blob, TB, true)
  inst(new THREE.SphereGeometry(0.09, 8, 6), M.bulb, BU)
  if (!HI) VEG.forEach((v) => (v.m.count = Math.floor(v.n * 0.45)))

  /* ---------- particles ---------- */
  const PSCALE = { value: H }
  function Particles(n: number, color: number, additive: boolean): PQ {
    const g = new THREE.BufferGeometry(), pos = new Float32Array(n * 3), al = new Float32Array(n), sz = new Float32Array(n)
    g.setAttribute("position", new THREE.BufferAttribute(pos, 3)); g.setAttribute("alpha", new THREE.BufferAttribute(al, 1)); g.setAttribute("size", new THREE.BufferAttribute(sz, 1))
    const m = new THREE.ShaderMaterial({ uniforms: { color: { value: lin(color) }, scale: PSCALE }, transparent: true, depthWrite: false, blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
      vertexShader: "attribute float alpha,size;varying float vA;uniform float scale;void main(){vA=alpha;vec4 mv=modelViewMatrix*vec4(position,1.);gl_PointSize=size*scale/max(.1,-mv.z);gl_Position=projectionMatrix*mv;}",
      fragmentShader: `uniform vec3 color;varying float vA;void main(){float d=length(gl_PointCoord-.5);gl_FragColor=vec4(color,smoothstep(.5,0.,d)*vA);
#include <tonemapping_fragment>
#include <colorspace_fragment>
}` })
    const pts = add(new THREE.Points(g, m)); pts.frustumCulled = false
    return { n, pos, al, sz, vel: new Float32Array(n * 3), life: new Float32Array(n), max: new Float32Array(n), g, i: 0, base: 1 }
  }
  function spawn(Q: PQ, x: number, y: number, z: number, vx: number, vy: number, vz: number, life: number, size: number) {
    const i = (Q.i = (Q.i + 1) % Q.n); Q.pos.set([x, y, z], i * 3); Q.vel.set([vx, vy, vz], i * 3); Q.life[i] = Q.max[i] = life; Q.sz[i] = size
  }
  const dirty = (Q: PQ) => { Q.g.attributes.position.needsUpdate = Q.g.attributes.alpha.needsUpdate = Q.g.attributes.size.needsUpdate = true }
  function stepP(Q: PQ, dt: number, grow: number) {
    for (let i = 0; i < Q.n; i++) { if (Q.life[i] <= 0) { Q.al[i] = 0; continue } Q.life[i] -= dt
      for (let k = 0; k < 3; k++) { Q.pos[i * 3 + k] += Q.vel[i * 3 + k] * dt; Q.vel[i * 3 + k] *= 0.985 } Q.sz[i] += grow * dt; Q.al[i] = Math.sin(PI * (1 - Math.max(0, Q.life[i]) / Q.max[i])) * Q.base }
    dirty(Q)
  }
  const EXH = Particles(220, 0xdcfff0, false), MIST = Particles(260, 0xeef8ff, false), FLY = Particles(160, 0x9dffd2, true)
  const flyBase: { p: THREE.Vector3; s: number }[] = []
  for (let i = 0; i < FLY.n; i++) { const L = pick(LV), a = rnd(-TH, TH), p = Math.random() < 0.6 ? P(L.rf + rnd(-1, 3), a, L.y + rnd(1, 3)) : new V3(rnd(-60, 70), rnd(1, 5), rnd(-30, 50)); flyBase.push({ p, s: rnd(0, TAU) }); FLY.sz[i] = rnd(0.6, 1.1) }

  /* ---------- glass dome + void ---------- */
  const domeG = add(new THREE.Group())
  { const ico = new THREE.IcosahedronGeometry(150, 3)
    const glass = shMat(`void main(){if(vW.y<-.5)discard;vec3 V=normalize(cameraPosition-vW);float f=pow(1.-abs(dot(normalize(vN),V)),2.5);
float streak=smoothstep(.55,.62,vN.x+vN.y*.3)*smoothstep(.8,.66,vN.x+vN.y*.3);
vec3 c=mix(vec3(.75,.95,1.),hor,.35);gl_FragColor=vec4(c,.03+f*.5+streak*.12);`, { transparent: true, depthWrite: false }, true)
    domeG.add(new THREE.Mesh(ico, glass))
    const e = new THREE.EdgesGeometry(ico, 1), src = e.attributes.position.array, keep: number[] = []
    for (let i = 0; i < src.length; i += 6) if (src[i + 1] > -0.5 && src[i + 4] > -0.5) for (let k = 0; k < 6; k++) keep.push(src[i + k])
    e.dispose()
    const eg = new THREE.BufferGeometry(); eg.setAttribute("position", new THREE.Float32BufferAttribute(keep, 3))
    domeG.add(new THREE.LineSegments(eg, new THREE.LineBasicMaterial({ color: lin(0xcff2ff), transparent: true, opacity: 0.28, fog: false }))) }
  { const ring = add(new THREE.Mesh(new THREE.TorusGeometry(150.5, 0.9, 8, 128), new THREE.MeshBasicMaterial({ color: lin(0x7dffc4).multiplyScalar(1.6), toneMapped: false, fog: false }))); ring.rotation.x = PI / 2
    add(new THREE.Mesh(new THREE.CylinderGeometry(150, 118, 16, 96, 1, true), M.base)).position.y = -8
    add(new THREE.Mesh(new THREE.CylinderGeometry(118, 6, 60, 64, 1, true), M.base)).position.y = -46
    const n = 3000, pos = new Float32Array(n * 3), v = new V3(); for (let i = 0; i < n; i++) { v.set(rnd(-1, 1), rnd(-1, 1), rnd(-1, 1)).normalize().multiplyScalar(rnd(900, 1600)); pos.set([v.x, v.y, v.z], i * 3) }
    const g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.BufferAttribute(pos, 3))
    add(new THREE.Points(g, new THREE.PointsMaterial({ color: lin(0xcfe8ff), size: 2, sizeAttenuation: false, fog: false }))) }

  /* ---------- environment map from the sky, scaled by daylight ---------- */
  const pmrem = new THREE.PMREMGenerator(renderer)
  const envScene = new THREE.Scene()
  const envSkyG = new THREE.SphereGeometry(10, 32, 12, 0, TAU, 0, PI / 2), envGndG = new THREE.SphereGeometry(10, 16, 8, 0, TAU, PI / 2, PI / 2)
  const envGndM = new THREE.MeshBasicMaterial({ side: THREE.BackSide })
  envScene.add(new THREE.Mesh(envSkyG, skyMat), new THREE.Mesh(envGndG, envGndM))
  let envRT: THREE.WebGLRenderTarget | null = null, envAt = -99, envT = 0
  function updateEnv(tod: number, force: boolean) {
    if (!force && Math.abs(tod - envAt) < 0.12) return
    envAt = tod; envGndM.color.setHex(PH.hg, LIN).multiplyScalar(0.6)
    const rt = pmrem.fromScene(envScene, 0.02, 0.1, 100); envRT?.dispose(); envRT = rt; scene.environment = rt.texture
    // The sky map is bright; scale reflections by daylight so night stays dark.
    scene.environmentIntensity = 0.1 + 0.45 * (1 - PH.glow)
  }

  /* ---------- cars ---------- */
  const kit = createSanctuaryKit()
  const selRing = add(new THREE.Mesh(new THREE.RingGeometry(2.05, 2.25, 64), new THREE.MeshBasicMaterial({ color: lin(0x7dffc4).multiplyScalar(1.4), transparent: true, opacity: 0.7, toneMapped: false, depthWrite: false })))
  selRing.rotation.x = -PI / 2; selRing.scale.set(1, 1.45, 1); selRing.visible = false
  let parked: Parked[] = []
  let selected: string | null = null
  let drive: Drive | null = null
  let zoom = 2

  const pillBase = "position:absolute;left:0;top:0;display:flex;align-items:center;gap:6px;margin:0;pointer-events:auto;cursor:pointer;white-space:nowrap;font:inherit;font-size:11px;line-height:1.4;color:#7dffc4;border-radius:999px;padding:3px 9px 3px 7px;backdrop-filter:blur(4px);-webkit-backdrop-filter:blur(4px);will-change:transform;"
  function pillLook(c: Parked) {
    const on = c.id === selected
    c.label.style.background = on ? "rgba(10,44,30,.88)" : "rgba(3,14,9,.74)"
    c.label.style.border = `1px solid rgba(125,255,196,${on ? 0.9 : 0.38})`
    c.label.style.boxShadow = on ? "0 0 14px rgba(125,255,196,.45)" : "0 0 calc(4px + var(--pl-glow)*14px) rgba(125,255,196,calc(.15 + var(--pl-glow)*.35))"
    c.nm.style.maxWidth = on || zoom === 1 ? "none" : "9em"
  }
  function makeLabel(id: string) {
    const el = document.createElement("button"); el.type = "button"; el.className = "pl-sanctuary-pill"
    el.style.cssText = pillBase + (RM ? "" : "transition:opacity .25s;")
    const dot = document.createElement("span"); dot.style.cssText = "display:inline-block;width:7px;height:7px;border-radius:50%;flex:none"
    const nm = document.createElement("span"); nm.style.cssText = "display:inline-block;color:#d9fff0;max-width:9em;overflow:hidden;text-overflow:ellipsis;white-space:nowrap"
    const tm = document.createElement("span"); tm.style.cssText = "font-variant-numeric:tabular-nums;font-size:11.5px"
    el.append(dot, nm, tm)
    el.addEventListener("mouseenter", () => (nm.style.maxWidth = "none"))
    el.addEventListener("mouseleave", () => { const c = parked.find((p) => p.id === id); if (c) pillLook(c) })
    el.addEventListener("click", (e) => { e.stopPropagation(); onPick(id) })
    layer.appendChild(el)
    const ln = document.createElementNS(NS, "line"); ln.setAttribute("stroke", "#7dffc4"); ln.setAttribute("stroke-width", "1"); ln.setAttribute("opacity", ".75"); svg.appendChild(ln)
    return { el, dot, nm, tm, ln }
  }
  function fillLabel(c: Parked, car: LotCar) {
    const col = hex(LOT_TIER_COLOR[car.tier])
    c.dot.style.background = col; c.dot.style.boxShadow = `0 0 6px ${col}`
    c.nm.textContent = car.title; c.tm.textContent = car.leftLabel
    c.label.title = car.title; c.label.setAttribute("aria-label", `${car.title}, ${car.leftLabel}`)
  }
  const carLights = (c: Parked, h: number, t: number) => { c.hlM.emissiveIntensity = h; c.tlM.emissiveIntensity = t }
  function placeCar(c: Parked) {
    const s = c.slot; c.g.position.copy(P(s.rc, s.th, s.y)); c.g.rotation.set(0, -s.th, 0); c.g.visible = true; c.state = "parked"; c.setPopups(0)
  }
  function endDrive() {
    if (!drive) return
    const d = drive; drive = null; d.done()
    scene.add(spot, spot.target); spot.position.set(0, -50, 0); spot.intensity = 0
    d.c.state = "gone"; d.c.g.visible = false; d.c.setPopups(0)
  }
  function clearCars() {
    endDrive()
    parked.forEach((c) => { scene.remove(c.g); c.own.forEach((m) => m.dispose()); c.label.remove(); c.ln.remove() })
    parked = []
  }
  function buildCars(cars: LotCar[]) {
    clearCars()
    parked = cars.slice(0, SLOTS.length).map((car, i) => {
      const b = kit.build(CONCEPT_KINDS[i % CONCEPT_KINDS.length], CONCEPT_PALETTE[i % CONCEPT_PALETTE.length])
      const { el, dot, nm, tm, ln } = makeLabel(car.id)
      const c: Parked = Object.assign(b, { id: car.id, slot: SLOTS[i], state: "parked" as const, label: el, dot, nm, tm, ln })
      c.g.traverse((o) => (o.userData.sid = car.id)); scene.add(c.g); placeCar(c)
      return c
    })
  }

  /* ---------- camera rig ---------- */
  const cs: Cam = { tx: 0, ty: 3.5, tz: -1, dist: 96, el: 0.62, az: 0.5, fov: 24, carW: 0, fogK: 1 }
  let tween: { from: Cam; to: Partial<Cam>; t: number; d: number } | null = null
  let dragAz = 0, dragEl = 0, dragHome = true, carAzS = 0
  function fit(baseD: number, baseF: number, af: number, maxD: number): [number, number] { const d = Math.min(baseD * af, maxD); return [d, (2 * Math.atan((baseD * af * Math.tan((baseF * PI) / 360)) / d) * 180) / PI] }
  function zoomCfg(z: number): Partial<Cam> {
    const af = Math.max(1, 1.45 / (W / H))
    if (z === 1) return { carW: 1, dist: 10 * Math.min(1.6, af), el: 0.52, fov: 38, fogK: 1 }
    if (z === 2) { const [d, f] = fit(96, 24, af, 120); return { carW: 0, tx: 0, ty: 3.5, tz: -1, dist: d, el: 0.62, az: 0.5, fov: Math.min(f, 70), fogK: 1 } }
    if (z === 3) { const [d, f] = fit(108, 50, Math.sqrt(af), 122); return { carW: 0, tx: -4, ty: 2, tz: 2, dist: d, el: 0.42, az: 0.32, fov: Math.min(f, 75), fogK: 0.75 } }
    return { carW: 0, tx: 0, ty: -8, tz: 0, dist: 560 * af, el: 0.27, az: 0.5, fov: 34, fogK: 0 }
  }
  function setZoom(z: number, instant = false) {
    z = MU.clamp(z, 1, 4); zoom = z
    zoomBtns.forEach((b, i) => { const on = i + 1 === z; b.setAttribute("aria-pressed", String(on))
      b.style.background = on ? "rgba(125,255,196,.14)" : "transparent"; b.style.color = on ? "#7dffc4" : "#a9d8c4"; b.style.boxShadow = on ? "inset 0 0 0 1px rgba(125,255,196,.4)" : "none" })
    VEG.forEach((v) => { if (v.detail === true) v.m.visible = z <= 2; if (v.detail === false) v.m.visible = z >= 3 })
    parked.forEach(pillLook)
    const cfg = zoomCfg(z); dragEl = 0; dragHome = true
    if (RM || instant) { Object.assign(cs, cfg); dragAz = 0; tween = null }
    else tween = { from: { ...cs }, to: cfg, t: 0, d: z === 4 || cs.dist > 200 ? 2.4 : 1.6 }
  }
  const focusCar = () => drive?.c ?? parked.find((c) => c.id === selected && c.state === "parked") ?? parked.find((c) => c.state === "parked")
  const tgt = new V3(), fwd = new V3(), pv = new V3()
  function updateCamera(dt: number) {
    if (tween) { const tw = tween; tw.t += dt; const u = Math.min(1, tw.t / tw.d), e = u < 0.5 ? 4 * u * u * u : 1 - Math.pow(-2 * u + 2, 3) / 2
      ;(Object.keys(tw.to) as (keyof Cam)[]).forEach((k) => (cs[k] = tw.from[k] + ((tw.to[k] as number) - tw.from[k]) * e)); if (u >= 1) tween = null }
    if (dragHome) dragAz += (0 - dragAz) * Math.min(1, dt * 3)
    const car = focusCar()?.g, cw = car ? cs.carW : 0
    if (car) { fwd.set(0, 0, 1).applyQuaternion(car.quaternion)
      const want = Math.atan2(fwd.x, fwd.z) + 0.7; let d = want - carAzS; d = Math.atan2(Math.sin(d), Math.cos(d)); carAzS += RM ? d : d * Math.min(1, dt * 3)
      tgt.set(cs.tx, cs.ty, cs.tz).lerp(pv.set(car.position.x, car.position.y + 0.8, car.position.z), cw) } else tgt.set(cs.tx, cs.ty, cs.tz)
    const az = cs.az + Math.atan2(Math.sin(carAzS - cs.az), Math.cos(carAzS - cs.az)) * cw + dragAz
    const el = MU.clamp(cs.el + dragEl, 0.05, 1.35)
    camera.position.set(tgt.x + cs.dist * Math.sin(az) * Math.cos(el), tgt.y + cs.dist * Math.sin(el), tgt.z + cs.dist * Math.cos(az) * Math.cos(el))
    camera.lookAt(tgt); if (Math.abs(camera.fov - cs.fov) > 0.01) { camera.fov = cs.fov; camera.updateProjectionMatrix() }
    domeG.visible = camera.position.length() > 146
  }

  /* ---------- post (high quality only) ---------- */
  let composer: EffectComposer | null = null, bloom: UnrealBloomPass | null = null, outPass: OutputPass | null = null
  if (HI) {
    const rt = new THREE.WebGLRenderTarget(W, H, { type: THREE.HalfFloatType, samples: 4 })
    composer = new EffectComposer(renderer, rt)
    composer.addPass(new RenderPass(scene, camera))
    bloom = new UnrealBloomPass(new THREE.Vector2(W, H), 0.4, 0.65, 0.9); composer.addPass(bloom)
    outPass = new OutputPass(); composer.addPass(outPass)
  }
  function resize() {
    W = Math.max(1, host.clientWidth); H = Math.max(1, host.clientHeight)
    const pr = Math.min(window.devicePixelRatio || 1, HI ? 1.75 : 1)
    renderer.setPixelRatio(pr); renderer.setSize(W, H, false); camera.aspect = W / H; camera.updateProjectionMatrix()
    if (composer) { composer.setPixelRatio(pr); composer.setSize(W, H) }
    PSCALE.value = H * pr * 0.5
    svg.setAttribute("viewBox", `0 0 ${W} ${H}`)
    const cfg = zoomCfg(zoom); if (cfg.dist != null) cs.dist = cfg.dist; if (cfg.fov != null) cs.fov = cfg.fov
    if (tween) { if (cfg.dist != null) tween.to.dist = cfg.dist; if (cfg.fov != null) tween.to.fov = cfg.fov }
  }
  const ro = new ResizeObserver(resize); ro.observe(host)

  /* ---------- labels ---------- */
  function updateLabels() {
    parked.forEach((c) => {
      const el = c.label, ln = c.ln, show = c.state === "parked" && zoom <= 2
      pv.copy(c.g.position); pv.y += 1.45; pv.project(camera)
      if (!show || pv.z > 1) { el.style.opacity = "0"; el.style.pointerEvents = "none"; ln.setAttribute("visibility", "hidden"); return }
      el.style.opacity = "1"; el.style.pointerEvents = "auto"
      const x = (pv.x * 0.5 + 0.5) * W, y = (-pv.y * 0.5 + 0.5) * H
      const off = zoom === 1 ? 54 : (c.slot.k + 2) % 2 ? 76 : 40
      el.style.transform = `translate(${x}px,${y - off}px) translate(-50%,-100%)`
      el.style.zIndex = c.id === selected ? "2000" : String(Math.round(1000 - pv.z * 900))
      ln.setAttribute("visibility", "visible"); ln.setAttribute("x1", String(x)); ln.setAttribute("y1", String(y - off)); ln.setAttribute("x2", String(x)); ln.setAttribute("y2", String(y - 3))
    })
  }

  /* ---------- API ---------- */
  function select(id: string | null) {
    selected = id && parked.some((c) => c.id === id) ? id : null
    parked.forEach(pillLook)
  }
  function setCars(cars: LotCar[], selectedId: string | null) {
    const same = cars.length === parked.length && cars.every((c, i) => parked[i].id === c.id)
    if (!same) buildCars(cars)
    else if (!drive) parked.forEach((c) => c.state !== "parked" && placeCar(c))
    cars.forEach((car, i) => parked[i] && fillLabel(parked[i], car))
    select(selectedId)
  }

  /* ---------- resume: lamps up, reverse out of the bay, drive the lane and down the ramp ---------- */
  const T0 = 0.15, TA = 1.1, GAP = 0.1, TB_ = 2.6, SETTLE = 0.4
  const easeA = (u: number) => (u < 0.5 ? 2 * u * u : 1 - Math.pow(-2 * u + 2, 2) / 2), easeB = (u: number) => u * u * u
  function playResume(id: string): Promise<void> {
    const c = parked.find((p) => p.id === id)
    if (RM || !c || drive || c.state !== "parked") return Promise.resolve()
    return new Promise<void>((resolve) => {
      const b = c.slot
      const A = new THREE.CatmullRomCurve3([P(b.rc, b.th, b.y), P(b.rc + 2.2, b.th - 0.6 / b.rc, b.y), P(b.rl, b.th - 4 / b.rl, b.y)])
      const pts = [P(b.rl, b.th - 4 / b.rl, b.y)]; for (let a = b.th + 0.5 / b.rl; a < TH; a += 0.07) pts.push(P(b.rl, a, b.y))
      const a = TH + 0.02, S0 = P(b.rl, a, b.y), dir = new V3(Math.cos(a), 0, Math.sin(a)), len = Math.max(3, b.y * 4.2)
      const E = S0.clone().addScaledVector(dir, len); E.y = 0
      pts.push(S0, S0.clone().lerp(E, 0.5), E, E.clone().addScaledVector(dir, 9).add(new V3(0, 0, -3)), E.clone().addScaledVector(dir, 22).add(new V3(4, 0, -14)))
      let resolved = false
      const done = () => { if (!resolved) { resolved = true; resolve() } }
      c.state = "driving"
      carLights(c, 3, 2)
      c.g.add(spot, spot.target); spot.position.set(0, 0.8, 2.2); spot.target.position.set(0, 0, 14)
      drive = { c, A, B: new THREE.CatmullRomCurve3(pts), t: 0, prev: c.g.position.clone(), done }
      // Slow GPUs or a hidden tab stall the frame loop. Resume never waits longer than this.
      setTimeout(done, 3000)
    })
  }
  const la = new V3()
  function stepDrive(dt: number) {
    const d = drive!, g = d.c.g; d.t += dt
    d.c.setPopups(Math.min(1, d.t / 0.4))
    const roll = (dist: number) => d.c.wheels.forEach((w) => (w.rotation.x += dist / 0.32))
    const ta = d.t - T0
    if (ta < 0) return
    if (ta < TA) { const u = easeA(ta / TA), p = d.A.getPointAt(u), t = d.A.getTangentAt(u); roll(-p.distanceTo(d.prev)); d.prev.copy(p); g.position.copy(p); g.lookAt(la.copy(p).sub(t)); return }
    const tb = ta - TA - GAP; if (tb < 0) return
    const ub = Math.min(1, tb / TB_), u = easeB(ub), p = d.B.getPointAt(u), t = d.B.getTangentAt(u)
    roll(p.distanceTo(d.prev)); d.prev.copy(p); g.position.copy(p); g.lookAt(la.copy(p).add(t))
    if (ub >= SETTLE) d.done()
    if (ub >= 1) { carLights(d.c, 0, 0); endDrive() }
  }

  /* ---------- input ---------- */
  let wheelAcc = 0, wheelT = 0
  const onWheel = (e: WheelEvent) => { e.preventDefault(); const now = performance.now(); if (now - wheelT < 550) return; wheelAcc += e.deltaY
    if (Math.abs(wheelAcc) > 60) { setZoom(zoom + Math.sign(wheelAcc)); wheelAcc = 0; wheelT = now } }
  const ptrs = new Map<number, { x: number; y: number }>(); let pinch0 = 0, downAt: { x: number; y: number; t: number } | null = null
  const onDown = (e: PointerEvent) => { try { canvas.setPointerCapture(e.pointerId) } catch { /* ignore */ }
    ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY }); downAt = { x: e.clientX, y: e.clientY, t: performance.now() }
    if (ptrs.size === 2) { const [a, b] = [...ptrs.values()]; pinch0 = Math.hypot(a.x - b.x, a.y - b.y) } }
  const ray = new THREE.Raycaster(), ndc = new THREE.Vector2()
  const hitAt = (e: PointerEvent) => { const r = canvas.getBoundingClientRect()
    ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1); ray.setFromCamera(ndc, camera)
    return ray.intersectObjects(parked.filter((c) => c.state === "parked").map((c) => c.g), true)[0] }
  const onMove = (e: PointerEvent) => { const p = ptrs.get(e.pointerId)
    if (!p) { if (e.pointerType === "mouse") canvas.style.cursor = hitAt(e) ? "pointer" : "grab"; return }
    const dx = e.clientX - p.x, dy = e.clientY - p.y; p.x = e.clientX; p.y = e.clientY
    if (ptrs.size === 2) { const [a, b] = [...ptrs.values()], d = Math.hypot(a.x - b.x, a.y - b.y)
      if (pinch0 && d / pinch0 > 1.3) { setZoom(zoom - 1); pinch0 = d } else if (pinch0 && d / pinch0 < 0.75) { setZoom(zoom + 1); pinch0 = d } return }
    dragHome = false; dragAz -= dx * 0.004; dragEl = MU.clamp(dragEl + dy * 0.003, -0.5, 0.6) }
  const onUp = (e: PointerEvent) => { ptrs.delete(e.pointerId); if (ptrs.size < 2) pinch0 = 0
    if (downAt && Math.hypot(e.clientX - downAt.x, e.clientY - downAt.y) < 6 && performance.now() - downAt.t < 400) {
      const sid = hitAt(e)?.object.userData.sid
      if (typeof sid === "string") { if (zoom > 2) setZoom(2); onPick(sid) } }
    downAt = null }
  const onCancel = (e: PointerEvent) => { ptrs.delete(e.pointerId); pinch0 = 0 }
  canvas.addEventListener("wheel", onWheel, { passive: false })
  canvas.addEventListener("pointerdown", onDown); canvas.addEventListener("pointermove", onMove)
  canvas.addEventListener("pointerup", onUp); canvas.addEventListener("pointercancel", onCancel)

  /* ---------- frame ---------- */
  const wp = new V3()
  let last = performance.now(), clockT = 0, mistT = 0, glowShown = -1, raf = 0
  function frame(now: number) {
    raf = requestAnimationFrame(frame)
    const dt = Math.min(0.05, (now - last) / 1000); last = now
    if (document.hidden) return
    clockT += dt
    const tod = nowHours(), ph = phase(tod)
    U.time.value = RM ? clockT * 0.25 : clockT
    U.top.value.setHex(ph.top, LIN); U.hor.value.setHex(ph.hor, LIN); U.sunC.value.setHex(ph.light, LIN)
    U.glow.value = ph.glow; U.stars.value = MU.clamp(ph.glow * 1.1 - 0.05, 0, 1); U.mist.value = ph.mist
    const sd = U.sunDir.value, md = U.moonDir.value, w = MU.smoothstep(sd.y, -0.12, 0.04)
    wp.copy(md).lerp(sd, w); wp.y = Math.max(wp.y, 0.12); wp.normalize()
    sun.position.copy(sun.target.position).addScaledVector(wp, 120); sun.color.setHex(ph.light, LIN); sun.intensity = ph.lightI * PI
    hemi.color.setHex(ph.hs, LIN); hemi.groundColor.setHex(ph.hg, LIN); hemi.intensity = ph.hi * PI
    fog.color.setHex(ph.fog, LIN); fog.density = ph.fogD * cs.fogK
    renderer.toneMappingExposure = ph.exp
    if (bloom) bloom.strength = ph.bloom
    M.bulb.color.setScalar(0.25 + ph.glow * 2.4); M.leaf.emissive.setHex(0x0a3a2a, LIN).multiplyScalar(ph.glow * 0.5)
    if (Math.abs(ph.glow - glowShown) > 0.01) { glowShown = ph.glow; layer.style.setProperty("--pl-glow", ph.glow.toFixed(2)) }
    envT += dt; if (envT > 1.2) { envT = 0; updateEnv(tod, false) }
    parked.forEach((c) => { if (c.state === "parked") carLights(c, ph.glow * 0.5, 0.15 + ph.glow * 0.35) })
    spot.intensity = drive ? (ph.glow * 4 + 0.3) * PI : 0
    if (drive) { stepDrive(dt); if (drive) { drive.c.exO.getWorldPosition(wp); for (let k = 0; k < 2; k++) spawn(EXH, wp.x, wp.y, wp.z, rnd(-0.3, 0.3), rnd(0.3, 0.8), rnd(-0.3, 0.3), rnd(1.2, 2), rnd(0.25, 0.45)) } }
    EXH.base = 0.55; stepP(EXH, dt, 0.7)
    mistT += dt; if (mistT > 0.05 && !RM) { mistT = 0; const f = pick(FALLS), o = rnd(-0.5, 0.5) * f.w; spawn(MIST, f.x + Math.cos(f.yaw) * o, f.y + 0.3, f.z - Math.sin(f.yaw) * o, rnd(-0.5, 0.5), rnd(0.4, 1.1), rnd(-0.5, 0.5), rnd(2, 3.5), f.w > 3 ? rnd(2.5, 4) : rnd(0.6, 1)) }
    MIST.base = 0.35 + ph.mist * 0.2; stepP(MIST, dt, 0.6)
    for (let i = 0; i < FLY.n; i++) { const { p: b, s } = flyBase[i], tt = U.time.value * 0.3 + s
      FLY.pos.set([b.x + Math.sin(tt * 1.3) * 1.5, b.y + Math.sin(tt * 0.9 + s) * 0.6, b.z + Math.cos(tt * 1.1) * 1.5], i * 3); FLY.al[i] = ph.glow * (0.35 + 0.65 * Math.max(0, Math.sin(tt * 2.1 + s * 3))) }
    dirty(FLY)
    const sc = parked.find((c) => c.id === selected)
    selRing.visible = !!sc && sc.state === "parked" && zoom <= 2
    if (sc && selRing.visible) { selRing.position.copy(sc.g.position); selRing.position.y += 0.03; selRing.rotation.z = sc.slot.th }
    updateCamera(dt); updateLabels()
    if (composer) composer.render(dt); else renderer.render(scene, camera)
  }

  /* ---------- boot ---------- */
  phase(nowHours())
  resize()
  setZoom(2, true)
  updateEnv(nowHours(), true)
  raf = requestAnimationFrame(frame)

  function dispose() {
    drive?.done()
    cancelAnimationFrame(raf); ro.disconnect()
    clearCars()
    canvas.removeEventListener("wheel", onWheel); canvas.removeEventListener("pointerdown", onDown); canvas.removeEventListener("pointermove", onMove)
    canvas.removeEventListener("pointerup", onUp); canvas.removeEventListener("pointercancel", onCancel)
    const geos = new Set<THREE.BufferGeometry>(), mats = new Set<THREE.Material>(), texs = new Set<THREE.Texture>()
    scene.traverse((o) => {
      const m = o as THREE.Mesh
      if (m.geometry) geos.add(m.geometry)
      const ms = m.material ? (Array.isArray(m.material) ? m.material : [m.material]) : []
      ms.forEach((x) => { mats.add(x); const r = x as THREE.MeshStandardMaterial
        ;[r.map, r.bumpMap, r.emissiveMap, r.normalMap, r.roughnessMap].forEach((t) => t && texs.add(t)) })
    })
    VEG.forEach((v) => v.m.dispose())
    geos.forEach((x) => x.dispose()); mats.forEach((x) => x.dispose()); texs.forEach((x) => x.dispose())
    envSkyG.dispose(); envGndG.dispose(); envGndM.dispose(); envRT?.dispose(); pmrem.dispose()
    bloom?.dispose(); outPass?.dispose(); composer?.dispose()
    sun.shadow.map?.dispose(); kit.dispose()
    scene.environment = null
    renderer.dispose()
    canvas.remove(); svg.remove(); layer.remove(); zoomBar.remove()
  }

  return { setCars, select, playResume, dispose }
}
