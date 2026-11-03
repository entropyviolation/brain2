#!/usr/bin/env node
/**
 * Compare parseable README file lists to the files on disk.
 *
 * Conservative on purpose. A fenced tree or a File/Path table is checked.
 * Prose that mentions a filename is not. A listed path that is not on disk
 * is drift. A file on disk that a fenced tree left out is drift only when
 * that directory's list already covers most of its children — a sample tree
 * is reported, not failed. Exit 1 on drift.
 *
 * Usage: node scripts/docs-check.mjs
 */
import { readdirSync, readFileSync, statSync } from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
const SOURCE_EXT = new Set(["ts", "tsx", "js", "jsx", "mjs", "cjs", "css", "md", "json", "py", "sh"])
const SKIP_LANG = new Set(["bash", "sh", "tsx", "ts", "jsx", "js", "json", "css", "html", "python", "py", "diff"])
const SKIP_DIRS = new Set(["node_modules", ".git", ".next", "out", "dist", "ios", "public", "docs/screenshots"])

const problems = []
const notes = []

function walkReadmes(dir, out) {
  let entries
  try {
    entries = readdirSync(dir, { withFileTypes: true })
  } catch {
    return
  }
  for (const entry of entries) {
    if (entry.name.startsWith(".")) continue
    const rel = path.relative(root, path.join(dir, entry.name))
    if (SKIP_DIRS.has(entry.name) || SKIP_DIRS.has(rel)) continue
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      if (entry.name === "screenshots" && path.basename(dir) === "docs") continue
      walkReadmes(full, out)
    } else if (entry.name === "README.md") {
      out.push(full)
    }
  }
}

function exists(relPath) {
  const abs = path.join(root, relPath)
  try {
    statSync(abs)
    return true
  } catch {
    return false
  }
}

function isSourceFile(name) {
  const ext = name.includes(".") ? name.slice(name.lastIndexOf(".") + 1) : ""
  return SOURCE_EXT.has(ext)
}

function cleanToken(raw) {
  return raw.trim().replace(/^\.\//, "").replace(/\/$/, "")
}

function weird(name) {
  return !name || /[*…<>(){}]/.test(name) || name.includes("...") || name.includes(" ")
}

/** Depth from tree glyphs before the name. Root line is 0. */
function treeDepth(line) {
  const cut = line.split("#")[0]
  const nameAt = cut.search(/[^\s│├└─]/)
  const head = nameAt < 0 ? cut : cut.slice(0, nameAt)
  return (head.match(/[│├└]/g) || []).length
}

function treeName(line) {
  const cut = line.split("#")[0]
  const marked = cut.match(/(?:├──|└──)\s+(.+?)\s*$/)
  if (marked) return marked[1].trim()
  const plain = cut.trim()
  if (!plain || /[│├└┌┐┘┤┬┼]/.test(plain)) return null
  if (/^[─┌┐┘┤┬┼\s]+$/.test(plain)) return null
  return plain
}

function parseTree(text) {
  const entries = []
  const stack = []
  for (const raw of text.split("\n")) {
    if (!raw.trim()) continue
    const name = treeName(raw)
    if (!name) continue
    const depth = treeDepth(raw)
    while (stack.length && stack[stack.length - 1].depth >= depth) stack.pop()
    const base = cleanToken(name)
    if (weird(base)) continue
    const parent = stack.length ? stack[stack.length - 1].path : ""
    const rel = parent ? `${parent}/${base}` : base
    const isDir = name.trim().endsWith("/") || !base.includes(".")
    if (isDir) stack.push({ depth, path: rel })
    entries.push({ path: rel, dir: isDir })
  }
  return entries
}

function fenceBlocks(md) {
  const blocks = []
  const re = /```([^\n`]*)\n([\s\S]*?)```/g
  let match
  while ((match = re.exec(md))) {
    blocks.push({ lang: (match[1] || "").trim().toLowerCase(), body: match[2] })
  }
  return blocks
}

function looksLikeTree(body) {
  const lines = body.split("\n").map((l) => l.trim()).filter(Boolean)
  if (lines.length < 3) return false
  const glyphs = lines.filter((l) => l.includes("├") || l.includes("└")).length
  return glyphs >= 2
}

function headingBase(heading) {
  const ticks = [...heading.matchAll(/`([^`]+)`/g)].map((m) => cleanToken(m[1]))
  for (const tick of ticks) {
    if (!tick || tick.includes(".")) continue
    if (exists(tick)) return tick
  }
  return null
}

