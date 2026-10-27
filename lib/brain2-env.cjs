/**
 * lib/brain2-env.cjs — Read a BRAIN2_ setting, then the older COGS_ name.
 *
 * The name in .env.local and the docs is BRAIN2_. A machine that still has
 * the COGS_ line keeps working. An empty BRAIN2_ value does not hide a
 * COGS_ value.
 */
function brain2Env(suffix, env) {
  const source = env || process.env
  const modern = source[`BRAIN2_${suffix}`]
  if (modern !== undefined && String(modern) !== "") return String(modern)
  const legacy = source[`COGS_${suffix}`]
  if (legacy === undefined) return undefined
  return String(legacy)
}

/** First non-empty `BRAIN2_NAME=` or `COGS_NAME=` line in an env file. */
function brain2EnvLine(text, suffix) {
  const rows = String(text).split(/\r?\n/)
  for (const prefix of ["BRAIN2_", "COGS_"]) {
    const key = `${prefix}${suffix}=`
    const line = rows.find((row) => row.startsWith(key))
    if (!line) continue
    const value = line.slice(key.length).trim().replace(/^["']|["']$/g, "")
    if (value) return value
  }
  return ""
}

module.exports = { brain2Env, brain2EnvLine }
