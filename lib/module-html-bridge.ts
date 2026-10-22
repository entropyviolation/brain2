/**
 * lib/module-html-bridge.ts — What an uploaded HTML module may do to Brain2
 *
 * The page runs in a sandboxed frame (no same-origin, no parent access). It
 * reaches Brain2 only through `window.brain2`, which this file injects and
 * answers over `postMessage`. Nothing is ambient: a page sees the lists the
 * user attached and may write only when the user ticked "allow edits".
 *
 * Pure helpers (`buildSrcDoc`, `bridgeSnapshot`) and the call handler take the
 * data they need as arguments so they test without a store. `HtmlModuleView`
 * wires them to `task-store` (the one write door).
 */
import type { AttributeValue, List, Task } from "@/lib/types"

export interface HtmlBridgeGrants {
  /** Lists the page may read (and write, when `canWrite`). Empty = no list data. */
  listIds: string[]
  canWrite: boolean
}

export interface BridgeList {
  id: string
  name: string
  attributes: { id: string; name: string; type: string; options?: string[] }[]
}

export interface BridgeItem {
  id: string
  title: string
  completed: boolean
  listIds: string[]
  attributes: Record<string, AttributeValue>
}

export interface BridgeSnapshot {
  lists: BridgeList[]
  items: BridgeItem[]
}

export function toBridgeList(list: List): BridgeList {
  return {
    id: list.id,
    name: list.name,
    attributes: (list.itemAttributes ?? []).map((a) => ({
      id: a.id,
      name: a.name,
      type: a.type,
      ...(a.options ? { options: a.options } : {}),
    })),
  }
}

export function toBridgeItem(task: Task): BridgeItem {
  return {
    id: task.id,
    title: task.title || task.description || "",
    completed: !!task.completed,
    listIds: task.lists ?? [],
    attributes: JSON.parse(JSON.stringify(task.attributes ?? {})) as Record<string, AttributeValue>,
  }
}

/** The data a page is allowed to see: attached lists and the items on them. */
export function bridgeSnapshot(lists: List[], tasks: Task[], grants: HtmlBridgeGrants): BridgeSnapshot {
  const allowed = new Set(grants.listIds)
  return {
    lists: lists.filter((l) => allowed.has(l.id)).map(toBridgeList),
    items: tasks.filter((t) => t.lists?.some((id) => allowed.has(id))).map(toBridgeItem),
  }
}

export interface BridgeItemPatch {
  title?: string
  completed?: boolean
  attributes?: Record<string, AttributeValue>
}

export type BridgeCall =
  | { method: "snapshot" }
  | { method: "createItem"; listId: string; item: BridgeItemPatch }
  | { method: "updateItem"; id: string; patch: BridgeItemPatch }
  | { method: "openItem"; id: string }
  | { method: "setKv"; key: string; value: string | null }

/** Store operations the handler needs. `HtmlModuleView` passes the real ones. */
export interface BridgeHost {
  lists: List[]
  tasks: Task[]
  createItem: (listId: string, patch: BridgeItemPatch) => string
  updateItem: (task: Task, patch: BridgeItemPatch) => void
  openItem?: (id: string) => void
  setKv: (key: string, value: string | null) => void
}

export class BridgeError extends Error {}

/** Answer one call from the frame. Throws `BridgeError` when a grant is missing. */
export function handleBridgeCall(call: BridgeCall, host: BridgeHost, grants: HtmlBridgeGrants): unknown {
  const allowed = new Set(grants.listIds)
  const mayTouch = (task: Task) => !!task.lists?.some((id) => allowed.has(id))
  switch (call.method) {
    case "snapshot":
      return bridgeSnapshot(host.lists, host.tasks, grants)
    case "createItem": {
      if (!grants.canWrite) throw new BridgeError("This module was not allowed to edit items.")
      if (!allowed.has(call.listId)) throw new BridgeError("That list is not attached to this module.")
      return host.createItem(call.listId, call.item)
    }
    case "updateItem": {
      if (!grants.canWrite) throw new BridgeError("This module was not allowed to edit items.")
      const task = host.tasks.find((t) => t.id === call.id)
      if (!task || !mayTouch(task)) throw new BridgeError("That item is not on an attached list.")
      host.updateItem(task, call.patch)
      return true
    }
    case "openItem": {
      const task = host.tasks.find((t) => t.id === call.id)
      if (!task || !mayTouch(task)) throw new BridgeError("That item is not on an attached list.")
      host.openItem?.(call.id)
      return true
    }
    case "setKv":
      host.setKv(String(call.key).slice(0, 200), call.value == null ? null : String(call.value))
      return true
    default:
      throw new BridgeError("Unknown bridge call.")
  }
}

