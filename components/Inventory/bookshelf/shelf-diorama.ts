/**
 * components/Inventory/bookshelf/shelf-diorama.ts — Three-arch cherry bookcase
 *
 * Loaded only on the desktop stage. The case is stained-cherry millwork: a wide
 * center arch between two narrower arches, pilasters, and paneled alcoves.
 * That woodwork follows a library photograph the shelf was asked to match.
 * A covered book's front face shows the cover, cropped to the face, never
 * stretched. The spine and the hinge are a generated binding in a color
 * sampled from that picture. A book without a cover stays spine-out, with
 * its title set as text on the binding. Thickness comes from shelfMeasures
 * and is only scaled so a row fits its bay. One pulled book eases forward
 * and squares to the camera. A search only quiets the titles that do not
 * match. Reduced motion snaps the pulled book forward. Dispose on the
 * returned cleanup.
 */
import * as THREE from "three"
import { coverFrame, shelfMeasures, type ShelfBook } from "./shelf-books"
import {
  hexToRgb,
  readCoverColor,
  rgbToHex,
  spineCanvas,
  spineKind,
  spineTones,
  surfaceTakesCoverArt,
  type BookSurface,
} from "./shelf-spine"

export interface BookshelfMount {
  books: readonly ShelfBook[]
  reducedMotion: boolean
  getMatchIds: () => readonly string[]
  getPulledId: () => string | null
  getCoverSrcs: () => Readonly<Record<string, string>>
  onSelect: (id: string | null) => void
}

const OUTER_W = 7.05
const OUTER_D = 1.02
const JAMB = 0.24
const POST = 0.2
const BOARD_T = 0.07
const SHELF_Z0 = -0.28
const SHELF_Z1 = 0.42
const FRONT_Z = 0.36
const GAP = 0.04
const PULL_Z = 0.78
/** Side arches spring here. The center arch springs higher, so that bay holds another shelf. */
const SIDE_SPRING = 4.08
const CENTER_SPRING = 4.78

const innerLeft = -OUTER_W / 2 + JAMB
const innerRight = OUTER_W / 2 - JAMB
const free = innerRight - innerLeft - POST * 2
const sideW = free / (1 + 1.62 + 1)
const centerW = sideW * 1.62

interface Bay {
  x0: number
  x1: number
  shelves: readonly number[]
}

const sideShelves = [0.5, 1.36, 2.22, 3.08]
const centerShelves = [0.5, 1.32, 2.14, 2.96, 3.78]
const leftX0 = innerLeft
const leftX1 = innerLeft + sideW
const centerX0 = leftX1 + POST
const centerX1 = centerX0 + centerW
const rightX0 = centerX1 + POST

