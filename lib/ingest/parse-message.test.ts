import { describe, it, expect } from "vitest"
import { parseMessage } from "./parse-message"

describe("parseMessage", () => {
  it("treats prefix-less text as inbox capture", () => {
    expect(parseMessage("pick up milk")).toEqual({
      kind: "capture",
      payload: "pick up milk",
      raw: "pick up milk",
    })
  })

  it("strips capture verbs", () => {
    expect(parseMessage("qa: pick up milk").payload).toBe("pick up milk")
    expect(parseMessage("quick add: call dentist").kind).toBe("capture")
    expect(parseMessage("inbox: random idea").payload).toBe("random idea")
    expect(parseMessage("add pick up milk").payload).toBe("pick up milk")
  })

  it("parses bulk bodies across lines", () => {
    const text = "bulk:\nmilk\neggs"
    expect(parseMessage(text)).toMatchObject({ kind: "bulk", payload: "milk\neggs" })
  })

  it("parses iphone-notes dumps across lines and does not collide with tracker note", () => {
    const text = "iphone-notes:\nid: abc\ntitle: Grocery\n---\nmilk"
    expect(parseMessage(text)).toMatchObject({
      kind: "iphone-notes",
      payload: "id: abc\ntitle: Grocery\n---\nmilk",
    })
    expect(parseMessage("inotes:\nid: abc\n---\nmilk").kind).toBe("iphone-notes")
    expect(parseMessage("phone notes:\nid: abc\n---\nmilk").kind).toBe("iphone-notes")
    expect(parseMessage("iphone-notes 2/3:\nid: abc\n---\nmore").payload).toBe("2/3:\nid: abc\n---\nmore")
    expect(parseMessage("n stuck").kind).toBe("note")
    expect(parseMessage("note: aisle").kind).toBe("note")
  })

  it("parses habit / location / track / mood / sleep / start / stop / help / pair", () => {
    expect(parseMessage("habit: exercise 30")).toMatchObject({ kind: "habit", payload: "exercise 30" })
    expect(parseMessage("did: stretch")).toMatchObject({ kind: "habit", payload: "stretch" })
    expect(parseMessage("at: gym")).toMatchObject({ kind: "location", payload: "gym" })
    expect(parseMessage("location: home")).toMatchObject({ kind: "location", payload: "home" })
    expect(parseMessage("track: exercise 30m")).toMatchObject({ kind: "track", payload: "exercise 30m" })
    expect(parseMessage("screen: Instagram 30m")).toMatchObject({ kind: "iphone-screen", payload: "Instagram 30m" })
    expect(parseMessage("screentime Instagram")).toMatchObject({ kind: "iphone-screen", payload: "Instagram" })
    expect(parseMessage("phone-screen: Safari 9-11")).toMatchObject({
      kind: "iphone-screen",
      payload: "Safari 9-11",
    })
    expect(parseMessage("iphone Instagram")).toMatchObject({ kind: "iphone-screen", payload: "Instagram" })
    expect(parseMessage("ios: Messages")).toMatchObject({ kind: "iphone-screen", payload: "Messages" })
    expect(parseMessage("call: Jane 12m")).toMatchObject({ kind: "iphone-call", payload: "Jane 12m" })
    expect(parseMessage("called: Mom 3:02-3:17")).toMatchObject({ kind: "iphone-call", payload: "Mom 3:02-3:17" })
    expect(parseMessage("phone-call: Dad 8m")).toMatchObject({ kind: "iphone-call", payload: "Dad 8m" })
    expect(parseMessage("text: Jane on my way")).toMatchObject({ kind: "iphone-text", payload: "Jane on my way" })
    expect(parseMessage("sms: Jane hi")).toMatchObject({ kind: "iphone-text", payload: "Jane hi" })
    expect(parseMessage("imessage: Jane hi")).toMatchObject({ kind: "iphone-text", payload: "Jane hi" })
    expect(parseMessage("sent: Jane hi")).toMatchObject({ kind: "iphone-text", payload: "Jane hi" })
    expect(parseMessage("iphone-notes:\nid: abc\n---\nmilk").kind).toBe("iphone-notes")
    expect(parseMessage("track: exercise 30m").kind).toBe("track")
    expect(parseMessage("at: gym").kind).toBe("location")
    expect(parseMessage("mood: good")).toMatchObject({ kind: "mood", payload: "good" })
    expect(parseMessage("sleep: 11:30-7:00")).toMatchObject({ kind: "sleep", payload: "11:30-7:00" })
    expect(parseMessage("start: write paper")).toMatchObject({ kind: "start", payload: "write paper" })
    expect(parseMessage("stop")).toMatchObject({ kind: "stop", payload: "" })
    expect(parseMessage("help")).toMatchObject({ kind: "help", payload: "" })
    expect(parseMessage("/start 123456")).toMatchObject({ kind: "pair", payload: "123456" })
    expect(parseMessage("pair: 123456")).toMatchObject({ kind: "pair", payload: "123456" })
  })

  it("parses read / catalog / info keys", () => {
    expect(parseMessage("read: grocery list")).toMatchObject({ kind: "read", payload: "grocery list" })
    expect(parseMessage("show: Groceries")).toMatchObject({ kind: "read", payload: "Groceries" })
    expect(parseMessage("read folder: Home")).toMatchObject({ kind: "read", payload: "folder: Home" })
    expect(parseMessage("lists")).toMatchObject({ kind: "lists", payload: "" })
    expect(parseMessage("ls")).toMatchObject({ kind: "lists", payload: "" })
    expect(parseMessage("folders")).toMatchObject({ kind: "folders", payload: "" })
    expect(parseMessage("info")).toMatchObject({ kind: "info", payload: "" })
    expect(parseMessage("read inbox")).toMatchObject({ kind: "inbox", payload: "" })
    expect(parseMessage("search: milk")).toMatchObject({ kind: "search", payload: "milk" })
    expect(parseMessage("? oat")).toMatchObject({ kind: "search", payload: "oat" })
    expect(parseMessage("today")).toMatchObject({ kind: "today", payload: "" })
    expect(parseMessage("habits")).toMatchObject({ kind: "habits", payload: "" })
    expect(parseMessage("where")).toMatchObject({ kind: "status", payload: "" })
    expect(parseMessage("ops")).toMatchObject({ kind: "ops", payload: "" })
    expect(parseMessage("agenda")).toMatchObject({ kind: "plan", payload: "" })
    expect(parseMessage("count")).toMatchObject({ kind: "count", payload: "" })
    expect(parseMessage("ping")).toMatchObject({ kind: "ping", payload: "" })
    expect(parseMessage("groc")).toMatchObject({ kind: "grocery", payload: "" })
    expect(parseMessage("g")).toMatchObject({ kind: "capture", payload: "g" })
    expect(parseMessage("Groceries: milk")).toMatchObject({ kind: "grocery", payload: "milk" })
    expect(parseMessage("needed: batteries")).toMatchObject({ kind: "needed", payload: "batteries" })
    expect(parseMessage("get:\nbatteries\nmilk\nstamps")).toMatchObject({
      kind: "needed",
      payload: "batteries\nmilk\nstamps",
    })
    expect(parseMessage("get: batteries\nmilk")).toMatchObject({
      kind: "needed",
      payload: "batteries\nmilk",
    })
    expect(parseMessage("get milk from the store")).toMatchObject({
      kind: "capture",
      payload: "get milk from the store",
    })
    expect(parseMessage("got milk")).toMatchObject({ kind: "bought", payload: "milk" })
    expect(parseMessage("n stuck")).toMatchObject({ kind: "note", payload: "stuck" })
    expect(parseMessage("pin")).toMatchObject({ kind: "pin", payload: "" })
    expect(parseMessage("receipt")).toMatchObject({ kind: "receipt", payload: "" })
    expect(parseMessage("journal: morning")).toMatchObject({ kind: "journal", payload: "morning" })
    expect(parseMessage("inv oats")).toMatchObject({ kind: "inventory", payload: "oats" })
    expect(parseMessage("pdf")).toMatchObject({ kind: "pdf", payload: "" })
    expect(parseMessage("plan for rn:\nwrite\nwalk")).toMatchObject({
      kind: "plan-now",
      payload: "write\nwalk",
    })
    expect(parseMessage("currently deep work")).toMatchObject({ kind: "currently", payload: "deep work" })
    expect(parseMessage("stopped deep work")).toMatchObject({
      kind: "stopped-activity",
      payload: "deep work",
    })
    expect(parseMessage("switched to cooking")).toMatchObject({ kind: "switched-to", payload: "cooking" })
    expect(parseMessage("log: drink water")).toMatchObject({ kind: "event-log", payload: "drink water" })
    expect(parseMessage("log-something now")).toMatchObject({ kind: "event-log", payload: "something now" })
    expect(parseMessage("stop")).toMatchObject({ kind: "stop", payload: "" })
    expect(parseMessage("read plan for today").kind).toBe("read-plan")
    expect(parseMessage("read plans for today").kind).toBe("read-plans")
    expect(parseMessage("do: call dentist").kind).toBe("do")
    expect(parseMessage("to do today: call dentist").kind).toBe("todo-today")
    expect(parseMessage("READ to do today").kind).toBe("read-todo-today")
    expect(parseMessage("gm").kind).toBe("morning")
    expect(parseMessage("reviews").kind).toBe("reviews")
    expect(parseMessage("review today")).toMatchObject({ kind: "review", payload: "today" })
    expect(parseMessage("today").kind).toBe("today")
    expect(parseMessage("gps: Home\n37.77,-122.42").kind).toBe("gps")
  })

  it("keeps inbox: as capture, not an inbox dump", () => {
    expect(parseMessage("inbox: random idea")).toMatchObject({ kind: "capture", payload: "random idea" })
  })

  it("keeps list-path captures as capture, not a list verb", () => {
    expect(parseMessage("Chores: milk").kind).toBe("capture")
    expect(parseMessage("Chores: milk").payload).toBe("Chores: milk")
  })

  it("treats a multi-line list header as bulk, even when it starts with grocery", () => {
    const text = "Grocery list: grocery list:\neggs\nrice\nbutter"
    expect(parseMessage(text)).toMatchObject({ kind: "bulk", payload: text })
    expect(parseMessage("before elijah gets home:\nclean house\nclean couch").kind).toBe("bulk")
    expect(parseMessage("g eggs\nrice")).toMatchObject({ kind: "capture", payload: "g eggs\nrice" })
    expect(parseMessage("groc eggs\nrice")).toMatchObject({ kind: "grocery", payload: "eggs\nrice" })
  })

  it("keeps need-to phrases as inbox capture", () => {
    expect(parseMessage("need to call dentist").kind).toBe("capture")
  })

  it("returns unknown for empty input", () => {
    expect(parseMessage("   ").kind).toBe("unknown")
  })
})