/**
 * The script injected ahead of the page's own. Defines `window.brain2` and a
 * `localStorage` shim backed by the module's kv, since a sandboxed frame has no
 * Web Storage of its own. Written as a string: it runs inside the frame.
 */
export const BRIDGE_PRELUDE = `(function(){
var CFG = window.__BRAIN2_CFG__; delete window.__BRAIN2_CFG__;
var kv = CFG.kv || {};
var pending = {}, seq = 0, listeners = [], snap = { lists: [], items: [] };
function call(msg){
  return new Promise(function(resolve, reject){
    var id = ++seq; pending[id] = { resolve: resolve, reject: reject };
    parent.postMessage({ b2: 1, id: id, call: msg }, "*");
  });
}
window.addEventListener("message", function(e){
  var d = e.data; if (!d || d.b2 !== 1) return;
  if (d.reply) {
    var p = pending[d.reply]; if (!p) return; delete pending[d.reply];
    if (d.error) p.reject(new Error(d.error)); else p.resolve(d.result);
  } else if (d.event === "snapshot") {
    snap = d.data; listeners.slice().forEach(function(fn){ try { fn(snap) } catch (err) { console.error(err) } });
  }
});
function write(key, value){ call({ method: "setKv", key: key, value: value }).catch(function(){}); }
var storage = {
  get length(){ return Object.keys(kv).length },
  key: function(i){ return Object.keys(kv)[i] === undefined ? null : Object.keys(kv)[i] },
  getItem: function(k){ k = String(k); return Object.prototype.hasOwnProperty.call(kv, k) ? kv[k] : null },
  setItem: function(k, v){ k = String(k); v = String(v); kv[k] = v; write(k, v) },
  removeItem: function(k){ k = String(k); delete kv[k]; write(k, null) },
  clear: function(){ Object.keys(kv).forEach(function(k){ delete kv[k]; write(k, null) }) }
};
try { Object.defineProperty(window, "localStorage", { configurable: true, get: function(){ return storage } }) } catch (e) {}
try { Object.defineProperty(window, "sessionStorage", { configurable: true, get: function(){ return storage } }) } catch (e) {}
var byList = function(listId){ return snap.items.filter(function(i){ return !listId || i.listIds.indexOf(listId) !== -1 }) };
window.brain2 = {
  canWrite: !!CFG.canWrite,
  listIds: CFG.listIds || [],
  ready: call({ method: "snapshot" }).then(function(s){ snap = s; return s }),
  lists: function(){ return Promise.resolve(snap.lists) },
  items: function(listId){ return Promise.resolve(byList(listId)) },
  onChange: function(fn){ listeners.push(fn); return function(){ listeners = listeners.filter(function(f){ return f !== fn }) } },
  createItem: function(listId, item){ return call({ method: "createItem", listId: listId, item: item || {} }) },
  updateItem: function(id, patch){ return call({ method: "updateItem", id: id, patch: patch || {} }) },
  openItem: function(id){ return call({ method: "openItem", id: id }) },
  storage: { get: storage.getItem, set: storage.setItem, remove: storage.removeItem, keys: function(){ return Object.keys(kv) } }
};
window.dispatchEvent(new Event("brain2:ready"));
})();`

/** `<` and U+2028/9 would end the inline script or JSON string early. */
function safeJson(value: unknown): string {
  return JSON.stringify(value).replace(/</g, "\\u003c").replace(/\u2028/g, "\\u2028").replace(/\u2029/g, "\\u2029")
}

/**
 * Put the bridge in front of the uploaded page. The file is used as it is: a
 * full document keeps its own head, a fragment is wrapped in a minimal one.
 */
export function buildSrcDoc(html: string, cfg: { kv: Record<string, string>; grants: HtmlBridgeGrants }): string {
  const boot =
    `<script>window.__BRAIN2_CFG__=${safeJson({ kv: cfg.kv, listIds: cfg.grants.listIds, canWrite: cfg.grants.canWrite })}</script>` +
    `<script>${BRIDGE_PRELUDE}</script>`
  const head = /<head(\s[^>]*)?>/i.exec(html)
  if (head) return html.slice(0, head.index + head[0].length) + boot + html.slice(head.index + head[0].length)
  const root = /<html(\s[^>]*)?>/i.exec(html)
  if (root) return html.slice(0, root.index + root[0].length) + `<head>${boot}</head>` + html.slice(root.index + root[0].length)
  return `<!doctype html><html><head><meta charset="utf-8">${boot}</head><body>${html.replace(/^\s*<!doctype[^>]*>/i, "")}</body></html>`
}
