/**
 * scripts/build-iphone-phone-shortcuts.test.ts — Screen Time / Call / Text / Location generator shape
 */
import { describe, expect, it } from "vitest"
import {
  buildBoundNfcWorkflow,
  buildCallWorkflow,
  buildLocationWorkflow,
  buildScreenTimeWorkflow,
  buildTextWorkflow,
  nfcShortcutDownloadName,
} from "./build-iphone-phone-shortcuts.mjs"

function sendIndex(workflow: { WFWorkflowActions: { WFWorkflowActionIdentifier: string }[] }) {
  return workflow.WFWorkflowActions.findIndex(
    (action) => action.WFWorkflowActionIdentifier === "is.workflow.actions.sendmessage",
  )
}

function expectTelegramSend(workflow: {
  WFWorkflowActions: {
    WFWorkflowActionIdentifier: string
    WFWorkflowActionParameters: {
      IntentAppIdentifier?: string
      WFSendMessageContent?: { Value?: { Type?: string; VariableName?: string } }
      WFVariableName?: string
    }
  }[]
  WFWorkflowImportQuestions: { ActionIndex: number; ParameterKey: string }[]
}) {
  const index = sendIndex(workflow)
  expect(index).toBeGreaterThan(-1)
  const send = workflow.WFWorkflowActions[index]
  expect(send.WFWorkflowActionParameters.IntentAppIdentifier).toBe("ph.telegra.Telegraph")
  expect(send.WFWorkflowActionParameters.IntentAppDefinition).toEqual({
    BundleIdentifier: "ph.telegra.Telegraph",
    Name: "Telegram",
    TeamIdentifier: "C67CF9S4VU",
    IntentClassName: "INSendMessageIntent",
  })
  expect(send.WFWorkflowActionParameters.ShowWhenRun).toBe(false)
  expect(send.WFWorkflowActionParameters.WFSendMessageContent).toEqual({
    Value: { Type: "Variable", VariableName: "Outgoing" },
    WFSerializationType: "WFTextTokenAttachment",
  })
  const outgoing = workflow.WFWorkflowActions.filter(
    (action) =>
      action.WFWorkflowActionIdentifier === "is.workflow.actions.setvariable" &&
      action.WFWorkflowActionParameters.WFVariableName === "Outgoing",
  )
  expect(outgoing).toHaveLength(1)
  expect(workflow.WFWorkflowImportQuestions).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        ActionIndex: index,
        ParameterKey: "WFSendMessageActionRecipients",
      }),
    ]),
  )
}

function textBlob(workflow: {
  WFWorkflowActions: {
    WFWorkflowActionIdentifier: string
    WFWorkflowActionParameters: { WFTextActionText?: { Value: { string: string } } }
  }[]
}) {
  const text = workflow.WFWorkflowActions.find(
    (action) => action.WFWorkflowActionIdentifier === "is.workflow.actions.gettext",
  )
  return text?.WFWorkflowActionParameters.WFTextActionText?.Value.string ?? ""
}

describe("buildScreenTimeWorkflow", () => {
  it("asks for the Telegram bot chat and sends screen:", () => {
    const workflow = buildScreenTimeWorkflow()
    expectTelegramSend(workflow)
    expect(textBlob(workflow)).toMatch(/^screen: /)
    expect(workflow.WFWorkflowName).toBe("Screen Time to Brain2")
    expect(workflow.WFWorkflowActions.some((a: { WFWorkflowActionIdentifier: string }) => a.WFWorkflowActionIdentifier === "is.workflow.actions.ask")).toBe(
      true,
    )
  })

  it("asks for the app name once", () => {
    const workflow = buildScreenTimeWorkflow()
    const sets = workflow.WFWorkflowActions.filter(
      (action: { WFWorkflowActionIdentifier: string; WFWorkflowActionParameters: { WFVariableName?: string } }) =>
        action.WFWorkflowActionIdentifier === "is.workflow.actions.setvariable" &&
        action.WFWorkflowActionParameters.WFVariableName === "App",
    )
    expect(sets).toHaveLength(1)
  })
})

