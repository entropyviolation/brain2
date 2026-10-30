import { describe, expect, it } from "vitest"
import { INVENTORY_LIST_ID } from "@/lib/ingest/apply-inventory"
import {
  autoPickShopLists,
  defaultShopViews,
  shopAddItem,
  shopAggregate,
  shopViewsFromStored,
  type ShopView,
} from "./shop-lists"

const open = defaultShopViews()

function ids(views: ShopView[], id: string): string[] {
  return views.find((view) => view.id === id)?.listIds ?? []
}

describe("autoPickShopLists", () => {
  it("lets the inventory list id win grocery, and does not let shopping take it", () => {
    const picked = autoPickShopLists(
      [
        { id: INVENTORY_LIST_ID, name: "Shopping" },
        { id: "groc", name: "Grocery" },
        { id: "shop", name: "Hardware shopping" },
      ],
      open,
    )
    expect(ids(picked, "grocery")).toEqual([INVENTORY_LIST_ID])
    expect(ids(picked, "shopping")).toEqual(["shop"])
    expect(ids(picked, "shopping")).not.toEqual(ids(picked, "grocery"))
  })

  it("leaves shopping unbound when the only shopping name is the grocery list", () => {
    const picked = autoPickShopLists([{ id: INVENTORY_LIST_ID, name: "Shopping" }], open)
    expect(ids(picked, "grocery")).toEqual([INVENTORY_LIST_ID])
    expect(ids(picked, "shopping")).toEqual([])
  })

  it("matches wish and wanted names without giving them a list another section took", () => {
    const picked = autoPickShopLists(
      [
        { id: "both", name: "Grocery shopping" },
        { id: "wish", name: "Wish list" },
        { id: "want", name: "Wanted records" },
        { id: "overlap", name: "Wish to buy" },
      ],
      open,
    )
    expect(ids(picked, "grocery")).toEqual(["both"])
    expect(ids(picked, "shopping")).toEqual([])
    expect(ids(picked, "wish")).toEqual(["wish"])
    expect(ids(picked, "wanted")).toEqual(["want"])
    expect(new Set([...ids(picked, "grocery"), ...ids(picked, "wish"), ...ids(picked, "wanted")]).size).toBe(3)
  })

  it("does not bind two empty sections to one list", () => {
    const picked = autoPickShopLists([{ id: "only", name: "Grocery shopping wish wanted to buy" }], open)
    expect(ids(picked, "grocery")).toEqual(["only"])
    expect(ids(picked, "shopping")).toEqual([])
    expect(ids(picked, "wish")).toEqual([])
    expect(ids(picked, "wanted")).toEqual([])
  })

  it("keeps an explicit grocery binding and will not hand that list to shopping", () => {
    const bound = open.map((view) => (view.id === "grocery" ? { ...view, listIds: [INVENTORY_LIST_ID] } : view))
    const picked = autoPickShopLists(
      [
        { id: INVENTORY_LIST_ID, name: "Shopping" },
        { id: "shop", name: "Weekend shopping" },
      ],
      bound,
    )
    expect(ids(picked, "grocery")).toEqual([INVENTORY_LIST_ID])
    expect(ids(picked, "shopping")).toEqual(["shop"])
  })

  it("leaves extra source lists on a view that already has one", () => {
    const bound = open.map((view) => (view.id === "grocery" ? { ...view, listIds: ["a", "b"] } : view))
    const picked = autoPickShopLists([{ id: "c", name: "Grocery" }], bound)
    expect(ids(picked, "grocery")).toEqual(["a", "b"])
  })
})

describe("shopAggregate", () => {
  it("keeps one row when an item sits on more than one source list", () => {
    const rows = shopAggregate(
      [
        { id: "milk", lists: ["a", "b"] },
        { id: "soap", lists: ["b"] },
        { id: "pen", lists: ["c"] },
        { id: "milk", lists: ["a"] },
      ],
      ["a", "b"],
    )
    expect(rows.map((row) => row.id)).toEqual(["milk", "soap"])
  })

  it("returns nothing when the view has no sources", () => {
    expect(shopAggregate([{ id: "milk", lists: ["a"] }], [])).toEqual([])
  })
})

describe("shopViewsFromStored", () => {
  it("reads a version 2 record and drops a repeated source", () => {
    const views = shopViewsFromStored({
      v: 2,
      views: [{ id: "grocery", name: "Grocery", listIds: ["a", "a", "b"] }, { id: "trip", name: "Trip", listIds: [] }],
    })
    expect(views?.map((view) => view.id)).toEqual(["grocery", "trip"])
    expect(views?.[0].listIds).toEqual(["a", "b"])
  })

  it("turns the older one-id record into views", () => {
    const views = shopViewsFromStored({ grocery: "list-inventory", shopping: "", wish: "wishes", wanted: "" })
    expect(ids(views ?? [], "grocery")).toEqual(["list-inventory"])
    expect(ids(views ?? [], "shopping")).toEqual([])
    expect(ids(views ?? [], "wish")).toEqual(["wishes"])
    expect(views).toHaveLength(4)
  })
})

describe("shopAddItem", () => {
  it("sets the title and includes the list id", () => {
    const item = shopAddItem("  Oats  ", "list-inventory")
    expect(item).not.toBeNull()
    expect(item?.title).toBe("Oats")
    expect(item?.lists).toContain("list-inventory")
  })

  it("does not submit an empty name", () => {
    expect(shopAddItem("   ", "list-inventory")).toBeNull()
    expect(shopAddItem("Oats", "")).toBeNull()
  })
})
