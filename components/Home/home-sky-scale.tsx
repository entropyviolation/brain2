/**
 * components/Home/home-sky-scale.tsx — Full-frame powers-of-ten card
 *
 * One decade fills the glass. Moon and Earth are the photographs in
 * `public/planets` (a projected globe when the chart has painted one).
 * A person, a western gull, and San Diego are original drawings. The
 * other decades are schematics. The previous object stays in the frame
 * at its true size. One element scales from 1 to 0.1 across the dwell,
 * so the Moon photograph pulls back onto the Earth photograph.
 *
 * 10^26 m is a dark field, a labeled circle, and the Milky Way schematic
 * shrunk to one speck. It says it is a schematic.
 */
"use client"

import { GalaxySchematic } from "@/components/Home/sky-galaxy"
import {
  SCALE_PHOTO_SRC,
  scaleExponent,
  scaleFlightZoom,
  scaleFrameCast,
  scaleFrameMetres,
  scaleGlyph,
  scaleImageKey,
  scaleMarkAnchor,
  scaleMetres,
  scalePictureKind,
  tourCaption,
  type ScaleGlyph,
  type ScaleStop,
} from "@/lib/sky-scale"

const INK = "#e8e4da"

export function ScalePower({ n }: { n: number }) {
  return (
    <span className="home-sky-scale-power" aria-label={`10^${n} m`}>
      10<sup aria-hidden="true">{n}</sup> m
    </span>
  )
}

export function ScaleField({
  stop,
  blend,
  earth,
  moon,
}: {
  stop: ScaleStop
  blend: number
  /** Projected globe, when the chart has painted one. */
  earth?: string
  moon?: string
}) {
  const caption = tourCaption(stop)
  const power = `10^${scaleExponent(stop)} m`
  const kind = scalePictureKind(stop)
  const image = scaleImageKey(stop)
  const zoom = scaleFlightZoom(blend)
  const universe = stop === "universe" || (stop === "sloan" && blend > 0.02)
  return (
    <div
      className="home-sky-scale"
      role="img"
      aria-label={`${power}. ${caption}`}
      data-scale-stop={stop}
      data-scale-image={image ?? "schematic"}
      data-scale-kind={kind}
    >
      <div className="home-sky-scale-viewport">
        {universe ? <UniversePlate opacity={stop === "universe" ? 1 : blend} /> : null}
        {stop === "universe" ? null : (
          <div className="home-sky-scale-flight" style={{ transform: `scale(${zoom})` }}>
            {scaleFrameCast(stop).map((mark) => (
              <ScaleObject key={mark} mark={mark} focus={stop} earth={earth} moon={moon} />
            ))}
          </div>
        )}
      </div>
      <p>
        <ScalePower n={scaleExponent(stop)} />
        {caption}
      </p>
    </div>
  )
}

function ScaleObject({
  mark,
  focus,
  earth,
  moon,
}: {
  mark: ScaleStop
  focus: ScaleStop
  earth?: string
  moon?: string
}) {
  const view = scaleFrameMetres(focus)
  const anchor = scaleMarkAnchor(mark, focus)
  const pct = (scaleMetres(mark) / view) * 100
  const dx = (anchor.x / view) * 100
  const dy = (anchor.y / view) * 100
  return (
    <div
      className="home-sky-scale-object"
      data-scale-object={mark}
      data-scale-image={scaleImageKey(mark) ?? "schematic"}
      style={{
        width: `${pct}%`,
        height: `${pct}%`,
        marginLeft: `${dx}%`,
        marginTop: `${dy}%`,
      }}
    >
      <ScaleMark stop={mark} earth={earth} moon={moon} />
    </div>
  )
}

