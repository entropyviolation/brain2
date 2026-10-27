/**
 * lib/computer-project-types.ts — Computer Project item type
 *
 * A Computer Project is an Operation (`parentTypeId: operation`). The item is
 * still one task. Its type id is `computer-project`, so the Operations board
 * keeps it (`isOperation` includes this id) and Item Types → Operations includes
 * it as a subtype. Item detail's Computer Project view is the desk for running
 * the project; the Operation view is the generic operation profile.
 *
 * Fields live on the item's attributes, the same way Operation stage and mission
 * do. Phases, parts, links, notes, and tracked time are the records the app
 * already stores — this type does not invent a second project database.
 */
import type { AttributeDefinition, ItemTypeDefinition } from "@/lib/types"
import { OPERATION_ATTR, OPERATION_TYPE_ID } from "@/lib/operation-types"

export const COMPUTER_PROJECT_TYPE_ID = "computer-project"

export const COMPUTER_PROJECT_ATTR = {
  repo: "cpRepo",
  path: "cpPath",
  branch: "cpBranch",
  stack: "cpStack",
  next: "cpNext",
} as const

/**
 * Attributes the Computer Project desk edits itself. Item detail omits them
 * from the generic attribute list while that view is up, and also while a
 * computer project is showing another type's view, so they do not reappear as
 * unlabeled leftovers.
 */
export const COMPUTER_PROJECT_DESK_ATTRS = [
  OPERATION_ATTR.stage,
  OPERATION_ATTR.mission,
  COMPUTER_PROJECT_ATTR.repo,
  COMPUTER_PROJECT_ATTR.path,
  COMPUTER_PROJECT_ATTR.branch,
  COMPUTER_PROJECT_ATTR.stack,
  COMPUTER_PROJECT_ATTR.next,
] as const

const COMPUTER_PROJECT_ATTRIBUTES: AttributeDefinition[] = [
  { id: COMPUTER_PROJECT_ATTR.repo, name: "Repository", type: "link" },
  { id: COMPUTER_PROJECT_ATTR.path, name: "Local path", type: "string" },
  { id: COMPUTER_PROJECT_ATTR.branch, name: "Branch", type: "string" },
  { id: COMPUTER_PROJECT_ATTR.stack, name: "Stack", type: "multistring" },
  { id: COMPUTER_PROJECT_ATTR.next, name: "Next milestone", type: "string" },
]

export function getComputerProjectTypeDefinition(): ItemTypeDefinition {
  return {
    id: COMPUTER_PROJECT_TYPE_ID,
    name: "Computer Project",
    pluralName: "Computer Projects",
    itemLabel: "computer project",
    description:
      "A software project. It is an Operation, with a desk for status, repository, next actions, milestones, notes, and tracked time.",
    builtin: true,
    kind: "system",
    parentTypeId: OPERATION_TYPE_ID,
    color: "#155e75",
    attributes: COMPUTER_PROJECT_ATTRIBUTES,
    defaultAttributeValues: {
      [COMPUTER_PROJECT_ATTR.branch]: "main",
      [COMPUTER_PROJECT_ATTR.stack]: [],
    },
    displayedAttributes: [
      OPERATION_ATTR.stage,
      COMPUTER_PROJECT_ATTR.repo,
      COMPUTER_PROJECT_ATTR.branch,
      COMPUTER_PROJECT_ATTR.next,
    ],
    detailPanels: ["details", "body", "subtasks", "dependencies", "time"],
    detailLayout: {
      featuredAttributeIds: [
        OPERATION_ATTR.stage,
        COMPUTER_PROJECT_ATTR.repo,
        COMPUTER_PROJECT_ATTR.stack,
        COMPUTER_PROJECT_ATTR.next,
      ],
    },
    capabilities: {
      completable: true,
      subtasks: true,
      scheduleable: true,
      deadline: true,
      duration: true,
      nextActions: true,
    },
  }
}

export function withComputerProjectType(existing: ItemTypeDefinition[]): ItemTypeDefinition[] {
  if (existing.some((t) => t.id === COMPUTER_PROJECT_TYPE_ID)) return existing
  return [...existing, getComputerProjectTypeDefinition()]
}
