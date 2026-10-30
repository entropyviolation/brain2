/**
 * components/Inventory/shopping/shopping-board.tsx — Shopping list views
 *
 * Each key is one view. It aggregates every vault list chosen in the
 * source picker, once per item. Add writes `addTask(createListItem(...))`
 * onto the first source. The checkbox finishes the item. The rest of the
 * row opens item detail.
 */
"use client"

import { useEffect, useMemo, useState } from "react"
import { itemTitleOrUntitled } from "@/lib/item-utils"
import { openItemDetailPopup } from "@/lib/points-ledger-nav"
import { usePersistHydrated } from "@/lib/use-persist-hydrated"
import { useTaskStore } from "@/lib/task-store"
import { useShopBindings } from "./shop-bindings"
import { ShopSourcePicker } from "./shop-source-picker"
import {
  autoPickShopLists,
  defaultShopViews,
  shopAddItem,
  shopAggregate,
  shopCatalogLists,
  shopListDraft,
  shopListDraftNamed,
  shopRowAside,
  shopSectionId,
  shopViewDraft,
} from "./shop-lists"
import "./shopping.css"

export function ShoppingBoard({ testId, className }: { testId: string; className?: string }) {
  const hydrated = usePersistHydrated(useTaskStore.persist)
  const lists = useTaskStore((state) => state.lists)
  const tasks = useTaskStore((state) => state.tasks)
  const [views, setViews] = useShopBindings()
  const [section, setSection] = useState("grocery")
  const [name, setName] = useState("")
  const [adding, setAdding] = useState(false)
  const [draft, setDraft] = useState("")

  const catalog = useMemo(
    () => shopCatalogLists(lists).map((list) => ({ id: list.id, name: list.name, color: list.color || "#6e7378" })),
    [lists],
  )

  useEffect(() => {
    if (!hydrated || views !== null || catalog.length === 0) return
    setViews(autoPickShopLists(catalog, defaultShopViews()))
  }, [hydrated, views, catalog, setViews])

  const current = views ?? defaultShopViews()
  const view = current.find((row) => row.id === section) ?? current[0]
  const rows = shopAggregate(tasks, view.listIds)
  const readyName = name.trim()
  const readyDraft = draft.trim()

  const setSources = (listIds: string[]) => {
    setViews(current.map((row) => (row.id === view.id ? { ...row, listIds } : row)))
  }

  const addView = () => {
    const next = shopViewDraft(readyDraft)
    if (!next) return
    setViews([...current, next])
    setSection(next.id)
    setDraft("")
    setAdding(false)
  }

  const add = () => {
    if (!readyName) return
    const known = new Set(catalog.map((list) => list.id))
    const base = views ?? autoPickShopLists(catalog, defaultShopViews())
    const active = base.find((row) => row.id === view.id) ?? base[0]
    let home = active.listIds.find((id) => known.has(id)) ?? ""
    let listIds = active.listIds
    if (!home) {
      const sectionId = shopSectionId(active.id)
      const list = sectionId ? shopListDraft(sectionId) : shopListDraftNamed(active.name)
      useTaskStore.getState().addList(list)
      home = list.id
      listIds = [...active.listIds.filter((id) => known.has(id)), home]
    }
    const item = shopAddItem(readyName, home)
    if (!item) return
    useTaskStore.getState().addTask(item)
    setViews(base.map((row) => (row.id === active.id ? { ...row, listIds } : row)))
    setName("")
  }

  const toggle = (id: string) => {
    const task = useTaskStore.getState().tasks.find((row) => row.id === id)
    if (!task) return
    useTaskStore.getState().updateTask({ ...task, completed: !task.completed })
  }

  return (
    <section className={className ? `inv-shop ${className}` : "inv-shop"} data-testid={testId} aria-label="Shopping lists" data-section={view.id}>
      <div className="inv-shop-sections" role="group" aria-label="Shopping lists">
        {current.map((row) => (
          <button
            key={row.id}
            type="button"
            data-no95=""
            className="todo-cap inv-shop-key"
            aria-pressed={view.id === row.id}
            onClick={() => setSection(row.id)}
          >
            {row.name}
          </button>
        ))}
        {adding ? (
          <form
            className="inv-shop-new"
            aria-label="New shopping list"
            onSubmit={(event) => {
              event.preventDefault()
              addView()
            }}
          >
            <input
              aria-label="New shopping list"
              value={draft}
              autoFocus
              onChange={(event) => setDraft(event.target.value)}
              onKeyDown={(event) => {
                if (event.key !== "Escape") return
                event.preventDefault()
                setDraft("")
                setAdding(false)
              }}
            />
            <button type="submit" data-no95="" className="todo-cap inv-shop-key" disabled={!readyDraft}>
              Add
            </button>
          </form>
        ) : (
          <button type="button" data-no95="" className="todo-cap inv-shop-key inv-shop-plus" aria-label="Add shopping list" onClick={() => setAdding(true)}>
            +
          </button>
        )}
      </div>
      <p className="inv-shop-list-name">{view.name}</p>
      <ShopSourcePicker key={view.id} selected={view.listIds} onChange={setSources} viewName={view.name} />
      {view.listIds.length > 0 && rows.length === 0 ? <p className="inv-shop-empty">Nothing here yet.</p> : null}
      {rows.length > 0 ? (
        <ul className="inv-shop-rows">
          {rows.map((task) => {
            const title = itemTitleOrUntitled(task)
            const aside = shopRowAside(task)
            return (
              <li key={task.id} className="inv-shop-row" data-done={task.completed ? "true" : "false"} data-testid="shop-row">
                <input type="checkbox" checked={!!task.completed} aria-label={`Done ${title}`} onChange={() => toggle(task.id)} />
                <button type="button" data-no95="" className="inv-shop-open" aria-label={title} onClick={() => openItemDetailPopup(task.id)}>
                  <span className="inv-shop-title">{title}</span>
                  {aside ? <span className="inv-shop-aside">{aside}</span> : null}
                </button>
              </li>
            )
          })}
        </ul>
      ) : null}
      <form
        className="inv-shop-add"
        aria-label={`Add to ${view.name}`}
        onSubmit={(event) => {
          event.preventDefault()
          add()
        }}
      >
        <label className="inv-shop-field">
          <span>Name</span>
          <input aria-label="Item name" value={name} onChange={(event) => setName(event.target.value)} />
        </label>
        <button type="submit" data-no95="" className="inv-shop-go" disabled={!readyName}>
          Add
        </button>
      </form>
    </section>
  )
}