function ScaleMark({ stop, earth, moon }: { stop: ScaleStop; earth?: string; moon?: string }) {
  const key = scaleImageKey(stop)
  if (key === "earth" || key === "moon") {
    const projected = key === "earth" ? earth : moon
    const src = projected || SCALE_PHOTO_SRC[key]
    return (
      <div className={projected ? "home-sky-scale-disk is-globe" : "home-sky-scale-disk"}>
        <img src={src} alt="" draggable={false} />
      </div>
    )
  }
  if (key === "person") return <PersonScene />
  if (key === "gull") return <GullScene />
  if (key === "city") return <CityScene />
  const glyph = scaleGlyph(stop)
  if (!glyph) return null
  return (
    <svg viewBox="0 0 100 100" aria-hidden="true">
      <Glyph glyph={glyph} />
    </svg>
  )
}

function UniversePlate({ opacity }: { opacity: number }) {
  return (
    <div className="home-sky-scale-universe" style={{ opacity }} data-scale-image="schematic">
      <svg viewBox="0 0 100 100" preserveAspectRatio="xMidYMid meet" aria-hidden="true">
        <circle cx="50" cy="52" r="32" fill="none" stroke={INK} strokeWidth="0.45" />
        <text x="50" y="14" textAnchor="middle" fill="#9fffd4" fontSize="3.15">
          schematic
        </text>
      </svg>
      <div className="home-sky-scale-speck" title="Local universe, schematic">
        <GalaxySchematic />
      </div>
    </div>
  )
}

function PersonScene() {
  return (
    <svg viewBox="0 0 100 100" aria-hidden="true">
      <ellipse cx="50" cy="94" rx="14" ry="2.2" fill={INK} opacity="0.28" />
      <circle cx="50" cy="15" r="7.4" fill={INK} />
      <path fill={INK} d="M43 23.5h14l1.5 6H41.5z" />
      <path fill={INK} d="M40 30h20l3 22H37z" />
      <path fill={INK} d="M40 32 24 52l4 3.2L42 38z" />
      <path fill={INK} d="M60 32 78 50l-4.2 3.4L58 38z" />
      <path fill={INK} d="M41 52h8l-1 36h-8z" />
      <path fill={INK} d="M51 52h8l1 36h-8z" />
    </svg>
  )
}

function GullScene() {
  return (
    <svg viewBox="0 0 100 100" aria-hidden="true">
      <path
        fill={INK}
        d="M3 58c14-6 28-8 42-2 4-14 14-26 28-32 1 6-6 12-12 16 10 0 18 4 22 8-12 2-22 6-30 14-14 6-32 4-50-4z"
      />
      <path fill="#f7f4ee" d="M62 46c8-1 14 1 18 4-8 1-14 2-18 6 1-3 1-7 0-10z" />
      <path d="M46 66c1 6 0 10-2 12M54 66c1 6 0 10-2 12" fill="none" stroke={INK} strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  )
}

function CityScene() {
  const night = "#050806"
  const towers: Array<[number, number, number, number]> = [
    [4, 58, 9, 30],
    [14, 40, 11, 48],
    [26, 48, 12, 40],
    [39, 22, 8, 66],
    [48, 36, 13, 52],
    [62, 28, 10, 60],
    [73, 46, 14, 42],
    [88, 54, 9, 34],
  ]
  const windows: Array<[number, number]> = [
    [18, 48],
    [18, 56],
    [18, 64],
    [42, 32],
    [42, 40],
    [42, 48],
    [42, 56],
    [66, 38],
    [66, 46],
    [66, 54],
    [66, 62],
    [78, 54],
    [78, 62],
  ]
  return (
    <svg viewBox="0 0 100 100" aria-hidden="true">
      {towers.map(([x, y, w, h]) => (
        <rect key={`${x}-${y}`} x={x} y={y} width={w} height={h} fill={INK} />
      ))}
      <rect x="42.2" y="14" width="1.6" height="8" fill={INK} />
      {windows.map(([x, y]) => (
        <rect key={`${x}-${y}`} x={x} y={y} width="1.7" height="2.4" fill={night} />
      ))}
      <rect x="0" y="87" width="100" height="1.6" fill={INK} opacity="0.55" />
    </svg>
  )
}

