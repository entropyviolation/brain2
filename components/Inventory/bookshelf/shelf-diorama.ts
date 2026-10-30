/**
 * components/Inventory/bookshelf/shelf-diorama.ts — Two-bay bookcase
 *
 * Loaded only on the desktop stage. A book with a cover is a volume: page
 * block, boards, and the picture on the front, cropped to the board
 * (`coverFrame`) and drawn without tone mapping so the print stays true.
 * One pulled book eases forward and squares to the camera. A search only
 * quiets the titles that do not match. Reduced motion snaps the pulled book
 * forward instead of tweening. Dispose on the returned cleanup.
 */
import * as THREE from "three"
import { coverFrame, shelfMeasures, type ShelfBook } from "./shelf-books"

export interface BookshelfMount {
  books: readonly ShelfBook[]
  reducedMotion: boolean
  getMatchIds: () => readonly string[]
  getPulledId: () => string | null
  getCoverSrcs: () => Readonly<Record<string, string>>
  onSelect: (id: string | null) => void
}

const OUTER_W = 4.72
const OUTER_D = 0.98
const SIDE = 0.18
const STILE = 0.14
const CASE_LEFT = -OUTER_W / 2
const CASE_RIGHT = OUTER_W / 2
const BAYS = [
  { x0: CASE_LEFT + SIDE, x1: -STILE / 2 },
  { x0: STILE / 2, x1: CASE_RIGHT - SIDE },
]
/** Top surface of each shelf board, low to high. The top row stays under the valance. */
const SHELF_Y = [1.34, 2.16, 2.98, 3.78]
const BOARD_T = 0.06
const SHELF_Z0 = -0.26
const SHELF_Z1 = 0.4
const FRONT_Z = 0.34
const GAP = 0.045
const PULL_Z = 0.78

const CLOTH = ["#6e2c3a", "#1e3a4c", "#3f4a32", "#8a5a2a", "#3a3058", "#7a3b2e", "#243832", "#c4b496", "#1c2838", "#5c3a48", "#6a4530", "#2c3e50"]

interface Measured {
  book: ShelfBook
  w: number
  h: number
  d: number
  cloth: string
  cover: boolean
}

interface Standing extends Measured {
  x: number
  y: number
  z: number
}

type ShelfMat = THREE.MeshStandardMaterial | THREE.MeshBasicMaterial

interface Placed {
  id: string
  group: THREE.Group
  mats: ShelfMat[]
  front: ShelfMat
  w: number
  h: number
  homeY: number
  homeZ: number
  pull: number
  cover: boolean
  lean: number
  coverSrc: string
  jacket: THREE.Texture
  photo?: THREE.Texture
}

