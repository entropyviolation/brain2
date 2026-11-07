import { beforeEach, describe, expect, it } from "vitest"
import { useDocOutLinks } from "./doc-out-links"

describe("useDocOutLinks", () => {
  beforeEach(() => useDocOutLinks.setState({ links: [] }))
  it("keeps records per document", () => {
    const s = useDocOutLinks.getState()
    s.record({ docId: "a", kind: "log", text: "walked" })
    s.record({ docId: "b", kind: "item-note", text: "idea", targetId: "t1", targetLabel: "Book" })
    expect(useDocOutLinks.getState().forDoc("a")).toHaveLength(1)
    expect(useDocOutLinks.getState().forDoc("b")[0]?.targetLabel).toBe("Book")
    useDocOutLinks.getState().forgetDoc("a")
    expect(useDocOutLinks.getState().forDoc("a")).toHaveLength(0)
  })
})
