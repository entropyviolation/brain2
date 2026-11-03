const status = document.getElementById("status")
const profile = document.getElementById("profile")
const save = document.getElementById("save")

function paint(state) {
  profile.value = state.profile || "Chrome"
  save.checked = state.saveFiles !== false
  const last = state.lastDay ? `Last closed day: ${state.lastDay}.` : "No day has been exported yet."
  const waiting = state.pending ? ` ${state.pending} day${state.pending === 1 ? "" : "s"} waiting to reach Brain2.` : ""
  const error = state.lastError ? ` ${state.lastError}` : ""
  status.textContent = `${last}${waiting}${error}`
}

const state = await chrome.runtime.sendMessage({ type: "status" })
paint(state || {})

profile.addEventListener("change", () => {
  void chrome.runtime.sendMessage({ type: "setProfile", profile: profile.value })
})

save.addEventListener("change", () => {
  void chrome.runtime.sendMessage({ type: "setSaveFiles", saveFiles: save.checked })
})

document.getElementById("yesterday").addEventListener("click", async () => {
  status.textContent = "Exporting yesterday…"
  paint(await chrome.runtime.sendMessage({ type: "exportYesterday" }))
})

document.getElementById("backfill").addEventListener("click", async () => {
  status.textContent = "Sending the days Chrome still has…"
  paint(await chrome.runtime.sendMessage({ type: "backfill" }))
})