function helixStrand(sign: number): string {
  let d = ""
  for (let i = 0; i <= 36; i++) {
    const t = i / 36
    const y = 16 + t * 68
    const x = 50 + sign * Math.sin(t * Math.PI * 4) * 16
    d += `${i === 0 ? "M" : "L"}${x.toFixed(1)} ${y.toFixed(1)}`
  }
  return d
}

function Glyph({ glyph }: { glyph: ScaleGlyph }) {
  switch (glyph) {
    case "proton":
      return <circle cx="50" cy="50" r="16" fill={INK} />
    case "nucleus":
      return (
        <g fill={INK}>
          {[
            [50, 42],
            [44, 52],
            [56, 52],
            [50, 60],
            [38, 46],
            [62, 46],
          ].map(([x, y], i) => (
            <circle key={i} cx={x} cy={y} r="5" />
          ))}
        </g>
      )
    case "nucleus-dense":
      return (
        <g fill={INK}>
          {Array.from({ length: 12 }, (_, i) => {
            const ang = (i / 12) * Math.PI * 2
            const ring = i < 6 ? 8 : 16
            return <circle key={i} cx={50 + Math.cos(ang) * ring} cy={50 + Math.sin(ang) * ring} r="4.2" />
          })}
        </g>
      )
    case "shell":
      return (
        <g fill="none" stroke={INK} strokeWidth="1.6">
          <ellipse cx="50" cy="50" rx="28" ry="16" />
          <circle cx="76" cy="50" r="3.2" fill={INK} stroke="none" />
          <circle cx="50" cy="50" r="3" fill={INK} stroke="none" />
        </g>
      )
    case "electron":
      return <circle cx="50" cy="50" r="22" fill="none" stroke={INK} strokeWidth="1.4" />
    case "atom":
      return (
        <g fill="none" stroke={INK} strokeWidth="1.5">
          <circle cx="50" cy="50" r="26" />
          <circle cx="50" cy="50" r="3.5" fill={INK} stroke="none" />
          <circle cx="74" cy="50" r="3" fill={INK} stroke="none" />
        </g>
      )
    case "molecule":
      return (
        <g fill={INK}>
          <circle cx="46" cy="54" r="14" />
          <circle cx="64" cy="38" r="8" />
          <circle cx="68" cy="64" r="8" />
        </g>
      )
    case "helix":
      return (
        <g fill="none" stroke={INK} strokeWidth="1.8" strokeLinecap="round">
          <path d={helixStrand(1)} />
          <path d={helixStrand(-1)} />
          {[0.2, 0.4, 0.6, 0.8].map((t) => (
            <line key={t} x1={50 - 16} y1={16 + t * 68} x2={50 + 16} y2={16 + t * 68} strokeWidth="1.2" />
          ))}
        </g>
      )
    case "virus":
      return (
        <g fill={INK}>
          <circle cx="50" cy="50" r="16" />
          {Array.from({ length: 10 }, (_, i) => {
            const ang = (i / 10) * Math.PI * 2
            return <circle key={i} cx={50 + Math.cos(ang) * 24} cy={50 + Math.sin(ang) * 24} r="3.2" />
          })}
        </g>
      )
    case "bacterium":
      return <ellipse cx="50" cy="50" rx="30" ry="16" fill={INK} />
    case "cell":
      return (
        <g>
          <circle cx="50" cy="50" r="30" fill="none" stroke={INK} strokeWidth="2" />
          <circle cx="54" cy="48" r="10" fill={INK} />
        </g>
      )
    case "hair":
      return <rect x="46" y="10" width="8" height="80" rx="4" fill={INK} />
    case "sand":
      return <path d="M38 58c2-16 10-22 20-18 8 2 14 8 12 18-2 10-12 16-22 12-8-2-12-6-10-12z" fill={INK} />
    case "ant":
      return (
        <g fill={INK} stroke={INK} strokeWidth="1.3" strokeLinecap="round">
          <ellipse cx="38" cy="52" rx="8" ry="6" />
          <ellipse cx="52" cy="50" rx="6" ry="5" />
          <circle cx="64" cy="48" r="4.5" />
          <path d="M46 46 L38 34 M52 44 L58 32 M40 56 L30 68 M48 56 L44 70 M56 54 L64 66" fill="none" />
        </g>
      )
    case "dollar":
      return (
        <g fill="none" stroke={INK} strokeWidth="1.7">
          <circle cx="50" cy="50" r="28" />
          <circle cx="50" cy="50" r="5" fill={INK} stroke="none" />
          {[0, 72, 144, 216, 288].map((deg) => {
            const rad = (deg * Math.PI) / 180
            return <line key={deg} x1="50" y1="50" x2={50 + Math.sin(rad) * 20} y2={50 - Math.cos(rad) * 20} />
          })}
        </g>
      )
    case "mouse":
      return (
        <g fill={INK}>
          <path d="M28 62 C14 76 8 54 24 56" fill="none" stroke={INK} strokeWidth="2.2" strokeLinecap="round" />
          <ellipse cx="46" cy="58" rx="20" ry="11" />
          <circle cx="66" cy="52" r="8" />
          <circle cx="72" cy="42" r="5.5" />
          <circle cx="70" cy="41" r="1.4" fill="#050806" />
        </g>
      )
    case "person":
      return null
    case "gull":
      return null
    case "park":
      return (
        <g fill={INK}>
          <rect x="18" y="78" width="64" height="2" />
          <rect x="32" y="58" width="3" height="20" />
          <circle cx="33" cy="50" r="12" />
          <rect x="62" y="52" width="3" height="26" />
          <circle cx="63" cy="44" r="14" />
        </g>
      )
    case "blocks":
      return (
        <g fill={INK}>
          <rect x="16" y="58" width="14" height="22" />
          <rect x="32" y="46" width="16" height="34" />
          <rect x="50" y="54" width="12" height="26" />
          <rect x="64" y="40" width="18" height="40" />
        </g>
      )
    case "skyline":
      return null
    case "span":
      return (
        <g fill="none" stroke={INK} strokeWidth="1.8" strokeLinecap="round">
          <line x1="16" y1="58" x2="84" y2="58" />
          <circle cx="18" cy="58" r="4" fill={INK} stroke="none" />
          <circle cx="82" cy="58" r="4" fill={INK} stroke="none" />
        </g>
      )
    case "moon":
      return null
    case "earth":
      return null
    case "andromeda":
      return (
        <g>
          <ellipse cx="50" cy="50" rx="36" ry="10" transform="rotate(-24 50 50)" fill="#d5efe4" opacity="0.85" />
          <circle cx="50" cy="50" r="6" fill="#f4fff8" />
        </g>
      )
    case "group":
      return (
        <g fill="#d5efe4">
          <ellipse cx="36" cy="54" rx="16" ry="6" transform="rotate(-18 36 54)" />
          <ellipse cx="62" cy="46" rx="18" ry="7" transform="rotate(16 62 46)" />
          <ellipse cx="54" cy="64" rx="8" ry="3" />
        </g>
      )
    case "cluster":
      return (
        <g fill={INK}>
          <ellipse cx="50" cy="50" rx="28" ry="18" fill="none" stroke={INK} strokeWidth="0.6" opacity="0.7" />
          {Array.from({ length: 11 }, (_, i) => {
            const ang = i * 2.4
            const rad = 6 + (i % 4) * 4
            return <circle key={i} cx={50 + Math.cos(ang) * rad} cy={50 + Math.sin(ang) * rad * 0.62} r={i % 3 === 0 ? 2.2 : 1.3} />
          })}
        </g>
      )
    case "wall":
      return (
        <g fill={INK}>
          <text x="50" y="28" textAnchor="middle" fill="#9fffd4" fontSize="7">
            schematic
          </text>
          {Array.from({ length: 16 }, (_, i) => (
            <circle key={i} cx={12 + i * 5} cy={52 + Math.sin(i * 0.85) * 8} r={i % 4 === 0 ? 2 : 1.25} />
          ))}
        </g>
      )
    default:
      return null
  }
}
