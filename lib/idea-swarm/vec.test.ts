import { describe, expect, it } from "vitest"
import { centroid, cluster, cosine, medoid, pca2 } from "./vec"

const near = (x: number, y: number, r = 0.05): number[] => [x + r, y - r, 0.01]
const pts = [[1, 0.1, 0], [1, 0.2, 0.05], [0.9, 0.1, 0], [0, 1, 0.1], [0.05, 1, 0], [0, 0.2, 1]]

describe("vectors", () => {
  it("cosine and centroid", () => {
    expect(cosine([1, 0], [1, 0])).toBeCloseTo(1)
    expect(cosine([1, 0], [0, 1])).toBeCloseTo(0)
    expect(centroid([[0, 2], [2, 0]])).toEqual([1, 1])
    expect(near(1, 1)).toHaveLength(3)
  })
  it("clusters by threshold, leaving lone points alone", () => {
    const groups = cluster(pts, 0.8)
    expect(groups.map((g) => g.length)).toEqual([3, 2, 1])
    expect(groups[0]).toEqual([0, 1, 2])
    expect(cluster(pts, 0.999999).every((g) => g.length === 1)).toBe(true)
    expect(cluster(pts, -1)).toHaveLength(1)
  })
  it("medoid is a real member nearest the centre", () => {
    expect([0, 1, 2]).toContain(medoid([pts[0]!, pts[1]!, pts[2]!]))
  })
  it("pca2 gives a point each, scaled into the unit box, and separates the groups", () => {
    const xy = pca2(pts)
    expect(xy).toHaveLength(6)
    for (const [x, y] of xy) { expect(Math.abs(x)).toBeLessThanOrEqual(1.0001); expect(Math.abs(y)).toBeLessThanOrEqual(1.0001) }
    const d = (a: number, b: number) => Math.hypot(xy[a]![0] - xy[b]![0], xy[a]![1] - xy[b]![1])
    expect(d(0, 1)).toBeLessThan(d(0, 3))
    expect(pca2([])).toEqual([])
  })
})
