/**
 * components/Home/ToDo/parking-lot/scene-well.ts — "Scrying well" parking lot
 *
 * Port of parking-lot-mockups/2-scrying-well.html. Parked sessions are
 * crystals floating over a black-mirror pool inside a chrome rim. The picked
 * crystal rises and the rest dim; resume lifts the crystal up and out while
 * the water calms. Small DOM labels (title + time left) ride above each crystal.
 */
import * as THREE from "three"
import { LOT_TIER_COLOR, type LotCar, type MountLot } from "./types"

const MAX = 12
const R = 3
const BASE_Y = 0.46
const UP_Y = 0.8
const ARC_S = 2.2

type Crystal = {
  car: LotCar
  g: THREE.Group
  m: THREE.Mesh<THREE.OctahedronGeometry, THREE.MeshStandardMaterial>
  sp: THREE.Sprite
  hit: THREE.Mesh<THREE.SphereGeometry, THREE.MeshBasicMaterial>
  pl: THREE.PointLight
  rg: THREE.Group
  rm: THREE.Mesh<THREE.OctahedronGeometry, THREE.MeshStandardMaterial>
  rs: THREE.Sprite
  label: HTMLDivElement
  y: number
  gone: boolean
  arc: { t0: number; from: THREE.Vector3; dir: THREE.Vector3 } | null
}

const labelColor = (c: LotCar) =>
  c.tier === "exceptional" ? "#b38cff" : `#${LOT_TIER_COLOR[c.tier].toString(16).padStart(6, "0")}`

/** Sunflower spread inside the pool; one crystal sits in the middle. */
function layout(n: number): [number, number][] {
  if (n === 1) return [[0, 0.2]]
  const rMax = n <= 3 ? 1.5 : n <= 6 ? 1.9 : 2.25
  return Array.from({ length: n }, (_, i) => {
    const r = rMax * Math.sqrt((i + 0.6) / n)
    const a = i * 2.39996 + 0.7
    return [r * Math.cos(a), r * Math.sin(a)]
  })
}

