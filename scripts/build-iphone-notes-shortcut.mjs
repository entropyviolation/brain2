/**
 * scripts/build-iphone-notes-shortcut.mjs — Write + sign Dump iPhone Notes to Brain2
 *
 * Emits docs/shortcuts/Dump iPhone Notes to Brain2.wflow.json (source) and a
 * signed .shortcut you can AirDrop onto the iPhone. Re-run after a wire-format
 * change: npm run shortcut:iphone-notes
 *
 * Design notes (phone-proven):
 * - No If actions (empty condition blocks the whole Shortcut).
 * - No properties.notes (gone from ToolKit → false “update Shortcuts”).
 * - NoteEntity has Name / Body / Folder / Last Modified Date — not Identifier.
 * - Find Notes ActionOutput name is “Note” (Gallery ActionItems).
 * - Date ranges use operator 1001 (“is in the last”) — Date+AdjustDate branches
 *   error on device.
 * - Send Message must receive Variable “Outgoing” (plain text). If content
 *   points at a bad ActionOutput name, Telegram shares Note entities instead —
 *   iOS shows “send %%lld notes in a Telegram message” and nothing is posted.
 */
import { execFileSync } from "node:child_process"
import { mkdirSync, writeFileSync, existsSync, unlinkSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..")
const OUT_DIR = join(ROOT, "docs", "shortcuts")
const NAME = "Dump iPhone Notes to Brain2"
const JSON_PATH = join(OUT_DIR, `${NAME}.wflow.json`)
const UNSIGNED_PATH = join(OUT_DIR, `${NAME}.unsigned.shortcut`)
const SIGNED_PATH = join(OUT_DIR, `${NAME}.shortcut`)

const TELEGRAM_BUNDLE = "ph.telegra.Telegraph"
const BOT = "@brain2_phone_bot"
const CLIENT_VERSION = "4018.0.4"

const NOTES_APP_INTENT = {
  TeamIdentifier: "0000000000",
  BundleIdentifier: "com.apple.mobilenotes",
  Name: "Notes",
  AppIntentIdentifier: "NoteEntity",
  ActionRequiresAppInstallation: true,
}

/** Days unit for operator 1001 / 1000 (FILTERS.md). */
const UNIT_DAYS = 16384

const ID = {
  comment: "A1111111-1111-4111-A111-111111111111",
  menu: "A4444444-4444-4444-A444-444444444444",
  menu24: "A4444444-4444-4444-A444-444444444401",
  menu7: "A4444444-4444-4444-A444-444444444402",
  menu30: "A4444444-4444-4444-A444-444444444403",
  menuFolder: "A4444444-4444-4444-A444-444444444404",
  menuPick: "A4444444-4444-4444-A444-444444444405",
  menuShare: "A4444444-4444-4444-A444-444444444406",
  menuEnd: "A4444444-4444-4444-A444-444444444407",
  notes24: "A7777777-7777-4777-A777-777777777777",
  set24: "B7777777-7777-4777-B777-777777777701",
  notes7: "B1111111-1111-4111-B111-111111111111",
  set7: "B7777777-7777-4777-B777-777777777702",
  notes30: "B4444444-4444-4444-B444-444444444444",
  set30: "B7777777-7777-4777-B777-777777777703",
  notesFolder: "B5555555-5555-4555-B555-555555555555",
  setFolder: "B7777777-7777-4777-B777-777777777704",
  notesPick: "B6666666-6666-4666-B666-666666666666",
  choosePick: "B6666666-6666-4666-B666-666666666701",
  setPick: "B7777777-7777-4777-B777-777777777705",
  setShare: "B7777777-7777-4777-B777-777777777706",
  getNotes: "B9999999-9999-4999-B999-999999999999",
  count: "C0A0A0A0-0A0A-40A0-A0A0-A0A0A0A0A0A0",
  ifCount: "C0B0B0B0-0B0B-40B0-B0B0-B0B0B0B0B0B0",
  ifCountElse: "C0B0B0B0-0B0B-40B0-B0B0-B0B0B0B0B0B1",
  ifCountEnd: "C0B0B0B0-0B0B-40B0-B0B0-B0B0B0B0B0B2",
  repeat: "C1111111-1111-4111-C111-111111111111",
  repeatEnd: "C1111111-1111-4111-C111-111111111102",
  message: "C9999999-9999-4999-C999-999999999999",
  setOutgoing: "C8888888-8888-4888-C888-888888888801",
  send: "D3333333-3333-4333-D333-333333333333",
  wait: "D4444444-4444-4444-D444-444444444444",
  notifyOk: "D7777777-7777-4777-D777-777777777701",
  notifyEmpty: "D7777777-7777-4777-D777-777777777702",
}

const NOTE_PROP = {
  modified: "Last Modified Date",
  folder: "Folder",
  name: "Name",
  body: "Body",
}

const FIND_NOTES_OUTPUT = "Note"
const CHOOSE_OUTPUT = "Chosen Item"

const MENU_ITEMS = [
  "Last 24 hours",
  "Last 7 days",
  "Last 30 days",
  "Choose folder",
  "Pick a note",
  "Shortcut Input",
]

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

function extensionInput() {
  return {
    Value: { Type: "ExtensionInput", VariableName: "Shortcut Input" },
    WFSerializationType: "WFTextTokenAttachment",
  }
}

function noteField(propertyName) {
  return {
    name: "Repeat Item",
    aggrandizements: [
      {
        Type: "WFPropertyVariableAggrandizement",
        PropertyName: propertyName,
      },
    ],
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

function findNotesParams(filterTemplates) {
  return {
    AppIntentDescriptor: NOTES_APP_INTENT,
    CustomOutputName: FIND_NOTES_OUTPUT,
    WFContentItemFilter: {
      WFSerializationType: "WFContentPredicateTableTemplate",
      Value: {
        WFActionParameterFilterPrefix: 1,
        WFContentPredicateBoundedDate: false,
        WFActionParameterFilterTemplates: filterTemplates,
      },
    },
    WFContentItemLimitEnabled: true,
    WFContentItemLimitNumber: 25,
    WFContentItemSortOrder: "Latest First",
    WFContentItemSortProperty: NOTE_PROP.modified,
  }
}

/** Operator 1001 = “is in the last”; Unit 16384 = days. */
function findNotesInLastDays(days) {
  return findNotesParams([
    {
      Operator: 1001,
      Property: NOTE_PROP.modified,
      Removable: false,
      Values: {
        Number: days,
        Unit: UNIT_DAYS,
      },
    },
  ])
}

function setNotesFromFind(setId, notesId) {
  return action("is.workflow.actions.setvariable", setId, {
    WFVariableName: "Notes",
    WFInput: attachment(notesId, FIND_NOTES_OUTPUT),
  })
}

/**
 * Exact plaintext the Shortcut Text action builds (magic tokens → sample values).
 * Used by tests to simulate the webhook ingest path.
 */
export function sampleDumpText(sample = {
  name: "Grocery",
  folder: "Quick Notes",
  modified: "2026-09-21T16:00:00Z",
  body: "milk\neggs",
}) {
  return (
    `iphone-notes:\n` +
    `id: ${sample.name}|${sample.folder}|${sample.modified}\n` +
    `title: ${sample.name}\n` +
    `folder: ${sample.folder}\n` +
    `account: On My iPhone\n` +
    `modified: ${sample.modified}\n` +
    `---\n` +
    `${sample.body}`
  )
}

export function buildWorkflow() {
  const actions = [
    action("is.workflow.actions.comment", ID.comment, {
      WFCommentActionText:
        `Sends On My iPhone Notes to ${BOT} as iphone-notes: dumps.\n` +
        `Pair Brain2 first. On import, pick the bot chat in Telegram.\n` +
        `Pick a note = choose from recent notes (run from Shortcuts).\n` +
        `Shortcut Input = share a note into this Shortcut from Notes.`,
    }),
    action("is.workflow.actions.choosefrommenu", ID.menu, {
      WFControlFlowMode: 0,
      GroupingIdentifier: ID.menu,
      WFMenuPrompt: "Which notes?",
      WFMenuItems: MENU_ITEMS,
    }),

    // Last 24 hours ≈ last 1 day (Shortcuts day unit)
    action("is.workflow.actions.choosefrommenu", ID.menu24, {
      WFControlFlowMode: 1,
      GroupingIdentifier: ID.menu,
      WFMenuItemTitle: "Last 24 hours",
    }),
    action("is.workflow.actions.filter.notes", ID.notes24, findNotesInLastDays(1)),
    setNotesFromFind(ID.set24, ID.notes24),

    action("is.workflow.actions.choosefrommenu", ID.menu7, {
      WFControlFlowMode: 1,
      GroupingIdentifier: ID.menu,
      WFMenuItemTitle: "Last 7 days",
    }),
    action("is.workflow.actions.filter.notes", ID.notes7, findNotesInLastDays(7)),
    setNotesFromFind(ID.set7, ID.notes7),

    action("is.workflow.actions.choosefrommenu", ID.menu30, {
      WFControlFlowMode: 1,
      GroupingIdentifier: ID.menu,
      WFMenuItemTitle: "Last 30 days",
    }),
    action("is.workflow.actions.filter.notes", ID.notes30, findNotesInLastDays(30)),
    setNotesFromFind(ID.set30, ID.notes30),

    action("is.workflow.actions.choosefrommenu", ID.menuFolder, {
      WFControlFlowMode: 1,
      GroupingIdentifier: ID.menu,
      WFMenuItemTitle: "Choose folder",
    }),
    action(
      "is.workflow.actions.filter.notes",
      ID.notesFolder,
      findNotesParams([
        {
          Operator: 4,
          Property: NOTE_PROP.folder,
          Removable: false,
          Values: {
            String: {
              Value: { Type: "Ask" },
              WFSerializationType: "WFTextTokenAttachment",
            },
          },
        },
      ]),
    ),
    setNotesFromFind(ID.setFolder, ID.notesFolder),

    // Pick a note — works when run from the Shortcuts app (no Share Sheet input)
    action("is.workflow.actions.choosefrommenu", ID.menuPick, {
      WFControlFlowMode: 1,
      GroupingIdentifier: ID.menu,
      WFMenuItemTitle: "Pick a note",
    }),
    action("is.workflow.actions.filter.notes", ID.notesPick, findNotesInLastDays(30)),
    action("is.workflow.actions.choosefromlist", ID.choosePick, {
      WFInput: attachment(ID.notesPick, FIND_NOTES_OUTPUT),
      CustomOutputName: CHOOSE_OUTPUT,
    }),
    action("is.workflow.actions.setvariable", ID.setPick, {
      WFVariableName: "Notes",
      WFInput: attachment(ID.choosePick, CHOOSE_OUTPUT),
    }),

    // Shortcut Input — Share Sheet from Notes
    action("is.workflow.actions.choosefrommenu", ID.menuShare, {
      WFControlFlowMode: 1,
      GroupingIdentifier: ID.menu,
      WFMenuItemTitle: "Shortcut Input",
    }),
    action("is.workflow.actions.setvariable", ID.setShare, {
      WFVariableName: "Notes",
      WFInput: extensionInput(),
    }),

    action("is.workflow.actions.choosefrommenu", ID.menuEnd, {
      WFControlFlowMode: 2,
      GroupingIdentifier: ID.menu,
    }),

    action("is.workflow.actions.getvariable", ID.getNotes, {
      WFVariable: variable("Notes"),
    }),
    action("is.workflow.actions.count", ID.count, {
      WFCountType: "Items",
      WFInput: attachment(ID.getNotes, "Notes"),
    }),
    // Well-formed If (Count > 0). An empty If condition blocks import; this one is filled.
    action("is.workflow.actions.conditional", ID.ifCount, {
      GroupingIdentifier: ID.ifCount,
      WFControlFlowMode: 0,
      WFCondition: 2, // is greater than
      WFNumberValue: 0,
      WFInput: attachment(ID.count, "Count"),
    }),

    action("is.workflow.actions.repeat.each", ID.repeat, {
      WFControlFlowMode: 0,
      GroupingIdentifier: ID.repeat,
      WFInput: attachment(ID.getNotes, "Notes"),
    }),
    // Default Get Text output name is "Text" (Screen Time). Do NOT CustomOutputName
    // "Dump" — a mismatched Send Message token falls back to Repeat Item (Notes),
    // which produces the iOS sheet: “send %%lld notes in a Telegram message”.
    action("is.workflow.actions.gettext", ID.message, {
      WFTextActionText: textWithTokens([
        "iphone-notes:\nid: ",
        noteField(NOTE_PROP.name),
        "|",
        noteField(NOTE_PROP.folder),
        "|",
        noteField(NOTE_PROP.modified),
        "\ntitle: ",
        noteField(NOTE_PROP.name),
        "\nfolder: ",
        noteField(NOTE_PROP.folder),
        "\naccount: On My iPhone\nmodified: ",
        noteField(NOTE_PROP.modified),
        "\n---\n",
        noteField(NOTE_PROP.body),
      ]),
    }),
    // Park the dump in a Text variable so Telegram cannot “share Notes items”.
    action("is.workflow.actions.setvariable", ID.setOutgoing, {
      WFVariableName: "Outgoing",
      WFInput: attachment(ID.message, "Text"),
    }),
    action("is.workflow.actions.sendmessage", ID.send, {
      IntentAppIdentifier: TELEGRAM_BUNDLE,
      WFSendMessageContent: variable("Outgoing"),
    }),
    action("is.workflow.actions.delay", ID.wait, { WFDelayTime: 1 }),
    action("is.workflow.actions.repeat.each", ID.repeatEnd, {
      WFControlFlowMode: 2,
      GroupingIdentifier: ID.repeat,
    }),
    action("is.workflow.actions.notification", ID.notifyOk, {
      WFNotificationActionTitle: "Brain2",
      WFNotificationActionBody: textWithTokens([
        "Sent ",
        { uuid: ID.count, name: "Count" },
        " note(s) to Brain2. Open Phone Notes on the laptop.",
      ]),
    }),

    action("is.workflow.actions.conditional", ID.ifCountElse, {
      GroupingIdentifier: ID.ifCount,
      WFControlFlowMode: 1,
    }),
    action("is.workflow.actions.notification", ID.notifyEmpty, {
      WFNotificationActionTitle: "Brain2",
      WFNotificationActionBody: "No notes matched. Try another range, Pick a note, or share a note in.",
    }),
    action("is.workflow.actions.conditional", ID.ifCountEnd, {
      GroupingIdentifier: ID.ifCount,
      WFControlFlowMode: 2,
    }),
  ]

  const sendIndex = actions.findIndex((a) => a.WFWorkflowActionParameters.UUID === ID.send)

  return {
    WFWorkflowClientVersion: CLIENT_VERSION,
    WFWorkflowMinimumClientVersion: 900,
    WFWorkflowMinimumClientVersionString: "900",
    WFWorkflowName: NAME,
    WFWorkflowIcon: {
      WFWorkflowIconStartColor: 946986751,
      WFWorkflowIconGlyphNumber: 59511,
    },
    WFWorkflowImportQuestions: [
      {
        ActionIndex: sendIndex,
        Category: "Parameter",
        ParameterKey: "WFSendMessageActionRecipients",
        Text: `Pick the Brain2 bot chat in Telegram (${BOT}). Pair it in Brain2 Settings first, then open that chat once.`,
      },
    ],
    WFWorkflowInputContentItemClasses: ["WFNoteContentItem", "WFStringContentItem"],
    WFWorkflowOutputContentItemClasses: [],
    WFWorkflowTypes: ["ActionExtension", "NCWidget", "WatchKit", "MenuBar", "QuickActions"],
    WFWorkflowHasOutputFallback: false,
    WFWorkflowHasShortcutInputVariables: true,
    WFWorkflowActions: actions,
  }
}

export const KNOWN_ACTION_IDENTIFIERS = new Set([
  "is.workflow.actions.comment",
  "is.workflow.actions.choosefrommenu",
  "is.workflow.actions.filter.notes",
  "is.workflow.actions.choosefromlist",
  "is.workflow.actions.setvariable",
  "is.workflow.actions.getvariable",
  "is.workflow.actions.count",
  "is.workflow.actions.conditional",
  "is.workflow.actions.repeat.each",
  "is.workflow.actions.gettext",
  "is.workflow.actions.sendmessage",
  "is.workflow.actions.delay",
  "is.workflow.actions.notification",
])

export const NOTE_ENTITY_PROPERTY_TITLES = new Set([
  "Name",
  "Summary",
  "Body",
  "Folder",
  "Pinned",
  "Tags",
  "Attachments",
  "Creation Date",
  "Last Modified Date",
])

const UUID_RE = /^[0-9A-Fa-f]{8}-[0-9A-Fa-f]{4}-[0-9A-Fa-f]{4}-[0-9A-Fa-f]{4}-[0-9A-Fa-f]{12}$/

export function assertWorkflowShape(workflow = buildWorkflow()) {
  const badIds = []
  const unknown = []
  const badProps = []
  let hasDate = false
  let hasAdjust = false
  for (const a of workflow.WFWorkflowActions) {
    const id = a.WFWorkflowActionIdentifier
    if (!KNOWN_ACTION_IDENTIFIERS.has(id)) unknown.push(id)
    if (id === "is.workflow.actions.date") hasDate = true
    if (id === "is.workflow.actions.adjustdate") hasAdjust = true
    const uuid = a.WFWorkflowActionParameters?.UUID
    if (uuid && !UUID_RE.test(uuid)) badIds.push(uuid)
    const group = a.WFWorkflowActionParameters?.GroupingIdentifier
    if (group && !UUID_RE.test(group)) badIds.push(group)

    if (id === "is.workflow.actions.filter.notes") {
      if (a.WFWorkflowActionParameters.CustomOutputName !== FIND_NOTES_OUTPUT) {
        throw new Error(`Find Notes must CustomOutputName "${FIND_NOTES_OUTPUT}"`)
      }
      const templates =
        a.WFWorkflowActionParameters.WFContentItemFilter?.Value?.WFActionParameterFilterTemplates ?? []
      for (const t of templates) {
        if (t.Property === NOTE_PROP.modified && t.Operator !== 1001) {
          throw new Error("Date filters must use operator 1001 (is in the last)")
        }
      }
    }

    if (id === "is.workflow.actions.gettext") {
      const attachments = a.WFWorkflowActionParameters.WFTextActionText?.Value?.attachmentsByRange ?? {}
      for (const token of Object.values(attachments)) {
        for (const ag of token.Aggrandizements ?? []) {
          if (ag.Type === "WFPropertyVariableAggrandizement" && !NOTE_ENTITY_PROPERTY_TITLES.has(ag.PropertyName)) {
            badProps.push(ag.PropertyName)
          }
        }
      }
    }

    if (id === "is.workflow.actions.sendmessage") {
      if (a.WFWorkflowActionParameters.IntentAppIdentifier !== TELEGRAM_BUNDLE) {
        throw new Error("Send Message must target Telegram")
      }
      const content = a.WFWorkflowActionParameters.WFSendMessageContent?.Value
      // Must be the Outgoing text variable — never Notes / Repeat Item / Find Notes.
      if (content?.Type !== "Variable" || content?.VariableName !== "Outgoing") {
        throw new Error(
          "Send Message must use Variable Outgoing (plain text). Sharing Notes causes the %%lld permission sheet.",
        )
      }
    }

    if (id === "is.workflow.actions.gettext") {
      if (a.WFWorkflowActionParameters.CustomOutputName) {
        throw new Error('Get Text must use default output name "Text" (not CustomOutputName)')
      }
    }

    if (id === "is.workflow.actions.conditional" && a.WFWorkflowActionParameters.WFControlFlowMode === 0) {
      if (a.WFWorkflowActionParameters.WFCondition == null || !a.WFWorkflowActionParameters.WFInput) {
        throw new Error("If actions must have a filled condition (empty If blocks import)")
      }
    }
  }
  if (hasDate || hasAdjust) {
    throw new Error("Date/Adjust Date branches error on device — use Find Notes operator 1001")
  }
  if (unknown.length) throw new Error(`Unknown action ids: ${unknown.join(", ")}`)
  if (badIds.length) throw new Error(`Invalid UUIDs: ${badIds.join(", ")}`)
  if (badProps.length) throw new Error(`Unknown NoteEntity properties: ${badProps.join(", ")}`)
  if (workflow.WFWorkflowActions.some((a) => a.WFWorkflowActionIdentifier === "is.workflow.actions.properties.notes")) {
    throw new Error("properties.notes is not in current Shortcuts ToolKit")
  }
  const menu = workflow.WFWorkflowActions.find(
    (a) =>
      a.WFWorkflowActionIdentifier === "is.workflow.actions.choosefrommenu" &&
      a.WFWorkflowActionParameters.WFControlFlowMode === 0,
  )
  if (!menu?.WFWorkflowActionParameters.WFMenuItems?.includes("Pick a note")) {
    throw new Error('Menu must include "Pick a note" for in-app runs')
  }
  if (!menu?.WFWorkflowActionParameters.WFMenuItems?.includes("Shortcut Input")) {
    throw new Error('Menu must include "Shortcut Input" for Share Sheet')
  }
  if (!workflow.WFWorkflowActions.some((a) => a.WFWorkflowActionIdentifier === "is.workflow.actions.count")) {
    throw new Error("Must Count notes before send (empty vs confirmation)")
  }
  return true
}

function writePlistJson(workflow) {
  mkdirSync(OUT_DIR, { recursive: true })
  writeFileSync(JSON_PATH, `${JSON.stringify(workflow, null, 2)}\n`)
}

function convertAndSign() {
  execFileSync("plutil", ["-convert", "binary1", "-o", UNSIGNED_PATH, JSON_PATH], {
    stdio: "inherit",
  })
  execFileSync(
    "shortcuts",
    ["sign", "--mode", "anyone", "--input", UNSIGNED_PATH, "--output", SIGNED_PATH],
    { stdio: "inherit" },
  )
  if (existsSync(UNSIGNED_PATH) && existsSync(SIGNED_PATH)) {
    unlinkSync(UNSIGNED_PATH)
  }
}

const isMain = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]
if (isMain) {
  const workflow = buildWorkflow()
  assertWorkflowShape(workflow)
  writePlistJson(workflow)
  console.log(`Wrote ${JSON_PATH}`)
  try {
    convertAndSign()
    console.log(`Signed ${SIGNED_PATH}`)
    if (!existsSync(SIGNED_PATH)) throw new Error("signed shortcut missing")
  } catch (err) {
    console.error(`Signing failed (${err instanceof Error ? err.message : err}).`)
    console.error(`The iPhone will not import an unsigned file. On this Mac run:`)
    console.error(
      `  shortcuts sign --mode anyone --input ${JSON.stringify(UNSIGNED_PATH)} --output ${JSON.stringify(SIGNED_PATH)}`,
    )
    process.exitCode = 1
  }
}