export function mountBookshelf(host: HTMLElement, opts: BookshelfMount): () => void {
  const canvas = document.createElement("canvas")
  canvas.style.cssText = "position:absolute;inset:0;width:100%;height:100%;display:block"
  canvas.setAttribute("aria-hidden", "true")
  host.appendChild(canvas)

  let renderer: THREE.WebGLRenderer
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true })
  } catch {
    canvas.remove()
    return () => {}
  }

  const geos: THREE.BufferGeometry[] = []
  const mats: THREE.Material[] = []
  const textures: THREE.Texture[] = []
  const trackGeo = <T extends THREE.BufferGeometry>(geo: T): T => {
    geos.push(geo)
    return geo
  }
  const trackMat = <T extends THREE.Material>(mat: T): T => {
    mats.push(mat)
    return mat
  }
  const trackTex = (tex: THREE.Texture): THREE.Texture => {
    tex.colorSpace = THREE.SRGBColorSpace
    tex.anisotropy = 4
    textures.push(tex)
    return tex
  }

  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2))
  renderer.outputColorSpace = THREE.SRGBColorSpace
  renderer.toneMapping = THREE.ACESFilmicToneMapping
  renderer.toneMappingExposure = 1.05
  renderer.setClearColor(0x000000, 0)

  const scene = new THREE.Scene()
  const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 40)
  camera.position.set(0.05, 2.45, 9.4)
  camera.lookAt(0, 2.4, 0)

  scene.add(new THREE.AmbientLight(0xfff6ec, 0.72))
  const key = new THREE.DirectionalLight(0xfff3e4, 1.55)
  key.position.set(1.4, 6.2, 5.4)
  scene.add(key)
  const blush = new THREE.DirectionalLight(0xf0cfc4, 0.28)
  blush.position.set(-2.4, 1.6, 3.2)
  scene.add(blush)
  const front = new THREE.DirectionalLight(0xfff8ee, 0.7)
  front.position.set(0, 2.2, 7)
  scene.add(front)

  const root = new THREE.Group()
  scene.add(root)

  const woodTex = trackTex(new THREE.CanvasTexture(woodCanvas(false)))
  woodTex.wrapS = THREE.RepeatWrapping
  woodTex.wrapT = THREE.RepeatWrapping
  const woodMat = trackMat(
    new THREE.MeshStandardMaterial({ map: woodTex, color: 0x8a6848, roughness: 0.78, metalness: 0.02 }),
  )
  const darkMat = trackMat(
    new THREE.MeshStandardMaterial({ color: 0x2a1b12, roughness: 0.86, metalness: 0 }),
  )

  buildCase(root, trackGeo, trackMat, woodMat, darkMat, trackTex)

  const pageTex = trackTex(new THREE.CanvasTexture(pageCanvas()))
  const standing = layoutBooks(opts.books)
  const placed: Placed[] = []
  const targets: THREE.Object3D[] = []
  for (const book of standing) {
    const row = makeBook(book, trackGeo, trackMat, trackTex, pageTex)
    row.group.position.set(book.x, book.y, book.z)
    root.add(row.group)
    targets.push(row.group)
    placed.push({
      id: book.book.id,
      group: row.group,
      mats: row.mats,
      front: row.front,
      w: book.w,
      h: book.h,
      homeY: book.y,
      homeZ: book.z,
      pull: 0,
      cover: book.cover,
      lean: book.cover ? ((hash(book.book.id) % 7) - 3) * 0.012 : 0,
      coverSrc: "",
      jacket: row.front.map as THREE.Texture,
    })
  }

  const raycaster = new THREE.Raycaster()
  const pointer = new THREE.Vector2()
  const pick = (event: PointerEvent): string | null => {
    const rect = canvas.getBoundingClientRect()
    if (!rect.width || !rect.height) return null
    pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1
    pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1
    raycaster.setFromCamera(pointer, camera)
    const hits = raycaster.intersectObjects(targets, true)
    for (const hit of hits) {
      let node: THREE.Object3D | null = hit.object
      while (node) {
        if (typeof node.userData.bookId === "string") return node.userData.bookId
        node = node.parent
      }
    }
    return null
  }
  const onPointerDown = (event: PointerEvent) => {
    opts.onSelect(pick(event))
  }
  const onPointerMove = (event: PointerEvent) => {
    canvas.style.cursor = pick(event) ? "pointer" : "default"
  }
  canvas.addEventListener("pointerdown", onPointerDown)
  canvas.addEventListener("pointermove", onPointerMove)

  const loader = new THREE.TextureLoader()
  let stopped = false
  let frame = 0
  let looping = false
  let last = 0

  const paintFront = (book: Placed, map: THREE.Texture) => {
    book.front.map = map
    book.front.color.setHex(0xffffff)
    book.front.userData.base = book.front.color.clone()
    book.front.needsUpdate = true
  }

  const applyCovers = () => {
    const srcs = opts.getCoverSrcs()
    const maxAniso = renderer.capabilities.getMaxAnisotropy?.() ?? 4
    for (const book of placed) {
      const src = srcs[book.id] || ""
      if (book.coverSrc === src) continue
      book.coverSrc = src
      if (book.photo) {
        book.photo.dispose()
        book.photo = undefined
      }
      if (!src) {
        paintFront(book, book.jacket)
        continue
      }
      const token = src
      loader.load(token, (tex) => {
        if (stopped || book.coverSrc !== token) {
          tex.dispose()
          return
        }
        const image = tex.image as { width?: number; height?: number }
        const frame = coverFrame(image.width || 2, image.height || 3, book.w / Math.max(book.h, 0.001))
        tex.repeat.set(frame.repeatX, frame.repeatY)
        tex.offset.set(frame.offsetX, frame.offsetY)
        tex.wrapS = THREE.RepeatWrapping
        tex.wrapT = THREE.RepeatWrapping
        tex.needsUpdate = true
        tex.colorSpace = THREE.SRGBColorSpace
        tex.anisotropy = Math.min(8, maxAniso)
        book.photo = tex
        paintFront(book, tex)
        render()
      })
    }
  }

  const applyPose = (dt: number): boolean => {
    const ids = new Set(opts.getMatchIds())
    const searching = ids.size > 0
    const pulled = opts.getPulledId()
    let moving = false
    for (const book of placed) {
      const on = book.id === pulled
      const target = on ? 1 : 0
      if (opts.reducedMotion) book.pull = target
      else {
        const next = book.pull + (target - book.pull) * (1 - Math.exp(-dt * 7))
        book.pull = Math.abs(next - target) < 0.004 ? target : next
        if (book.pull !== target) moving = true
      }
      const wantH = book.cover ? book.h * 1.55 : Math.max(book.h, 0.78)
      const wantW = book.cover ? book.w * 1.55 : Math.max(book.w, 0.46)
      const sy = 1 + book.pull * (wantH / book.h - 1)
      const sx = 1 + book.pull * (wantW / book.w - 1)
      book.group.scale.set(sx, sy, 1 + book.pull * 0.08)
      book.group.rotation.y = book.lean * (1 - book.pull)
      book.group.position.y = book.homeY + (book.h * (sy - 1)) / 2 + book.pull * 0.03
      book.group.position.z = book.homeZ + book.pull * (book.cover ? PULL_Z * 1.15 : PULL_Z)
      const quiet = searching && !ids.has(book.id)
      for (const mat of book.mats) {
        const base = mat.userData.base as THREE.Color
        mat.color.copy(base).multiplyScalar(quiet ? 0.62 : 1)
        if (mat instanceof THREE.MeshStandardMaterial) {
          mat.emissive.setHex(on ? 0x5c3b22 : 0x000000)
          mat.emissiveIntensity = on ? 0.42 : 0
        }
      }
    }
    return moving
  }

  const render = () => {
    if (stopped) return
    try {
      renderer.render(scene, camera)
    } catch {
      stopped = true
    }
  }

  const tick = (now: number) => {
    if (stopped) return
    const dt = Math.min(0.05, (now - last) / 1000 || 0.016)
    last = now
    const moving = applyPose(dt)
    render()
    if (moving) frame = requestAnimationFrame(tick)
    else looping = false
  }

  const poke = () => {
    if (stopped) return
    applyCovers()
    if (opts.reducedMotion) {
      applyPose(0)
      render()
      return
    }
    if (!looping) {
      looping = true
      last = performance.now()
      frame = requestAnimationFrame(tick)
    }
  }

  const preCenter = new THREE.Box3().setFromObject(root)
  const center = preCenter.getCenter(new THREE.Vector3())
  root.position.sub(center)
  const span = new THREE.Box3().setFromObject(root).getSize(new THREE.Vector3())

  const resize = () => {
    const w = host.clientWidth || 640
    const h = host.clientHeight || 480
    camera.aspect = w / Math.max(h, 1)
    camera.updateProjectionMatrix()
    const vFov = (camera.fov * Math.PI) / 180
    const hFov = 2 * Math.atan(Math.tan(vFov / 2) * camera.aspect)
    const distY = span.y / 2 / Math.tan(vFov / 2)
    const distX = span.x / 2 / Math.tan(hFov / 2)
    const dist = Math.max(distX, distY) * 1.08
    camera.position.set(0, span.y * 0.02, dist)
    // The case's pixels land right of the camera target on this wide stage.
    // Aim partway across the case so the bookcase sits in the middle of the paper.
    camera.lookAt(span.x * 0.34, 0, 0)
    camera.updateProjectionMatrix()
    renderer.setSize(w, h, false)
    render()
  }

  resize()
  poke()
  const onResize = () => resize()
  window.addEventListener("resize", onResize)
  const observer = typeof ResizeObserver !== "undefined" ? new ResizeObserver(() => resize()) : null
  observer?.observe(host)
  const onPoke = () => poke()
  host.addEventListener("shelf-poke", onPoke)

  return () => {
    stopped = true
    cancelAnimationFrame(frame)
    canvas.removeEventListener("pointerdown", onPointerDown)
    canvas.removeEventListener("pointermove", onPointerMove)
    window.removeEventListener("resize", onResize)
    host.removeEventListener("shelf-poke", onPoke)
    observer?.disconnect()
    for (const book of placed) book.photo?.dispose()
    for (const tex of textures) tex.dispose()
    for (const geo of geos) geo.dispose()
    for (const mat of mats) mat.dispose()
    renderer.dispose()
    host.replaceChildren()
  }
}

