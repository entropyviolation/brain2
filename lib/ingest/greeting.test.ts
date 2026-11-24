import { describe, expect, it } from "vitest"
import { parseAboutMe, parseForget, parseMeAsk } from "@/lib/coach-bimby/read"
import { parseNoteStatement } from "./bim-facts"
import { dropGreeting } from "./greeting"

describe("dropGreeting", () => {
  it("takes off one leading hello and its mark", () => {
    expect(dropGreeting("hi. Remember that my name is Allie")).toBe("Remember that my name is Allie")
    expect(dropGreeting("hey bim, about me: I'm a designer")).toBe("about me: I'm a designer")
    expect(dropGreeting("ok so remember that the gate code is 4412")).toBe("so remember that the gate code is 4412")
    expect(dropGreeting("good morning! what do you know about me?")).toBe("what do you know about me?")
  })
  it("leaves a lone hello and ordinary words alone", () => {
    expect(dropGreeting("hi")).toBe("hi")
    expect(dropGreeting("hi!")).toBe("hi!")
    expect(dropGreeting("hiking with Marilyn at 3")).toBe("hiking with Marilyn at 3")
    expect(dropGreeting("solo show next week")).toBe("solo show next week")
  })
})

describe("remember shapes after a hello", () => {
  it("keeps the name as a note about you", () => {
    expect(parseAboutMe("hi. Remember that my name is Allie")).toEqual({ kind: "who", texts: ["my name is Allie"] })
    expect(parseMeAsk("hey, what do you know about me?")).toBe("all")
    expect(parseForget("ok forget that I hate mornings")).toBe("I hate mornings")
  })
  it("keeps a plain fact", () => {
    expect(parseNoteStatement("hi, remember that the gate code is 4412")?.text).toBe("the gate code is 4412")
  })
})
