/**
 * scripts/build-iphone-phone-shortcuts.test.ts — Screen Time / Call / Text / Location generator shape
 */
import { describe, expect, it } from "vitest"
import {
  buildCallWorkflow,
  buildLocationWorkflow,
  buildScreenTimeWorkflow,
  buildTextWorkflow,
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
  expect(workflow.WFWorkflowImportQuestions).toEqual([
    expect.objectContaining({
      ActionIndex: index,
      ParameterKey: "WFSendMessageActionRecipients",
    }),
  ])
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
    expect(workflow.WFWorkflowActions.some((a) => a.WFWorkflowActionIdentifier === "is.workflow.actions.ask")).toBe(
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
  it("gets current location, sends gps: text, and asks for the Telegram bot chat", () => {
    const workflow = buildLocationWorkflow()
    expectTelegramSend(workflow)
    expect(workflow.WFWorkflowName).toBe("Location to Brain2")
    expect(
      workflow.WFWorkflowActions.some(
        (a: { WFWorkflowActionIdentifier: string }) =>
          a.WFWorkflowActionIdentifier === "is.workflow.actions.getcurrentlocation",
      ),
    ).toBe(true)
    expect(textBlob(workflow)).toMatch(/^gps: /)
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