function layoutBooks(books: readonly ShelfBook[]): Standing[] {
  const measured = books.map(measure)
  const indexes = shelfIndexes(measured.length)
  const slots: { shelf: number; bay: number; items: Measured[] }[] = []
  for (const shelf of indexes) {
    for (const bay of [0, 1]) slots.push({ shelf, bay, items: [] })
  }
  if (measured.length === 0 || slots.length === 0) return []
  const per = Math.ceil(measured.length / slots.length)
  const widest = measured.slice().sort((a, b) => b.w - a.w).slice(0, per)
  const bayW = BAYS[0].x1 - BAYS[0].x0
  const worst = widest.reduce((sum, book) => sum + book.w, 0) + Math.max(0, per - 1) * GAP
  const scale = Math.min(1, (bayW - 0.08) / Math.max(worst, 0.001))
  measured.forEach((book, index) => {
    const slot = slots[Math.min(slots.length - 1, Math.floor(index / per))]
    slot.items.push({ ...book, w: book.w * scale })
  })
  const standing: Standing[] = []
  for (const slot of slots) {
    const used = slot.items.reduce((sum, book) => sum + book.w, 0) + Math.max(0, slot.items.length - 1) * GAP
    const bay = BAYS[slot.bay]
    let cursor = bay.x0 + (bay.x1 - bay.x0 - used) / 2
    const shelfY = SHELF_Y[slot.shelf]
    for (const book of slot.items) {
      standing.push({
        ...book,
        x: cursor + book.w / 2,
        y: shelfY + book.h / 2 + 0.01,
        z: FRONT_Z - book.d / 2,
      })
      cursor += book.w + GAP
    }
  }
  return standing
}

