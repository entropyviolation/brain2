/**
 * lib/baby-game/specs/ — The spec contract: plain-JSON shapes a weak local model writes and code realizes
 *
 * `PropSpec`, `CastSpec`, `BlockSpec` and `ToolSpec` with their validators, the named ramps, and Valdivia written in those shapes. `GameSeed`
 * still lives in `../seed.ts`. Nothing in the game reads these yet (`docs/BABY_GAME_STANDALONE.md`, step 1).
 */

export * from "./common"
export * from "./ramps"
export * from "./prop"
export * from "./cast"
export * from "./block"
export * from "./tool"
export * from "./examples"
