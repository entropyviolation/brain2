/**
 * scripts/iphone-shortcut-actions.mjs — Shared Shortcuts plist pieces
 *
 * `textWithTokens` and `action` are the same in the Notes dump builder and
 * the phone shortcut builder. Call sites pass the same part shapes.
 */

export function textWithTokens(parts) {
  let string = ""
  const attachmentsByRange = {}
  for (const part of parts) {
    if (typeof part === "string") {
      string += part
      continue
    }
    const start = string.length
    string += "\uFFFC"
    attachmentsByRange[`{${start}, 1}`] = {
      Type: part.uuid ? "ActionOutput" : "Variable",
      ...(part.uuid ? { OutputUUID: part.uuid, OutputName: part.name } : { VariableName: part.name }),
      ...(part.aggrandizements ? { Aggrandizements: part.aggrandizements } : {}),
    }
  }
  return {
    Value: { string, attachmentsByRange },
    WFSerializationType: "WFTextTokenString",
  }
}

export function action(identifier, uuid, params) {
  return {
    WFWorkflowActionIdentifier: identifier,
    WFWorkflowActionParameters: { UUID: uuid, ...params },
  }
}