/** A short list leaves air between shelves, the way a lived-in case does. */
function shelfIndexes(count: number): number[] {
  if (count <= 4) return [0, 2]
  if (count <= 10) return [0, 1, 3]
  return [0, 1, 2, 3]
}

function measure(book: ShelfBook): Measured {
  const n = hash(book.id)
  const cloth = CLOTH[n % CLOTH.length]
  const sized = shelfMeasures(book)
  if (book.coverUri) {
    return {
      book,
      cloth,
      cover: true,
      w: sized?.w ?? 0.42 + (n % 5) * 0.03,
      h: sized?.h ?? 0.6 + ((n >> 3) % 4) * 0.035,
      d: sized?.d ?? 0.075 + ((n >> 6) % 3) * 0.012,
    }
  }
  return {
    book,
    cloth,
    cover: false,
    w: sized?.w ?? 0.16 + (n % 6) * 0.02,
    h: sized?.h ?? 0.62 + ((n >> 3) % 5) * 0.03,
    d: sized?.d ?? 0.3 + ((n >> 6) % 4) * 0.028,
  }
}

function makeBook(
  book: Standing,
  trackGeo: <T extends THREE.BufferGeometry>(geo: T) => T,
  trackMat: <T extends THREE.Material>(mat: T) => T,
  trackTex: (tex: THREE.Texture) => THREE.Texture,
  pageTex: THREE.Texture,
): { group: THREE.Group; mats: ShelfMat[]; front: ShelfMat } {
  const cloth = new THREE.Color(book.cloth)
  const pages = new THREE.Color("#efe6d4")
  const jacket = trackTex(
    new THREE.CanvasTexture(book.cover ? coverCanvas(book.book.title, book.cloth) : spineCanvas(book.book.title, book.cloth)),
  )
  const face = (color: THREE.Color, map?: THREE.Texture, rough = 0.78) => {
    const mat = trackMat(
      new THREE.MeshStandardMaterial({
        color,
        map,
        roughness: map ? Math.min(rough, 0.72) : rough,
        metalness: 0,
      }),
    )
    mat.userData.base = mat.color.clone()
    return mat
  }
  const printed = (map: THREE.Texture) => {
    const mat = trackMat(new THREE.MeshBasicMaterial({ map, color: 0xffffff, toneMapped: false }))
    mat.userData.base = mat.color.clone()
    return mat
  }
  const group = new THREE.Group()
  group.userData.bookId = book.book.id

  if (!book.cover) {
    const front = face(new THREE.Color("#ffffff"), jacket, 0.62)
    const page = face(pages, pageTex, 0.9)
    const side = face(cloth)
    // +X, -X, +Y, -Y, +Z, -Z. The camera looks along +Z, so +Z is the spine you read.
    const materials: ShelfMat[] = [side, side, page, side, front, page]
    group.add(new THREE.Mesh(trackGeo(new THREE.BoxGeometry(book.w, book.h, book.d)), materials))
    return { group, mats: materials, front }
  }

  // Face-out volume. The picture sits on the front board. Pages show on the
  // fore-edge and the top. The spine is the left hinge.
  const boardT = Math.min(0.012, book.d * 0.22)
  const spineW = Math.min(0.03, book.w * 0.08)
  const pageW = Math.max(0.05, book.w - spineW - 0.01)
  const pageH = Math.max(0.05, book.h - 0.016)
  const pageD = Math.max(0.02, book.d - boardT * 2 - 0.004)
  const pageMat = face(pages, pageTex, 0.92)
  const pageMesh = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(pageW, pageH, pageD)), pageMat)
  pageMesh.position.set(spineW * 0.35, 0, 0)

  const front = printed(jacket)
  const boardEdge = face(new THREE.Color("#f3ecdf"), undefined, 0.84)
  const board = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(book.w, book.h, boardT)), [
    boardEdge,
    boardEdge,
    boardEdge,
    boardEdge,
    front,
    boardEdge,
  ])
  board.position.z = book.d / 2 - boardT / 2

  const backMat = face(cloth.clone().multiplyScalar(0.92))
  const back = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(book.w, book.h, boardT)), backMat)
  back.position.z = -book.d / 2 + boardT / 2

  const spineMat = face(cloth)
  const spine = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(spineW, book.h, book.d - boardT)), spineMat)
  spine.position.set(-book.w / 2 + spineW / 2, 0, -boardT / 2)

  group.add(pageMesh, back, spine, board)
  return { group, mats: [pageMat, boardEdge, front, backMat, spineMat], front }
}