describe("buildCallWorkflow", () => {
  it("asks who + duration and sends call:", () => {
    const workflow = buildCallWorkflow()
    expectTelegramSend(workflow)
    expect(textBlob(workflow)).toMatch(/^call: /)
    expect(workflow.WFWorkflowName).toBe("iPhone Call to Brain2")
    const asks = workflow.WFWorkflowActions.filter(
      (action: { WFWorkflowActionIdentifier: string }) => action.WFWorkflowActionIdentifier === "is.workflow.actions.ask",
    )
    expect(asks).toHaveLength(2)
  })
})

describe("buildTextWorkflow", () => {
  it("asks for the Telegram bot chat and sends text:", () => {
    const workflow = buildTextWorkflow()
    expectTelegramSend(workflow)
    expect(textBlob(workflow)).toMatch(/^text: /)
    expect(workflow.WFWorkflowName).toBe("iPhone Text to Brain2")
    expect(workflow.WFWorkflowTypes).toContain("ActionExtension")
    expect(workflow.WFWorkflowInputContentItemClasses).toContain("WFStringContentItem")
  })

  it("sets Body from Ask", () => {
    const workflow = buildTextWorkflow()
    const sets = workflow.WFWorkflowActions.filter(
      (action: { WFWorkflowActionIdentifier: string; WFWorkflowActionParameters: { WFVariableName?: string } }) =>
        action.WFWorkflowActionIdentifier === "is.workflow.actions.setvariable" &&
        action.WFWorkflowActionParameters.WFVariableName === "Body",
    )
    expect(sets).toHaveLength(1)
  })
})

describe("buildLocationWorkflow", () => {
  it("gets current location, queues a timestamped gps-log, and asks for the Telegram bot chat", () => {
    const workflow = buildLocationWorkflow()
    expectTelegramSend(workflow)
    expect(workflow.WFWorkflowName).toBe("Location to Brain2")
    expect(
      workflow.WFWorkflowActions.some(
        (a: { WFWorkflowActionIdentifier: string }) =>
          a.WFWorkflowActionIdentifier === "is.workflow.actions.getcurrentlocation",
      ),
    ).toBe(true)
    const texts = workflow.WFWorkflowActions.filter(
      (a: { WFWorkflowActionIdentifier: string }) => a.WFWorkflowActionIdentifier === "is.workflow.actions.gettext",
    ).map(
      (a: { WFWorkflowActionParameters: { WFTextActionText?: { Value: { string: string } } } }) =>
        a.WFWorkflowActionParameters.WFTextActionText?.Value.string ?? "",
    )
    expect(texts.some((text: string) => text.startsWith("gps-log:\n"))).toBe(true)
    expect(
      workflow.WFWorkflowActions.some(
        (a: { WFWorkflowActionIdentifier: string }) => a.WFWorkflowActionIdentifier === "is.workflow.actions.file.append",
      ),
    ).toBe(true)
    const append = workflow.WFWorkflowActions.findIndex(
      (a: { WFWorkflowActionIdentifier: string }) => a.WFWorkflowActionIdentifier === "is.workflow.actions.file.append",
    )
    const send = sendIndex(workflow)
    const clear = workflow.WFWorkflowActions.findIndex(
      (a: { WFWorkflowActionIdentifier: string }) =>
        a.WFWorkflowActionIdentifier === "is.workflow.actions.documentpicker.save",
    )
    expect(append).toBeGreaterThan(-1)
    expect(append).toBeLessThan(send)
    expect(clear).toBeGreaterThan(send)
    expect(workflow.WFWorkflowTypes).toEqual(
      expect.arrayContaining(["NCWidget", "WatchKit", "MenuBar", "QuickActions"]),
    )
    const details = workflow.WFWorkflowActions.filter(
      (a: { WFWorkflowActionIdentifier: string }) =>
        a.WFWorkflowActionIdentifier === "is.workflow.actions.properties.locations",
    )
    expect(details).toHaveLength(3)
    expect(
      details.map(
        (a: { WFWorkflowActionParameters: { WFContentItemPropertyName?: string } }) =>
          a.WFWorkflowActionParameters.WFContentItemPropertyName,
      ),
    ).toEqual(["Name", "Latitude", "Longitude"])
  })
})

