import { describe, expect, it } from "vitest"
import type { Task } from "@/lib/types"
import { NOTICE_PROMPT, needsNotice, totalPushes, withNoticeAnswer } from "@/lib/notice-dot"

const task = (patch: Partial<Task> = {}) => ({ id: "t1", description: "Taxes", ...patch }) as Task

describe("notice dot (Phase 15 B)", () => {
  it("shows at 3 pushes across all periods, not before", () => {
    expect(needsNotice(task({ daysPushed: 2 }))).toBe(false)
    expect(needsNotice(task({ daysPushed: 1, weeksPushed: 1, monthsPushed: 1 }))).toBe(true)
    expect(totalPushes(task({ daysPushed: 2, weeksPushed: 3 }))).toBe(5)
  })

  it("writes a dated noteLog entry tagged notice and goes quiet until the next push", () => {
    const now = new Date(2026, 9, 16, 9, 30)
    const answered = withNoticeAnswer(task({ daysPushed: 3, noteLog: [{ id: "n0", date: "2026-10-01", text: "old" }] }), " Waiting on the form ", now)
    const entry = answered.noteLog!.at(-1)!
    expect(entry).toMatchObject({ date: "2026-10-16", time: "09:30", text: "Waiting on the form", tag: "notice", pushCount: 3 })
    expect(answered.noteLog).toHaveLength(2)
    expect(needsNotice(answered)).toBe(false)
    expect(needsNotice({ ...answered, daysPushed: 4 })).toBe(true)
  })

  it("ignores a blank answer and keeps the prompt a question", () => {
    const t = task({ daysPushed: 3 })
    expect(withNoticeAnswer(t, "   ")).toBe(t)
    expect(NOTICE_PROMPT).not.toMatch(/should|must|!/i)
  })
})
