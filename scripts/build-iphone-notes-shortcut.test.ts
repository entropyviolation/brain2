/**
 * scripts/build-iphone-notes-shortcut.test.ts — signed-shortcut generator shape
 */
import { describe, expect, it } from "vitest"
import {
  assertWorkflowShape,
  buildWorkflow,
  KNOWN_ACTION_IDENTIFIERS,
  sampleDumpText,
} from "./build-iphone-notes-shortcut.mjs"
import { applyIphoneNotes, parseIphoneNoteDump, resetIphoneNoteContinuations } from "@/lib/ingest/apply-iphone-notes"
import { resetAllStores, resetLocalStorage } from "@/tests/test-utils"
import { IPHONE_NOTES_STORE_LIST_ID } from "@/lib/apple-notes"
import { useTaskStore } from "@/lib/task-store"

const UUID_RE = /^[0-9A-Fa-f]{8}-[0-9A-Fa-f]{4}-[0-9A-Fa-f]{4}-[0-9A-Fa-f]{4}-[0-9A-Fa-f]{12}$/

describe("buildWorkflow", () => {
  it("asks for the Telegram bot chat on the Send Message action", () => {
    const workflow = buildWorkflow()
    const sendIndex = workflow.WFWorkflowActions.findIndex(
      (action: { WFWorkflowActionIdentifier: string }) =>
        action.WFWorkflowActionIdentifier === "is.workflow.actions.sendmessage",
    )
    expect(sendIndex).toBeGreaterThan(-1)
    const send = workflow.WFWorkflowActions[sendIndex]
    expect(send.WFWorkflowActionParameters.IntentAppIdentifier).toBe("ph.telegra.Telegraph")
    expect(workflow.WFWorkflowImportQuestions).toEqual([
      expect.objectContaining({
        ActionIndex: sendIndex,
        ParameterKey: "WFSendMessageActionRecipients",
      }),
    ])
  })

  it("sets Notes on every menu branch", () => {
    const workflow = buildWorkflow()
    const noteSets = workflow.WFWorkflowActions.filter(
      (action: { WFWorkflowActionIdentifier: string; WFWorkflowActionParameters: { WFVariableName?: string } }) =>
        action.WFWorkflowActionIdentifier === "is.workflow.actions.setvariable" &&
        action.WFWorkflowActionParameters.WFVariableName === "Notes",
    )
    expect(noteSets).toHaveLength(6)
  })

  it("uses a filled If (Count > 0), not an empty conditional", () => {
    const workflow = buildWorkflow()
    const banned = new Set([
      "is.workflow.actions.date",
      "is.workflow.actions.adjustdate",
      "is.workflow.actions.properties.notes",
    ])
    const bad = workflow.WFWorkflowActions.filter((a: { WFWorkflowActionIdentifier: string }) =>
      banned.has(a.WFWorkflowActionIdentifier),
    )
    expect(bad).toEqual([])
    const ifOpen = workflow.WFWorkflowActions.find(
      (a: { WFWorkflowActionIdentifier: string; WFWorkflowActionParameters: { WFControlFlowMode?: number } }) =>
        a.WFWorkflowActionIdentifier === "is.workflow.actions.conditional" &&
        a.WFWorkflowActionParameters.WFControlFlowMode === 0,
    )
    expect(ifOpen?.WFWorkflowActionParameters.WFCondition).toBe(2)
    expect(ifOpen?.WFWorkflowActionParameters.WFNumberValue).toBe(0)
    expect(ifOpen?.WFWorkflowActionParameters.WFInput).toBeTruthy()
  })

  it("Send Message posts Variable Outgoing text — never Notes / Dump ActionOutput", () => {
    const workflow = buildWorkflow()
    const send = workflow.WFWorkflowActions.find(
      (action: { WFWorkflowActionIdentifier: string }) =>
        action.WFWorkflowActionIdentifier === "is.workflow.actions.sendmessage",
    )
    expect(send?.WFWorkflowActionParameters.IntentAppIdentifier).toBe("ph.telegra.Telegraph")
    expect(send?.WFWorkflowActionParameters.WFSendMessageContent).toEqual({
      Value: { Type: "Variable", VariableName: "Outgoing" },
      WFSerializationType: "WFTextTokenAttachment",
    })
    const text = workflow.WFWorkflowActions.find(
      (action: { WFWorkflowActionIdentifier: string }) =>
        action.WFWorkflowActionIdentifier === "is.workflow.actions.gettext",
    )
    expect(text?.WFWorkflowActionParameters.CustomOutputName).toBeUndefined()
    const setOut = workflow.WFWorkflowActions.find(
      (action: {
        WFWorkflowActionIdentifier: string
        WFWorkflowActionParameters: { WFVariableName?: string }
      }) =>
        action.WFWorkflowActionIdentifier === "is.workflow.actions.setvariable" &&
        action.WFWorkflowActionParameters.WFVariableName === "Outgoing",
    )
    expect(setOut?.WFWorkflowActionParameters.WFInput?.Value?.OutputName).toBe("Text")
  })

  it("date branches use Find Notes operator 1001 (is in the last)", () => {
    const workflow = buildWorkflow()
    const finds = workflow.WFWorkflowActions.filter(
      (action: { WFWorkflowActionIdentifier: string }) =>
        action.WFWorkflowActionIdentifier === "is.workflow.actions.filter.notes",
    )
    const dayFinds = finds.filter((f: { WFWorkflowActionParameters: { WFContentItemFilter: { Value: { WFActionParameterFilterTemplates: { Operator: number; Property: string }[] } } } }) =>
      f.WFWorkflowActionParameters.WFContentItemFilter.Value.WFActionParameterFilterTemplates.some(
        (t) => t.Property === "Last Modified Date",
      ),
    )
    expect(dayFinds.length).toBeGreaterThanOrEqual(3)
    for (const find of dayFinds) {
      const t = find.WFWorkflowActionParameters.WFContentItemFilter.Value.WFActionParameterFilterTemplates.find(
        (row: { Property: string }) => row.Property === "Last Modified Date",
      )
      expect(t?.Operator).toBe(1001)
      expect(t?.Values?.Unit).toBe(16384)
    }
  })

  it("menu has Pick a note (Choose from List) and Shortcut Input", () => {
    const workflow = buildWorkflow()
    const menu = workflow.WFWorkflowActions.find(
      (a: { WFWorkflowActionIdentifier: string; WFWorkflowActionParameters: { WFControlFlowMode?: number } }) =>
        a.WFWorkflowActionIdentifier === "is.workflow.actions.choosefrommenu" &&
        a.WFWorkflowActionParameters.WFControlFlowMode === 0,
    )
    expect(menu?.WFWorkflowActionParameters.WFMenuItems).toEqual(
      expect.arrayContaining(["Pick a note", "Shortcut Input", "Last 24 hours", "Choose folder"]),
    )
    expect(
      workflow.WFWorkflowActions.some(
        (a: { WFWorkflowActionIdentifier: string }) =>
          a.WFWorkflowActionIdentifier === "is.workflow.actions.choosefromlist",
      ),
    ).toBe(true)
  })

  it("reads only real NoteEntity fields (no Identifier)", () => {
    const workflow = buildWorkflow()
    const text = workflow.WFWorkflowActions.find(
      (action: { WFWorkflowActionIdentifier: string }) =>
        action.WFWorkflowActionIdentifier === "is.workflow.actions.gettext",
    )
    const attachments = text?.WFWorkflowActionParameters.WFTextActionText.Value.attachmentsByRange
    const props = Object.values(attachments ?? {}).flatMap(
      (a: { Aggrandizements?: { PropertyName?: string }[] }) =>
        (a.Aggrandizements ?? []).map((ag) => ag.PropertyName),
    )
    expect(props).toEqual(expect.arrayContaining(["Name", "Folder", "Last Modified Date", "Body"]))
    expect(props).not.toContain("Identifier")
  })

  it("wires Find Notes as Note into the Notes variable", () => {
    const workflow = buildWorkflow()
    const finds = workflow.WFWorkflowActions.filter(
      (action: { WFWorkflowActionIdentifier: string }) =>
        action.WFWorkflowActionIdentifier === "is.workflow.actions.filter.notes",
    )
    for (const find of finds) {
      expect(find.WFWorkflowActionParameters.CustomOutputName).toBe("Note")
    }
  })

  it("opens and closes every control-flow group", () => {
    const workflow = buildWorkflow()
    const depth = new Map<string, number>()
    for (const action of workflow.WFWorkflowActions) {
      const { GroupingIdentifier: group, WFControlFlowMode: mode } = action.WFWorkflowActionParameters
      if (!group) continue
      if (mode === 0) depth.set(group, (depth.get(group) ?? 0) + 1)
      if (mode === 2) depth.set(group, (depth.get(group) ?? 0) - 1)
    }
    expect([...depth.values()]).toEqual(Array.from(depth, () => 0))
  })

  it("emits only known action identifiers and valid UUIDs", () => {
    const workflow = buildWorkflow()
    expect(() => assertWorkflowShape(workflow)).not.toThrow()
    for (const action of workflow.WFWorkflowActions) {
      expect(KNOWN_ACTION_IDENTIFIERS.has(action.WFWorkflowActionIdentifier)).toBe(true)
      expect(action.WFWorkflowActionParameters.UUID).toMatch(UUID_RE)
    }
  })
})