/** File/Path tables, each scoped by the nearest heading that names a directory. */
function fileTables(md) {
  const tables = []
  const lines = md.split("\n")
  let base = null
  let level = 0
  for (let i = 0; i < lines.length - 1; i++) {
    const heading = lines[i].match(/^(#{1,6})\s+(.*)$/)
    if (heading) {
      const next = heading[2]
      const nextLevel = heading[1].length
      if (level === 0 || nextLevel <= level) {
        const named = headingBase(next)
        if (named) {
          base = named
          level = nextLevel
        } else if (nextLevel <= level) {
          base = null
          level = 0
        }
      }
      continue
    }
    const header = lines[i]
    if (!header.trim().startsWith("|")) continue
    const cells = header.split("|").map((c) => c.trim()).filter(Boolean)
    if (!cells.length) continue
    if (!/^(file|path|files)$/i.test(cells[0].replace(/`/g, ""))) continue
    const sep = lines[i + 1] || ""
    if (!/^\s*\|?\s*-+/.test(sep)) continue
    const rows = []
    for (let j = i + 2; j < lines.length; j++) {
      if (!lines[j].trim().startsWith("|")) break
      const cols = lines[j].split("|").map((c) => c.trim()).filter(Boolean)
      const col = cols[0] || ""
      const rest = cols.slice(1).join(" ")
      if (/\b(future|planned|not yet|coming soon)\b/i.test(rest)) continue
      const tick = col.match(/`([^`]+)`/)
      const token = tick ? tick[1] : col
      if (weird(cleanToken(token))) continue
      rows.push(token)
    }
    if (rows.length) tables.push({ base, rows })
  }
  return tables
}

const basenameIndex = new Map()
function indexBasenames(dir) {
  let entries
  try {
    entries = readdirSync(dir, { withFileTypes: true })
  } catch {
    return
  }
  for (const entry of entries) {
    if (entry.name.startsWith(".") || entry.name === "node_modules" || entry.name === "ios") continue
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      if (entry.name === "screenshots" && path.basename(dir) === "docs") continue
      if (entry.name === "public" || entry.name === "designrefs") continue
      indexBasenames(full)
    } else if (isSourceFile(entry.name)) {
      const rel = path.relative(root, full).split(path.sep).join("/")
      if (!basenameIndex.has(entry.name)) basenameIndex.set(entry.name, [])
      basenameIndex.get(entry.name).push(rel)
    }
  }
}
indexBasenames(root)

function resolveFrom(readmeDir, token, sectionBase) {
  const name = cleanToken(token)
  if (weird(name)) return null
  if (!isSourceFile(path.posix.basename(name)) && !name.includes("/")) return null
  const candidates = []
  if (sectionBase) candidates.push(path.posix.normalize(path.posix.join(sectionBase, name)))
  candidates.push(path.posix.normalize(path.posix.join(readmeDir, name)))
  if (name.includes("/")) candidates.push(name)
  else candidates.push(name)
  for (const rel of candidates) {
    if (exists(rel)) return { path: rel, where: "found" }
  }
  if (!name.includes("/")) {
    const hits = basenameIndex.get(path.posix.basename(name)) || []
    if (hits.length === 1) return { path: hits[0], where: "found" }
    if (hits.length > 1) return { path: hits[0], where: "ambiguous" }
  }
  return { path: candidates[0], where: "missing" }
}

function childrenOf(relDir) {
  const abs = path.join(root, relDir)
  try {
    return readdirSync(abs, { withFileTypes: true })
      .filter((e) => !e.name.startsWith("."))
      .map((e) => ({ name: e.name, dir: e.isDirectory() }))
  } catch {
    return null
  }
}

function checkTree(readmeRel, body) {
  const entries = parseTree(body)
  const files = entries.filter((e) => !e.dir && isSourceFile(path.posix.basename(e.path)))
  if (files.length < 2) return
  const rootEntry = entries[0]
  const base = rootEntry && exists(rootEntry.path) ? "" : path.posix.dirname(readmeRel)
  const listed = new Set()
  for (const entry of entries) {
    const rel = path.posix.normalize(base ? path.posix.join(base, entry.path) : entry.path)
    if (entry.dir) {
      if (!exists(rel)) problems.push(`${readmeRel}: listed directory missing: ${rel}`)
      continue
    }
    if (!isSourceFile(path.posix.basename(rel))) continue
    listed.add(rel)
    if (!exists(rel)) problems.push(`${readmeRel}: listed file missing: ${rel}`)
  }

  const byDir = new Map()
  for (const rel of listed) {
    const dir = path.posix.dirname(rel)
    if (!byDir.has(dir)) byDir.set(dir, new Set())
    byDir.get(dir).add(path.posix.basename(rel))
  }
  for (const [dir, names] of byDir) {
    const kids = childrenOf(dir)
    if (!kids) continue
    const disk = kids.filter((k) => !k.dir && isSourceFile(k.name)).map((k) => k.name)
    if (disk.length < 4) continue
    const missing = disk.filter((n) => !names.has(n))
    const coverage = (disk.length - missing.length) / disk.length
    if (coverage >= 0.85 && missing.length > 0 && missing.length <= 6) {
      for (const name of missing) problems.push(`${readmeRel}: ${dir}/${name} is on disk and absent from the file tree`)
    } else if (missing.length > 6) {
      notes.push(`${readmeRel}: ${dir} tree is a sample (${disk.length - missing.length}/${disk.length} files) — omissions not failed`)
    }
  }
}

function checkTable(readmeRel, table) {
  const readmeDir = path.posix.dirname(readmeRel)
  for (const row of table.rows) {
    const resolved = resolveFrom(readmeDir, row, table.base)
    if (!resolved || resolved.where !== "missing") continue
    problems.push(`${readmeRel}: file table lists ${cleanToken(row)}, not on disk at ${resolved.path}`)
  }
}

const readmes = []
walkReadmes(root, readmes)

for (const abs of readmes) {
  const rel = path.relative(root, abs).split(path.sep).join("/")
  const md = readFileSync(abs, "utf8")
  for (const block of fenceBlocks(md)) {
    if (SKIP_LANG.has(block.lang)) continue
    if (!looksLikeTree(block.body)) continue
    checkTree(rel, block.body)
  }
  for (const rows of fileTables(md)) checkTable(rel, rows)
}

if (notes.length) {
  console.log("Notes (not failures):")
  for (const note of notes) console.log(`  ${note}`)
}
if (problems.length) {
  console.error(`docs:check found ${problems.length} problem(s):`)
  for (const problem of problems) console.error(`  ${problem}`)
  process.exit(1)
}
console.log(`docs:check ok (${readmes.length} READMEs).`)
