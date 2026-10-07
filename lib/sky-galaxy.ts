/**
 * lib/sky-galaxy.ts — Milky Way geometry for the Moon chart
 *
 * A thin disk about 100,000 light years across. The Sun sits about 27,000
 * light years out, in the Orion spur. The plane is inclined about 60.2° to
 * the ecliptic of J2000. Its ascending node is ecliptic longitude 270.02°
 * (A&A 1998 coordinate transformations; the IAU north galactic pole). That
 * is the plane the Hipparcos stars already use, so the band meets them.
 * The galactic center lies toward Sagittarius.
 *
 * `galaxyBandAngle` is that inclination, in degrees. `GalaxySchematic` in
 * `components/Home/sky-galaxy.tsx` is the face-on wash the powers-of-ten
 * tour mounts for the 10^21 m Milky Way step instead of a text card.
 * No catalog, no photograph, no network.
 */

/** Stellar disk, light years. A round diameter, not a fitted profile. */
export const GALAXY_DIAMETER_LY = 100_000
/** Thin-disk thickness, light years. The bulge is thicker. */
export const GALAXY_DISK_THICKNESS_LY = 1_000
/** Bulge, light years through. Several times the thin disk. */
export const GALAXY_BULGE_THICKNESS_LY = 10_000
/** Sun from the galactic center, light years. Orion spur, not the middle. */
export const SUN_GALACTIC_RADIUS_LY = 27_000

const DEG = Math.PI / 180
/** Mean obliquity at J2000. Same figure as the star glass. */
const OBLIQUITY_DEG = 23.4392911
const OBL = OBLIQUITY_DEG * DEG
const COS_E = Math.cos(OBL)
const SIN_E = Math.sin(OBL)

/** IAU north galactic pole, J2000. */
const NGP_RA = 192.85948
const NGP_DEC = 27.12825
/** Galactic center, J2000. Sagittarius A*. */
const GC_RA = 266.405
const GC_DEC = -28.936172

/**
 * Glass the orrery already uses for Hipparcos directions.
 * Limb, tilt, and north match `projectDirection` in `naked-eye-stars.ts`.
 */
export const GALAXY_GLASS = {
  cx: 260,
  cy: 200,
  limb: 216,
  tilt: 0.72,
  north: 100,
} as const

/** Face-on disk on that glass, in pixels. The Sun stays at the chart center. */
export const SCHEMATIC_RADIUS_PX = 96

/** Logarithmic-arm pitch, degrees. A wash, not a survey. */
const ARM_PITCH_DEG = 12
const ARM_PHASE = 0.55
const ARM_R_MIN = 0.13
const ARM_R_MAX = 0.98

export type Vec3 = { x: number; y: number; z: number; lon: number; lat: number }
export type GlassPoint = { x: number; y: number }
export type BandPoint = GlassPoint & { l: number }

const R_EQ_TO_GAL = [
  [-0.0548755604162154, -0.873437090234885, -0.4838350155487132],
  [0.4941094278755837, -0.4448296299600112, 0.7469822444972189],
  [-0.8676661490190047, -0.1980763734312015, 0.4559837761750669],
] as const

function wrap360(deg: number): number {
  const x = deg % 360
  return x < 0 ? x + 360 : x
}

function equatorialOf(raDeg: number, decDeg: number): { x: number; y: number; z: number } {
  const ra = raDeg * DEG
  const dec = decDeg * DEG
  const cosDec = Math.cos(dec)
  return {
    x: cosDec * Math.cos(ra),
    y: cosDec * Math.sin(ra),
    z: Math.sin(dec),
  }
}

/** Equatorial J2000 → mean ecliptic of J2000. Same rotation as the star glass. */
export function eclipticOfRaDec(raDeg: number, decDeg: number): Vec3 {
  const eq = equatorialOf(raDeg, decDeg)
  const y = eq.y * COS_E + eq.z * SIN_E
  const z = -eq.y * SIN_E + eq.z * COS_E
  return {
    x: eq.x,
    y,
    z,
    lon: wrap360(Math.atan2(y, eq.x) / DEG),
    lat: Math.asin(Math.min(1, Math.max(-1, z))) / DEG,
  }
}

function galacticOfEquatorial(eq: { x: number; y: number; z: number }): { l: number; b: number } {
  const g = R_EQ_TO_GAL.map((row) => row[0] * eq.x + row[1] * eq.y + row[2] * eq.z)
  return {
    l: wrap360(Math.atan2(g[1], g[0]) / DEG),
    b: Math.asin(Math.min(1, Math.max(-1, g[2]))) / DEG,
  }
}

function equatorialOfEcliptic(v: { x: number; y: number; z: number }): { x: number; y: number; z: number } {
  return {
    x: v.x,
    y: v.y * COS_E - v.z * SIN_E,
    z: v.y * SIN_E + v.z * COS_E,
  }
}

const NGP = eclipticOfRaDec(NGP_RA, NGP_DEC)

/**
 * Inclination of the galactic plane to the ecliptic, degrees.
 * The wide-field band is this plane. About 60.2.
 */
export const galaxyBandAngle = 90 - NGP.lat

/**
 * Ecliptic longitude of the ascending node, degrees.
 * J2000 value is 270.02, the crossing that threads the Hipparcos Milky Way.
 */
export const galacticAscendingNode = wrap360(NGP.lon + 90)

/** Galactic center on the ecliptic. Longitude falls in Sagittarius. */
export const galacticCenter = eclipticOfRaDec(GC_RA, GC_DEC)

/** Fraction of the disk radius. 27,000 / 50,000, not the cartoon center. */
export function sunRadiusFraction(): number {
  return SUN_GALACTIC_RADIUS_LY / (GALAXY_DIAMETER_LY / 2)
}

