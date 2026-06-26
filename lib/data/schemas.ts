/**
 * lib/data/schemas.ts — Zod validation schemas (data-access boundary)
 *
 * Runtime validation for the core persisted entities (Task, List, Folder,
 * ItemLink, attribute values). Used by the repository layer on
 * writes and by backup/restore + import paths so untrusted/legacy data is
 * checked before it enters a store. Schemas are intentionally permissive about
 * optional/legacy fields (`.passthrough()` where shapes evolve) so validation
 * adds safety without rejecting valid historical records.
 *
 * Spec: §5 (Item model). Target persistence: MongoDB (docs/SPEC_MAPPING.md §3).
 */
import { z } from "zod"

/** Accept Date objects or ISO strings; coerce to Date. */
const dateLike = z.union([z.date(), z.string(), z.number()]).pipe(z.coerce.date())

/**
 * A single attached file value (mirrors `FileValue` in lib/types.ts). Lenient
 * (`.passthrough()`) so future file-store fields round-trip without rejection.
 */
export const fileValueSchema = z
  .object({
    id: z.string(),
    name: z.string(),
    mime: z.string(),
    uri: z.string(),
    size: z.number().optional(),
    extractedText: z.string().optional(),
  })
  .passthrough()

/** A single attribute value (mirrors `AttributeValue` in lib/types.ts). */
export const attributeValueSchema: z.ZodType = z.union([
  z.string(),
  z.number(),
  z.boolean(),
  z.array(z.string()),
  z.object({ current: z.number(), target: z.number() }),
  fileValueSchema,
  z.array(fileValueSchema),
  z.null(),
  z.undefined(),
])

export const itemLinkSchema = z.object({
  id: z.string(),
  relation: z.string(),
  targetId: z.string(),
})

export const subtaskSchema = z.object({
  id: z.string(),
  description: z.string(),
  completed: z.boolean(),
})

export const taskCategorySchema = z
  .object({
    id: z.string().min(1),
    name: z.string(),
    color: z.string(),
    createdAt: dateLike,
    description: z.string().optional(),
    order: z.number().optional(),
    scheduleable: z.boolean().optional(),
    icon: z.string().optional(),
  })
  .passthrough()

export const categoryFolderSchema = z
  .object({
    id: z.string().min(1),
    name: z.string(),
    createdAt: dateLike,
    listIds: z.array(z.string()),
    parentFolderId: z.string().optional(),
    color: z.string().optional(),
    description: z.string().optional(),
    scheduleable: z.boolean().optional(),
    icon: z.string().optional(),
  })
  .passthrough()

/**
 * Task schema. Only the genuinely-required invariants are strict (id,
 * description, stage bucket, createdAt, completed, lists[]); the long tail of
 * optional scheduling/metadata fields is allowed through.
 */
export const taskSchema = z
  .object({
    id: z.string().min(1),
    description: z.string(),
    stage: z.enum(["inbox", "clarified", "scheduled", "completed", "list"]),
    createdAt: dateLike,
    completed: z.boolean(),
    lists: z.array(z.string()),
    // Unified Item fields (spec §5)
    type: z.string().optional(),
    title: z.string().optional(),
    tags: z.array(z.string()).optional(),
    links: z.array(itemLinkSchema).optional(),
    attributes: z.record(z.string(), attributeValueSchema).optional(),
    // Common scheduling/metadata (optional)
    estimatedDuration: z.number().optional(),
    cognitiveLoad: z.number().optional(),
    urgency: z.number().optional(),
    importance: z.number().optional(),
    entropy: z.number().optional(),
    rewardValue: z.number().optional(),
    dependencies: z.array(z.string()).optional(),
    deadline: dateLike.optional(),
    scheduledDate: dateLike.optional(),
    scheduledTime: z.string().optional(),
    scheduledWeek: z.string().optional(),
    scheduledMonth: z.string().optional(),
    scheduledYear: z.string().optional(),
    subtasks: z.array(subtaskSchema).optional(),
  })
  .passthrough()

export type ValidatedTask = z.infer<typeof taskSchema>
export type ValidatedCategory = z.infer<typeof taskCategorySchema>
export type ValidatedFolder = z.infer<typeof categoryFolderSchema>

/** The full task-store snapshot (for backup/restore + import). */
export const taskStoreSnapshotSchema = z.object({
  tasks: z.array(taskSchema),
  lists: z.array(taskCategorySchema),
  folders: z.array(categoryFolderSchema),
})

export type TaskStoreSnapshot = z.infer<typeof taskStoreSnapshotSchema>

export class ValidationError extends Error {
  constructor(
    message: string,
    public readonly issues: z.ZodIssue[],
  ) {
    super(message)
    this.name = "ValidationError"
  }
}

/** Parse-or-throw a `ValidationError` with a readable message. */
export function parseOrThrow<T>(schema: z.ZodType<T>, value: unknown, label = "value"): T {
  const result = schema.safeParse(value)
  if (!result.success) {
    const first = result.error.issues[0]
    const path = first?.path.join(".") || "(root)"
    throw new ValidationError(`Invalid ${label}: ${first?.message} at ${path}`, result.error.issues)
  }
  return result.data
}