const BAYS: Bay[] = [
  { x0: leftX0, x1: leftX1, shelves: sideShelves },
  { x0: centerX0, x1: centerX1, shelves: centerShelves },
  { x0: rightX0, x1: rightX0 + sideW, shelves: sideShelves },
]

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
  title: string
  cloth: string
  seed: number
  /** Generated binding. Null on a spine-out book, whose facing material is `front`. */
  spine: THREE.MeshStandardMaterial | null
  hinge: THREE.MeshStandardMaterial | null
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
  renderer.toneMappingExposure = 1.18
  renderer.setClearColor(0x000000, 0)

  const scene = new THREE.Scene()
  const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 40)
  camera.position.set(0.05, 2.45, 9.4)
  camera.lookAt(0, 2.4, 0)

  scene.add(new THREE.AmbientLight(0xffe0d4, 0.74))
  const key = new THREE.DirectionalLight(0xffc8b4, 1.05)
  key.position.set(0.4, 6.6, 6.4)
  scene.add(key)
  const fill = new THREE.DirectionalLight(0xe8b0a0, 0.24)
  fill.position.set(-3.4, 3.4, 4.8)
  scene.add(fill)

  const root = new THREE.Group()
  scene.add(root)

  const woodTex = trackTex(new THREE.CanvasTexture(woodCanvas()))
  woodTex.wrapS = THREE.RepeatWrapping
  woodTex.wrapT = THREE.RepeatWrapping
  const woodMat = trackMat(
    new THREE.MeshStandardMaterial({ map: woodTex, color: 0xffffff, roughness: 0.58, metalness: 0 }),
  )
  const darkMat = trackMat(
    new THREE.MeshStandardMaterial({ color: 0x321410, roughness: 0.84, metalness: 0 }),
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
      title: book.book.title,
      cloth: book.cloth,
      seed: hash(book.book.id),
      spine: row.spine,
      hinge: row.hinge,
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

  const paintSpine = (book: Placed, cloth: string) => {
    if (!book.spine) return
    const tex = trackTex(
      new THREE.CanvasTexture(spineCanvas({ title: book.title, cloth, seed: book.seed, showTitle: false })),
    )
    book.spine.map = tex
    book.spine.needsUpdate = true
    if (!book.hinge) return
    const shade = new THREE.Color(spineTones(hexToRgb(cloth)).shade)
    book.hinge.color.copy(shade)
    book.hinge.userData.base = shade.clone()
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
        paintSpine(book, book.cloth)
        continue
      }
      const token = src
      loader.load(token, (tex) => {
        if (stopped || book.coverSrc !== token) {
          tex.dispose()
          return
        }
        const image = tex.image as CanvasImageSource & { width?: number; height?: number }
        const frame = coverFrame(image.width || 2, image.height || 3, book.w / Math.max(book.h, 0.001))
        tex.repeat.set(frame.repeatX, frame.repeatY)
        tex.offset.set(frame.offsetX, frame.offsetY)
        tex.wrapS = THREE.RepeatWrapping
        tex.wrapT = THREE.RepeatWrapping
        tex.needsUpdate = true
        tex.colorSpace = THREE.SRGBColorSpace
        tex.anisotropy = Math.min(8, maxAniso)
        book.photo = tex
        if (book.cover && surfaceTakesCoverArt("front")) paintFront(book, tex)
        const sampled = readCoverColor(image)
        if (sampled) paintSpine(book, rgbToHex(sampled))
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
    // The floor sits forward of the case. Fit the front of the box, or the plinth clips.
    const dist = (Math.max(distX, distY) + span.z * 0.45) * 1.16
    camera.position.set(0, span.y * 0.03, dist)
    camera.lookAt(0, 0, 0)
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
  const slots: { y: number; bay: Bay; items: Measured[] }[] = []
  for (const bay of BAYS) {
    for (const y of shelvesFor(bay.shelves, measured.length)) slots.push({ y, bay, items: [] })
  }
  if (measured.length === 0 || slots.length === 0) return []
  const per = Math.ceil(measured.length / slots.length)
  measured.forEach((book, index) => {
    const slot = slots[Math.min(slots.length - 1, Math.floor(index / per))]
    slot.items.push(book)
  })
  let scale = 1
  for (const slot of slots) {
    const bayW = slot.bay.x1 - slot.bay.x0
    const raw = slot.items.reduce((sum, book) => sum + book.w, 0) + Math.max(0, slot.items.length - 1) * GAP
    scale = Math.min(scale, (bayW - 0.1) / Math.max(raw, 0.001))
  }
  scale = Math.min(1, scale)
  const standing: Standing[] = []
  for (const slot of slots) {
    const bayW = slot.bay.x1 - slot.bay.x0
    const used = slot.items.reduce((sum, book) => sum + book.w * scale, 0) + Math.max(0, slot.items.length - 1) * GAP
    let cursor = slot.bay.x0 + (bayW - used) / 2
    for (const book of slot.items) {
      const w = book.w * scale
      standing.push({
        ...book,
        w,
        x: cursor + w / 2,
        y: slot.y + book.h / 2 + 0.01,
        z: FRONT_Z - book.d / 2,
      })
      cursor += w + GAP
    }
  }
  return standing
}

/** A short list leaves air between shelves, the way a lived-in case does. */
function shelvesFor(all: readonly number[], count: number): number[] {
  if (count > 24) return [...all]
  if (count > 8) return all.filter((_, index) => index === 0 || index === 2 || index === all.length - 1)
  const low = all[0]
  const high = all[Math.min(2, all.length - 1)]
  return low === high ? [low] : [low, high]
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
): {
  group: THREE.Group
  mats: ShelfMat[]
  front: ShelfMat
  spine: THREE.MeshStandardMaterial | null
  hinge: THREE.MeshStandardMaterial | null
} {
  const cloth = new THREE.Color(book.cloth)
  const pages = new THREE.Color("#efe6d4")
  const seed = hash(book.book.id)
  const bindingTex = trackTex(
    new THREE.CanvasTexture(
      spineCanvas({ title: book.book.title, cloth: book.cloth, seed, showTitle: !book.cover }),
    ),
  )
  const coverTex = book.cover ? trackTex(new THREE.CanvasTexture(coverCanvas(book.book.title, book.cloth))) : null
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
  const print = coverTex ? printed(coverTex) : null
  const artOr = (surface: BookSurface, fallback: ShelfMat): ShelfMat =>
    print && surfaceTakesCoverArt(surface) ? print : fallback
  const binding = face(new THREE.Color("#ffffff"), bindingTex, 0.72)
  const kind = spineKind(seed)
  binding.roughness = kind === "leather" ? 0.56 : kind === "paper" ? 0.93 : 0.86
  binding.metalness = kind === "leather" ? 0.04 : 0

  if (!book.cover) {
    const front = artOr("spine", binding)
    const page = artOr("pages", face(pages, pageTex, 0.9))
    const side = artOr("board", face(cloth))
    // +X, -X, +Y, -Y, +Z, -Z. The camera looks along +Z, so +Z is the spine you read.
    const materials: ShelfMat[] = [side, side, page, side, front, page]
    group.add(new THREE.Mesh(trackGeo(new THREE.BoxGeometry(book.w, book.h, book.d)), materials))
    return { group, mats: materials, front, spine: null, hinge: null }
  }

  // Covered volume. The front board shows the cover. The left hinge is the
  // binding. Hinge width and page-block size stay as they were.
  const boardT = Math.min(0.012, book.d * 0.22)
  const spineW = Math.min(0.03, book.w * 0.08)
  const pageW = Math.max(0.05, book.w - spineW - 0.01)
  const pageH = Math.max(0.05, book.h - 0.016)
  const pageD = Math.max(0.02, book.d - boardT * 2 - 0.004)
  const pageMat = artOr("pages", face(pages, pageTex, 0.92))
  const pageMesh = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(pageW, pageH, pageD)), pageMat)
  pageMesh.position.set(spineW * 0.35, 0, 0)

  const boardEdge = face(new THREE.Color("#f3ecdf"), undefined, 0.84)
  const front = artOr("front", binding)
  const board = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(book.w, book.h, boardT)), [
    artOr("board", boardEdge),
    artOr("board", boardEdge),
    artOr("board", boardEdge),
    artOr("board", boardEdge),
    front,
    artOr("board", boardEdge),
  ])
  board.position.z = book.d / 2 - boardT / 2

  const backMat = artOr("back", face(cloth.clone().multiplyScalar(0.92)))
  const back = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(book.w, book.h, boardT)), backMat)
  back.position.z = -book.d / 2 + boardT / 2

  const hinge = face(new THREE.Color(spineTones(hexToRgb(book.cloth)).shade), undefined, 0.9)
  const spineFace = artOr("spine", binding)
  const spine = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(spineW, book.h, book.d - boardT)), [
    hinge,
    spineFace,
    hinge,
    hinge,
    spineFace,
    hinge,
  ])
  spine.position.set(-book.w / 2 + spineW / 2, 0, -boardT / 2)

  group.add(pageMesh, back, spine, board)
  return { group, mats: [pageMat, boardEdge, front, backMat, binding, hinge], front, spine: binding, hinge }
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
    return mesh
  }

  const panelTex = trackTex(new THREE.CanvasTexture(panelCanvas()))
  panelTex.wrapS = THREE.RepeatWrapping
  panelTex.wrapT = THREE.RepeatWrapping
  const panelMat = trackMat(
    new THREE.MeshStandardMaterial({ map: panelTex, color: 0xffffff, roughness: 0.74, metalness: 0 }),
  )
  const centerR = centerW / 2 - 0.06
  const sideR = sideW / 2 - 0.05
  const crown = CENTER_SPRING + centerR + 0.16

  box(OUTER_W + 0.55, crown + 0.2, 0.08, 0, (crown + 0.2) / 2 - 0.02, -0.5, panelMat)

  box(OUTER_W + 0.36, 0.1, OUTER_D + 0.22, 0, 0.05, 0.04, darkMat)
  box(OUTER_W + 0.18, 0.22, OUTER_D + 0.1, 0, 0.2, 0.02)
  box(OUTER_W + 0.28, 0.14, OUTER_D * 0.7, 0, crown + 0.08, -0.02)

  const pierH = CENTER_SPRING - 0.32
  const pierY = 0.32 + pierH / 2
  box(JAMB, pierH, OUTER_D, -OUTER_W / 2 + JAMB / 2, pierY, 0)
  box(JAMB, pierH, OUTER_D, OUTER_W / 2 - JAMB / 2, pierY, 0)
  for (const x of [leftX1 + POST / 2, centerX1 + POST / 2]) {
    box(POST, pierH, OUTER_D - 0.02, x, pierY, 0.02)
    box(POST + 0.1, 0.1, OUTER_D + 0.04, x, SIDE_SPRING, 0.03)
    box(POST + 0.08, 0.12, OUTER_D, x, 0.42, 0.02)
    box(POST + 0.12, 0.1, OUTER_D + 0.06, x, CENTER_SPRING, 0.04)
  }
  box(JAMB + 0.08, 0.1, OUTER_D + 0.06, -OUTER_W / 2 + JAMB / 2, SIDE_SPRING, 0.03)
  box(JAMB + 0.08, 0.1, OUTER_D + 0.06, OUTER_W / 2 - JAMB / 2, SIDE_SPRING, 0.03)
  box(JAMB + 0.1, 0.1, OUTER_D + 0.08, -OUTER_W / 2 + JAMB / 2, CENTER_SPRING, 0.04)
  box(JAMB + 0.1, 0.1, OUTER_D + 0.08, OUTER_W / 2 - JAMB / 2, CENTER_SPRING, 0.04)

  const shadeMat = trackMat(
    new THREE.MeshBasicMaterial({ color: 0x1a0a08, transparent: true, opacity: 0.42, depthWrite: false }),
  )
  for (const bay of BAYS) {
    const w = bay.x1 - bay.x0
    const cx = (bay.x0 + bay.x1) / 2
    const alcoveTop = bay === BAYS[1] ? CENTER_SPRING - 0.06 : SIDE_SPRING - 0.06
    box(w - 0.04, alcoveTop - 0.34, 0.03, cx, (alcoveTop + 0.34) / 2, -0.4, panelMat)
    for (const y of bay.shelves) {
      box(w - 0.04, BOARD_T, SHELF_Z1 - SHELF_Z0, cx, y - BOARD_T / 2, (SHELF_Z0 + SHELF_Z1) / 2)
      const shade = new THREE.Mesh(trackGeo(new THREE.PlaneGeometry(w - 0.08, 0.22)), shadeMat)
      shade.position.set(cx, y - BOARD_T - 0.12, -0.08)
      scene.add(shade)
    }
  }

  addArch(scene, trackGeo, woodMat, (leftX0 + leftX1) / 2, SIDE_SPRING, sideR)
  addArch(scene, trackGeo, woodMat, (centerX0 + centerX1) / 2, CENTER_SPRING, centerR)
  addArch(scene, trackGeo, woodMat, (rightX0 + rightX0 + sideW) / 2, SIDE_SPRING, sideR)

  const pot = trackMat(new THREE.MeshStandardMaterial({ color: 0xd9c6a6, roughness: 0.68, metalness: 0 }))
  const leaf = trackMat(new THREE.MeshStandardMaterial({ color: 0x3d6840, roughness: 0.78, metalness: 0 }))
  const clay = trackMat(new THREE.MeshStandardMaterial({ color: 0xefe6d6, roughness: 0.52, metalness: 0.02 }))
  for (const bay of [BAYS[0], BAYS[2]]) {
    const cx = (bay.x0 + bay.x1) / 2
    box(0.34, 0.04, 0.22, cx, 3.96, 0.12)
    addPlant(scene, trackGeo, pot, leaf, cx, 3.98, 0.12)
  }
  const mid = (centerX0 + centerX1) / 2
  box(0.28, 0.04, 0.2, mid, 4.66, 0.1)
  addVase(scene, trackGeo, clay, mid, 4.68, 0.1)
  addUrn(scene, trackGeo, clay, -OUTER_W / 2 - 0.42, 0.62)
  addUrn(scene, trackGeo, clay, OUTER_W / 2 + 0.42, 0.62)

  const floorTex = trackTex(new THREE.CanvasTexture(parquetCanvas()))
  floorTex.wrapS = THREE.RepeatWrapping
  floorTex.wrapT = THREE.RepeatWrapping
  floorTex.repeat.set(3, 1.4)
  const floor = new THREE.Mesh(
    trackGeo(new THREE.PlaneGeometry(OUTER_W + 1.3, 2.4)),
    trackMat(new THREE.MeshStandardMaterial({ map: floorTex, roughness: 0.72, metalness: 0 })),
  )
  floor.rotation.x = -Math.PI / 2
  floor.position.set(0, 0.012, 0.72)
  scene.add(floor)

  const shadowTex = trackTex(new THREE.CanvasTexture(shadowCanvas()))
  const shadow = new THREE.Mesh(
    trackGeo(new THREE.PlaneGeometry(OUTER_W + 0.8, 1.5)),
    trackMat(new THREE.MeshBasicMaterial({ map: shadowTex, transparent: true, depthWrite: false })),
  )
  shadow.rotation.x = -Math.PI / 2
  shadow.position.set(0, 0.02, 0.35)
  scene.add(shadow)
}

