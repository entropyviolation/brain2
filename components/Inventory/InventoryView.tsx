/**
 * components/Inventory/InventoryView.tsx — Inventory desk
 *
 * Go tab. Bookshelf (one existing list), Closet (wardrobe store),
 * Kitchen (kitchen store), Shopping (named views over vault lists), and Gems and
 * Trinkets (finished daily habits and tasks). A viewport
 * at or under 767px mounts the phone layout instead.
 */
"use client"

import { SingleListPicker } from "@/components/Lists/list-picker"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { BookshelfScene } from "./bookshelf-scene"
import { ClosetScene } from "./closet-scene"
import { KitchenScene } from "./kitchen/kitchen-scene"
import { ShoppingScene } from "./shopping/shopping-scene"
import { GemsScene } from "./gems/gems-scene"
import { INVENTORY_SCENES, useBookshelfListId, useInventoryScene, type InventorySceneId } from "./inventory-scenes"
import { InventoryPhone } from "./phone/inventory-phone"
import { useInventoryPhone } from "./phone/use-inventory-phone"
import "./inventory-chrome.css"

export function InventoryView() {
  const phone = useInventoryPhone()
  const [scene, setScene] = useInventoryScene()
  const [listId, setListId] = useBookshelfListId()

  if (phone) {
    return <InventoryPhone scene={scene} onScene={setScene} listId={listId} onListId={setListId} />
  }

  const meta = INVENTORY_SCENES.find((row) => row.id === scene)
  return (
    <div className="inv-room" data-testid="inventory-room" data-ui-name="Inventory" data-scene={scene}>
      <Tabs value={scene} onValueChange={(value) => setScene(value as InventorySceneId)}>
        <TabsList className="inv-scene-keys b2-keycap-tab" aria-label="Inventory scene">
          {INVENTORY_SCENES.map((row) => (
            <TabsTrigger key={row.id} value={row.id} title={row.description}>
              {row.label}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>
      {meta ? <p className="inv-scene-note">{meta.description}</p> : null}
      {scene === "bookshelf" ? (
        <div className="inv-shelf-pick">
          <span className="inv-shelf-label">List</span>
          <SingleListPicker value={listId ?? ""} onValueChange={(id) => setListId(id || null)} />
        </div>
      ) : null}
      {scene === "bookshelf" ? (
        <BookshelfScene listId={listId} />
      ) : scene === "closet" ? (
        <ClosetScene />
      ) : scene === "kitchen" ? (
        <KitchenScene />
      ) : scene === "shopping" ? (
        <ShoppingScene />
      ) : (
        <GemsScene surface="desk" />
      )}
    </div>
  )
}
