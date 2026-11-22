import { beforeEach, describe, expect, it } from "vitest"
import { resetAllStores } from "@/tests/test-utils"
import { answerSelf, readSelfQuestion } from "./bim-self"
import { sendToBim, useBimChatStore } from "./bim-chat"

describe("Self BIMBY: questions about what BIM can do", () => {
  it("answers the web capability question that used to time out in Ask", () => {
    const said = answerSelf("can you answer random questions that require web search?", { llm: true })
    expect(said?.route).toBe("SELF · web · code")
    expect(said?.text).toMatch(/^Yes, through the Web BIMBY/)
    expect(said?.text).not.toMatch(/LLM is off/)
    expect(said?.evidence.length).toBeGreaterThan(10)
  })

  it("says what LLM off changes", () => {
    expect(answerSelf("can you answer random questions?", { llm: false })?.text).toMatch(/LLM is off right now/)
  })

  it.each([
    ["what can you do?", "overview"],
    ["hey bim, what can you help with", "overview"],
    ["are you able to read my texts?", "texts"],
    ["can you search the web?", "web"],
    ["do you have access to the internet?", "web"],
    ["can you track habits?", "habits"],
    ["could you ever do things like plan my day", "plan"],
  ])("%s → %s", (line, topic) => {
    expect(answerSelf(line, { llm: true })?.route).toBe(`SELF · ${topic} · code`)
  })

  it.each([
    "can you find out what time the laundromats by my house close?",
    "can you search the web for laundromats near me",
    "can you add milk to groceries",
    "can you tell me when I last saw Shelby?",
    "can you remind me to call mom at 5",
    "what is the boiling point of nitrogen?",
    "when did I last feel nauseous?",
    "what are you doing",
  ])("leaves a request or a question about the world alone: %s", (line) => {
    expect(readSelfQuestion(line)).toBeNull()
  })

  describe("in chat", () => {
    beforeEach(() => {
      resetAllStores()
      useBimChatStore.setState({ lines: [], busy: false })
    })

    it("is taken by the self lane, files nothing and asks no model", async () => {
      const line = await sendToBim("can you answer random questions that require web search?", new Date(), { llm: false })
      expect(line.route).toBe("SELF · web · code")
      expect(line.status).toBe("ok")
    })
  })
})