function openBotUrl(workflow: {
  WFWorkflowActions: {
    WFWorkflowActionIdentifier: string
    WFWorkflowActionParameters: { WFInput?: { Value?: { string?: string } } }
  }[]
}) {
  const open = workflow.WFWorkflowActions.find((a) => a.WFWorkflowActionIdentifier === "is.workflow.actions.openurl")
  return open?.WFWorkflowActionParameters.WFInput?.Value?.string ?? ""
}

describe("buildBoundNfcWorkflow", () => {
  it("bakes a door id in and opens the bot chat", () => {
    const workflow = buildBoundNfcWorkflow({ id: "door", name: "Front door", askQuantity: false })
    expect(workflow).not.toBeNull()
    expect(workflow!.WFWorkflowActions.some((a) => a.WFWorkflowActionIdentifier === "is.workflow.actions.sendmessage")).toBe(
      false,
    )
    expect(workflow!.WFWorkflowName).toBe("NFC Front door")
    expect(textBlob(workflow!)).toBe("nfc:door")
    expect(openBotUrl(workflow!)).toBe("tg://resolve?domain=brain2_phone_bot&text=\uFFFC")
    expect(
      workflow!.WFWorkflowActions.some((a) => a.WFWorkflowActionIdentifier === "is.workflow.actions.urlencode"),
    ).toBe(true)
    expect(
      workflow!.WFWorkflowActions.some((a) => a.WFWorkflowActionIdentifier === "is.workflow.actions.ask"),
    ).toBe(false)
    expect(workflow!.WFWorkflowImportQuestions).toEqual([])
    expect(nfcShortcutDownloadName("Front door", "door")).toBe("NFC Front door.shortcut")
  })

  it("asks how many for a dose and keeps the id in the line", () => {
    const workflow = buildBoundNfcWorkflow({ id: "Adderall", name: "Adderall", askQuantity: true })
    expect(workflow).not.toBeNull()
    expect(textBlob(workflow!)).toBe("nfc:adderall \uFFFC")
    expect(openBotUrl(workflow!)).toContain("tg://resolve?domain=brain2_phone_bot&text=")
    const asks = workflow!.WFWorkflowActions.filter(
      (a) => a.WFWorkflowActionIdentifier === "is.workflow.actions.ask",
    )
    expect(asks).toHaveLength(1)
    expect(workflow!.WFWorkflowActions.some((a) => a.WFWorkflowActionIdentifier === "is.workflow.actions.conditional")).toBe(
      false,
    )
  })

  it("refuses an empty id", () => {
    expect(buildBoundNfcWorkflow({ id: "  ", name: "Nope" })).toBeNull()
  })
})

describe("every phone shortcut", () => {
  it("uses no If actions — a hand-written one imports with an empty condition", () => {
    for (const build of [
      buildScreenTimeWorkflow,
      buildCallWorkflow,
      buildTextWorkflow,
      buildLocationWorkflow,
    ]) {
      const conditionals = build().WFWorkflowActions.filter(
        (action: { WFWorkflowActionIdentifier: string }) =>
          action.WFWorkflowActionIdentifier === "is.workflow.actions.conditional",
      )
      expect(conditionals).toEqual([])
    }
  })

  it("Send Message posts Variable Outgoing text — never Get Text ActionOutput", () => {
    for (const build of [
      buildScreenTimeWorkflow,
      buildCallWorkflow,
      buildTextWorkflow,
      buildLocationWorkflow,
    ]) {
      expectTelegramSend(build())
    }
  })
})
