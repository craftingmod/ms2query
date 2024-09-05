import type { ChatInputCommandInteraction } from "discord.js"
import Bun, { sleep as BunSleep } from "bun"


type BasicJSON = Record<string, string | number | boolean>
/**
 * `path` 경로의 파일을 읽어 JSON Object로 반환
 * @param path JSON 경로
 * @param dfValue 기본 JSON 파일
 * @returns JSON Object
 */
export async function readJSON<T extends BasicJSON>(path: string, dfValue: T) {
  const file = Bun.file(path, {
    type: "application/json",
  })
  // 파일 미존재 시 그냥 쓰기
  if (!(await file.exists())) {
    await writeJSON(path, dfValue)
    return {
      ...dfValue,
    }
  }
  // 존재 시 읽기
  const fileContent = await file.text()
  return {
    ...dfValue,
    ...JSON.parse(fileContent),
  }
}

/**
 * `path` 경로의 파일을 `data`로 쓰기
 * @param path JSON 경로
 * @param data 쓸 JSON 데이터
 * @returns 
 */
export async function writeJSON(path: string, data: BasicJSON) {
  return Bun.write(path, JSON.stringify(data, null, 2))
}

export async function exists(path: string) {
  const bunFile = Bun.file(path)
  return bunFile.exists()
}

/**
 * Sleep인데 Bun용 Sleep
 */
export const sleep = BunSleep