export const mount: MountLot = (host, { onPick, reducedMotion: RM }) => {
  const renderer = new THREE.WebGLRenderer({ antialias: true })
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2))
  const canvas = renderer.domElement
  canvas.style.display = "block"
  canvas.style.width = "100%"
  canvas.style.height = "100%"
  canvas.style.touchAction = "manipulation"
  host.appendChild(canvas)

  const scene = new THREE.Scene()
  scene.background = new THREE.Color(0x030605)
  scene.fog = new THREE.Fog(0x030605, 9, 16)
  const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 50)

  // studio-strip env map so the chrome reads as chrome
  const ec = document.createElement("canvas")
  ec.width = 512
  ec.height = 256
  {
    const g = ec.getContext("2d")
    if (g) {
      const gr = g.createLinearGradient(0, 0, 0, 256)
      gr.addColorStop(0, "#2a2f33")
      gr.addColorStop(0.42, "#d9dee2")
      gr.addColorStop(0.5, "#ffffff")
      gr.addColorStop(0.56, "#3a4044")
      gr.addColorStop(1, "#050707")
      g.fillStyle = gr
      g.fillRect(0, 0, 512, 256)
      g.fillStyle = "rgba(255,255,255,.85)"
      g.fillRect(60, 40, 90, 14)
      g.fillRect(300, 30, 140, 10)
      g.fillStyle = "rgba(125,255,196,.25)"
      g.fillRect(0, 150, 512, 6)
    }
  }
  const envTex = new THREE.CanvasTexture(ec)
  envTex.mapping = THREE.EquirectangularReflectionMapping
  envTex.colorSpace = THREE.SRGBColorSpace
  const pmrem = new THREE.PMREMGenerator(renderer)
  const envRT = pmrem.fromEquirectangular(envTex)
  scene.environment = envRT.texture

  scene.add(new THREE.HemisphereLight(0xcfe8ff, 0x000000, 0.35 * Math.PI))
  const key = new THREE.DirectionalLight(0xffffff, 0.9 * Math.PI)
  key.position.set(-3, 8, 4)
  scene.add(key)

  const statics: { dispose: () => void }[] = []
  const chromeMat = new THREE.MeshStandardMaterial({ color: 0xd8dcdf, metalness: 1, roughness: 0.18 })
  const lipMat = new THREE.MeshStandardMaterial({ color: 0x5c6064, metalness: 1, roughness: 0.35 })
  const floorMat = new THREE.MeshBasicMaterial({ color: 0x000000 })
  const rimGeo = new THREE.TorusGeometry(R + 0.14, 0.17, 40, 160)
  const lipGeo = new THREE.TorusGeometry(R + 0.02, 0.035, 16, 160)
  const wallGeo = new THREE.CylinderGeometry(R + 0.3, R - 0.1, 0.9, 160, 1, true)
  const floorGeo = new THREE.CircleGeometry(R + 0.4, 64)
  const waterGeo = new THREE.CircleGeometry(R, 128)
  statics.push(chromeMat, lipMat, floorMat, rimGeo, lipGeo, wallGeo, floorGeo, waterGeo)

  const rim = new THREE.Mesh(rimGeo, chromeMat)
  rim.rotation.x = -Math.PI / 2
  rim.position.y = 0.04
  const lip = new THREE.Mesh(lipGeo, lipMat)
  lip.rotation.x = -Math.PI / 2
  lip.position.y = 0.06
  const wall = new THREE.Mesh(wallGeo, chromeMat)
  wall.position.y = -0.42
  const floor = new THREE.Mesh(floorGeo, floorMat)
  floor.rotation.x = -Math.PI / 2
  floor.position.y = -2.4
  scene.add(rim, lip, wall, floor)

  // black-mirror water: ripples + crystal glow pools in a shader
  const rip = [0, 1, 2, 3].map(() => new THREE.Vector4(0, 0, -99, 0))
  const glowPos = Array.from({ length: MAX }, () => new THREE.Vector3())
  const glowCol = Array.from({ length: MAX }, () => new THREE.Color(0))
  const waterU = {
    uT: { value: 0 },
    uRip: { value: rip },
    uCalm: { value: 1 },
    uGP: { value: glowPos },
    uGC: { value: glowCol },
    uR: { value: R },
  }
  const waterMat = new THREE.ShaderMaterial({
    uniforms: waterU,
    transparent: true,
    depthWrite: false,
    vertexShader: `varying vec2 vP; void main(){ vec4 w = modelMatrix*vec4(position,1.); vP = w.xz; gl_Position = projectionMatrix*viewMatrix*w; }`,
    fragmentShader: `
      uniform float uT, uCalm, uR; uniform vec4 uRip[4]; uniform vec3 uGP[${MAX}]; uniform vec3 uGC[${MAX}]; varying vec2 vP;
      void main(){
        float r = length(vP)/uR;
        vec3 c = mix(vec3(.010,.022,.018), vec3(.0), r*r);
        c += vec3(.55,.65,.68) * .05 * smoothstep(.15,.95,r) * smoothstep(.2,-1.,vP.y/uR);
        float h = 0.;
        for(int i=0;i<4;i++){
          float a = uT - uRip[i].z; if(a < 0. || a > 9.) continue;
          float d = distance(vP, uRip[i].xy), f = d - a*.32;
          h += sin(f*26.) * exp(-abs(f)*5.) * exp(-a*.42) * uRip[i].w;
        }
        h *= uCalm;
        for(int i=0;i<${MAX};i++){
          if(uGP[i].y <= 0.) continue;
          float d = distance(vP, uGP[i].xz);
          c += uGC[i] * uGP[i].y * (.16*exp(-d*d*4.) + .05*exp(-d*1.6)) * (1. + h*1.5);
        }
        c += vec3(.75,.95,.88) * .12 * max(h,0.);
        c += vec3(.8) * .35 * smoothstep(.985,1.,r);
        gl_FragColor = vec4(c, .88);
      }`,
  })
  statics.push(waterMat)
  const water = new THREE.Mesh(waterGeo, waterMat)
  water.rotation.x = -Math.PI / 2
  water.renderOrder = 2
  scene.add(water)

  // shared crystal pieces
  const gc = document.createElement("canvas")
  gc.width = gc.height = 128
  {
    const g = gc.getContext("2d")
    if (g) {
      const gr = g.createRadialGradient(64, 64, 0, 64, 64, 64)
      gr.addColorStop(0, "rgba(255,255,255,1)")
      gr.addColorStop(0.25, "rgba(255,255,255,.35)")
      gr.addColorStop(1, "rgba(255,255,255,0)")
      g.fillStyle = gr
      g.fillRect(0, 0, 128, 128)
    }
  }
  const glowTex = new THREE.CanvasTexture(gc)
  glowTex.colorSpace = THREE.SRGBColorSpace
  const geo = new THREE.OctahedronGeometry(0.3, 0)
  geo.scale(0.75, 1.5, 0.75)
  const hitGeo = new THREE.SphereGeometry(0.55, 12, 8)
  statics.push(glowTex, geo, hitGeo, envTex, envRT, pmrem)

  let crystals: Crystal[] = []
  let selId: string | null = null
  let setKey = ""
  let now = 0
  let ripN = 0
  const pending = new Set<() => void>()
  const timers = new Set<number>()

  const ripple = (x: number, z: number, w: number) => {
    if (RM) return
    rip[ripN++ % 4].set(x, z, now, w)
  }

  function makeLabel(c: LotCar): HTMLDivElement {
    const el = document.createElement("div")
    el.className = "pl-well-label"
    Object.assign(el.style, {
      position: "absolute",
      left: "0",
      top: "0",
      pointerEvents: "auto",
      cursor: "pointer",
      textAlign: "center",
      whiteSpace: "nowrap",
      fontFamily: "inherit",
      lineHeight: "1.15",
      textShadow: "0 0 6px rgba(0,0,0,.9), 0 0 2px #000",
      userSelect: "none",
      transition: "opacity .4s ease",
      willChange: "transform",
    } satisfies Partial<CSSStyleDeclaration>)
    const t = document.createElement("div")
    t.className = "pl-well-title"
    Object.assign(t.style, { fontSize: "12px", maxWidth: "130px", overflow: "hidden", textOverflow: "ellipsis" })
    const l = document.createElement("div")
    l.className = "pl-well-left"
    Object.assign(l.style, { fontSize: "11px", opacity: "0.7" })
    el.append(t, l)
    el.setAttribute("role", "button")
    el.tabIndex = 0
    el.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault()
        onPick(el.dataset.id ?? "")
      }
    })
    el.addEventListener("click", (e) => {
      e.stopPropagation()
      onPick(el.dataset.id ?? "")
    })
    fillLabel(el, c)
    host.appendChild(el)
    return el
  }
  function fillLabel(el: HTMLDivElement, c: LotCar) {
    el.dataset.id = c.id
    el.style.color = labelColor(c)
    const [t, l] = el.children as unknown as [HTMLDivElement, HTMLDivElement]
    t.textContent = c.title
    l.textContent = c.leftLabel
  }

  function disposeCrystal(c: Crystal) {
    scene.remove(c.g, c.rg)
    c.m.material.dispose()
    c.rm.material.dispose()
    c.sp.material.dispose()
    c.rs.material.dispose()
    c.hit.material.dispose()
    c.pl.dispose()
    c.label.remove()
  }

  function build(cars: LotCar[]) {
    crystals.forEach(disposeCrystal)
    const list = cars.slice(0, MAX)
    const pos = layout(list.length)
    const s = list.length > 7 ? 0.82 : 1
    crystals = list.map((car, i) => {
      const col = LOT_TIER_COLOR[car.tier]
      const mat = new THREE.MeshStandardMaterial({
        color: col,
        emissive: col,
        emissiveIntensity: 0.55,
        metalness: 0.2,
        roughness: 0.12,
        flatShading: true,
        transparent: true,
        opacity: 0.92,
      })
      const g = new THREE.Group()
      const m = new THREE.Mesh(geo, mat)
      m.rotation.y = i * 0.9
      const sp = new THREE.Sprite(
        new THREE.SpriteMaterial({ map: glowTex, color: col, blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0.55 }),
      )
      sp.scale.set(1.3, 1.3, 1)
      const hit = new THREE.Mesh(hitGeo, new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false }))
      hit.userData.id = car.id
      const pl = new THREE.PointLight(col, 0.5 * Math.PI, 3.2, 0)
      g.add(m, sp, hit, pl)
      g.scale.setScalar(s)
      const rg = new THREE.Group()
      const rmat = mat.clone()
      rmat.emissiveIntensity = 0.3
      rmat.opacity = 0.32
      const rm = new THREE.Mesh(geo, rmat)
      rm.rotation.y = m.rotation.y
      rm.scale.y = -1
      const rs = new THREE.Sprite(sp.material.clone())
      rs.scale.copy(sp.scale)
      rs.material.opacity = 0.18
      rg.add(rm, rs)
      rg.scale.setScalar(s)
      g.position.set(pos[i][0], BASE_Y, pos[i][1])
      scene.add(g, rg)
      glowCol[i].setHex(col)
      return { car, g, m, sp, hit, pl, rg, rm, rs, label: makeLabel(car), y: BASE_Y, gone: false, arc: null }
    })
    for (let i = crystals.length; i < MAX; i++) glowPos[i].set(0, 0, 0)
    waterU.uCalm.value = 1
  }

  /* ---------- picking ---------- */
  const ray = new THREE.Raycaster()
  const mp = new THREE.Vector2()
  function hitAt(e: PointerEvent | MouseEvent): string | null {
    const r = canvas.getBoundingClientRect()
    if (!r.width || !r.height) return null
    mp.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1)
    ray.setFromCamera(mp, camera)
    const h = ray.intersectObjects(crystals.filter((c) => !c.gone && !c.arc).map((c) => c.hit))[0]
    return h ? (h.object.userData.id as string) : null
  }
  const onMove = (e: PointerEvent) => {
    canvas.style.cursor = hitAt(e) ? "pointer" : "default"
  }
  const onClick = (e: MouseEvent) => {
    const id = hitAt(e)
    if (id) onPick(id)
  }
  canvas.addEventListener("pointermove", onMove)
  canvas.addEventListener("click", onClick)

  /* ---------- sizing ---------- */
  let W = 1
  let H = 1
  function resize() {
    const w = host.clientWidth
    const h = host.clientHeight
    if (!w || !h) return
    W = w
    H = h
    renderer.setSize(w, h, false)
    camera.aspect = w / h
    const k = Math.max(1, 1.25 / camera.aspect)
    camera.position.set(0, 6.4 * k, 6.0 * k)
    camera.lookAt(0, -0.35, 0)
    camera.updateProjectionMatrix()
  }
  const ro = new ResizeObserver(resize)
  ro.observe(host)
  resize()

  /* ---------- loop ---------- */
  const ease = (t: number) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2)
  const v = new THREE.Vector3()
  let raf = 0
  let last = performance.now()
  let alive = true

  function frame(t: number) {
    raf = 0
    if (!alive || document.hidden) return
    const dt = Math.min(0.05, (t - last) / 1000)
    last = t
    now += dt
    waterU.uT.value = now
    const resuming = crystals.some((c) => c.arc || c.gone)
    if (resuming) waterU.uCalm.value += (0 - waterU.uCalm.value) * (RM ? 1 : 1 - Math.exp(-dt * 0.9))
    const selIdx = crystals.findIndex((c) => c.car.id === selId)
    crystals.forEach((c, i) => {
      if (c.gone) {
        c.g.visible = c.rg.visible = false
        c.label.style.display = "none"
        glowPos[i].y = 0
        return
      }
      let glow = 1
      if (c.arc) {
        const k = RM ? 1 : Math.min(1, (now - c.arc.t0) / ARC_S)
        const e = ease(k)
        c.g.position.set(
          c.arc.from.x + c.arc.dir.x * 1.2 * e,
          c.arc.from.y + 6.5 * e * e + 0.6 * Math.sin(e * Math.PI),
          c.arc.from.z + 2.2 * e,
        )
        glow = 1 - e
        if (k >= 1) c.gone = true
      } else {
        c.y += ((i === selIdx ? UP_Y : BASE_Y) - c.y) * (RM ? 1 : 1 - Math.exp(-dt * 1.6))
        c.g.position.y = c.y
      }
      const dim = selIdx >= 0 && selIdx !== i ? 0.45 : 1
      c.m.material.emissiveIntensity = 0.35 + 0.35 * dim
      c.sp.material.opacity = 0.5 * dim
      c.pl.intensity = 0.5 * Math.PI * dim * glow
      c.rg.position.set(c.g.position.x, -c.g.position.y, c.g.position.z)
      const near = Math.max(0, 1 - (c.g.position.y - BASE_Y) / 2.5)
      c.rm.material.opacity = 0.32 * near * dim
      c.rs.material.opacity = 0.18 * near * dim
      glowPos[i].set(c.g.position.x, dim * glow * near, c.g.position.z)

      // label rides just above the crystal
      v.set(c.g.position.x, c.g.position.y + 0.62 * c.g.scale.y, c.g.position.z).project(camera)
      const lb = c.label
      lb.style.display = v.z > 1 ? "none" : "block"
      lb.style.transform = `translate(${((v.x + 1) / 2) * W}px, ${((1 - v.y) / 2) * H}px) translate(-50%, -100%)`
      lb.style.opacity = String((c.arc ? Math.max(0, 1 - (1 - glow) * 3) : 1) * (dim < 1 ? 0.45 : 1))
    })
    renderer.render(scene, camera)
    raf = requestAnimationFrame(frame)
  }
  const start = () => {
    if (raf || !alive || document.hidden) return
    last = performance.now()
    raf = requestAnimationFrame(frame)
  }
  const onVis = () => start()
  document.addEventListener("visibilitychange", onVis)
  start()

  /* ---------- scene API ---------- */
  function select(id: string | null) {
    const changed = id !== selId
    selId = id
    if (changed && id) {
      const c = crystals.find((x) => x.car.id === id)
      if (c) ripple(c.g.position.x, c.g.position.z, 1)
    }
  }

  return {
    setCars(cars, selectedId) {
      const k = cars.slice(0, MAX).map((c) => `${c.id}:${c.tier}`).join("|")
      if (k === setKey && crystals.length) {
        cars.slice(0, MAX).forEach((car, i) => {
          crystals[i].car = car
          fillLabel(crystals[i].label, car)
        })
      } else {
        setKey = k
        build(cars)
      }
      select(selectedId)
    },
    select,
    playResume(id) {
      const c = crystals.find((x) => x.car.id === id)
      if (!c || c.gone) return Promise.resolve()
      if (RM) {
        c.gone = true
        return Promise.resolve()
      }
      ripple(c.g.position.x, c.g.position.z, 0.7)
      const p = c.g.position
      c.arc = { t0: now, from: p.clone(), dir: new THREE.Vector3(p.x, 0, p.z).normalize() }
      return new Promise<void>((resolve) => {
        const done = () => {
          pending.delete(done)
          timers.delete(timer)
          c.gone = true
          resolve()
        }
        const timer = window.setTimeout(done, ARC_S * 1000 + 100)
        timers.add(timer)
        pending.add(done)
      })
    },
    dispose() {
      alive = false
      if (raf) cancelAnimationFrame(raf)
      document.removeEventListener("visibilitychange", onVis)
      canvas.removeEventListener("pointermove", onMove)
      canvas.removeEventListener("click", onClick)
      ro.disconnect()
      timers.forEach((t) => clearTimeout(t))
      ;[...pending].forEach((fn) => fn())
      crystals.forEach(disposeCrystal)
      crystals = []
      statics.forEach((s) => s.dispose())
      renderer.dispose()
      canvas.remove()
    },
  }
}
