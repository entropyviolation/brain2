/**
 * components/BabyGame/trees.ts — Big trees, painted once each and drawn as standing things
 *
 * A tree is a trunk on one solid tile and a canopy that rises two and a half tiles above it. Four kinds (oak, pine, birch,
 * blossom) times a few seeds, each a small canvas of shaded leaf-clumps with a dark rim, lit from the top left. They are
 * y-sorted with friends and the player, and fade when someone is standing behind one.
 */

export type TreeKind = "oak" | "pine" | "birch" | "blossom"

export type TreeArt = { img: HTMLCanvasElement; w: number; h: number; /** Half-width of the canopy, for fading. */ reach: number; /** Height of the canopy above the trunk's base. */ rise: number }

const RAMPS: Record<TreeKind, string[]> = {
  oak: ["#173f2a", "#235a37", "#2f7a45", "#45a05a", "#6fc47a", "#a2e29a"],
  pine: ["#10362b", "#1a4d3a", "#26694b", "#388a5c", "#58a874", "#8fcd9a"],
  birch: ["#2a5a34", "#3b7a44", "#56a055", "#7cc274", "#a8dc8e", "#d0f0b0"],
  blossom: ["#8a2f5e", "#b04578", "#d86a98", "#f092b4", "#ffbcd2", "#ffe2ec"],
}

function rng(seed: number) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

type Blob = { x: number; y: number; r: number }

const cache = new Map<string, TreeArt>()

/** Canvas pixels per game pixel: a tree is painted this much finer than it is shown, so the leaves have grain. */
const Q = 3

