/**
 * components/Inventory/pharmacy/pharmacy-diorama.ts — A little apothecary shelf
 *
 * Loaded only when the Pharmacy scene is open. Each bottle stands on a shelf
 * with a face on its label. Pills inside pile up to match what is left, so a
 * dose visibly lowers the heap. A low bottle looks worried and an empty one
 * sleeps. Click a bottle to pick it; it hops. Reduced motion holds one frame.
 */
import * as THREE from "three"
import type { PharmacyForm, PharmacyLevel } from "@/lib/pharmacy-math"

export interface PharmacyBottle {
  id: string
  name: string
  strength?: string
  form: PharmacyForm
  /** 0–1 */
  fill: number
  level: PharmacyLevel
  /** Cap colour, hex like `#7dcec4`. */
  color: string
}

const PER_SHELF = 5
const SHELF_Y = [0.1, 1.35, 2.6]
const SHELF_W = 6.4

export function pickBottle(hits: readonly { bottleId?: string }[]): string | null {
  for (const hit of hits) if (hit.bottleId) return hit.bottleId
  return null
}

/** Where bottle `i` of `total` stands. Rows fill bottom shelf first, left to right. */
export function bottleSlot(index: number): { x: number; y: number } {
  const shelf = Math.min(SHELF_Y.length - 1, Math.floor(index / PER_SHELF))
  const col = index % PER_SHELF
  return { x: -SHELF_W / 2 + 0.75 + col * ((SHELF_W - 1.5) / (PER_SHELF - 1)), y: SHELF_Y[shelf] }
}

/** How many loose pills fill a bottle at this fill. At least one while any are left. */
export function pillsShown(fill: number): number {
  if (fill <= 0) return 0
  return Math.max(1, Math.round(fill * 26))
}

function hash(text: string): number {
  let h = 2166136261
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619)
  return h >>> 0
}

function rng(seed: number): () => number {
  let s = seed || 1
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0
    return s / 4294967296
  }
}

const PASTELS = [0xf4b6c2, 0xffd6a5, 0xcde7be, 0xa9d6e5, 0xd7c6f0, 0xf7e7a1, 0xbfe3d0]

function labelTexture(bottle: PharmacyBottle): THREE.CanvasTexture {
  const canvas = document.createElement("canvas")
  canvas.width = 256
  canvas.height = 256
  const g = canvas.getContext("2d")!
  g.fillStyle = "#fbf8f2"
  g.fillRect(0, 0, 256, 256)
  g.fillStyle = bottle.color
  g.fillRect(0, 0, 256, 26)
  g.fillRect(0, 230, 256, 26)
  g.fillStyle = "#3b3548"
  g.textAlign = "center"
  let size = 34
  g.font = `700 ${size}px ui-monospace, Menlo, monospace`
  const name = bottle.name.length > 16 ? `${bottle.name.slice(0, 15)}…` : bottle.name
  while (g.measureText(name).width > 226 && size > 16) {
    size -= 2
    g.font = `700 ${size}px ui-monospace, Menlo, monospace`
  }
  g.fillText(name, 128, 72)
  if (bottle.strength) {
    g.fillStyle = "#6b6478"
    g.font = "600 22px ui-monospace, Menlo, monospace"
    g.fillText(bottle.strength, 128, 100)
  }
  // The face. Eyes and a mouth that follow how much is left.
  g.fillStyle = "#3b3548"
  g.strokeStyle = "#3b3548"
  g.lineWidth = 6
  g.lineCap = "round"
  if (bottle.level === "empty") {
    g.beginPath()
    g.moveTo(84, 150)
    g.quadraticCurveTo(96, 160, 108, 150)
    g.moveTo(148, 150)
    g.quadraticCurveTo(160, 160, 172, 150)
    g.stroke()
    g.beginPath()
    g.arc(128, 196, 7, 0, Math.PI * 2)
    g.stroke()
  } else {
    g.beginPath()
    g.arc(96, 150, 9, 0, Math.PI * 2)
    g.arc(160, 150, 9, 0, Math.PI * 2)
    g.fill()
    g.beginPath()
    if (bottle.level === "low") {
      g.moveTo(106, 200)
      g.quadraticCurveTo(128, 184, 150, 200)
    } else {
      g.moveTo(106, 188)
      g.quadraticCurveTo(128, 212, 150, 188)
    }
    g.stroke()
  }
  g.fillStyle = "rgba(244, 143, 170, 0.55)"
  g.beginPath()
  g.arc(70, 180, 11, 0, Math.PI * 2)
  g.arc(186, 180, 11, 0, Math.PI * 2)
  g.fill()
  if (bottle.level === "low") {
    g.fillStyle = "#8cc8f0"
    g.beginPath()
    g.moveTo(214, 120)
    g.quadraticCurveTo(224, 138, 214, 146)
    g.quadraticCurveTo(204, 138, 214, 120)
    g.fill()
  }
  const tex = new THREE.CanvasTexture(canvas)
  tex.colorSpace = THREE.SRGBColorSpace
  return tex
}

