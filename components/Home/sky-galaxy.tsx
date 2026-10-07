/**
 * components/Home/sky-galaxy.tsx — Milky Way on the Moon chart
 *
 * Wide star field: `GalaxyBand`, a faint band on the galactic plane, drawn
 * behind the Hipparcos stars. Galaxy zoom, and the powers-of-ten tour's
 * 10^21 m Milky Way step: `GalaxySchematic`, a face-on wash. The tour
 * renders `GalaxySchematic` (and may read `galaxyBandAngle`) instead of a
 * text-only galaxy stop.
 *
 * Numbers: `lib/sky-galaxy.ts`. A schematic of our galaxy, not a catalog
 * of other galaxies and not a photograph.
 */
"use client"

import { useId } from "react"
import {
  GALACTIC_EQUATOR,
  GALAXY_DIAMETER_LY,
  GALAXY_DISK_THICKNESS_LY,
  GALAXY_SCHEMATIC_CAPTION,
  SUN_GALACTIC_RADIUS_LY,
  dustLanes,
  galacticCenterOnGlass,
  galaxySchematicLayout,
  orionSpur,
  polyline,
  schematicToGlass,
  showGalaxySchematic,
  spiralArms,
  galaxyBandAngle,
} from "@/lib/sky-galaxy"

export { galaxyBandAngle, showGalaxySchematic }

const layout = galaxySchematicLayout()

function glassPath(points: readonly { x: number; y: number }[]): string {
  return polyline(points.map((point) => schematicToGlass(point, layout)))
}

function bandArc(withinDeg: number): string {
  const runs: (typeof GALACTIC_EQUATOR)[number][][] = []
  let run: (typeof GALACTIC_EQUATOR)[number][] = []
  for (const point of GALACTIC_EQUATOR) {
    const fromCenter = Math.min(point.l, 360 - point.l)
    if (fromCenter <= withinDeg) run.push(point)
    else if (run.length) {
      runs.push(run)
      run = []
    }
  }
  if (run.length) runs.push(run)
  return runs.map((points) => polyline(points)).join(" ")
}

/** Faint inclined band. Mount it behind the stars on the wide field. */
export function GalaxyBand() {
  const raw = useId().replace(/:/g, "")
  const blur = `sky-mw-band-${raw}`
  const center = galacticCenterOnGlass()
  return (
    <g className="home-sky-galaxy-band" data-galaxy="band" data-angle={galaxyBandAngle.toFixed(2)} aria-hidden="true">
      <defs>
        <filter id={blur} x="-30%" y="-30%" width="160%" height="160%">
          <feGaussianBlur stdDeviation="2.4" />
        </filter>
      </defs>
      <path d={polyline(GALACTIC_EQUATOR)} fill="none" stroke="#c5ddd2" strokeWidth="22" strokeOpacity="0.14" strokeLinejoin="round" filter={`url(#${blur})`} />
      <path d={bandArc(70)} fill="none" stroke="#f3efe4" strokeWidth="16" strokeOpacity="0.16" strokeLinejoin="round" filter={`url(#${blur})`} />
      <path d={polyline(GALACTIC_EQUATOR)} fill="none" stroke="#e7fff4" strokeWidth="2.4" strokeOpacity="0.34" strokeLinejoin="round" />
      <circle cx={center.x} cy={center.y} r="18" fill="#f4efe2" opacity="0.14" filter={`url(#${blur})`} />
    </g>
  )
}

function SchematicBody() {
  const raw = useId().replace(/:/g, "")
  const disk = `sky-mw-disk-${raw}`
  const bulge = `sky-mw-bulge-${raw}`
  const wash = `sky-mw-wash-${raw}`
  const arms = spiralArms()
  const dust = dustLanes()
  const sun = layout.sun
  return (
    <g className="home-sky-galaxy" data-galaxy="schematic" data-angle={galaxyBandAngle.toFixed(2)}>
      <defs>
        <radialGradient id={disk} cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#1a2e28" />
          <stop offset="46%" stopColor="#101c18" />
          <stop offset="82%" stopColor="#0a1210" stopOpacity="0.72" />
          <stop offset="100%" stopColor="#050806" stopOpacity="0" />
        </radialGradient>
        <radialGradient id={bulge} cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#f4fff8" stopOpacity="0.92" />
          <stop offset="28%" stopColor="#d7efe4" stopOpacity="0.55" />
          <stop offset="100%" stopColor="#d7efe4" stopOpacity="0" />
        </radialGradient>
        <filter id={wash} x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="1.15" />
        </filter>
      </defs>
      <circle cx={layout.center.x} cy={layout.center.y} r={layout.radius} fill={`url(#${disk})`} />
      <g filter={`url(#${wash})`} strokeLinejoin="round" fill="none">
        {arms.map((arm, i) => (
          <path key={`arm-${i}`} d={glassPath(arm)} stroke="#d5efe4" strokeWidth="8" strokeOpacity="0.5" />
        ))}
        <path d={glassPath(orionSpur())} stroke="#e7fff4" strokeWidth="3.4" strokeOpacity="0.62" />
      </g>
      <g strokeLinejoin="round" fill="none">
        {dust.map((lane, i) => (
          <path key={`dust-${i}`} d={glassPath(lane)} stroke="#050806" strokeWidth="2.1" strokeOpacity="0.72" />
        ))}
      </g>
      <circle cx={layout.center.x} cy={layout.center.y} r={layout.radius * 0.16} fill={`url(#${bulge})`} />
      <circle className="home-sky-marker" cx={sun.x} cy={sun.y} r="2.15" />
      <text className="home-sky-tag" x={sun.x + 7} y={sun.y - 4}>
        Sun
      </text>
      <text className="home-sky-galaxy-caption" x={260} y={312} textAnchor="middle">
        {GALAXY_SCHEMATIC_CAPTION}
      </text>
      <text className="home-sky-galaxy-caption" x={260} y={326} textAnchor="middle">
        {`Sun in the Orion spur, ${SUN_GALACTIC_RADIUS_LY.toLocaleString("en-US")} ly from the center.`}
      </text>
      <text className="home-sky-galaxy-caption" x={260} y={340} textAnchor="middle">
        {`${GALAXY_DIAMETER_LY.toLocaleString("en-US")} ly across. The star disk is about ${GALAXY_DISK_THICKNESS_LY.toLocaleString("en-US")} ly thin; the bulge is thicker.`}
      </text>
    </g>
  )
}

/**
 * Face-on schematic. `frame="svg"` is a glass of its own for the scale
 * ladder. `frame="layer"` is a group for the chart svg.
 */
export function GalaxySchematic({ frame = "svg" }: { frame?: "svg" | "layer" }) {
  if (frame === "layer") return <SchematicBody />
  return (
    <svg className="home-sky-galaxy-frame" viewBox="0 0 520 400" role="img" aria-label={GALAXY_SCHEMATIC_CAPTION}>
      <rect width="520" height="400" fill="#050806" />
      <SchematicBody />
    </svg>
  )
}
