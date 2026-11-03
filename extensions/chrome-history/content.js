/**
 * Bridges the service worker to a Brain2 tab on localhost:3000.
 * The page asks when it is ready. This script never reads the page.
 */
const READY = "brain2-chrome-history-ready"
const PUSH = "brain2-chrome-history"
const ACK = "brain2-chrome-history-ack"
const POLL = "brain2-chrome-history-poll"

async function pushPending() {
  const res = await chrome.runtime.sendMessage({ type: "pending" })
  const files = res && Array.isArray(res.files) ? res.files : []
  if (!files.length) return
  window.dispatchEvent(new CustomEvent(PUSH, { detail: { files } }))
}

window.addEventListener(READY, () => {
  void pushPending()
})

window.addEventListener(ACK, (event) => {
  const days = event.detail && event.detail.days
  if (!Array.isArray(days) || !days.length) return
  void chrome.runtime.sendMessage({ type: "ack", days })
})

chrome.runtime.onMessage.addListener((message) => {
  if (!message || typeof message.type !== "string") return
  if (message.type === "push") void pushPending()
  if (message.type === "poll") window.dispatchEvent(new Event(POLL))
})