export function mountPharmacy(
  host: HTMLElement,
  opts: {
    bottles: readonly PharmacyBottle[]
    selectedId: string | null
    reducedMotion: boolean
    onPick: (id: string) => void
  },
): () => void {
  const canvas = document.createElement("canvas")
  canvas.style.cssText = "position:absolute;inset:0;width:100%;height:100%;display:block"
  host.appendChild(canvas)
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true })
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2))
  renderer.toneMapping = THREE.ACESFilmicToneMapping
  renderer.toneMappingExposure = 1.08
  const scene = new THREE.Scene()
  scene.background = new THREE.Color(0xe9eef0)
  // Two shelves for a few bottles, a third once there are more than ten.
  const shelves = Math.min(SHELF_Y.length, Math.max(2, Math.ceil(opts.bottles.length / PER_SHELF)))
  const topY = SHELF_Y[shelves - 1] + 1.5
  const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 40)
  camera.position.set(0, topY * 0.55, Math.max(7.2, topY * 1.85))
  camera.lookAt(0, topY * 0.5, 0)

  scene.add(new THREE.HemisphereLight(0xffffff, 0xb9c4cc, 0.95))
  const key = new THREE.DirectionalLight(0xfff4e6, 1.0)
  key.position.set(3, 6, 6)
  scene.add(key)

  const disposables: { dispose: () => void }[] = []
  const own = <T extends { dispose: () => void }>(item: T): T => {
    disposables.push(item)
    return item
  }

  // Cabinet back, sides, and three cream shelves.
  const back = new THREE.Mesh(
    own(new THREE.BoxGeometry(SHELF_W + 0.4, topY, 0.12)),
    own(new THREE.MeshStandardMaterial({ color: 0xcfe3e0, roughness: 0.9 })),
  )
  back.position.set(0, topY / 2, -0.75)
  scene.add(back)
  const frameMat = own(new THREE.MeshStandardMaterial({ color: 0xf4efe6, roughness: 0.6 }))
  for (const x of [-SHELF_W / 2 - 0.1, SHELF_W / 2 + 0.1]) {
    const side = new THREE.Mesh(own(new THREE.BoxGeometry(0.2, topY, 1.6)), frameMat)
    side.position.set(x, topY / 2, 0)
    scene.add(side)
  }
  const top = new THREE.Mesh(own(new THREE.BoxGeometry(SHELF_W + 0.6, 0.2, 1.6)), frameMat)
  top.position.set(0, topY, 0)
  scene.add(top)
  for (const y of SHELF_Y.slice(0, shelves)) {
    const board = new THREE.Mesh(own(new THREE.BoxGeometry(SHELF_W, 0.14, 1.5)), frameMat)
    board.position.set(0, y - 0.07, 0)
    scene.add(board)
  }
  // A green cross, because it is a pharmacy.
  const crossMat = own(new THREE.MeshStandardMaterial({ color: 0x7ccf9a, roughness: 0.5 }))
  const bar = own(new THREE.BoxGeometry(0.46, 0.14, 0.06))
  const crossA = new THREE.Mesh(bar, crossMat)
  const crossB = new THREE.Mesh(bar, crossMat)
  crossB.rotation.z = Math.PI / 2
  for (const part of [crossA, crossB]) {
    part.position.set(0, topY - 0.3, -0.66)
    scene.add(part)
  }

  const pillGeo = own(new THREE.SphereGeometry(0.06, 10, 8))
  const capsuleGeo = own(new THREE.CapsuleGeometry(0.04, 0.07, 4, 8))
  const gummyGeo = own(new THREE.SphereGeometry(0.065, 8, 6))
  const glassMat = own(
    new THREE.MeshStandardMaterial({ color: 0xe2a24f, transparent: true, opacity: 0.42, roughness: 0.2, metalness: 0.05 }),
  )
  const jarMat = own(
    new THREE.MeshStandardMaterial({ color: 0xdbeaf2, transparent: true, opacity: 0.4, roughness: 0.15 }),
  )

  const groups: { id: string; group: THREE.Group; baseY: number }[] = []
  const hitMeshes: THREE.Mesh[] = []

  opts.bottles.slice(0, PER_SHELF * shelves).forEach((bottle, index) => {
    const slot = bottleSlot(index)
    const group = new THREE.Group()
    group.position.set(slot.x, slot.y, 0.1)
    group.userData.bottleId = bottle.id
    const r = rng(hash(bottle.id))
    const jar = bottle.form === "gummy" || bottle.form === "powder"
    const liquid = bottle.form === "liquid"
    const radius = jar ? 0.42 : liquid ? 0.3 : 0.34
    const height = jar ? 0.78 : liquid ? 1.05 : 1.0
    const capColor = new THREE.Color(bottle.color)

    const body = new THREE.Mesh(own(new THREE.CylinderGeometry(radius, radius * 1.04, height, 22)), jar ? jarMat : glassMat)
    body.position.y = height / 2
    body.userData.bottleId = bottle.id
    group.add(body)
    hitMeshes.push(body)

    // The label wraps the front half so the face stays readable.
    const label = new THREE.Mesh(
      own(new THREE.CylinderGeometry(radius + 0.006, radius * 1.04 + 0.006, height * 0.62, 22, 1, true, -0.95, 1.9)),
      own(new THREE.MeshStandardMaterial({ map: labelTexture(bottle), roughness: 0.8, side: THREE.DoubleSide })),
    )
    label.position.y = height * 0.46
    label.userData.bottleId = bottle.id
    group.add(label)
    hitMeshes.push(label)

    const capMat = own(new THREE.MeshStandardMaterial({ color: capColor, roughness: 0.45, metalness: 0.1 }))
    if (liquid) {
      const neck = new THREE.Mesh(own(new THREE.CylinderGeometry(0.12, 0.16, 0.14, 14)), capMat)
      neck.position.y = height + 0.07
      const bulb = new THREE.Mesh(own(new THREE.SphereGeometry(0.15, 14, 10)), capMat)
      bulb.scale.y = 1.35
      bulb.position.y = height + 0.28
      group.add(neck, bulb)
      // Liquid level inside.
      const level = Math.max(0.02, bottle.fill) * (height - 0.1)
      const fluid = new THREE.Mesh(
        own(new THREE.CylinderGeometry(radius - 0.03, radius * 1.04 - 0.03, level, 20)),
        own(new THREE.MeshStandardMaterial({ color: capColor, transparent: true, opacity: bottle.fill > 0 ? 0.75 : 0, roughness: 0.3 })),
      )
      fluid.position.y = level / 2 + 0.04
      group.add(fluid)
    } else {
      const cap = new THREE.Mesh(own(new THREE.CylinderGeometry(radius + 0.03, radius + 0.03, 0.2, 22)), capMat)
      cap.position.y = height + 0.1
      cap.userData.bottleId = bottle.id
      group.add(cap)
      hitMeshes.push(cap)
      const ridge = new THREE.Mesh(own(new THREE.TorusGeometry(radius + 0.03, 0.018, 8, 26)), capMat)
      ridge.rotation.x = Math.PI / 2
      ridge.position.y = height + 0.2
      group.add(ridge)

      // Pills piled inside, packed bottom up.
      const shown = pillsShown(bottle.fill)
      const geo = bottle.form === "capsule" ? capsuleGeo : bottle.form === "gummy" ? gummyGeo : pillGeo
      const perRing = jar ? 11 : 8
      for (let i = 0; i < shown; i++) {
        const ring = Math.floor(i / perRing)
        const tone = new THREE.Color(PASTELS[(hash(bottle.id) + i * 3) % PASTELS.length])
        const pill = new THREE.Mesh(
          geo,
          own(new THREE.MeshStandardMaterial({ color: bottle.form === "capsule" ? tone : bottle.form === "gummy" ? tone : 0xfffaf0, roughness: 0.4 })),
        )
        const angle = (i % perRing) * ((Math.PI * 2) / perRing) + ring * 0.7 + r() * 0.4
        const spread = ring === 0 && i % perRing === 0 ? 0 : (radius - 0.13) * (0.45 + r() * 0.55)
        pill.position.set(Math.cos(angle) * spread, 0.1 + ring * 0.085 + (jar ? 0.04 : 0), Math.sin(angle) * spread)
        pill.rotation.set(r() * 3, r() * 3, r() * 3)
        group.add(pill)
      }
    }

    scene.add(group)
    groups.push({ id: bottle.id, group, baseY: slot.y })
  })

  const raycaster = new THREE.Raycaster()
  const pointer = new THREE.Vector2()
  const onPointer = (event: PointerEvent) => {
    const rect = canvas.getBoundingClientRect()
    if (!rect.width || !rect.height) return
    pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1
    pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1
    raycaster.setFromCamera(pointer, camera)
    const hits = raycaster.intersectObjects(hitMeshes, false).map((hit) => ({
      bottleId: typeof hit.object.userData.bottleId === "string" ? hit.object.userData.bottleId : undefined,
    }))
    const id = pickBottle(hits)
    if (id) opts.onPick(id)
  }
  canvas.addEventListener("pointerdown", onPointer)

  const resize = () => {
    const w = host.clientWidth || 320
    const h = host.clientHeight || 240
    camera.aspect = w / h
    camera.updateProjectionMatrix()
    renderer.setSize(w, h, false)
  }
  resize()
  window.addEventListener("resize", resize)

  const place = (now: number) => {
    for (const row of groups) {
      const selected = row.id === opts.selectedId
      const bob = opts.reducedMotion ? 0 : Math.sin(now * 0.002 + hash(row.id) % 7) * 0.012
      const hop = selected ? (opts.reducedMotion ? 0.22 : 0.22 + Math.abs(Math.sin(now * 0.004)) * 0.12) : 0
      row.group.position.y = row.baseY + hop + bob
      row.group.rotation.y = selected && !opts.reducedMotion ? Math.sin(now * 0.003) * 0.12 : 0
    }
  }

  let frame = 0
  let stopped = false
  const render = (now: number) => {
    if (stopped) return
    place(now)
    renderer.render(scene, camera)
    if (!opts.reducedMotion) frame = requestAnimationFrame(render)
  }
  if (opts.reducedMotion) render(0)
  else frame = requestAnimationFrame(render)

  return () => {
    stopped = true
    cancelAnimationFrame(frame)
    canvas.removeEventListener("pointerdown", onPointer)
    window.removeEventListener("resize", resize)
    for (const item of disposables) item.dispose()
    for (const mesh of hitMeshes) {
      const mat = mesh.material as THREE.MeshStandardMaterial
      mat.map?.dispose()
    }
    renderer.dispose()
    host.replaceChildren()
  }
}