function addArch(
  scene: THREE.Object3D,
  trackGeo: <T extends THREE.BufferGeometry>(geo: T) => T,
  woodMat: THREE.Material,
  cx: number,
  spring: number,
  radius: number,
) {
  const outer = new THREE.Mesh(trackGeo(new THREE.TorusGeometry(radius, 0.055, 8, 36, Math.PI)), woodMat)
  outer.position.set(cx, spring, 0.46)
  scene.add(outer)
  const inner = new THREE.Mesh(trackGeo(new THREE.TorusGeometry(radius - 0.08, 0.026, 6, 32, Math.PI)), woodMat)
  inner.position.set(cx, spring, 0.4)
  scene.add(inner)
  const key = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.16, 0.18, 0.1)), woodMat)
  key.position.set(cx, spring + radius, 0.48)
  scene.add(key)
}

function addPlant(
  scene: THREE.Object3D,
  trackGeo: <T extends THREE.BufferGeometry>(geo: T) => T,
  pot: THREE.Material,
  leaf: THREE.Material,
  x: number,
  y: number,
  z: number,
) {
  const potMesh = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(0.075, 0.055, 0.1, 10)), pot)
  potMesh.position.set(x, y + 0.05, z)
  scene.add(potMesh)
  for (const [dx, dy, dz, r] of [
    [0, 0.18, 0, 0.07],
    [0.05, 0.22, 0.02, 0.05],
    [-0.045, 0.21, 0.02, 0.048],
    [0.01, 0.27, -0.015, 0.04],
  ] as const) {
    const blob = new THREE.Mesh(trackGeo(new THREE.SphereGeometry(r, 8, 6)), leaf)
    blob.position.set(x + dx, y + dy, z + dz)
    scene.add(blob)
  }
}

