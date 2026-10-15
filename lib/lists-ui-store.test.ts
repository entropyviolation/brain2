import { beforeEach, describe, expect, it } from "vitest"
import { listItemsIconLocation } from "@/components/Lists/lib/list-icon-pile"
import { DEFAULT_GRAVITY_FIELD_PARAMS } from "@/components/Lists/lib/list-icon-gravity"
import { migrateListsUiPersisted, useListsUiStore } from "@/lib/lists-ui-store"

describe("lists ui desktop mode persist", () => {
  beforeEach(() => {
    useListsUiStore.setState({
      iconPositions: {},
      iconLayoutMode: {},
      listIconsDesktop: {},
      listIconsGravity: {},
      listIconsGravityField: {
        globalG: DEFAULT_GRAVITY_FIELD_PARAMS.globalG,
        sources: { ...DEFAULT_GRAVITY_FIELD_PARAMS.sources },
        attributeDrift: DEFAULT_GRAVITY_FIELD_PARAMS.attributeDrift,
      },
    })
  })

  it("migrates v6 to desktop off without clobbering folder icon positions", () => {
    const folderKey = "home:list-abc"
    const migrated = migrateListsUiPersisted(
      {
        iconPositions: { [folderKey]: { x: 12, y: 24 } },
        iconLayoutMode: { home: "freeform" },
        showPeriodLedgerListsInAll: false,
      },
      6,
    )
    expect(migrated.listIconsDesktop).toEqual({})
    expect(migrated.listIconsGravity).toEqual({})
    expect(migrated.listIconsGravityField).toEqual({
      globalG: DEFAULT_GRAVITY_FIELD_PARAMS.globalG,
      sources: { ...DEFAULT_GRAVITY_FIELD_PARAMS.sources },
      attributeDrift: DEFAULT_GRAVITY_FIELD_PARAMS.attributeDrift,
    })
    expect(migrated.iconPositions).toEqual({ [folderKey]: { x: 12, y: 24 } })
    expect(migrated.iconLayoutMode).toEqual({ home: "freeform" })
    expect(migrated.showPeriodLedgerListsInAll).toBe(false)
  })

  it("keeps an existing desktop flag when the blob is already v7", () => {
    const migrated = migrateListsUiPersisted(
      {
        listIconsDesktop: { "list-1": true },
        iconPositions: { "home:folder-1": { x: 1, y: 2 } },
      },
      7,
    )
    expect(migrated.listIconsDesktop).toEqual({ "list-1": true })
    expect(migrated.listIconsGravity).toEqual({})
    expect(migrated.iconPositions).toEqual({ "home:folder-1": { x: 1, y: 2 } })
  })

  it("keeps gravity flag when the blob is already v8 and fills field defaults", () => {
    const migrated = migrateListsUiPersisted(
      {
        listIconsDesktop: { "list-1": true },
        listIconsGravity: { "list-1": true },
      },
      8,
    )
    expect(migrated.listIconsGravity).toEqual({ "list-1": true })
    expect(migrated.listIconsGravityField).toEqual({
      globalG: DEFAULT_GRAVITY_FIELD_PARAMS.globalG,
      sources: { ...DEFAULT_GRAVITY_FIELD_PARAMS.sources },
      attributeDrift: DEFAULT_GRAVITY_FIELD_PARAMS.attributeDrift,
    })
  })

  it("migrates v9 to empty hiddenItemTypeIdsByTarget", () => {
    const migrated = migrateListsUiPersisted(
      {
        listIconsDesktop: { "list-1": true },
        listIconsGravity: {},
      },
      9,
    )
    expect(migrated.hiddenItemTypeIdsByTarget).toEqual({})
  })

  it("keeps a valid gravity field blob on v9 and Desktop off clears on/off only", () => {
    const { setListIconsDesktop, setListIconsGravity, setListIconsGravityField, setIconPosition, commitIconLayout } =
      useListsUiStore.getState()
    setIconPosition("home", "list-abc", 10, 20)
    setListIconsDesktop("list-abc", true)
    setListIconsGravity("list-abc", true)
    setListIconsGravityField({ globalG: 1.4, sources: { tag: 1.1 } })
    setListIconsDesktop("all-root", false)
    const location = listItemsIconLocation("list-abc")
    commitIconLayout(location, { "task-1": { x: 30, y: 40 } }, "freeform")

    const state = useListsUiStore.getState()
    expect(state.listIconsDesktop["list-abc"]).toBe(true)
    expect(state.listIconsGravity["list-abc"]).toBe(true)
    expect(state.listIconsGravityField.globalG).toBe(1.4)
    expect(state.listIconsGravityField.sources.tag).toBe(1.1)
    expect(state.listIconsDesktop["all-root"]).toBe(false)
    expect(state.iconPositions["home:list-abc"]).toEqual({ x: 10, y: 20 })
    expect(state.iconPositions[`${location}:task-1`]).toEqual({ x: 30, y: 40 })
    expect(state.iconLayoutMode[location]).toBe("freeform")
    expect(state.iconLayoutMode.home).toBeUndefined()
    expect(useListsUiStore.persist.getOptions().version).toBe(10)

    setListIconsDesktop("list-abc", false)
    expect(useListsUiStore.getState().listIconsGravity["list-abc"]).toBe(false)
    expect(useListsUiStore.getState().listIconsGravityField.globalG).toBe(1.4)
  })
})
