/**
 * components/Home/Tracking/tracking-log/food/kitchen-diorama.ts — Four cabinets
 *
 * A small kitchen, loaded only when the Food detail is open. Jars stand in
 * front of the room they belong to. Click a cabinet to show that room's list.
 * Reduced motion holds one still frame.
 */
import * as THREE from "three"
import type { KitchenRoom } from "@/lib/kitchen-types"

export interface DioramaLot {
  id?: string
  room: KitchenRoom
  name: string
}

/** A jar wins over the cabinet behind it. */
export function pickKitchenTarget(
  hits: readonly { lotId?: string; room?: KitchenRoom }[],
): { lotId: string } | { room: KitchenRoom } | null {
  for (const hit of hits) {
    if (hit.lotId) return { lotId: hit.lotId }
  }
  for (const hit of hits) {
    if (hit.room) return { room: hit.room }
  }
  return null
}

const ROOMS: { id: KitchenRoom; x: number; h: number; color: number }[] = [
  { id: "fridge", x: -2.55, h: 2.15, color: 0xd7e4df },
  { id: "pantry", x: -0.85, h: 2.35, color: 0xc5ccd4 },
  { id: "spice", x: 0.75, h: 1.45, color: 0xb7c4ce },
  { id: "freezer", x: 2.45, h: 1.85, color: 0xd5deee },
]

export function mountKitchen(
  host: HTMLElement,
  opts: {
    lots: readonly DioramaLot[]
    active: KitchenRoom | "all"
    onRoom: (room: KitchenRoom) => void
    onLot?: (id: string) => void
    reducedMotion: boolean
  },
): () => void {
  const canvas = document.createElement("canvas")
  canvas.style.cssText = "position:absolute;inset:0;width:100%;height:100%;display:block"
  host.appendChild(canvas)
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true })
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2))
  renderer.toneMapping = THREE.ACESFilmicToneMapping
  renderer.toneMappingExposure = 1.05
  const scene = new THREE.Scene()
  scene.background = new THREE.Color(0x241c2e)
  scene.fog = new THREE.Fog(0x241c2e, 8, 16)
  const camera = new THREE.PerspectiveCamera(32, 1, 0.1, 40)
  camera.position.set(0.2, 2.15, 7.2)
  camera.lookAt(0, 0.7, 0)

  scene.add(new THREE.AmbientLight(0xf4f1ea, 0.55))
  const key = new THREE.DirectionalLight(0xfff6ea, 1.15)
  key.position.set(3, 6, 4)
  scene.add(key)
  const fill = new THREE.PointLight(0x7dcec4, 0.35, 12)
  fill.position.set(-2, 1.2, 2)
  scene.add(fill)

  const floor = new THREE.Mesh(
    new THREE.BoxGeometry(8.2, 0.08, 3.4),
    new THREE.MeshStandardMaterial({ color: 0x3a3348, roughness: 0.85 }),
  )
  floor.position.y = -0.04
  scene.add(floor)

  const cabinets: THREE.Mesh[] = []
  const disposables: { dispose: () => void }[] = [floor.geometry, floor.material]
  for (const room of ROOMS) {
    const geo = new THREE.BoxGeometry(1.35, room.h, 0.72)
    const mat = new THREE.MeshStandardMaterial({
      color: room.color,
      roughness: 0.45,
      metalness: 0.18,
      emissive: opts.active === room.id ? 0x1c3d36 : 0x000000,
      emissiveIntensity: opts.active === room.id ? 0.35 : 0,
    })
    const mesh = new THREE.Mesh(geo, mat)
    mesh.position.set(room.x, room.h / 2, -0.35)
    mesh.userData.room = room.id
    scene.add(mesh)
    cabinets.push(mesh)
    disposables.push(geo, mat)
    const handle = new THREE.Mesh(
      new THREE.BoxGeometry(0.08, 0.28, 0.06),
      new THREE.MeshStandardMaterial({ color: 0x7dcec4, roughness: 0.3, metalness: 0.4 }),
    )
    handle.position.set(room.x + 0.42, room.h * 0.55, 0.04)
    scene.add(handle)
    disposables.push(handle.geometry, handle.material)
  }

  const jarGeo = new THREE.CylinderGeometry(0.11, 0.13, 0.28, 10)
  const lidGeo = new THREE.CylinderGeometry(0.12, 0.12, 0.05, 10)
  disposables.push(jarGeo, lidGeo)
  const jars: THREE.Mesh[] = []
  const counts: Record<KitchenRoom, number> = { fridge: 0, pantry: 0, spice: 0, freezer: 0 }
  for (const lot of opts.lots) {
    if (counts[lot.room] >= 5) continue
    const i = counts[lot.room]
    counts[lot.room] += 1
    const room = ROOMS.find((row) => row.id === lot.room)!
    const hue = (lot.name.length * 47) % 360
    const jarMat = new THREE.MeshStandardMaterial({ color: new THREE.Color(`hsl(${hue}, 28%, 62%)`), roughness: 0.4 })
    const jar = new THREE.Mesh(jarGeo, jarMat)
    jar.position.set(room.x - 0.46 + i * 0.24, 0.16, 0.72)
    if (lot.id) jar.userData.lotId = lot.id
    scene.add(jar)
    const lidMat = new THREE.MeshStandardMaterial({ color: 0xe7ebef, metalness: 0.35, roughness: 0.35 })
    const lid = new THREE.Mesh(lidGeo, lidMat)
    lid.position.set(jar.position.x, 0.32, jar.position.z)
    if (lot.id) lid.userData.lotId = lot.id
    scene.add(lid)
    jars.push(jar, lid)
    disposables.push(jarMat, lidMat)
  }

  const raycaster = new THREE.Raycaster()
  const pointer = new THREE.Vector2()
  const onPointer = (event: PointerEvent) => {
    const rect = canvas.getBoundingClientRect()
    if (!rect.width || !rect.height) return
    pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1
    pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1
    raycaster.setFromCamera(pointer, camera)
    const hits = raycaster.intersectObjects([...jars, ...cabinets], false).map((hit) => ({
      lotId: typeof hit.object.userData.lotId === "string" ? hit.object.userData.lotId : undefined,
      room: hit.object.userData.room as KitchenRoom | undefined,
    }))
    const target = pickKitchenTarget(hits)
    if (!target) return
    if ("lotId" in target) opts.onLot?.(target.lotId)
    else opts.onRoom(target.room)
  }
  canvas.addEventListener("pointerdown", onPointer)

  let frame = 0
  let stopped = false
  const resize = () => {
    const w = host.clientWidth || 320
    const h = host.clientHeight || 220
    camera.aspect = w / h
    camera.updateProjectionMatrix()
    renderer.setSize(w, h, false)
  }
  resize()
  const onResize = () => resize()
  window.addEventListener("resize", onResize)

  const render = (now: number) => {
    if (stopped) return
    if (!opts.reducedMotion) {
      const sway = Math.sin(now * 0.00035) * 0.18
      camera.position.x = Math.sin(sway) * 0.85
      camera.lookAt(0, 0.75, 0)
      frame = requestAnimationFrame(render)
    }
    renderer.render(scene, camera)
  }
  if (opts.reducedMotion) render(0)
  else frame = requestAnimationFrame(render)

  return () => {
    stopped = true
    cancelAnimationFrame(frame)
    canvas.removeEventListener("pointerdown", onPointer)
    window.removeEventListener("resize", onResize)
    for (const item of disposables) item.dispose()
    renderer.dispose()
    host.replaceChildren()
  }
}
