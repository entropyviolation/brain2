import { describe, it, expect } from "vitest"
import {
  parseLetterboxdCsv,
  parseRating,
  detectExportKind,
  parseCsvText,
  classifyLetterboxdPath,
  parseLetterboxdExportBundle,
} from "./letterboxd-parse"
import {
  blendCatalogs,
  cosine,
  decadeVec,
  rankWatchlist,
  watchScatter,
} from "./filmrecs-score"
import type { FilmRecord } from "./filmrecs-types"
import { normalizeFilmTitle } from "./filmrecs-types"
import { planLetterboxdMerge, taskToFilm, seedFilmToTask } from "./filmrecs-catalog"
import type { List } from "./types"

describe("letterboxd-parse", () => {
  it("parses ratings and titles from a Letterboxd watchlist CSV", () => {
    const csv = `Name,Year,Letterboxd URI
Stalker,1979,https://boxd.it/28PO
Amélie,2001,https://boxd.it/1x
"The Boy and the Heron",2023,https://boxd.it/ipeM
`
    const parsed = parseLetterboxdCsv(csv, "watchlist.csv")
    expect(parsed.kind).toBe("watchlist")
    expect(parsed.count).toBe(3)
    expect(parsed.films[0].title).toBe("Stalker")
    expect(parsed.films[0].year).toBe(1979)
    expect(parsed.films[0].queued).toBe(true)
  })

  it("detects likes exports and star ratings", () => {
    expect(detectExportKind("likes.csv", ["Name", "Year", "Rating"])).toBe("likes")
    expect(parseRating("4.5")).toBe(4.5)
    expect(parseRating("★★★★½")).toBe(4.5)
    expect(parseRating("8")).toBe(4)
  })

  it("handles quoted commas in CSV cells", () => {
    const rows = parseCsvText('Name,Year\n"Meyerowitz Stories, The",2017\n')
    expect(rows[1][0]).toBe("Meyerowitz Stories, The")
  })

  it("classifies paths inside a Letterboxd export folder", () => {
    expect(classifyLetterboxdPath("watchlist.csv")).toBe("watchlist")
    expect(classifyLetterboxdPath("letterboxd-user/likes/films.csv")).toBe("likes")
    expect(classifyLetterboxdPath("likes/lists.csv")).toBe("skip")
    expect(classifyLetterboxdPath("deleted/diary.csv")).toBe("skip")
    expect(classifyLetterboxdPath("profile.csv")).toBe("skip")
    expect(classifyLetterboxdPath("lists/want-to-watch.csv")).toBe("watchlist")
  })

  it("merges a multi-file Letterboxd export folder", () => {
    const bundle = parseLetterboxdExportBundle([
      {
        path: "letterboxd-demo/watchlist.csv",
        text: `Date,Name,Year,Letterboxd URI
2024-01-09,The Boy and the Heron,2023,https://boxd.it/ipeM
2024-01-09,Stalker,1979,https://boxd.it/28PO
`,
      },
      {
        path: "letterboxd-demo/likes/films.csv",
        text: `Date,Name,Year,Letterboxd URI
2023-11-18,Everything Everywhere All at Once,2022,https://boxd.it/jUk4
2023-11-18,Stalker,1979,https://boxd.it/28PO
`,
      },
      {
        path: "letterboxd-demo/ratings.csv",
        text: `Date,Name,Year,Letterboxd URI,Rating
2024-01-08,OPAL,2020,https://boxd.it/suy8,5
`,
      },
      {
        path: "letterboxd-demo/profile.csv",
        text: `Date,Name\n2024-01-01,demo\n`,
      },
      {
        path: "letterboxd-demo/likes/lists.csv",
        text: `Date,Content\n2024-01-08,https://boxd.it/9ayZa\n`,
      },
    ])
    expect(bundle.kind).toBe("bundle")
    expect(bundle.label).toBe("demo")
    expect(bundle.files.map((f) => f.kind).sort()).toEqual(["likes", "ratings", "watchlist"])
    expect(bundle.count).toBe(4) // Heron, Stalker, EEAAO, OPAL
    const stalker = bundle.films.find((f) => f.title === "Stalker")!
    expect(stalker.queued).toBe(true)
    expect(stalker.liked).toBe(true)
    expect(bundle.skipped.some((p) => p.includes("profile"))).toBe(true)
  })
})

describe("filmrecs-score", () => {
  const mine: FilmRecord[] = [
    { id: "1", title: "Stalker", year: 1979, liked: true, rating: 5, shelf: "Cosmic & transcendental", shelfId: 2 },
    { id: "2", title: "Amélie", year: 2001, liked: true, rating: 5, shelf: "Warm & wry indies", shelfId: 13 },
    { id: "3", title: "Primer", year: 2004, source: "watchlist", shelf: "Time loops, doubles & puzzle-box sci-fi", shelfId: 0 },
    { id: "4", title: "Aftersun", year: 2022, source: "watchlist", shelf: "Dramas that leave a mark", shelfId: 14 },
  ]

  it("computes decade cosine similarity", () => {
    const a = decadeVec(mine)
    const b = decadeVec([{ year: 1979 }, { year: 2001 }, { year: 2004 }])
    expect(cosine(a, b)).toBeGreaterThan(0.5)
  })

  it("blends catalogs and finds shared films", () => {
    const theirs: FilmRecord[] = [
      { id: "t1", title: "Stalker", year: 1979 },
      { id: "t2", title: "Eraserhead", year: 1977 },
      { id: "t3", title: "Mulholland Drive", year: 2001 },
    ]
    const blend = blendCatalogs(mine, theirs)
    expect(blend.common.map((c) => normalizeFilmTitle(c.title))).toContain("stalker")
    expect(blend.score).toBeGreaterThan(0)
    expect(blend.forYou.some((f) => f.title === "Eraserhead")).toBe(true)
  })

  it("ranks watchlist toward liked decades / shelves", () => {
    const ranked = rankWatchlist(
      mine.filter((f) => f.source === "watchlist"),
      mine.filter((f) => f.liked),
    )
    expect(ranked.length).toBe(2)
    expect(ranked[0].rankScore).toBeGreaterThanOrEqual(ranked[1].rankScore)
    const scatter = watchScatter(ranked)
    expect(scatter.points.length).toBe(2)
  })
})

describe("filmrecs-catalog", () => {
  const category: List = {
    id: "films-1",
    name: "Films",
    color: "#ff8000",
    createdAt: new Date(),
    scheduleable: false,
    itemLabel: "film",
    itemAttributes: [],
  }

  it("round-trips seed films through tasks", () => {
    const task = seedFilmToTask(category, {
      title: "Stalker",
      year: 1979,
      shelf_id: 2,
      liked: true,
      rating: 5,
      poster: "https://example.com/p.jpg",
    })
    const film = taskToFilm(task)
    expect(film.title).toBe("Stalker")
    expect(film.year).toBe(1979)
    expect(film.liked).toBe(true)
    expect(film.shelf).toContain("Cosmic")
  })

  it("plans Letterboxd merges without duplicates", () => {
    const existing = [seedFilmToTask(category, { title: "Stalker", year: 1979, liked: true, source: "likes" })]
    const parsed = parseLetterboxdCsv(
      `Name,Year,Letterboxd URI\nStalker,1979,https://boxd.it/28PO\nPrimer,2004,https://boxd.it/x\n`,
      "watchlist.csv",
    )
    const plan = planLetterboxdMerge(category, existing, parsed)
    expect(plan.stats.updated).toBe(1)
    expect(plan.stats.added).toBe(1)
    expect(plan.update[0].attributes?.source).toBe("both")
  })
})