function buildCase(
  scene: THREE.Object3D,
  trackGeo: <T extends THREE.BufferGeometry>(geo: T) => T,
  trackMat: <T extends THREE.Material>(mat: T) => T,
  woodMat: THREE.MeshStandardMaterial,
  darkMat: THREE.Material,
  trackTex: (tex: THREE.Texture) => THREE.Texture,
) {
  const box = (w: number, h: number, d: number, x: number, y: number, z: number, mat: THREE.Material = woodMat) => {
    const mesh = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(w, h, d)), mat)
    mesh.position.set(x, y, z)
    scene.add(mesh)
  }

  const bodyH = 4.72
  const bodyY = 0.22 + bodyH / 2
  box(SIDE, bodyH, OUTER_D, CASE_LEFT + SIDE / 2, bodyY, 0)
  box(SIDE, bodyH, OUTER_D, CASE_RIGHT - SIDE / 2, bodyY, 0)
  box(STILE, bodyH - 0.2, OUTER_D - 0.08, 0, bodyY + 0.04, 0)
  box(OUTER_W + 0.12, 0.22, OUTER_D + 0.08, 0, 4.96, 0.02)
  box(OUTER_W, 0.2, OUTER_D, 0, 0.28, 0)
  box(OUTER_W - SIDE * 2, bodyH - 0.4, 0.06, 0, bodyY, -0.4, darkMat)

  const bayW = BAYS[0].x1 - BAYS[0].x0
  const boardGeo = trackGeo(new THREE.BoxGeometry(bayW, BOARD_T, SHELF_Z1 - SHELF_Z0))
  for (const y of SHELF_Y) {
    for (const bay of BAYS) {
      const mesh = new THREE.Mesh(boardGeo, woodMat)
      mesh.position.set((bay.x0 + bay.x1) / 2, y - BOARD_T / 2, (SHELF_Z0 + SHELF_Z1) / 2)
      scene.add(mesh)
    }
  }

  const blossom = trackTex(new THREE.CanvasTexture(blossomCanvas()))
  const blossomMat = trackMat(new THREE.MeshStandardMaterial({ map: blossom, roughness: 0.8, metalness: 0 }))
  const panelW = bayW - 0.08
  const panel = trackGeo(new THREE.BoxGeometry(panelW, 0.92, 0.04))
  for (const bay of BAYS) {
    const mesh = new THREE.Mesh(panel, blossomMat)
    mesh.position.set((bay.x0 + bay.x1) / 2, 0.78, 0.36)
    scene.add(mesh)
  }

  const valanceTex = trackTex(new THREE.CanvasTexture(valanceCanvas()))
  const valanceMat = trackMat(
    new THREE.MeshStandardMaterial({
      map: valanceTex,
      transparent: true,
      depthWrite: false,
      roughness: 0.7,
      side: THREE.DoubleSide,
    }),
  )
  const valance = new THREE.Mesh(trackGeo(new THREE.PlaneGeometry(OUTER_W - SIDE * 2 - 0.04, 0.42)), valanceMat)
  valance.position.set(0, 4.78, 0.46)
  scene.add(valance)

  const footGeo = trackGeo(new THREE.BoxGeometry(0.28, 0.16, 0.28))
  for (const x of [CASE_LEFT + 0.08, CASE_RIGHT - 0.08]) {
    for (const z of [-0.28, 0.32]) {
      const foot = new THREE.Mesh(footGeo, woodMat)
      foot.position.set(x, 0.08, z)
      scene.add(foot)
    }
  }

  const shadowTex = trackTex(new THREE.CanvasTexture(shadowCanvas()))
  const shadow = new THREE.Mesh(
    trackGeo(new THREE.PlaneGeometry(5.3, 1.35)),
    trackMat(new THREE.MeshBasicMaterial({ map: shadowTex, transparent: true, depthWrite: false })),
  )
  shadow.rotation.x = -Math.PI / 2
  shadow.position.set(0, 0.012, 0.12)
  scene.add(shadow)
}

