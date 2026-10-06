import { writeFileSync } from "fs"
import { catalogMarkdown } from "../lib/ingest/command-catalog"

writeFileSync("docs/BIM_COMMANDS.md", catalogMarkdown())
console.log("wrote docs/BIM_COMMANDS.md")