function paint(kind: TreeKind, seed: number): TreeArt {
  const rand = rng(seed * 977 + kind.length * 13)
  const gw = kind === "pine" ? 36 : 48
  const gh = kind === "pine" ? 66 : 62
  const w = gw * Q
  const h = gh * Q
  const canvas = document.createElement("canvas")
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext("2d")!
  const ramp = RAMPS[kind]
  const px = (c: string, x: number, y: number, ww = 1, hh = 1) => {
    ctx.fillStyle = c
    ctx.fillRect(Math.round(x), Math.round(y), ww, hh)
  }
  const cx = w / 2

  // ground shadow
  ctx.fillStyle = "rgba(20,30,20,0.28)"
  ctx.beginPath()
  ctx.ellipse(cx, h - 3 * Q, (kind === "pine" ? 10 : 15) * Q, 3.4 * Q, 0, 0, Math.PI * 2)
  ctx.fill()

  // trunk: lit left edge, shaded right edge, cracks, and roots that flare at the foot
  const trunkW = (kind === "pine" ? 5 : kind === "birch" ? 5 : 8) * Q
  const trunkTop = h - (kind === "pine" ? 16 : 24) * Q
  const bark = kind === "birch" ? ["#f0ece4", "#d6d0c4", "#2b1d2e"] : ["#8a5a44", "#6b4630", "#4e3224"]
  for (let y = trunkTop; y < h - 2 * Q; y++) {
    const flare = y > h - 7 * Q ? Math.round((y - (h - 7 * Q)) * 0.7) : 0
    const left = Math.round(cx - trunkW / 2) - flare
    const wide = trunkW + flare * 2
    px(bark[1]!, left, y, wide, 1)
    px(bark[0]!, left, y, Math.max(1, Math.floor(wide / 3)), 1)
    px(bark[0]!, left + Math.floor(wide / 3), y, 1, 1)
    px(bark[2]!, left + wide - Math.max(1, Math.round(Q / 2)), y, Math.max(1, Math.round(Q / 2)), 1)
    if (kind === "birch" && rand() < 0.08) px(bark[2]!, left + 1 + Math.floor(rand() * (wide - 2)), y, 2 + Math.floor(rand() * 3), 1)
    else if (kind !== "birch" && rand() < 0.07) px(bark[2]!, left + 1 + Math.floor(rand() * (wide - 2)), y, 1, 2 + Math.floor(rand() * 4))
  }

  // canopy as a mask of blobs (or stacked tiers for a pine), each with small clumps round its rim so the edge is scalloped
  const blobs: Blob[] = []
  if (kind === "pine") {
    const tiers = 5
    for (let i = 0; i < tiers; i++) {
      const ty = 6 + i * 8
      const tw = 5 + i * 3.4
      for (let k = -2; k <= 2; k++) blobs.push({ x: cx + k * (tw / 4.2) * Q, y: (ty + 6 + Math.abs(k) * 1.6) * Q, r: (tw / 3.2 + 2) * Q })
    }
  } else {
    const count = kind === "birch" ? 8 : 11
    const spread = kind === "birch" ? 8 : 11
    for (let i = 0; i < count; i++) {
      const a = rand() * Math.PI * 2
      const d = rand() * spread
      blobs.push({ x: cx + Math.cos(a) * d * 1.05 * Q, y: (22 + Math.sin(a) * d * 0.78) * Q, r: (7 + rand() * 4.4) * Q })
    }
    blobs.push({ x: cx, y: 22 * Q, r: 11 * Q })
  }
  const clumps: Blob[] = []
  for (const b of blobs) {
    for (let n = 0; n < 5; n++) {
      const a = rand() * Math.PI * 2
      clumps.push({ x: b.x + Math.cos(a) * b.r * 0.82, y: b.y + Math.sin(a) * b.r * 0.82, r: b.r * (0.26 + rand() * 0.14) })
    }
  }
  const inMask = new Uint8Array(w * h)
  const light = new Float32Array(w * h)
  for (const b of [...blobs, ...clumps]) {
    for (let y = Math.max(0, Math.floor(b.y - b.r)); y <= Math.min(h - 1, Math.ceil(b.y + b.r)); y++) {
      for (let x = Math.max(0, Math.floor(b.x - b.r)); x <= Math.min(w - 1, Math.ceil(b.x + b.r)); x++) {
        const dx = x - b.x
        const dy = y - b.y
        const d = Math.sqrt(dx * dx + dy * dy) / b.r
        if (d > 1) continue
        const i = y * w + x
        // lit from the top left: bright on that side of each clump, dark underneath
        const l = 1 - d * 0.45 - (dx * 0.5 + dy * 0.9) / (b.r * 2)
        if (!inMask[i] || l > light[i]!) light[i] = l
        inMask[i] = 1
      }
    }
  }
  // leaf grain: noise in 2×2 blocks, so the texture reads as leaves and not static
  const grain = new Float32Array(Math.ceil(w / 2) * Math.ceil(h / 2))
  for (let i = 0; i < grain.length; i++) grain[i] = rand() - 0.5
  const gstride = Math.ceil(w / 2)
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x
      if (!inMask[i]) continue
      const edge = [inMask[i - 1], inMask[i + 1], inMask[i - w], inMask[i + w]].some((n) => !n)
      let v = light[i]! * (ramp.length - 1) + grain[(y >> 1) * gstride + (x >> 1)]! * 1.5
      if (kind === "pine") v += y % (8 * Q) < 2 * Q ? -0.6 : 0
      const tone = Math.max(0, Math.min(ramp.length - 1, Math.round(v)))
      px(edge && inMask[i + w] === 0 ? ramp[0]! : ramp[tone]!, x, y)
    }
  }
  // outline the whole canopy in the darkest leaf, two canvas pixels thick
  const ring = (src: Uint8Array) => {
    const next = new Uint8Array(src)
    for (let y = 1; y < h - 1; y++) {
      for (let x = 1; x < w - 1; x++) {
        if (src[y * w + x]) continue
        if ([src[y * w + x - 1], src[y * w + x + 1], src[(y - 1) * w + x], src[(y + 1) * w + x]].some(Boolean)) next[y * w + x] = 1
      }
    }
    return next
  }
  const ring1 = ring(inMask)
  const ring2 = ring(ring1)
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (inMask[y * w + x]) continue
      if (ring2[y * w + x]) px("#0e2a1e", x, y)
    }
  }
  // leaf glints and a few fruit or blossoms
  for (let n = 0; n < 26 * Q; n++) {
    const x = Math.floor(rand() * w)
    const y = Math.floor(rand() * 40 * Q)
    if (!inMask[y * w + x]) continue
    px(ramp[ramp.length - 1]!, x, y, Q + 1, Math.max(1, Q - 1))
    px(ramp[ramp.length - 2]!, x + 1, y + Math.max(1, Q - 1), Q, 1)
  }
  if (kind === "oak") for (let n = 0; n < 4; n++) {
    const x = 8 * Q + Math.floor(rand() * (w - 16 * Q))
    const y = 14 * Q + Math.floor(rand() * 18 * Q)
    if (inMask[y * w + x]) {
      px("#b8344e", x, y, Q + 1, Q + 1)
      px("#e8506a", x, y, Q, Q)
      px("#ffb0bc", x, y, 1, 1)
    }
  }
  if (kind === "pine") px(ramp[0]!, cx, Q, Q, 3 * Q)
  return { img: canvas, w: gw, h: gh, reach: kind === "pine" ? 14 : 20, rise: kind === "pine" ? 58 : 44 }
}