function project(v: { x: number; y: number; z: number }, glass = GALAXY_GLASS): GlassPoint {
  return {
    x: glass.cx + v.x * glass.limb,
    y: glass.cy + v.y * glass.limb * glass.tilt - v.z * glass.north,
  }
}

function cross(a: Vec3, b: { x: number; y: number; z: number }): { x: number; y: number; z: number } {
  return {
    x: a.y * b.z - a.z * b.y,
    y: a.z * b.x - a.x * b.z,
    z: a.x * b.y - a.y * b.x,
  }
}

const NODE_VEC = {
  x: Math.cos(galacticAscendingNode * DEG),
  y: Math.sin(galacticAscendingNode * DEG),
  z: 0,
}
const PLANE_AHEAD = cross(NGP, NODE_VEC)

function equatorDirection(phiRad: number): Vec3 {
  const c = Math.cos(phiRad)
  const s = Math.sin(phiRad)
  const x = NODE_VEC.x * c + PLANE_AHEAD.x * s
  const y = NODE_VEC.y * c + PLANE_AHEAD.y * s
  const z = NODE_VEC.z * c + PLANE_AHEAD.z * s
  return {
    x,
    y,
    z,
    lon: wrap360(Math.atan2(y, x) / DEG),
    lat: Math.asin(Math.min(1, Math.max(-1, z))) / DEG,
  }
}

/** Galactic latitude of an equatorial J2000 direction, degrees. */
export function galacticLatitude(raDeg: number, decDeg: number): number {
  return galacticOfEquatorial(equatorialOf(raDeg, decDeg)).b
}

/** Closed galactic equator on the star glass. `l` is galactic longitude. */
export function galacticEquator(samples = 180): BandPoint[] {
  const n = Math.max(8, Math.round(samples))
  const points: BandPoint[] = []
  for (let i = 0; i <= n; i++) {
    const dir = equatorDirection((i / n) * Math.PI * 2)
    const gal = galacticOfEquatorial(equatorialOfEcliptic(dir))
    const at = project(dir)
    points.push({ x: at.x, y: at.y, l: gal.l })
  }
  return points
}

export const GALACTIC_EQUATOR = galacticEquator(180)

/** Where the galactic center falls on the star glass. */
export function galacticCenterOnGlass(): GlassPoint {
  return project(galacticCenter)
}

export type SchematicLayout = {
  center: GlassPoint
  sun: GlassPoint
  radius: number
  sunFraction: number
}

/**
 * Face-on placement. The Sun is the chart center. The galactic center
 * lies from there toward Sagittarius on the same glass, at the Sun's radius.
 */
export function galaxySchematicLayout(radius = SCHEMATIC_RADIUS_PX): SchematicLayout {
  const sun = { x: GALAXY_GLASS.cx, y: GALAXY_GLASS.cy }
  const toward = galacticCenterOnGlass()
  const dx = toward.x - sun.x
  const dy = toward.y - sun.y
  const len = Math.hypot(dx, dy) || 1
  const reach = sunRadiusFraction() * radius
  return {
    sun,
    center: { x: sun.x + (dx / len) * reach, y: sun.y + (dy / len) * reach },
    radius,
    sunFraction: sunRadiusFraction(),
  }
}

export type UnitPoint = { x: number; y: number }

function spiral(phase: number, steps = 96): UnitPoint[] {
  const k = Math.tan(ARM_PITCH_DEG * DEG)
  const sMax = Math.log(ARM_R_MAX / ARM_R_MIN) / k
  const points: UnitPoint[] = []
  for (let i = 0; i <= steps; i++) {
    const s = (sMax * i) / steps
    const r = ARM_R_MIN * Math.exp(k * s)
    const psi = s + phase
    points.push({ x: r * Math.cos(psi), y: r * Math.sin(psi) })
  }
  return points
}

/** Four luminous arms in the unit disk. The Sun is on +x, not on an arm. */
export function spiralArms(): UnitPoint[][] {
  return [0, 1, 2, 3].map((i) => spiral(ARM_PHASE + (i * Math.PI) / 2))
}

/** Dust, just inside each arm. */
export function dustLanes(): UnitPoint[][] {
  return spiralArms().map((arm) => arm.map((p) => ({ x: p.x * 0.972, y: p.y * 0.972 })))
}

/** Short arc of the Orion spur beside the Sun. */
export function orionSpur(): UnitPoint[] {
  const points: UnitPoint[] = []
  for (let i = 0; i <= 28; i++) {
    const t = i / 28
    const ang = -0.42 + t * 0.84
    const r = 0.5 + 0.08 * Math.sin(t * Math.PI)
    points.push({ x: r * Math.cos(ang), y: r * Math.sin(ang) })
  }
  return points
}

/** Unit-disk point → glass pixel. +x is the direction from center to the Sun. */
export function schematicToGlass(point: UnitPoint, layout = galaxySchematicLayout()): GlassPoint {
  const ang = Math.atan2(layout.sun.y - layout.center.y, layout.sun.x - layout.center.x)
  const cos = Math.cos(ang)
  const sin = Math.sin(ang)
  return {
    x: layout.center.x + (point.x * cos - point.y * sin) * layout.radius,
    y: layout.center.y + (point.x * sin + point.y * cos) * layout.radius,
  }
}

export function polyline(points: readonly GlassPoint[], close = false): string {
  if (points.length === 0) return ""
  const body = points.map((p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(" ")
  return close ? `${body} Z` : body
}

/** Chart zoom "galaxy", or the powers-of-ten Milky Way step (10^21 m). */
export function showGalaxySchematic(stop: string | null | undefined): boolean {
  return stop === "galaxy"
}

export const GALAXY_SCHEMATIC_CAPTION =
  "Schematic of our galaxy. Not a catalog of other galaxies, and not a photograph."
