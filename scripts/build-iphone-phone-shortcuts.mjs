/**
 * scripts/build-iphone-phone-shortcuts.mjs — Write + sign Screen Time / Call /
 * Text / Location / NFC / NFC dose
 *
 * Same pipeline as scripts/build-iphone-notes-shortcut.mjs: JSON workflow →
 * binary plist → `shortcuts sign --mode anyone`. AirDrop the signed files
 * onto the iPhone. Re-run: node scripts/build-iphone-phone-shortcuts.mjs
 * Pass a shortcut name to sign just that one.
 *
 * No `is.workflow.actions.conditional`: a hand-written If imports with an empty
 * condition ("Please choose a value for each parameter in this action") and the
 * whole Shortcut refuses to run. Ask for the value instead of branching on it.
 *
 * Send Message must receive Variable “Outgoing” (plain text). Handing a raw
 * Get Text ActionOutput token makes iOS say “could not run Send Message”
 * (same class of failure as the Notes dump when content was unresolved).
 */
import { execFileSync } from "node:child_process"
import { mkdirSync, writeFileSync, existsSync, unlinkSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..")
const OUT_DIR = join(ROOT, "docs", "shortcuts")

const TELEGRAM_BUNDLE = "ph.telegra.Telegraph"
/** Without this dictionary the action’s built-in app is Messages. */
const TELEGRAM_APP = {
  BundleIdentifier: TELEGRAM_BUNDLE,
  Name: "Telegram",
  TeamIdentifier: "C67CF9S4VU",
  IntentClassName: "INSendMessageIntent",
}
const BOT = "@brain2_phone_bot"
const IMPORT_QUESTION = `Choose Telegram, not Messages. Then pick the ${BOT} chat. An iMessage contact does not reach Brain2. Pair that chat in Brain2 first, and open it once.`

const CLIENT = {
  WFWorkflowClientVersion: "1300.0.0",
  WFWorkflowClientRelease: "3.0",
  WFWorkflowMinimumClientVersion: 900,
  WFWorkflowMinimumClientVersionString: "900",
}

function attachment(uuid, outputName, extra = {}) {
  return {
    Value: {
      OutputName: outputName,
      OutputUUID: uuid,
      Type: "ActionOutput",
      ...extra,
    },
    WFSerializationType: "WFTextTokenAttachment",
  }
}

function variable(name, extra = {}) {
  return {
    Value: { Type: "Variable", VariableName: name, ...extra },
    WFSerializationType: "WFTextTokenAttachment",
  }
}

function textWithTokens(parts) {
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

function action(identifier, uuid, params) {
  return {
    WFWorkflowActionIdentifier: identifier,
    WFWorkflowActionParameters: { UUID: uuid, ...params },
  }
}

function setOutgoing(uuid, textUuid) {
  return action("is.workflow.actions.setvariable", uuid, {
    WFVariableName: "Outgoing",
    WFInput: attachment(textUuid, "Text"),
  })
}

/**
 * Telegram Send Message — content is Variable Outgoing only (plain text).
 * IntentAppIdentifier alone still opens Messages. IntentAppDefinition is the
 * app the action actually uses. ShowWhenRun stays off so a scan does not
 * present the Messages compose sheet.
 */
function sendMessage(uuid) {
  return action("is.workflow.actions.sendmessage", uuid, {
    IntentAppIdentifier: TELEGRAM_BUNDLE,
    IntentAppDefinition: TELEGRAM_APP,
    ShowWhenRun: false,
    WFSendMessageContent: variable("Outgoing"),
  })
}

function wrapWorkflow({ name, color, glyph, actions, sendId, inputClasses, types, hasInputVars, importQuestions = true }) {
  const sendIndex = actions.findIndex((row) => row.WFWorkflowActionParameters.UUID === sendId)
  return {
    ...CLIENT,
    WFWorkflowName: name,
    WFWorkflowIcon: {
      WFWorkflowIconStartColor: color,
      WFWorkflowIconGlyphNumber: glyph,
    },
    WFWorkflowImportQuestions: importQuestions
      ? [
          {
            ActionIndex: sendIndex,
            Category: "Parameter",
            ParameterKey: "WFSendMessageActionRecipients",
            Text: IMPORT_QUESTION,
          },
        ]
      : [],
    WFWorkflowInputContentItemClasses: inputClasses,
    WFWorkflowOutputContentItemClasses: [],
    WFWorkflowTypes: types,
    WFWorkflowHasOutputFallback: false,
    WFWorkflowHasShortcutInputVariables: hasInputVars,
    WFWorkflowActions: actions,
  }
}

const RUN_TYPES = ["NCWidget", "WatchKit", "MenuBar", "QuickActions"]
const SHARE_TYPES = ["ActionExtension", ...RUN_TYPES]

/** Stable UUIDs so git diffs stay readable. */
const SCREEN = {
  comment: "E1111111-1111-4111-A111-111111111111",
  ask: "E4444444-4444-4444-A444-444444444444",
  setFromAsk: "E5555555-5555-4555-A555-555555555555",
  message: "E6666666-6666-4666-A666-666666666666",
  setOutgoing: "E6A6A6A6-6A6A-46A6-A6A6-6666666666A6",
  send: "E7777777-7777-4777-A777-777777777777",
  notify: "E8888888-8888-4888-A888-888888888888",
}

const CALL = {
  comment: "F1111111-1111-4111-A111-111111111111",
  askWho: "F2222222-2222-4222-A222-222222222222",
  askDuration: "F3333333-3333-4333-A333-333333333333",
  message: "F4444444-4444-4444-A444-444444444444",
  setOutgoing: "F4A4A4A4-4A4A-44A4-A4A4-4444444444A4",
  send: "F5555555-5555-4555-A555-555555555555",
  notify: "F6666666-6666-4666-A666-666666666666",
}

const TEXT = {
  comment: "AA111111-1111-4111-A111-111111111111",
  askBody: "AA444444-4444-4444-A444-444444444444",
  setFromAsk: "AA555555-5555-4555-A555-555555555555",
  askWho: "AA666666-6666-4666-A666-666666666666",
  message: "AA777777-7777-4777-A777-777777777777",
  setOutgoing: "AA7A7A7A-7A7A-47A7-A7A7-7777777777A7",
  send: "AA888888-8888-4888-A888-888888888888",
  notify: "AA999999-9999-4999-A999-999999999999",
}

const LOCATION = {
  comment: "BB111111-1111-4111-A111-111111111111",
  getLoc: "BB222222-2222-4222-A222-222222222222",
  name: "BB333333-3333-4333-A333-333333333333",
  lat: "BB444444-4444-4444-A444-444444444444",
  lon: "BB555555-5555-4555-A555-555555555555",
  now: "BB5A5A5A-5A5A-45A5-A5A5-5555555555A5",
  stamp: "BB5B5B5B-5B5B-45B5-B5B5-5555555555B5",
  line: "BB5C5C5C-5C5C-45C5-C5C5-5555555555C5",
  append: "BB5D5D5D-5D5D-45D5-D5D5-5555555555D5",
  read: "BB5E5E5E-5E5E-45E5-E5E5-5555555555E5",
  message: "BB666666-6666-4666-A666-666666666666",
  setOutgoing: "BB6A6A6A-6A6A-46A6-A6A6-6666666666A6",
  send: "BB777777-7777-4777-A777-777777777777",
  blank: "BB7B7B7B-7B7B-47B7-B7B7-7777777777B7",
  clear: "BB7C7C7C-7C7C-47C7-C7C7-7777777777C7",
  notify: "BB888888-8888-4888-A888-888888888888",
}

/** iCloud Drive. Append's path is relative to /Shortcuts/; Get and Save want the full path. */
const ICLOUD_DRIVE = { WFStorageService: "iCloudDrive" }
const LOCATION_LOG = "Brain2-location-log.txt"
const LOCATION_LOG_PATH = `/Shortcuts/${LOCATION_LOG}`

export function buildScreenTimeWorkflow() {
  const actions = [
    action("is.workflow.actions.comment", SCREEN.comment, {
      WFCommentActionText:
        `Sends screen: AppName to ${BOT}.\n` +
        `Pair Brain2 first. On import, pick the bot chat in Telegram.\n` +
        `Run it and type an app name, or attach this Shortcut (or a duplicate) to Automation → App Is Opened.\n` +
        `Shortcuts cannot read a variable opened-app name in a downloadable file. For a silent per-app ping, duplicate this Shortcut and replace Ask with a Text of that app's name.`,
    }),
    action("is.workflow.actions.ask", SCREEN.ask, {
      WFAskActionPrompt: "Which app? (e.g. Instagram)",
      WFInputType: "Text",
      CustomOutputName: "App Name",
    }),
    action("is.workflow.actions.setvariable", SCREEN.setFromAsk, {
      WFVariableName: "App",
      WFInput: attachment(SCREEN.ask, "App Name"),
    }),
    // Default Get Text output name is "Text". Park it in Outgoing so Telegram
    // Send Message gets a resolved plain-text variable (not a dead ActionOutput).
    action("is.workflow.actions.gettext", SCREEN.message, {
      WFTextActionText: textWithTokens(["screen: ", { name: "App" }]),
    }),
    setOutgoing(SCREEN.setOutgoing, SCREEN.message),
    sendMessage(SCREEN.send),
    action("is.workflow.actions.notification", SCREEN.notify, {
      WFNotificationActionBody: "Sent screen ping to Brain2.",
      WFNotificationActionTitle: "Brain2",
    }),
  ]

  return wrapWorkflow({
    name: "Screen Time to Brain2",
    color: 4271458815,
    glyph: 59511,
    actions,
    sendId: SCREEN.send,
    inputClasses: ["WFStringContentItem"],
    types: SHARE_TYPES,
    hasInputVars: true,
  })
}

export function buildCallWorkflow() {
  const actions = [
    action("is.workflow.actions.comment", CALL.comment, {
      WFCommentActionText:
        `Sends call: Name 12m to ${BOT} after you hang up.\n` +
        `Pair Brain2 first. On import, pick the bot chat in Telegram.\n` +
        `Apple does not pass caller ID into most Personal Automations. Type the name yourself.`,
    }),
    action("is.workflow.actions.ask", CALL.askWho, {
      WFAskActionPrompt: "Who did you call?",
      WFInputType: "Text",
      CustomOutputName: "Who",
    }),
    action("is.workflow.actions.ask", CALL.askDuration, {
      WFAskActionPrompt: "How long? (12m or 3:02-3:17; leave blank for a 1-minute ping)",
      WFInputType: "Text",
      CustomOutputName: "Duration",
    }),
    action("is.workflow.actions.gettext", CALL.message, {
      WFTextActionText: textWithTokens([
        "call: ",
        { uuid: CALL.askWho, name: "Who" },
        " ",
        { uuid: CALL.askDuration, name: "Duration" },
      ]),
    }),
    setOutgoing(CALL.setOutgoing, CALL.message),
    sendMessage(CALL.send),
    action("is.workflow.actions.notification", CALL.notify, {
      WFNotificationActionBody: "Sent call ping to Brain2.",
      WFNotificationActionTitle: "Brain2",
    }),
  ]

  return wrapWorkflow({
    name: "iPhone Call to Brain2",
    color: 4292093695,
    glyph: 59511,
    actions,
    sendId: CALL.send,
    inputClasses: [],
    types: RUN_TYPES,
    hasInputVars: false,
  })
}

export function buildTextWorkflow() {
  const actions = [
    action("is.workflow.actions.comment", TEXT.comment, {
      WFCommentActionText:
        `Sends text: Name body to ${BOT}.\n` +
        `Pair Brain2 first. On import, pick the bot chat in Telegram.\n` +
        `Share a message from Messages into this Shortcut, or run it and type the body.\n` +
        `Shortcuts cannot read the thread's person. Type the name when asked.`,
    }),
    action("is.workflow.actions.ask", TEXT.askBody, {
      WFAskActionPrompt: "What did you text?",
      WFInputType: "Text",
      CustomOutputName: "Body Text",
    }),
    action("is.workflow.actions.setvariable", TEXT.setFromAsk, {
      WFVariableName: "Body",
      WFInput: attachment(TEXT.askBody, "Body Text"),
    }),
    action("is.workflow.actions.ask", TEXT.askWho, {
      WFAskActionPrompt: "Who did you text?",
      WFInputType: "Text",
      CustomOutputName: "Who",
    }),
    action("is.workflow.actions.gettext", TEXT.message, {
      WFTextActionText: textWithTokens([
        "text: ",
        { uuid: TEXT.askWho, name: "Who" },
        " ",
        { name: "Body" },
      ]),
    }),
    setOutgoing(TEXT.setOutgoing, TEXT.message),
    sendMessage(TEXT.send),
    action("is.workflow.actions.notification", TEXT.notify, {
      WFNotificationActionBody: "Sent text ping to Brain2.",
      WFNotificationActionTitle: "Brain2",
    }),
  ]

  return wrapWorkflow({
    name: "iPhone Text to Brain2",
    color: 1440408063,
    glyph: 59511,
    actions,
    sendId: TEXT.send,
    inputClasses: ["WFStringContentItem", "WFTextContentItem"],
    types: SHARE_TYPES,
    hasInputVars: true,
  })
}

function locationDetail(uuid, property) {
  return action("is.workflow.actions.properties.locations", uuid, {
    WFContentItemPropertyName: property,
    WFInput: attachment(LOCATION.getLoc, "Current Location"),
  })
}

export function buildLocationWorkflow() {
  const actions = [
    action("is.workflow.actions.comment", LOCATION.comment, {
      WFCommentActionText:
        `Saves each fix to iCloud Drive/Shortcuts/${LOCATION_LOG}, then sends the whole file as gps-log:.\n` +
        `If Telegram cannot send, the file keeps the lines and the next run delivers them.\n` +
        `A successful send clears the file. Pair Brain2 first. On import, pick the bot chat.\n` +
        `Attach duplicates to Automation → Arrive and Leave. iOS will not poll every minute.`,
    }),
    action("is.workflow.actions.getcurrentlocation", LOCATION.getLoc, {}),
    locationDetail(LOCATION.name, "Name"),
    locationDetail(LOCATION.lat, "Latitude"),
    locationDetail(LOCATION.lon, "Longitude"),
    action("is.workflow.actions.date", LOCATION.now, {
      WFDateActionMode: "Current Date",
    }),
    action("is.workflow.actions.format.date", LOCATION.stamp, {
      WFDateFormatStyle: "Custom",
      WFDateFormat: "yyyy-MM-dd'T'HH:mm:ss",
      WFInput: attachment(LOCATION.now, "Date"),
    }),
    action("is.workflow.actions.gettext", LOCATION.line, {
      WFTextActionText: textWithTokens([
        { uuid: LOCATION.stamp, name: "Formatted Date" },
        ";",
        { uuid: LOCATION.lat, name: "Latitude" },
        ",",
        { uuid: LOCATION.lon, name: "Longitude" },
        ";",
        { uuid: LOCATION.name, name: "Name" },
      ]),
    }),
    action("is.workflow.actions.file.append", LOCATION.append, {
      WFFileStorageService: ICLOUD_DRIVE,
      WFFilePath: LOCATION_LOG,
      WFAppendFileWriteMode: "Append",
      WFAppendOnNewLine: true,
      WFInput: attachment(LOCATION.line, "Text"),
    }),
    action("is.workflow.actions.documentpicker.open", LOCATION.read, {
      WFFileStorageService: ICLOUD_DRIVE,
      WFShowFilePicker: false,
      WFGetFilePath: LOCATION_LOG_PATH,
      WFFileErrorIfNotFound: false,
    }),
    action("is.workflow.actions.gettext", LOCATION.message, {
      WFTextActionText: textWithTokens(["gps-log:\n", { uuid: LOCATION.read, name: "File" }]),
    }),
    setOutgoing(LOCATION.setOutgoing, LOCATION.message),
    sendMessage(LOCATION.send),
    action("is.workflow.actions.gettext", LOCATION.blank, {
      WFTextActionText: textWithTokens(["."]),
    }),
    action("is.workflow.actions.documentpicker.save", LOCATION.clear, {
      WFFileStorageService: ICLOUD_DRIVE,
      WFAskWhereToSave: false,
      WFFileDestinationPath: LOCATION_LOG_PATH,
      WFSaveFileOverwrite: true,
      WFInput: attachment(LOCATION.blank, "Text"),
    }),
    action("is.workflow.actions.notification", LOCATION.notify, {
      WFNotificationActionBody: "Sent location to Brain2.",
      WFNotificationActionTitle: "Brain2",
    }),
  ]

  const workflow = wrapWorkflow({
    name: "Location to Brain2",
    color: 4282601983,
    glyph: 59511,
    actions,
    sendId: LOCATION.send,
    inputClasses: [],
    types: RUN_TYPES,
    hasInputVars: false,
  })
  const fileQuestion = {
    Category: "Parameter",
    ParameterKey: "WFFileStorageService",
    Text: "Pick iCloud Drive. Brain2 keeps the location log in Shortcuts/Brain2-location-log.txt until Telegram can send it.",
  }
  for (const uuid of [LOCATION.append, LOCATION.read, LOCATION.clear]) {
    const index = actions.findIndex((row) => row.WFWorkflowActionParameters.UUID === uuid)
    workflow.WFWorkflowImportQuestions.push({ ...fileQuestion, ActionIndex: index })
  }
  return workflow
}

const NFC = {
  comment: "BB111111-1111-4111-A111-111111111111",
  ask: "BB222222-2222-4222-A222-222222222222",
  message: "BB333333-3333-4333-A333-333333333333",
  setOutgoing: "BB3A3A3A-3A3A-43A3-A3A3-3333333333A3",
  send: "BB444444-4444-4444-A444-444444444444",
  notify: "BB555555-5555-4555-A555-555555555555",
}

const DOSE = {
  comment: "CC111111-1111-4111-A111-111111111111",
  askId: "CC222222-2222-4222-A222-222222222222",
  askQty: "CC333333-3333-4333-A333-333333333333",
  message: "CC444444-4444-4444-A444-444444444444",
  setOutgoing: "CC3A3A3A-3A3A-43A3-A3A3-3333333333A3",
  send: "CC555555-5555-4555-A555-555555555555",
  notify: "CC666666-6666-4666-A666-666666666666",
}

export function buildNfcWorkflow() {
  const actions = [
    action("is.workflow.actions.comment", NFC.comment, {
      WFCommentActionText:
        `Sends nfc:tag-id to ${BOT}.\n` +
        `Pair Brain2 first. On import, pick the bot chat in Telegram.\n` +
        `Type the tag id from Settings → NFC tags (vitamin-d), not the whole line.\n` +
        `For a sticker that should run with no question, duplicate this Shortcut and replace the Ask with the text nfc:your-id.\n` +
        `A dose that sometimes changes count uses NFC dose to Brain2 instead.`,
    }),
    action("is.workflow.actions.ask", NFC.ask, {
      WFAskActionPrompt: "Tag id? (vitamin-d, door, shower — the id from Brain2, not nfc:)",
      WFInputType: "Text",
      CustomOutputName: "Tag Id",
    }),
    action("is.workflow.actions.gettext", NFC.message, {
      WFTextActionText: textWithTokens(["nfc:", { uuid: NFC.ask, name: "Tag Id" }]),
    }),
    setOutgoing(NFC.setOutgoing, NFC.message),
    sendMessage(NFC.send),
    action("is.workflow.actions.notification", NFC.notify, {
      WFNotificationActionBody: "Sent NFC tag to Brain2.",
      WFNotificationActionTitle: "Brain2",
    }),
  ]

  return wrapWorkflow({
    name: "NFC to Brain2",
    color: 463140863,
    glyph: 59511,
    actions,
    sendId: NFC.send,
    inputClasses: [],
    types: RUN_TYPES,
    hasInputVars: false,
  })
}

const BOUND = {
  comment: "DD111111-1111-4111-A111-111111111111",
  askQty: "DD222222-2222-4222-A222-222222222222",
  message: "DD333333-3333-4333-A333-333333333333",
  setOutgoing: "DD3A3A3A-3A3A-43A3-A3A3-3333333333A3",
  send: "DD444444-4444-4444-A444-444444444444",
  notify: "DD555555-5555-4555-A555-555555555555",
}

/** Download name for one saved tag. The id is already inside the shortcut. */
export function nfcShortcutDownloadName(name, id) {
  const label =
    String(name || id || "tag")
      .replace(/[\\/:*?"<>|\u0000-\u001f]+/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 60) || "tag"
  return `NFC ${label}.shortcut`
}

/**
 * Telegram’s Send Message intent rejects a bot (`customIdentifier` must start
 * with `tg`, and a bot chat is not a saved person). Shortcuts shows that as
 * “unknown error”. Open the bot chat with the line filled in instead. The
 * message lands when Send is tapped.
 */
function openBotChat(textUuid, encodeUuid, openUuid) {
  return [
    action("is.workflow.actions.urlencode", encodeUuid, {
      WFInput: attachment(textUuid, "Text"),
      WFEncodeMode: "Encode",
      CustomOutputName: "Encoded",
    }),
    action("is.workflow.actions.openurl", openUuid, {
      WFInput: textWithTokens([
        "tg://resolve?domain=brain2_phone_bot&text=",
        { uuid: encodeUuid, name: "Encoded" },
      ]),
    }),
  ]
}

/**
 * One sticker. The tag id is baked in, so the automation does not ask for it.
 * A dose asks how many (blank uses the quantity saved on the tag). A door or
 * a plain event opens Telegram with `nfc:{id}` and no question. Returns null
 * for a bad id.
 */
export function buildBoundNfcWorkflow({ id, name, askQuantity } = {}) {
  const slug = String(id || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) return null
  const display = String(name || slug)
    .replace(/[\u0000-\u001f]/g, " ")
    .trim()
    .slice(0, 80) || slug
  const shortcutName = `NFC ${display}`.slice(0, 90)
  const actions = askQuantity
    ? [
        action("is.workflow.actions.comment", BOUND.comment, {
          WFCommentActionText:
            `Opens ${BOT} with nfc:${slug} and a count filled in.\n` +
            `Tap Send. Pair Brain2 first and open that chat once.\n` +
            `How many is optional: blank uses the quantity saved on this tag.\n` +
            `Attach this Shortcut to Automation → NFC for this sticker. Turn Ask Before Running off.`,
        }),
        action("is.workflow.actions.ask", BOUND.askQty, {
          WFAskActionPrompt: "How many? Leave blank to use the quantity saved on the tag.",
          WFInputType: "Text",
          CustomOutputName: "How many",
        }),
        action("is.workflow.actions.gettext", BOUND.message, {
          WFTextActionText: textWithTokens([`nfc:${slug} `, { uuid: BOUND.askQty, name: "How many" }]),
        }),
        ...openBotChat(BOUND.message, BOUND.setOutgoing, BOUND.send),
        action("is.workflow.actions.notification", BOUND.notify, {
          WFNotificationActionBody: "Tap Send in Telegram.",
          WFNotificationActionTitle: "Brain2",
        }),
      ]
    : [
        action("is.workflow.actions.comment", BOUND.comment, {
          WFCommentActionText:
            `Opens ${BOT} with nfc:${slug} filled in.\n` +
            `Tap Send. Pair Brain2 first and open that chat once.\n` +
            `Attach this Shortcut to Automation → NFC for this sticker. Turn Ask Before Running off.`,
        }),
        action("is.workflow.actions.gettext", BOUND.message, {
          WFTextActionText: textWithTokens([`nfc:${slug}`]),
        }),
        ...openBotChat(BOUND.message, BOUND.setOutgoing, BOUND.send),
        action("is.workflow.actions.notification", BOUND.notify, {
          WFNotificationActionBody: "Tap Send in Telegram.",
          WFNotificationActionTitle: "Brain2",
        }),
      ]

  return wrapWorkflow({
    name: shortcutName,
    color: 463140863,
    glyph: 59511,
    actions,
    sendId: BOUND.send,
    inputClasses: [],
    types: RUN_TYPES,
    hasInputVars: false,
    importQuestions: false,
  })
}

export function buildNfcDoseWorkflow() {
  const actions = [
    action("is.workflow.actions.comment", DOSE.comment, {
      WFCommentActionText:
        `Sends nfc:tag-id and a count to ${BOT}.\n` +
        `Pair Brain2 first. On import, pick the bot chat in Telegram.\n` +
        `Tag id is the slug from Settings → NFC tags. How many is optional: blank uses the quantity saved on that tag.\n` +
        `For a bottle, duplicate this Shortcut, delete the tag-id Ask, and set the text to nfc:adderall plus a space plus How many.`,
    }),
    action("is.workflow.actions.ask", DOSE.askId, {
      WFAskActionPrompt: "Tag id? (adderall — the id from Brain2, not nfc:)",
      WFInputType: "Text",
      CustomOutputName: "Tag Id",
    }),
    action("is.workflow.actions.ask", DOSE.askQty, {
      WFAskActionPrompt: "How many? Leave blank to use the quantity saved on the tag.",
      WFInputType: "Text",
      CustomOutputName: "How many",
    }),
    action("is.workflow.actions.gettext", DOSE.message, {
      WFTextActionText: textWithTokens([
        "nfc:",
        { uuid: DOSE.askId, name: "Tag Id" },
        " ",
        { uuid: DOSE.askQty, name: "How many" },
      ]),
    }),
    setOutgoing(DOSE.setOutgoing, DOSE.message),
    sendMessage(DOSE.send),
    action("is.workflow.actions.notification", DOSE.notify, {
      WFNotificationActionBody: "Sent NFC dose to Brain2.",
      WFNotificationActionTitle: "Brain2",
    }),
  ]

  return wrapWorkflow({
    name: "NFC dose to Brain2",
    color: 463140863,
    glyph: 59511,
    actions,
    sendId: DOSE.send,
    inputClasses: [],
    types: RUN_TYPES,
    hasInputVars: false,
  })
}

export const PHONE_SHORTCUTS = [
  { name: "Screen Time to Brain2", build: buildScreenTimeWorkflow },
  { name: "iPhone Call to Brain2", build: buildCallWorkflow },
  { name: "iPhone Text to Brain2", build: buildTextWorkflow },
  { name: "Location to Brain2", build: buildLocationWorkflow },
  { name: "NFC to Brain2", build: buildNfcWorkflow },
  { name: "NFC dose to Brain2", build: buildNfcDoseWorkflow },
]

function writePlistJson(workflow, jsonPath) {
  mkdirSync(OUT_DIR, { recursive: true })
  writeFileSync(jsonPath, `${JSON.stringify(workflow, null, 2)}\n`)
}

function convertAndSign(jsonPath, unsignedPath, signedPath) {
  execFileSync("plutil", ["-convert", "binary1", "-o", unsignedPath, jsonPath], {
    stdio: "inherit",
  })
  execFileSync(
    "shortcuts",
    ["sign", "--mode", "anyone", "--input", unsignedPath, "--output", signedPath],
    { stdio: "inherit" },
  )
  if (existsSync(unsignedPath) && existsSync(signedPath)) {
    unlinkSync(unsignedPath)
  }
}

function emitOne({ name, build }) {
  const jsonPath = join(OUT_DIR, `${name}.wflow.json`)
  const unsignedPath = join(OUT_DIR, `${name}.unsigned.shortcut`)
  const signedPath = join(OUT_DIR, `${name}.shortcut`)
  const workflow = build()
  writePlistJson(workflow, jsonPath)
  console.log(`Wrote ${jsonPath}`)
  try {
    convertAndSign(jsonPath, unsignedPath, signedPath)
    console.log(`Signed ${signedPath}`)
    if (!existsSync(signedPath)) throw new Error("signed shortcut missing")
    return true
  } catch (err) {
    console.error(`Signing failed for ${name} (${err instanceof Error ? err.message : err}).`)
    console.error(`The iPhone will not import an unsigned file. On this Mac run:`)
    console.error(
      `  shortcuts sign --mode anyone --input ${JSON.stringify(unsignedPath)} --output ${JSON.stringify(signedPath)}`,
    )
    return false
  }
}

const isMain = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]
if (isMain) {
  const only = process.argv.slice(2)
  let ok = true
  for (const spec of PHONE_SHORTCUTS) {
    if (only.length && !only.includes(spec.name)) continue
    if (!emitOne(spec)) ok = false
  }
  if (!ok) process.exitCode = 1
}
