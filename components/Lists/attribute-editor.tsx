/**
 * components/Lists/attribute-editor.tsx — Barrel for the attribute editor suite
 *
 * The flexible item-attribute UI (schema + value editors for the expanded
 * attribute type system) was split into focused modules under `./attributes/`.
 * This barrel preserves the original import surface. New code may import directly
 * from the submodules.
 *
 * - `./attributes/helpers`               value coercion, formatting, merging
 * - `./attributes/AttributeSchemaEditor` define a list's attribute schema
 * - `./attributes/AttributeValueField`   per-type single-value input
 * - `./attributes/AttributeValuesEditor` schema-driven + ad-hoc value editors
 */
"use client"

export {
  mergeListAttributes,
  mergeItemAttributes,
  listAttributeSchema,
  formatAttributeValue,
} from "./attributes/helpers"
export { AttributeSchemaEditor } from "./attributes/AttributeSchemaEditor"
export { AttributeValueField } from "./attributes/AttributeValueField"
export { AttributeValuesEditor, AdHocAttributesEditor } from "./attributes/AttributeValuesEditor"
