import { beforeEach, describe, expect, it } from "vitest"
import { resetAllStores } from "@/tests/test-utils"
import { useReviewsStore } from "@/lib/reviews-store"
import { saveOperationMissReason, saveOperationPostMortem } from "./operation-actions"

describe("operation miss reason", () => {
  beforeEach(() => resetAllStores())

  it("merges a reason onto an existing after-action review", () => {
    useReviewsStore.getState().addOperationReview({
      operationId: "op1",
      summary: "shipped",
      whatWorked: "focus",
      completedAt: new Date("2026-06-01T12:00:00"),
    })
    saveOperationMissReason("op1", { reason: "other", note: "the rain" })
    const review = useReviewsStore.getState().getOperationReview("op1")
    expect(review?.summary).toBe("shipped")
    expect(review?.whatWorked).toBe("focus")
    expect(review?.blockedReasons?.op1).toEqual({ reason: "other", note: "the rain" })
    expect(review?.completedAt).toEqual(new Date("2026-06-01T12:00:00"))
  })

  it("keeps the miss reason when the after-action report is filed", () => {
    saveOperationMissReason("op1", "no-time")
    saveOperationPostMortem("op1", {
      summary: "later",
      whatWorked: "focus",
      whatFailed: undefined,
      lessons: ["smaller"],
      ratings: { execution: 6 },
    })
    const review = useReviewsStore.getState().getOperationReview("op1")
    expect(review?.summary).toBe("later")
    expect(review?.whatWorked).toBe("focus")
    expect(review?.whatFailed).toBeUndefined()
    expect(review?.lessons).toEqual(["smaller"])
    expect(review?.blockedReasons?.op1).toBe("no-time")
  })
})
