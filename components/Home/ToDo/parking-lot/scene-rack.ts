/**
 * components/Home/ToDo/parking-lot/scene-rack.ts — "Cartridge rack" parking lot
 *
 * Ported from parking-lot-mockups/1-cartridge-rack.html. Each parked session is a
 * cartridge seated in a silver rack. The selected one rises out of its bay; resume
 * clicks it home and the power lamp comes on. Cartridge labels are canvas textures.
 */
import * as THREE from "three"
import { LOT_TIER_COLOR, type LotCar, type MountLot } from "./types"

const FONT = '"w95fa", monospace'
const HOME = -0.55
const OUT = 0.5
const PITCH_X = 3
const PITCH_Y = 4.4
const MAX_COLS = 6
const PRESS_MS = 420
const RESUME_MS = 1300

type Cart = {
  id: string
  mesh: THREE.Mesh
  face: THREE.MeshStandardMaterial
  label: THREE.CanvasTexture
  plate: THREE.CanvasTexture
  lamp: THREE.MeshBasicMaterial
  glow: THREE.PointLight
  car: LotCar
  press: boolean
}

const hex = (n: number) => "#" + n.toString(16).padStart(6, "0")
const stripe = (car: LotCar) => (car.tier === "exceptional" ? "#7d6bb8" : hex(LOT_TIER_COLOR[car.tier]))

function makeTex(w: number, h: number, draw: (g: CanvasRenderingContext2D, w: number, h: number) => void) {
  const c = document.createElement("canvas")
  c.width = w
  c.height = h
  const g = c.getContext("2d")
  if (g) {
    g.imageSmoothingEnabled = false
    draw(g, w, h)
  }
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  t.anisotropy = 4
  return t
}

function redraw(t: THREE.CanvasTexture, draw: (g: CanvasRenderingContext2D, w: number, h: number) => void) {
  const c = t.image as HTMLCanvasElement
  const g = c.getContext("2d")
  if (!g) return
  g.clearRect(0, 0, c.width, c.height)
  draw(g, c.width, c.height)
  t.needsUpdate = true
}

function clip(g: CanvasRenderingContext2D, s: string, max: number) {
  if (g.measureText(s).width <= max) return s
  let out = s
  while (out.length > 1 && g.measureText(out + "…").width > max) out = out.slice(0, -1)
  return out + "…"
}

function drawLabel(car: LotCar) {
  return (g: CanvasRenderingContext2D, w: number, h: number) => {
    g.fillStyle = "#2a2d31"
    g.fillRect(0, 0, w, h)
    g.fillStyle = "#e9ebed"
    g.fillRect(18, 18, w - 36, h - 120)
    g.fillStyle = stripe(car)
    g.fillRect(18, 18, w - 36, 16)
    g.fillStyle = "#1c1f22"
    g.font = `44px ${FONT}`
    const words = car.title.toUpperCase().split(/\s+/).filter(Boolean)
    const lines: string[] = []
    let cur = ""
    for (const wd of words) {
      const next = cur ? cur + " " + wd : wd
      if (cur && g.measureText(next).width > w - 64) {
        lines.push(cur)
        cur = wd
      } else cur = next
    }
    if (cur) lines.push(cur)
    if (lines.length > 3) lines.splice(3, lines.length - 3, lines[2] + " " + lines.slice(3).join(" "))
    let y = 86
    for (const ln of lines) {
      g.fillText(clip(g, ln, w - 64), 32, y)
      y += 40
    }
    g.font = `30px ${FONT}`
    g.fillStyle = "#3a3e42"
    g.fillText(clip(g, car.leftLabel.toUpperCase(), w - 64), 32, h - 118)
    g.fillStyle = "#1d2023"
    for (let k = 0; k < 6; k++) g.fillRect(40 + k * 30, h - 62, 18, 40)
  }
}

function drawPlate(car: LotCar) {
  return (g: CanvasRenderingContext2D, w: number, h: number) => {
    g.fillStyle = "#040a08"
    g.fillRect(0, 0, w, h)
    g.fillStyle = "#7dffc4"
    g.font = `34px ${FONT}`
    g.textAlign = "center"
    g.fillText(clip(g, car.title.toUpperCase(), w - 16), w / 2, 34)
  }
}