describe("sampleDumpText → applyIphoneNotes (webhook path)", () => {
  it("parks the exact dump the Shortcut Text action builds", () => {
    resetAllStores()
    resetLocalStorage()
    resetIphoneNoteContinuations()
    const text = sampleDumpText()
    // parseMessage strips the verb; executor passes the payload after iphone-notes:
    const payload = text.replace(/^iphone-notes:\s*/i, "")
    const parsed = parseIphoneNoteDump(payload)
    expect(parsed.ok).toBe(true)
    if (!parsed.ok) return
    expect(parsed.dump.id).toBe("Grocery|Quick Notes|2026-09-21T16:00:00Z")
    expect(parsed.dump.title).toBe("Grocery")
    expect(parsed.dump.body).toBe("milk\neggs")

    const result = applyIphoneNotes(payload)
    expect(result.status).toBe("ok")
    if (result.status !== "ok") return
    expect(result.reply).toMatch(/Parked in iPhone Notes Store: Grocery/)
    const task = useTaskStore.getState().tasks[0]
    expect(task?.lists).toContain(IPHONE_NOTES_STORE_LIST_ID)
    expect(task?.title).toBe("Grocery")
    expect(task?.body).toContain("milk")
  })

  it("synthesizes an id when the Shortcut sent empty Identifier magic vars", () => {
    resetAllStores()
    resetLocalStorage()
    resetIphoneNoteContinuations()
    const result = applyIphoneNotes(
      "id: ||\ntitle: Grocery\nfolder: Quick Notes\nmodified: 2026-09-21T16:00:00Z\n---\nmilk",
    )
    expect(result.status).toBe("ok")
    if (result.status !== "ok") return
    expect(result.reply).toMatch(/Parked/)
    expect(useTaskStore.getState().tasks[0]?.title).toBe("Grocery")
  })
})
