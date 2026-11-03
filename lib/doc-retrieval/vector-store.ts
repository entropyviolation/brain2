/**
 * lib/doc-retrieval/vector-store.ts — A small Pinecone-shaped vector index, in memory
 *
 * Same verbs as Pinecone's data plane: `upsert`, `query` (topK, metadata filter,
 * namespace), `fetch`, `update`, `delete` (ids, filter or all), `describeIndexStats`.
 * So the app can swap in a hosted index later without changing callers. Vectors
 * are unit-normalised on the way in, which makes cosine a dot product. Search is
 * exact brute force: right up to tens of thousands of chunks, far past one
 * 800-page document. `toJSON` / `fromJSON` persist it (IndexedDB, a file).
 *
 * Metadata filters follow Pinecone: `$eq $ne $gt $gte $lt $lte $in $nin $exists`
 * on a field, `$and` / `$or` across clauses, and a bare value means `$eq`.
 */

export type MetaValue = string | number | boolean | string[]
export type Metadata = Record<string, MetaValue>
export type Filter = Record<string, unknown>

export interface VectorRecord {
  id: string
  values: number[]
  metadata?: Metadata
}

export interface QueryMatch {
  id: string
  /** Cosine similarity, -1 to 1. */
  score: number
  metadata?: Metadata
  values?: number[]
}

export interface QueryRequest {
  vector: number[]
  topK: number
  namespace?: string
  filter?: Filter
  includeMetadata?: boolean
  includeValues?: boolean
}

export interface IndexStats {
  dimension: number
  totalRecordCount: number
  namespaces: Record<string, { recordCount: number }>
}

interface Stored {
  values: Float32Array
  metadata: Metadata
}

const DEFAULT_NS = ""

function unit(values: readonly number[]): Float32Array {
  let sum = 0
  for (const v of values) sum += v * v
  const n = Math.sqrt(sum) || 1
  return Float32Array.from(values, (v) => v / n)
}

function compare(op: string, have: MetaValue | undefined, want: unknown): boolean {
  switch (op) {
    case "$eq":
      return Array.isArray(have) ? have.includes(want as string) : have === want
    case "$ne":
      return Array.isArray(have) ? !have.includes(want as string) : have !== want
    case "$gt":
      return typeof have === "number" && have > (want as number)
    case "$gte":
      return typeof have === "number" && have >= (want as number)
    case "$lt":
      return typeof have === "number" && have < (want as number)
    case "$lte":
      return typeof have === "number" && have <= (want as number)
    case "$in": {
      const set = want as unknown[]
      return Array.isArray(have) ? have.some((h) => set.includes(h)) : set.includes(have)
    }
    case "$nin": {
      const set = want as unknown[]
      return Array.isArray(have) ? !have.some((h) => set.includes(h)) : !set.includes(have)
    }
    case "$exists":
      return (have !== undefined) === Boolean(want)
    default:
      throw new Error(`Unsupported filter operator ${op}`)
  }
}

export function matchesFilter(metadata: Metadata, filter: Filter | undefined): boolean {
  if (!filter) return true
  return Object.entries(filter).every(([key, cond]) => {
    if (key === "$and") return (cond as Filter[]).every((f) => matchesFilter(metadata, f))
    if (key === "$or") return (cond as Filter[]).some((f) => matchesFilter(metadata, f))
    if (cond !== null && typeof cond === "object" && !Array.isArray(cond)) {
      return Object.entries(cond as Record<string, unknown>).every(([op, want]) => compare(op, metadata[key], want))
    }
    return compare("$eq", metadata[key], cond)
  })
}

export class VectorStore {
  private spaces = new Map<string, Map<string, Stored>>()
  private dim = 0

  /** `dimension` is fixed by the first upsert unless given. A later vector of another length is refused. */
  constructor(dimension = 0) {
    this.dim = dimension
  }

  private space(ns = DEFAULT_NS, create = false): Map<string, Stored> | undefined {
    let s = this.spaces.get(ns)
    if (!s && create) this.spaces.set(ns, (s = new Map()))
    return s
  }