export const mount: MountLot = (host, { onPick, reducedMotion }) => {
  const RM = reducedMotion
  const canvas = document.createElement("canvas")
  canvas.style.cssText = "display:block;width:100%;height:100%;cursor:pointer;touch-action:manipulation"
  host.appendChild(canvas)

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true })
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2))
  const scene = new THREE.Scene()
  scene.background = new THREE.Color(0x0b0d0e)
  const cam = new THREE.PerspectiveCamera(30, 1, 0.1, 200)
  const hemi = new THREE.HemisphereLight(0xffffff, 0x40464c, 0.85 * Math.PI)
  const key = new THREE.DirectionalLight(0xffffff, 0.75 * Math.PI)
  key.position.set(-3, 6, 8)
  scene.add(hemi, key)

  // Shared materials (live for the whole mount).
  const brushed = makeTex(512, 256, (g, w, h) => {
    const gr = g.createLinearGradient(0, 0, 0, h)
    gr.addColorStop(0, "#dfe2e5")
    gr.addColorStop(1, "#b3b7bb")
    g.fillStyle = gr
    g.fillRect(0, 0, w, h)
    for (let y = 0; y < h; y++) {
      g.fillStyle = y % 2 ? "rgba(255,255,255,.22)" : "rgba(70,75,80,.07)"
      g.fillRect(0, y, w, 1)
    }
  })
  const pwrTex = makeTex(96, 32, (g, w, h) => {
    g.fillStyle = "#c5c9cd"
    g.fillRect(0, 0, w, h)
    g.fillStyle = "#3a3e42"
    g.font = `24px ${FONT}`
    g.textAlign = "center"
    g.fillText("PWR", w / 2, 24)
  })
  const silver = new THREE.MeshStandardMaterial({ map: brushed, metalness: 0.35, roughness: 0.45 })
  const chrome = new THREE.MeshStandardMaterial({ color: 0xe8ebee, metalness: 0.6, roughness: 0.18 })
  const mirror = new THREE.MeshStandardMaterial({ color: 0x040a08, metalness: 0.4, roughness: 0.08 })
  const white = new THREE.MeshBasicMaterial({ color: 0xffffff })
  const vent = new THREE.MeshBasicMaterial({ color: 0x8b9095 })
  const body = new THREE.MeshStandardMaterial({ color: 0x2a2d31, roughness: 0.55, metalness: 0.1 })
  const stroke = new THREE.LineBasicMaterial({ color: 0x5c6064 })
  const pwrMat = new THREE.MeshBasicMaterial({ color: 0x2b3a33 })
  const pwrLabelMat = new THREE.MeshBasicMaterial({ map: pwrTex })
  const shared: { dispose: () => void }[] = [brushed, pwrTex, silver, chrome, mirror, white, vent, body, stroke, pwrMat, pwrLabelMat]

  // Per-build state.
  let rack = new THREE.Group()
  scene.add(rack)
  let built: { dispose: () => void }[] = []
  let carts: Cart[] = []
  let idKey = ""
  let sel: string | null = null
  let running: string | null = null
  let pwrOn = 0
  let pwrTarget = 0
  let view = { halfW: 5, top: 1.3, bottom: -2.7 }

  const geo = <G extends THREE.BufferGeometry>(g: G) => (built.push(g), g)
  function box(w: number, h: number, d: number, m: THREE.Material, x: number, y: number, z: number, edge = false) {
    const o = new THREE.Mesh(geo(new THREE.BoxGeometry(w, h, d)), m)
    o.position.set(x, y, z)
    if (edge) o.add(new THREE.LineSegments(geo(new THREE.EdgesGeometry(o.geometry)), stroke))
    rack.add(o)
    return o
  }

  function clear() {
    scene.remove(rack)
    for (const d of built) d.dispose()
    built = []
    carts = []
    rack = new THREE.Group()
    scene.add(rack)
  }

  function build(cars: LotCar[]) {
    clear()
    const n = cars.length
    const rows = Math.max(1, Math.ceil(n / MAX_COLS))
    const cols = n <= 3 ? 3 : Math.ceil(n / rows)
    const halfW = cols * 1.5 + 0.4
    view = { halfW, top: 1.3, bottom: -2.7 - (rows - 1) * PITCH_Y }

    for (let r = 0; r < rows; r++) {
      const by = -r * PITCH_Y
      box(halfW * 2, 2.7, 0.7, silver, 0, by - 1.35, 0, true)
      box(halfW * 2, 0.035, 0.7, white, 0, by + 0.02, 0)
      for (let k = 0; k < 5; k++) box(halfW * 2 - 0.6, 0.012, 0.01, vent, 0, by - 1.25 - k * 0.22, 0.355)
      for (let c = 0; c < cols; c++) {
        const x = (c - (cols - 1) / 2) * PITCH_X
        box(2.5, 0.12, 0.62, chrome, x, by + 0.07, 0, true)
        box(2.2, 0.13, 0.34, mirror, x, by + 0.075, 0)
      }
    }

    cars.forEach((car, i) => {
      const r = Math.floor(i / cols)
      const x = ((i % cols) - (cols - 1) / 2) * PITCH_X
      const by = -r * PITCH_Y
      const label = makeTex(256, 320, drawLabel(car))
      const face = new THREE.MeshStandardMaterial({ map: label, emissiveMap: label, emissive: 0xffffff, emissiveIntensity: 0, roughness: 0.5 })
      const mesh = new THREE.Mesh(geo(new THREE.BoxGeometry(2, 2.5, 0.24)), [body, body, body, body, face, body])
      mesh.position.set(x, by + HOME, 0)
      mesh.userData = { id: car.id, base: by }
      rack.add(mesh)
      const col = new THREE.Color(LOT_TIER_COLOR[car.tier])
      const lamp = new THREE.MeshBasicMaterial({ color: col })
      const lampMesh = new THREE.Mesh(geo(new THREE.SphereGeometry(0.075, 16, 12)), lamp)
      lampMesh.position.set(x - 1.05, by - 0.42, 0.36)
      const plate = makeTex(256, 48, drawPlate(car))
      const plateMat = new THREE.MeshBasicMaterial({ map: plate })
      const pl = new THREE.Mesh(geo(new THREE.PlaneGeometry(1.9, 0.36)), plateMat)
      pl.position.set(x + 0.1, by - 0.42, 0.351)
      pl.userData = { id: car.id }
      const glow = new THREE.PointLight(col, 0, 3.2, 1)
      glow.position.set(x, by + 0.9, 1.1)
      rack.add(lampMesh, pl, glow)
      built.push(label, face, lamp, plate, plateMat, { dispose: () => glow.dispose() })
      carts.push({ id: car.id, mesh, face, label, plate, lamp, glow, car, press: false })
    })

    // Power lamp on the top row's right end.
    const px = halfW - 0.45
    box(0.36, 0.36, 0.06, chrome, px, -0.42, 0.36, true)
    const pwr = new THREE.Mesh(geo(new THREE.SphereGeometry(0.09, 16, 12)), pwrMat)
    pwr.position.set(px, -0.42, 0.41)
    const pt = new THREE.Mesh(geo(new THREE.PlaneGeometry(0.6, 0.2)), pwrLabelMat)
    pt.position.set(px, -0.78, 0.351)
    rack.add(pwr, pt)
    fit()
  }

  function fit() {
    const w = host.clientWidth || 1
    const h = host.clientHeight || 1
    renderer.setSize(w, h, false)
    cam.aspect = w / h
    const t = Math.tan((15 * Math.PI) / 180)
    const cy = (view.top + view.bottom) / 2 + 0.45
    const hh = (view.top - view.bottom) / 2 + 0.4
    const d = Math.max(12, (view.halfW + 0.7) / (t * cam.aspect), hh / t)
    cam.position.set(0, cy + 1.85, d)
    cam.lookAt(0, cy, 0)
    cam.updateProjectionMatrix()
  }
  const ro = new ResizeObserver(fit)
  ro.observe(host)

  // Picking.
  const ray = new THREE.Raycaster()
  const ptr = new THREE.Vector2()
  function onDown(e: PointerEvent) {
    if (running) return
    const r = canvas.getBoundingClientRect()
    ptr.set(((e.clientX - r.left) / r.width) * 2 - 1, (-(e.clientY - r.top) / r.height) * 2 + 1)
    ray.setFromCamera(ptr, cam)
    const hit = ray.intersectObjects(rack.children, false).find((h) => typeof h.object.userData.id === "string")
    if (!hit) return
    const id = hit.object.userData.id as string
    sel = id
    onPick(id)
  }
  canvas.addEventListener("pointerdown", onDown)

  // Fonts: redraw labels once w95fa is in (if the page has it).
  let alive = true
  if (document.fonts?.load) {
    Promise.race([document.fonts.load(`44px ${FONT}`), new Promise((r) => setTimeout(r, 1500))]).then(() => {
      if (!alive) return
      for (const c of carts) {
        redraw(c.label, drawLabel(c.car))
        redraw(c.plate, drawPlate(c.car))
      }
      redraw(pwrTex, (g, w, h) => {
        g.fillStyle = "#c5c9cd"
        g.fillRect(0, 0, w, h)
        g.fillStyle = "#3a3e42"
        g.font = `24px ${FONT}`
        g.textAlign = "center"
        g.fillText("PWR", w / 2, 24)
      })
    })
  }

  // Loop.
  let raf = 0
  let last = performance.now()
  const tmp = new THREE.Color()
  function loop(now: number) {
    raf = requestAnimationFrame(loop)
    const dt = Math.min(0.05, (now - last) / 1000)
    last = now
    if (document.hidden) return
    const k = RM ? 1 : 1 - Math.exp(-dt * 3.2)
    for (const c of carts) {
      const on = c.id === sel && !running
      const base = c.mesh.userData.base as number
      const ty = base + (c.press ? HOME - 0.1 : on ? HOME + OUT : HOME)
      c.mesh.position.y += (ty - c.mesh.position.y) * (c.press && !RM ? 1 - Math.exp(-dt * 14) : k)
      c.face.emissiveIntensity += ((on ? 0.22 : 0) - c.face.emissiveIntensity) * k
      c.glow.intensity += ((on ? 0.9 * Math.PI : 0) - c.glow.intensity) * k
      tmp.setHex(LOT_TIER_COLOR[c.car.tier]).multiplyScalar(running && c.id !== running ? 0.25 : 1)
      c.lamp.color.copy(tmp)
    }
    pwrOn += (pwrTarget - pwrOn) * (RM ? 1 : 1 - Math.exp(-dt * 4))
    pwrMat.color.setRGB(0.17 + 0.32 * pwrOn, 0.23 + 0.77 * pwrOn, 0.2 + 0.57 * pwrOn)
    renderer.render(scene, cam)
  }
  raf = requestAnimationFrame(loop)

  const timers = new Set<ReturnType<typeof setTimeout>>()
  const later = (ms: number, fn: () => void) => {
    const t = setTimeout(() => {
      timers.delete(t)
      fn()
    }, ms)
    timers.add(t)
  }

  return {
    setCars(cars, selectedId) {
      sel = selectedId
      if (running && !cars.some((c) => c.id === running)) {
        running = null
        pwrTarget = 0
      }
      const nextKey = cars.map((c) => c.id).join("\n")
      if (nextKey === idKey && carts.length === cars.length) {
        cars.forEach((car, i) => {
          const c = carts[i]
          if (car.title !== c.car.title || car.leftLabel !== c.car.leftLabel || car.tier !== c.car.tier) {
            const tierChanged = car.tier !== c.car.tier
            c.car = car
            redraw(c.label, drawLabel(car))
            if (tierChanged) c.glow.color.setHex(LOT_TIER_COLOR[car.tier])
            redraw(c.plate, drawPlate(car))
          }
        })
        return
      }
      idKey = nextKey
      build(cars)
    },
    select(id) {
      sel = id
    },
    playResume(id) {
      const c = carts.find((x) => x.id === id)
      if (!c) return Promise.resolve()
      sel = id
      running = id
      if (RM) {
        pwrTarget = 1
        return Promise.resolve()
      }
      c.press = true
      return new Promise<void>((resolve) => {
        later(PRESS_MS, () => {
          c.press = false
          pwrTarget = 1
        })
        later(RESUME_MS, resolve)
      })
    },
    dispose() {
      alive = false
      cancelAnimationFrame(raf)
      for (const t of timers) clearTimeout(t)
      timers.clear()
      ro.disconnect()
      canvas.removeEventListener("pointerdown", onDown)
      clear()
      for (const d of shared) d.dispose()
      hemi.dispose()
      key.dispose()
      renderer.dispose()
      canvas.remove()
    },
  }
}