function hash(id: string): number {
  let h = 2166136261
  for (let i = 0; i < id.length; i++) {
    h ^= id.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

function inkFor(hex: string): string {
  const n = Number.parseInt(hex.slice(1), 16)
  const r = (n >> 16) & 255
  const g = (n >> 8) & 255
  const b = n & 255
  return (r * 299 + g * 587 + b * 114) / 1000 > 150 ? "#2a2118" : "#f4ecdf"
}

function pageCanvas(): HTMLCanvasElement {
  const canvas = document.createElement("canvas")
  canvas.width = 64
  canvas.height = 256
  const g = canvas.getContext("2d")
  if (!g) return canvas
  g.fillStyle = "#f4efe4"
  g.fillRect(0, 0, 64, 256)
  g.strokeStyle = "rgba(90, 70, 48, 0.28)"
  g.lineWidth = 1
  for (let y = 4; y < 256; y += 3) {
    g.beginPath()
    g.moveTo(0, y)
    g.lineTo(64, y + ((y * 3) % 2))
    g.stroke()
  }
  g.fillStyle = "rgba(70, 52, 32, 0.08)"
  g.fillRect(0, 0, 8, 256)
  return canvas
}

function spineCanvas(title: string, cloth: string): HTMLCanvasElement {
  const canvas = document.createElement("canvas")
  canvas.width = 128
  canvas.height = 512
  const g = canvas.getContext("2d")
  if (!g) return canvas
  g.fillStyle = cloth
  g.fillRect(0, 0, 128, 512)
  shadeEdges(g, 128, 512)
  g.fillStyle = inkFor(cloth)
  const text = title.trim()
  if (text) {
    let size = 44
    g.font = `600 ${size}px Palatino, Georgia, serif`
    while (size > 18 && g.measureText(text).width > 430) {
      size -= 2
      g.font = `600 ${size}px Palatino, Georgia, serif`
    }
    g.save()
    g.translate(64, 256)
    g.rotate(-Math.PI / 2)
    g.textAlign = "center"
    g.textBaseline = "middle"
    g.fillText(text, 0, 0)
    g.restore()
  }
  g.strokeStyle = inkFor(cloth)
  g.globalAlpha = 0.45
  g.lineWidth = 3
  g.strokeRect(14, 28, 100, 18)
  g.strokeRect(14, 466, 100, 18)
  g.globalAlpha = 1
  return canvas
}

function coverCanvas(title: string, cloth: string): HTMLCanvasElement {
  const canvas = document.createElement("canvas")
  canvas.width = 320
  canvas.height = 460
  const g = canvas.getContext("2d")
  if (!g) return canvas
  g.fillStyle = cloth
  g.fillRect(0, 0, 320, 460)
  shadeEdges(g, 320, 460)
  g.strokeStyle = inkFor(cloth)
  g.globalAlpha = 0.4
  g.lineWidth = 4
  g.strokeRect(22, 22, 276, 416)
  g.globalAlpha = 1
  const text = title.trim()
  if (!text) return canvas
  g.fillStyle = inkFor(cloth)
  g.textAlign = "center"
  g.textBaseline = "middle"
  let size = 36
  g.font = `600 ${size}px Palatino, Georgia, serif`
  const words = text.split(/\s+/)
  const lines: string[] = []
  let line = ""
  for (const word of words) {
    const next = line ? `${line} ${word}` : word
    if (g.measureText(next).width > 240 && line) {
      lines.push(line)
      line = word
    } else line = next
  }
  if (line) lines.push(line)
  const shown = lines.slice(0, 4)
  const start = 230 - ((shown.length - 1) * (size + 6)) / 2
  shown.forEach((row, index) => g.fillText(row, 160, start + index * (size + 6)))
  return canvas
}

function shadeEdges(g: CanvasRenderingContext2D, w: number, h: number) {
  const edge = g.createLinearGradient(0, 0, w, 0)
  edge.addColorStop(0, "rgba(36, 18, 8, 0.32)")
  edge.addColorStop(0.12, "rgba(36, 18, 8, 0)")
  edge.addColorStop(0.88, "rgba(36, 18, 8, 0)")
  edge.addColorStop(1, "rgba(36, 18, 8, 0.38)")
  g.fillStyle = edge
  g.fillRect(0, 0, w, h)
}

function woodCanvas(dark: boolean): HTMLCanvasElement {
  const canvas = document.createElement("canvas")
  canvas.width = 256
  canvas.height = 256
  const g = canvas.getContext("2d")
  if (!g) return canvas
  g.fillStyle = dark ? "#3a2618" : "#5a3b26"
  g.fillRect(0, 0, 256, 256)
  for (let i = 0; i < 36; i++) {
    g.strokeStyle = `rgba(${dark ? "90, 58, 36" : "120, 78, 46"}, ${0.18 + (i % 5) * 0.05})`
    g.beginPath()
    const y = (i * 7) % 256
    g.moveTo(0, y)
    g.bezierCurveTo(70, y + 5, 170, y - 4, 256, y + 2)
    g.stroke()
  }
  g.fillStyle = "rgba(28, 14, 8, 0.2)"
  g.beginPath()
  g.ellipse(78, 96, 9, 5, 0.5, 0, Math.PI * 2)
  g.fill()
  return canvas
}

function blossomCanvas(): HTMLCanvasElement {
  const canvas = document.createElement("canvas")
  canvas.width = 512
  canvas.height = 320
  const g = canvas.getContext("2d")
  if (!g) return canvas
  g.fillStyle = "#3d2818"
  g.fillRect(0, 0, 512, 320)
  for (let i = 0; i < 28; i++) {
    g.strokeStyle = `rgba(92, 60, 36, ${0.2 + (i % 4) * 0.05})`
    g.beginPath()
    const y = 8 + i * 11
    g.moveTo(0, y)
    g.bezierCurveTo(140, y + 4, 300, y - 3, 512, y + 1)
    g.stroke()
  }
  g.strokeStyle = "rgba(20, 10, 6, 0.45)"
  g.lineWidth = 14
  g.strokeRect(7, 7, 498, 306)
  drawBlossom(g, 256, 168, 78)
  drawBlossom(g, 148, 214, 28)
  return canvas
}

function drawBlossom(g: CanvasRenderingContext2D, x: number, y: number, r: number) {
  g.save()
  g.translate(x, y)
  g.fillStyle = "rgba(62, 40, 24, 0.18)"
  g.beginPath()
  g.ellipse(6, r * 0.72, r * 0.7, r * 0.22, 0, 0, Math.PI * 2)
  g.fill()
  for (let i = 0; i < 5; i++) {
    g.rotate((Math.PI * 2) / 5)
    g.fillStyle = i % 2 === 0 ? "#e4d0ba" : "#d3b89c"
    g.beginPath()
    g.ellipse(r * 0.52, 0, r * 0.46, r * 0.3, 0, 0, Math.PI * 2)
    g.fill()
  }
  g.fillStyle = "#eddcc8"
  g.beginPath()
  g.arc(0, 0, r * 0.2, 0, Math.PI * 2)
  g.fill()
  g.fillStyle = "#8a6244"
  for (let i = 0; i < 7; i++) {
    const a = (i / 7) * Math.PI * 2
    g.beginPath()
    g.arc(Math.cos(a) * r * 0.1, Math.sin(a) * r * 0.1, r * 0.03, 0, Math.PI * 2)
    g.fill()
  }
  g.restore()
}

function valanceCanvas(): HTMLCanvasElement {
  const canvas = document.createElement("canvas")
  canvas.width = 1024
  canvas.height = 180
  const g = canvas.getContext("2d")
  if (!g) return canvas
  g.clearRect(0, 0, 1024, 180)
  g.fillStyle = "#6e2430"
  g.beginPath()
  g.moveTo(0, 0)
  g.lineTo(1024, 0)
  g.lineTo(1024, 92)
  const bumps = 16
  const bw = 1024 / bumps
  for (let i = bumps - 1; i >= 0; i--) {
    const x0 = i * bw
    g.quadraticCurveTo(x0 + bw / 2, 172, x0, 92)
  }
  g.closePath()
  g.fill()
  g.strokeStyle = "rgba(255, 214, 206, 0.35)"
  g.lineWidth = 3
  g.beginPath()
  g.moveTo(1024, 92)
  for (let i = bumps - 1; i >= 0; i--) {
    const x0 = i * bw
    g.quadraticCurveTo(x0 + bw / 2, 172, x0, 92)
  }
  g.stroke()
  return canvas
}

function shadowCanvas(): HTMLCanvasElement {
  const canvas = document.createElement("canvas")
  canvas.width = 256
  canvas.height = 128
  const g = canvas.getContext("2d")
  if (!g) return canvas
  const grd = g.createRadialGradient(128, 64, 16, 128, 64, 120)
  grd.addColorStop(0, "rgba(42, 24, 12, 0.32)")
  grd.addColorStop(1, "rgba(42, 24, 12, 0)")
  g.fillStyle = grd
  g.fillRect(0, 0, 256, 128)
  return canvas
}
