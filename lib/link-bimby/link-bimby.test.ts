import { describe, expect, it } from "vitest"
import type { List, Task } from "@/lib/types"
import { applyGuess, RESOURCE_FOR } from "./apply"
import { buildPool, pastLinks, shortlist, words } from "./context"
import { cleanGuesses, guessLink } from "./suggest"

const at = new Date("2026-11-01T12:00:00Z")
const task = (id: string, extra: Partial<Task>): Task =>
  ({ id, description: "", stage: "list", createdAt: at, completed: false, lists: [], ...extra }) as Task

const lists: List[] = [
  { id: "recipes", name: "Recipes", color: "", createdAt: at },
  { id: "house", name: "House projects", color: "", createdAt: at },
  { id: "gifts", name: "Gift ideas", color: "", createdAt: at },
]

const tasks: Task[] = [
  task("t1", { title: "Retile the kitchen backsplash", lists: ["house"] }),
  task("t2", { title: "Miso salmon", lists: ["recipes"] }),
  task("t3", { title: "Birthday gift for mom", lists: ["gifts"] }),
  task("old", { title: "", stage: "clarified", savedLink: { url: "https://instagram.com/reel/a", kind: "instagram" }, notes: "pasta recipe", lists: ["recipes"] }),
]

const link = task("link", {
  stage: "inbox",
  savedLink: { url: "https://www.instagram.com/reel/XYZ/", kind: "instagram" },
  notes: "backsplash tile trick",
})

describe("Link BIMBY context", () => {
  it("drops stop words and link chrome", () => {
    expect(words("Watch this Instagram reel: the BEST tile trick #diy")).toEqual(["best", "tile", "trick", "diy"])
  })

  it("ranks the item that shares the link's words first", () => {
    const pool = buildPool(link, tasks, lists, "backsplash tile trick")
    const top = shortlist(pool)
    const items = top.filter((c) => c.kind === "item")
    expect(items[0]?.id).toBe("t1")
    expect(items[0]?.ref).toBe("I1")
    expect(top.some((c) => c.id === "old")).toBe(false)
  })

  it("brings past links with where they went", () => {
    expect(pastLinks(link, tasks, lists, "recipe")[0]).toMatchObject({ note: "pasta recipe", wentTo: "Recipes" })
  })
})

describe("Link BIMBY guess", () => {
  it("keeps only refs on the shortlist", () => {
    const cands = shortlist(buildPool(link, tasks, lists, "backsplash tile"))
    const out = cleanGuesses({ gist: "Tile tip", guesses: [{ ref: "I1", why: "w", use: "u", sure: 2 }, { ref: "I99", why: "", use: "", sure: 1 }] }, cands)
    expect(out.guesses).toHaveLength(1)
    expect(out.guesses[0]).toMatchObject({ id: "t1", sure: 1 })
  })

  it("falls back to word matches with no model", async () => {
    const r = await guessLink({ link, tasks, lists, peek: null, call: null, ladder: [] })
    expect(r.by).toBe("rules")
    expect(r.guesses[0]?.id).toBe("t1")
  })

  it("uses the model's pick", async () => {
    const r = await guessLink({
      link,
      tasks,
      lists,
      peek: { title: "", description: "How to tile a backsplash", author: "", site: "Instagram" },
      call: async () => ({ gist: "A tiling technique", guesses: [{ ref: "I1", why: "backsplash", use: "copy the spacing trick", sure: 0.8 }] }),
      ladder: ["m"],
    })
    expect(r).toMatchObject({ by: "model", model: "m", gist: "A tiling technique", peeked: true })
    expect(r.guesses[0]).toMatchObject({ kind: "item", id: "t1", use: "copy the spacing trick" })
  })
})

describe("Link BIMBY use", () => {
  it("files a list guess", () => {
    const out = applyGuess([...tasks, link], "link", { kind: "list", id: "house", name: "House projects", why: "", use: "", sure: 1 })
    const l = out.find((t) => t.id === "link")!
    expect(l.lists).toContain("house")
    expect(l.stage).not.toBe("inbox")
  })

  it("ties an item guess and takes its lists", () => {
    const out = applyGuess([...tasks, link], "link", { kind: "item", id: "t1", name: "", why: "", use: "", sure: 1 })
    const l = out.find((t) => t.id === "link")!
    expect(l.links?.[0]).toMatchObject({ relation: RESOURCE_FOR, targetId: "t1" })
    expect(l.lists).toContain("house")
  })
})

describe("Link BIMBY page title", () => {
  it("keeps only the name when the title repeats the caption", async () => {
    const { pageTitle } = await import("./suggest")
    const caption = 'THAI RED NOODLE SOUP 🍜 SOUP SEASON 2 welcome back to the series'
    expect(pageTitle({ title: `ALFIE STEINER on Instagram: "${caption}`, description: `459K likes - alfiecooks: "${caption}"`, author: "", site: "" })).toBe("ALFIE STEINER")
    expect(pageTitle({ title: "How to tile", description: "", author: "", site: "" })).toBe("How to tile")
  })
})

describe("Link BIMBY watched video", () => {
  it("puts what the video says and shows in the prompt", async () => {
    const { guessPrompt } = await import("./suggest")
    const text = guessPrompt(link, { title: "", description: "", author: "", site: "", watched: true, transcript: "grout the gaps first", onScreen: "TILE HACK" }, [], [])
    expect(text).toContain("said in the video: grout the gaps first")
    expect(text).toContain("on screen: TILE HACK")
  })

  it("cleans OCR lines", async () => {
    const { cleanOcr } = await import("../../scripts/reel-watch.mjs")
    expect(cleanOcr(["| ~ @\nTILE HACK\n", "tile hack\nDay 3 of grout"])).toBe("TILE HACK\nDay 3 of grout")
  })
})