function addVase(
  scene: THREE.Object3D,
  trackGeo: <T extends THREE.BufferGeometry>(geo: T) => T,
  clay: THREE.Material,
  x: number,
  y: number,
  z: number,
) {
  const body = new THREE.Mesh(trackGeo(new THREE.SphereGeometry(0.07, 12, 10)), clay)
  body.scale.set(1, 1.2, 1)
  body.position.set(x, y + 0.1, z)
  scene.add(body)
  const neck = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(0.028, 0.034, 0.06, 10)), clay)
  neck.position.set(x, y + 0.2, z)
  scene.add(neck)
}

function addUrn(
  scene: THREE.Object3D,
  trackGeo: <T extends THREE.BufferGeometry>(geo: T) => T,
  clay: THREE.Material,
  x: number,
  z: number,
) {
  const foot = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(0.09, 0.1, 0.06, 12)), clay)
  foot.position.set(x, 0.1, z)
  scene.add(foot)
  const body = new THREE.Mesh(trackGeo(new THREE.SphereGeometry(0.11, 14, 12)), clay)
  body.scale.set(1, 1.15, 1)
  body.position.set(x, 0.26, z)
  scene.add(body)
  const neck = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(0.04, 0.05, 0.07, 10)), clay)
  neck.position.set(x, 0.4, z)
  scene.add(neck)
  const lip = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(0.065, 0.05, 0.03, 10)), clay)
  lip.position.set(x, 0.45, z)
  scene.add(lip)
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

