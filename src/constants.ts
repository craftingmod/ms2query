import Path from "node:path"

/**
 * 데이터 폴더
 */
export const DataDir = Path.resolve("data")

/**
 * 디버깅 토큰 경로
 */
export const TokenDebugPath = Path.resolve(DataDir, "token_debug.txt")