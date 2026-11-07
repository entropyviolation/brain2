/**
 * lib/idea-swarm/vec.ts — Vectors for the idea swarm: similarity, centres, clusters and a 2D picture
 *
 * `cluster` is average-linkage agglomerative on cosine distance, stopped at a similarity threshold, so nobody has to
 * guess how many ideas there are. A cluster of one is a *lone* idea. `medoid` is the member nearest the centre, the
 * nearest real answer to a point nobody wrote. `pca2` flattens the vectors to x, y for the map (power iteration on
 * the small n×n Gram matrix, so 768 dimensions cost nothing). Pure.
 */

export type Vec = number[]

export const dot = (a: Vec, b: Vec) => a.reduce((s, x, i) => s + x * (b[i] ?? 0), 0)
export const norm = (a: Vec) => Math.sqrt(dot(a, a))
export function cosine(a: Vec, b: Vec): number {
  const d = norm(a) * norm(b)
  return d ? dot(a, b) / d : 0
}

export function centroid(vs: Vec[]): Vec {
  if (!vs.length) return []
  const out = new Array<number>(vs[0]!.length).fill(0)
  for (const v of vs) for (let i = 0; i < out.length; i++) out[i]! += v[i]! / vs.length
  return out
}

/** Index of the vector most similar to the others' centre. */
export function medoid(vs: Vec[]): number {
  const c = centroid(vs)
  let best = 0
  let bestS = -2
  vs.forEach((v, i) => {
    const s = cosine(v, c)
    if (s > bestS) { bestS = s; best = i }
  })
  return best
}

/** Groups of indices whose average pairwise cosine stays at or above `threshold`. Biggest group first. */
export function cluster(vs: Vec[], threshold: number): number[][] {
  let groups: number[][] = vs.map((_, i) => [i])
  const sim: number[][] = vs.map((a) => vs.map((b) => cosine(a, b)))
  const link = (x: number[], y: number[]) => {
    let s = 0
    for (const i of x) for (const j of y) s += sim[i]![j]!
    return s / (x.length * y.length)
  }
  for (;;) {
    let bi = -1, bj = -1, best = threshold
    for (let i = 0; i < groups.length; i++) {
      for (let j = i + 1; j < groups.length; j++) {
        const s = link(groups[i]!, groups[j]!)
        if (s >= best) { best = s; bi = i; bj = j }
      }
    }
    if (bi < 0) break
    groups = groups.filter((_, k) => k !== bi && k !== bj).concat([[...groups[bi]!, ...groups[bj]!]])
  }
  return groups.map((g) => g.sort((a, b) => a - b)).sort((a, b) => b.length - a.length || a[0]! - b[0]!)
}

/** Top two principal axes of the points, as x, y scaled to about -1..1. Deterministic. */
export function pca2(vs: Vec[]): Array<[number, number]> {
  const n = vs.length
  if (n === 0) return []
  if (n === 1) return [[0, 0]]
  const mean = centroid(vs)
  const c = vs.map((v) => v.map((x, i) => x - mean[i]!))
  const gram = c.map((a) => c.map((b) => dot(a, b)))
  const axes: Array<{ v: number[]; l: number }> = []
  for (let k = 0; k < 2; k++) {
    let v = Array.from({ length: n }, (_, i) => Math.sin(i * 12.9898 + k * 78.233) + 1.1)
    let l = 0
    for (let it = 0; it < 80; it++) {
      const w = gram.map((row) => dot(row, v))
      for (const a of axes) { const p = dot(w, a.v); for (let i = 0; i < n; i++) w[i]! -= p * a.v[i]! }
      l = norm(w)
      if (!l) break
      v = w.map((x) => x / l)
    }
    axes.push({ v, l })
  }
  const pts = vs.map((_, i) => [axes[0]!.v[i]! * Math.sqrt(axes[0]!.l), axes[1]!.v[i]! * Math.sqrt(axes[1]!.l)] as [number, number])
  const m = Math.max(1e-9, ...pts.flatMap((p) => [Math.abs(p[0]), Math.abs(p[1])]))
  return pts.map(([x, y]) => [x / m, y / m])
}