describe("Link BIMBY refs in prose", () => {
  it("names refs and sorts by how sure", () => {
    const cands = shortlist(buildPool(link, tasks, lists, "backsplash tile recipes"))
    const ref = (id: string) => cands.find((c) => c.id === id)!.ref
    const out = cleanGuesses(
      {
        gist: `fits ${ref("t1")}`,
        guesses: [
          { ref: ref("recipes"), why: `${ref("recipes")}'s 'Recipes' list`, use: "", sure: 0.5 },
          { ref: ref("t1"), why: `matches ${ref("t1")}`, use: "", sure: 0.9 },
        ],
      },
      cands,
    )
    expect(out.guesses.map((g) => g.id)).toEqual(["t1", "recipes"])
    expect(out.guesses[1]!.why).toBe("'Recipes' list")
    expect(out.guesses[0]!.why).toBe("matches “Retile the kitchen backsplash”")
    expect(out.gist).toBe("fits “Retile the kitchen backsplash”")
  })
})

describe("Link BIMBY feedback", () => {
  it("words reviewed guesses as lessons and puts them in the prompt", async () => {
    const { feedbackLines, withComment, withVerdict, tally } = await import("./feedback")
    const at = "2026-11-06T00:00:00Z"
    let review = withVerdict(undefined, "list:recipes", "rejected", at)
    review = withVerdict(review, "item:t1", "approved", at)
    review = withComment(review, "tile reels go to House projects", at)
    const reviewed = [
      {
        taskId: "old2",
        url: "u",
        at,
        gist: "Tiling trick for a backsplash",
        note: "tile",
        guesses: [
          { kind: "list" as const, id: "recipes", name: "Recipes", why: "", use: "", sure: 0.4 },
          { kind: "item" as const, id: "t1", name: "Retile the kitchen backsplash", why: "", use: "", sure: 0.8 },
        ],
        by: "model" as const,
        peeked: true,
        review,
      },
    ]
    const lines = feedbackLines(reviewed, "backsplash tile", "link")
    expect(lines[0]).toBe(
      '- "Tiling trick for a backsplash", note "tile": WRONG: Recipes; RIGHT: Retile the kitchen backsplash — they said: "tile reels go to House projects"',
    )
    expect(feedbackLines(reviewed, "x", "old2")).toEqual([])
    expect(tally(reviewed)).toEqual({ read: 1, reviewed: 1, approved: 1, rejected: 1, comments: 1 })

    let sent = ""
    await guessLink({
      link,
      tasks,
      lists,
      peek: null,
      call: async ({ user }) => {
        sent = user
        return { gist: "", guesses: [] }
      },
      ladder: ["m"],
      reviewed,
    })
    expect(sent).toContain("FEEDBACK ON YOUR EARLIER GUESSES:")
    expect(sent).toContain("tile reels go to House projects")
  })

  it("clears a verdict and a comment", async () => {
    const { withComment, withVerdict, isReviewed } = await import("./feedback")
    const r = withComment(withVerdict(withVerdict(undefined, "k", "approved", "a"), "k", null, "b"), "  ", "c")
    expect(r.verdicts).toEqual({})
    expect(r.comment).toBeUndefined()
    expect(isReviewed({ review: r } as never)).toBe(false)
  })
})

describe("Link BIMBY ref parsing", () => {
  it("reads the ref at the head of a copied shortlist line", () => {
    const cands = shortlist(buildPool(link, tasks, lists, "backsplash tile"))
    const l1 = cands.find((c) => c.ref === "L1")!
    const out = cleanGuesses({ gist: "", guesses: [{ ref: `L1 list: ${l1.name}`, why: "", use: "", sure: 0.5 }, { ref: "nope", why: "", use: "", sure: 1 }] }, cands)
    expect(out.guesses.map((g) => g.id)).toEqual([l1.id])
  })
})

describe("Instagram account guard", () => {
  it("refuses batches, paces single fetches, honours the breaker", async () => {
    const { instagramRefusal, isInstagram } = await import("../../scripts/reel-watch.mjs")
    const now = Date.parse("2026-11-06T12:00:00Z")
    const ago = (min: number) => new Date(now - min * 60_000).toISOString()
    const clean = { fetches: [], trippedUntil: null, why: "" }
    expect(isInstagram("https://www.instagram.com/reel/x/")).toBe(true)
    expect(isInstagram("https://www.tiktok.com/@a")).toBe(false)
    expect(instagramRefusal(clean, { batch: false, now })).toBeNull()
    expect(instagramRefusal(clean, { batch: true, now })).toMatch(/Guess all never uses/)
    expect(instagramRefusal({ ...clean, fetches: [ago(1)] }, { batch: false, now })).toMatch(/every 3 min/)
    expect(instagramRefusal({ ...clean, fetches: [ago(10), ago(20), ago(30), ago(40), ago(50)] }, { batch: false, now })).toMatch(/an hour/)
    const day = Array.from({ length: 15 }, (_, i) => ago(70 + i * 60))
    expect(instagramRefusal({ ...clean, fetches: day }, { batch: false, now })).toMatch(/a day/)
    expect(instagramRefusal({ fetches: [], trippedUntil: new Date(now + 3600_000).toISOString(), why: "429" }, { batch: false, now })).toMatch(/pushed back \(429\)/)
    expect(instagramRefusal({ fetches: [], trippedUntil: new Date(now - 1).toISOString(), why: "" }, { batch: false, now })).toBeNull()
  })
})