/** A stump, seedling or sapling, drawn straight to the canvas (a few pixels each, so nothing to cache). `seed` is 0..1 and picks the lean. */
export function drawSprout(ctx: CanvasRenderingContext2D, stage: "stump" | "seedling" | "sapling", kind: TreeKind, cx: number, baseY: number, seed: number) {
  const ramp = RAMPS[kind]
  const px = (c: string, x: number, y: number, w = 1, h = 1) => {
    ctx.fillStyle = c
    ctx.fillRect(Math.round(cx + x), Math.round(baseY + y), w, h)
  }
  const bark = kind === "birch" ? ["#f0ece4", "#d6d0c4", "#2b1d2e"] : ["#8a5a44", "#6b4630", "#4e3224"]
  px("rgba(20,30,20,0.25)", -5, -3, 10, 2)
  if (stage === "stump") {
    px(bark[2]!, -5, -7, 10, 6)
    px(bark[1]!, -4, -7, 8, 5)
    px(bark[0]!, -4, -9, 8, 3)
    px(bark[1]!, -2, -8, 4, 1)
    px(bark[2]!, -1, -8, 2, 1)
    return
  }
  const lean = seed < 0.33 ? -1 : seed > 0.66 ? 1 : 0
  if (stage === "seedling") {
    px(ramp[1]!, 0, -6, 1, 4)
    px(ramp[3]!, -3, -7, 3, 2)
    px(ramp[4]!, 1, -8, 3, 2)
    px(ramp[0]!, -3, -5, 3, 1)
    return
  }
  px(bark[1]!, 0, -10, 2, 8)
  px(bark[2]!, 1, -10, 1, 8)
  px(ramp[0]!, -5 + lean, -17, 10, 8)
  px(ramp[2]!, -4 + lean, -18, 8, 8)
  px(ramp[3]!, -3 + lean, -18, 5, 4)
  px(ramp[5]!, -2 + lean, -17, 2, 1)
}

export function treeArt(kind: TreeKind, variant: number): TreeArt {
  const key = `${kind}${variant % 4}`
  let art = cache.get(key)
  if (!art) {
    art = paint(kind, (variant % 4) + 1)
    cache.set(key, art)
  }
  return art
}

/** Which tree stands on this tile: the zone sets the mix, a hash picks the kind. */
export function treeAt(tx: number, ty: number, zone: string | null): { kind: TreeKind; variant: number } {
  let t = (tx * 374761393 + ty * 668265263) >>> 0
  t = (t ^ (t >>> 13)) * 1274126177
  const r = ((t ^ (t >>> 16)) >>> 0) / 4294967296
  const variant = Math.floor(r * 997)
  const pick = (a: TreeKind, b: TreeKind, split: number): TreeKind => (r < split ? a : b)
  if (zone === "wood") return { kind: pick("pine", "oak", 0.62), variant }
  if (zone === "orchard") return { kind: pick("blossom", "oak", 0.34), variant }
  if (zone === "hill" || zone === "cove" || zone === "barn") return { kind: pick("pine", "birch", 0.6), variant }
  if (zone === "rhizome") return { kind: pick("oak", "birch", 0.55), variant }
  if (zone === "marsh") return { kind: pick("birch", "oak", 0.7), variant }
  if (zone === "stacks") return { kind: pick("oak", "pine", 0.5), variant }
  if (zone === "meadow" || zone === "pond" || zone === "farm") return { kind: pick("birch", "oak", 0.4), variant }
  return { kind: r < 0.45 ? "pine" : r < 0.8 ? "oak" : "birch", variant }
}