  upsert(records: readonly VectorRecord[], namespace = DEFAULT_NS): { upsertedCount: number } {
    for (const r of records) {
      if (!r.id) throw new Error("Record needs an id")
      if (!this.dim) this.dim = r.values.length
      if (r.values.length !== this.dim) throw new Error(`Vector ${r.id} has ${r.values.length} values, index is ${this.dim}`)
    }
    const space = this.space(namespace, true)!
    for (const r of records) space.set(r.id, { values: unit(r.values), metadata: { ...(r.metadata ?? {}) } })
    return { upsertedCount: records.length }
  }

  query(req: QueryRequest): { namespace: string; matches: QueryMatch[] } {
    const namespace = req.namespace ?? DEFAULT_NS
    if (req.vector.length !== this.dim && this.dim) throw new Error(`Query has ${req.vector.length} values, index is ${this.dim}`)
    const q = unit(req.vector)
    const scored: QueryMatch[] = []
    for (const [id, rec] of this.space(namespace) ?? []) {
      if (!matchesFilter(rec.metadata, req.filter)) continue
      let dot = 0
      for (let i = 0; i < q.length; i++) dot += q[i]! * rec.values[i]!
      const match: QueryMatch = { id, score: dot }
      if (req.includeMetadata) match.metadata = { ...rec.metadata }
      if (req.includeValues) match.values = Array.from(rec.values)
      scored.push(match)
    }
    scored.sort((a, b) => b.score - a.score || a.id.localeCompare(b.id))
    return { namespace, matches: scored.slice(0, Math.max(0, req.topK)) }
  }

  fetch(ids: readonly string[], namespace = DEFAULT_NS): Record<string, VectorRecord> {
    const out: Record<string, VectorRecord> = {}
    const space = this.space(namespace)
    for (const id of ids) {
      const rec = space?.get(id)
      if (rec) out[id] = { id, values: Array.from(rec.values), metadata: { ...rec.metadata } }
    }
    return out
  }

  /** Change one record's metadata (merged) and/or values. A missing id is ignored, as in Pinecone. */
  update(req: { id: string; values?: number[]; setMetadata?: Metadata; namespace?: string }): void {
    const rec = this.space(req.namespace)?.get(req.id)
    if (!rec) return
    if (req.values) {
      if (req.values.length !== this.dim) throw new Error(`Vector ${req.id} has ${req.values.length} values, index is ${this.dim}`)
      rec.values = unit(req.values)
    }
    if (req.setMetadata) Object.assign(rec.metadata, req.setMetadata)
  }

  delete(req: { ids?: readonly string[]; filter?: Filter; deleteAll?: boolean; namespace?: string }): void {
    const namespace = req.namespace ?? DEFAULT_NS
    const space = this.space(namespace)
    if (!space) return
    if (req.deleteAll) {
      this.spaces.delete(namespace)
      return
    }
    for (const id of req.ids ?? []) space.delete(id)
    if (req.filter) for (const [id, rec] of [...space]) if (matchesFilter(rec.metadata, req.filter)) space.delete(id)
  }

  describeIndexStats(): IndexStats {
    const namespaces: IndexStats["namespaces"] = {}
    let total = 0
    for (const [ns, space] of this.spaces) {
      namespaces[ns] = { recordCount: space.size }
      total += space.size
    }
    return { dimension: this.dim, totalRecordCount: total, namespaces }
  }

  toJSON(): { dimension: number; namespaces: Record<string, VectorRecord[]> } {
    const namespaces: Record<string, VectorRecord[]> = {}
    for (const [ns, space] of this.spaces) {
      namespaces[ns] = [...space].map(([id, r]) => ({ id, values: Array.from(r.values), metadata: r.metadata }))
    }
    return { dimension: this.dim, namespaces }
  }

  static fromJSON(data: ReturnType<VectorStore["toJSON"]>): VectorStore {
    const store = new VectorStore(data.dimension)
    for (const [ns, records] of Object.entries(data.namespaces)) store.upsert(records, ns)
    return store
  }
}