function woodCanvas(): HTMLCanvasElement {
  const canvas = document.createElement("canvas")
  canvas.width = 256
  canvas.height = 256
  const g = canvas.getContext("2d")
  if (!g) return canvas
  g.fillStyle = "#c46250"
  g.fillRect(0, 0, 256, 256)
  for (let i = 0; i < 48; i++) {
    const tone = i % 3 === 0 ? "92, 32, 26" : i % 3 === 1 ? "214, 130, 104" : "168, 78, 60"
    g.strokeStyle = `rgba(${tone}, ${0.28 + (i % 5) * 0.07})`
    g.beginPath()
    const y = (i * 5.2) % 256
    g.moveTo(0, y)
    g.bezierCurveTo(80, y + 4, 170, y - 3, 256, y + 1)
    g.stroke()
  }
  g.fillStyle = "rgba(58, 16, 14, 0.4)"
  g.beginPath()
  g.ellipse(74, 118, 10, 6, 0.4, 0, Math.PI * 2)
  g.fill()
  g.fillStyle = "rgba(196, 100, 82, 0.35)"
  g.beginPath()
  g.ellipse(190, 64, 7, 4, -0.3, 0, Math.PI * 2)
  g.fill()
  return canvas
}

function panelCanvas(): HTMLCanvasElement {
  const canvas = document.createElement("canvas")
  canvas.width = 128
  canvas.height = 256
  const g = canvas.getContext("2d")
  if (!g) return canvas
  g.fillStyle = "#7a382e"
  g.fillRect(0, 0, 128, 256)
  for (let x = 8; x < 128; x += 16) {
    g.fillStyle = x % 32 === 8 ? "rgba(48, 16, 14, 0.55)" : "rgba(186, 96, 78, 0.28)"
    g.fillRect(x, 0, 2, 256)
  }
  for (let i = 0; i < 18; i++) {
    g.strokeStyle = `rgba(90, 32, 28, ${0.12 + (i % 4) * 0.04})`
    g.beginPath()
    const x = (i * 7) % 128
    g.moveTo(x, 0)
    g.bezierCurveTo(x + 2, 80, x - 2, 160, x + 1, 256)
    g.stroke()
  }
  return canvas
}

function parquetCanvas(): HTMLCanvasElement {
  const canvas = document.createElement("canvas")
  canvas.width = 256
  canvas.height = 256
  const g = canvas.getContext("2d")
  if (!g) return canvas
  g.fillStyle = "#6a3028"
  g.fillRect(0, 0, 256, 256)
  const a = "#54241e"
  const b = "#8a4034"
  for (let row = 0; row < 8; row++) {
    for (let col = 0; col < 8; col++) {
      g.fillStyle = (row + col) % 2 === 0 ? a : b
      g.save()
      g.translate(col * 32 + 16, row * 32 + 16)
      g.rotate((row + col) % 2 === 0 ? Math.PI / 4 : -Math.PI / 4)
      g.fillRect(-14, -5, 28, 10)
      g.restore()
    }
  }
  g.strokeStyle = "rgba(24, 8, 8, 0.35)"
  g.strokeRect(0.5, 0.5, 255, 255)
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
