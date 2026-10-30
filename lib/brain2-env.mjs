import { createRequire } from "node:module"

const { brain2Env, brain2EnvLine } = createRequire(import.meta.url)("./brain2-env.cjs")

export { brain2Env, brain2EnvLine }
