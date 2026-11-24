/**
 * components/Icons/house-glyphs.tsx — Line icons lucide does not ship.
 *
 * Built with lucide's own `createLucideIcon`, so they take the same props
 * (size, strokeWidth, className) and sit on the same 24px grid with round
 * caps as every other icon in the house. Used where an emoji used to stand
 * in for a picture (the vocab words). No emoji anywhere: docs/DESIGN_STYLE.md#no-emojis.
 */

import { createLucideIcon } from "lucide-react"

export const HorseGlyph = createLucideIcon("HorseGlyph", [
  ["path", { d: "M10 4 9 2l3 1.5C17 4 20 9 20 15v6", key: "neck-back" }],
  ["path", { d: "M10 4 5 9l-2 4 1.5 1.5L8 13l2 1v7", key: "face" }],
  ["path", { d: "M13 5c2 2 3.5 5 4 9", key: "mane" }],
  ["circle", { cx: "9", cy: "8", r: ".5", key: "eye" }],
])

export const CowGlyph = createLucideIcon("CowGlyph", [
  ["path", { d: "M8 9c0-3 8-3 8 0l1 6c0 4-10 4-10 0Z", key: "face" }],
  ["path", { d: "M8 8C6 8 4 7 4 5", key: "horn-l" }],
  ["path", { d: "M16 8c2 0 4-1 4-3", key: "horn-r" }],
  ["path", { d: "M8 10l-4 1", key: "ear-l" }],
  ["path", { d: "M16 10l4 1", key: "ear-r" }],
  ["path", { d: "M7.5 13h9", key: "muzzle" }],
  ["circle", { cx: "10", cy: "15.5", r: ".5", key: "n1" }],
  ["circle", { cx: "14", cy: "15.5", r: ".5", key: "n2" }],
])

export const CheeseGlyph = createLucideIcon("CheeseGlyph", [
  ["path", { d: "M3 18h18v-6L9 6l-6 6Z", key: "wedge" }],
  ["path", { d: "M3 12h18", key: "rind" }],
  ["circle", { cx: "9", cy: "15", r: "1", key: "h1" }],
  ["circle", { cx: "16", cy: "15.5", r: "1", key: "h2" }],
])

export const MouthGlyph = createLucideIcon("MouthGlyph", [
  ["path", { d: "M2 12c3-4 6-4 10-2 4-2 7-2 10 2-4 5-16 5-20 0Z", key: "lips" }],
  ["path", { d: "M2 12h20", key: "seam" }],
])

export const NoseGlyph = createLucideIcon("NoseGlyph", [
  ["path", { d: "M12 3c0 6-3 10-4 13-1 2 1 3 2 2", key: "bridge" }],
  ["path", { d: "M10 18c1 1 3 1 4 0", key: "tip" }],
  ["path", { d: "M14 18c1 1 3 0 2-2", key: "wing" }],
])

export const WindowGlyph = createLucideIcon("WindowGlyph", [
  ["rect", { x: "4", y: "3", width: "16", height: "18", rx: "1", key: "frame" }],
  ["path", { d: "M12 3v18", key: "mullion" }],
  ["path", { d: "M4 12h16", key: "transom" }],
])

export const MotherGlyph = createLucideIcon("MotherGlyph", [
  ["circle", { cx: "12", cy: "8", r: "4", key: "head" }],
  ["path", { d: "M7 13C6 8 7 3 12 3s6 5 5 10", key: "hair" }],
  ["path", { d: "M5 21c0-4 3-6 7-6s7 2 7 6", key: "body" }],
])

export const TeacupGlyph = createLucideIcon("TeacupGlyph", [
  ["path", { d: "M5 10h12v3a6 6 0 0 1-12 0Z", key: "cup" }],
  ["path", { d: "M17 11h1a2 2 0 0 1 0 4h-1.5", key: "handle" }],
  ["path", { d: "M3 21h16", key: "saucer" }],
  ["path", { d: "M10 3c-1 1 1 2 0 4", key: "steam" }],
])

export const RiceBowlGlyph = createLucideIcon("RiceBowlGlyph", [
  ["path", { d: "M3 13h18a9 8 0 0 1-18 0Z", key: "bowl" }],
  ["path", { d: "M6 13c0-4 12-4 12 0", key: "rice" }],
  ["path", { d: "M14 3l5 7", key: "stick-1" }],
  ["path", { d: "M17 2l4 7", key: "stick-2" }],
])

export const WatermelonGlyph = createLucideIcon("WatermelonGlyph", [
  ["path", { d: "M3 8a9 9 0 0 0 18 0Z", key: "rind" }],
  ["path", { d: "M5.5 8a6.5 6.5 0 0 0 13 0", key: "flesh" }],
  ["circle", { cx: "9", cy: "11", r: ".5", key: "s1" }],
  ["circle", { cx: "12", cy: "13", r: ".5", key: "s2" }],
  ["circle", { cx: "15", cy: "11", r: ".5", key: "s3" }],
])

export const ShoeGlyph = createLucideIcon("ShoeGlyph", [
  ["path", { d: "M3 17V9l4 1 2 3 7 1c3 .5 5 1.5 5 3Z", key: "upper" }],
  ["path", { d: "M3 20h18", key: "sole" }],
  ["path", { d: "M9 13l-1 2", key: "lace-1" }],
  ["path", { d: "M12 13.5l-1 2", key: "lace-2" }],
])
