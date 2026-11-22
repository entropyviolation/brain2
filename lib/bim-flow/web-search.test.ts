import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import { describe, expect, it } from "vitest"
import { parseBraveResults, parseTavilyResults, searchKey, searchProviders, webSearch } from "./web-search.mjs"

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } })
const BRAVE = { web: { results: [{ title: "Foxtide <strong>Brooklyn</strong> Tickets", url: "https://www.bandsintown.com/e/1-foxtide", description: "Foxtide at <strong>Brooklyn Steel</strong> on Nov 14, 2026.", extra_snippets: ["Doors 7pm."] }, { title: "local", url: "http://192.168.1.4/x", description: "" }] } }
const TAVILY = { results: [{ title: "Foxtide Setlist", url: "https://www.setlist.fm/foxtide", content: "Brooklyn Steel, November 14, 2026" }] }
const DUCK_BLOCKED = new Response("<html><script src='/anomaly.js?sv=html'></script></html>", { status: 202 })

type Call = { url: string; init?: RequestInit }
function fakeFetch(routes: Record<string, () => Response>) {
  const calls: Call[] = []
  const f = async (url: string | URL, init?: RequestInit) => {
    const u = String(url)
    calls.push({ url: u, init })
    const hit = Object.keys(routes).find((k) => u.startsWith(k))
    if (!hit) throw new Error(`unexpected ${u}`)
    return routes[hit]!()
  }
  return { f: f as unknown as typeof fetch, calls }
}
const keys = (k: Record<string, string>) => (suffix: string) => k[suffix] ?? ""

describe("hub web search providers", () => {
  it("parses Brave and Tavily into title, url and snippet, dropping links off the public web", () => {
    expect(parseBraveResults(BRAVE)).toEqual([{ title: "Foxtide Brooklyn Tickets", url: "https://www.bandsintown.com/e/1-foxtide", snippet: "Foxtide at Brooklyn Steel on Nov 14, 2026. … Doors 7pm." }])
    expect(parseTavilyResults(TAVILY)[0]).toMatchObject({ title: "Foxtide Setlist", snippet: "Brooklyn Steel, November 14, 2026" })
  })

  it("runs only providers with a key, Brave first, DuckDuckGo last", () => {
    expect(searchProviders(keys({})).map((p) => p.name)).toEqual(["duckduckgo"])
    expect(searchProviders(keys({ TAVILY_KEY: "t", BRAVE_SEARCH_KEY: "b" })).map((p) => p.name)).toEqual(["brave", "tavily", "duckduckgo"])
  })

  it("sends the Brave key as a header and only the query", async () => {
    const { f, calls } = fakeFetch({ "https://api.search.brave.com/": () => json(BRAVE) })
    const found = await webSearch("foxtide brooklyn steel", { read: 0, fetchImpl: f, keyOf: keys({ BRAVE_SEARCH_KEY: "bk" }) })
    expect(found).toMatchObject({ provider: "brave", results: [{ url: "https://www.bandsintown.com/e/1-foxtide" }] })
    expect(calls).toHaveLength(1)
    expect(new URL(calls[0]!.url).searchParams.get("q")).toBe("foxtide brooklyn steel")
    expect((calls[0]!.init!.headers as Record<string, string>)["X-Subscription-Token"]).toBe("bk")
  })

  it("hands on to Tavily when Brave fails, and says what was skipped", async () => {
    const { f, calls } = fakeFetch({ "https://api.search.brave.com/": () => json({}, 429), "https://api.tavily.com/": () => json(TAVILY) })
    const found = await webSearch("foxtide", { read: 0, fetchImpl: f, keyOf: keys({ BRAVE_SEARCH_KEY: "bk", TAVILY_KEY: "tk" }) })
    expect(found).toMatchObject({ provider: "tavily", skipped: ["brave 429"] })
    expect((calls[1]!.init!.headers as Record<string, string>).Authorization).toBe("Bearer tk")
    expect(JSON.parse(String(calls[1]!.init!.body))).toMatchObject({ query: "foxtide" })
  })

  it("names every failure when nothing answers, DuckDuckGo's bot check included", async () => {
    const { f } = fakeFetch({ "https://api.tavily.com/": () => json({}, 401), "https://html.duckduckgo.com/": () => DUCK_BLOCKED })
    await expect(webSearch("foxtide", { read: 0, fetchImpl: f, keyOf: keys({ TAVILY_KEY: "tk" }) })).rejects.toThrow("tavily 401; duckduckgo blocked by its bot check")
  })

  it("reads a key from .env.local when the environment has none", () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "brain2-search-"))
    fs.writeFileSync(path.join(root, ".env.local"), "# keys\nBRAIN2_BRAVE_SEARCH_KEY=abc123\n")
    expect(searchKey("BRAVE_SEARCH_KEY", {} as NodeJS.ProcessEnv, root)).toBe("abc123")
    expect(searchKey("BRAVE_SEARCH_KEY", { BRAIN2_BRAVE_SEARCH_KEY: "env" } as unknown as NodeJS.ProcessEnv, root)).toBe("env")
    expect(searchKey("TAVILY_KEY", {} as NodeJS.ProcessEnv, root)).toBe("")
  })
})
