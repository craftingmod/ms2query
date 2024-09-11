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

/**
 * `path` 경로의 파일이 있는 지 검사
 * @param path 파일 경로
 * @returns 존재 유무 boolean
 */
export async function exists(path: string) {
  const bunFile = Bun.file(path)
  return bunFile.exists()
}

/**
 * ms만큼 sleep
 * @param ms 밀리초
 */
export const sleep = BunSleep

/**
 * 현재 네트워크 시간을 가져옵니다.
 * @returns 네트워크 시간
 */
export async function getCurrentTimeForce() {
  const currentTime = (await (await fetch("https://worldtimeapi.org/api/timezone/Asia/Seoul")).json()) as { datetime: string }

  const date = new Date(currentTime.datetime)
  return date
}

/**
 * hour, minute 값을 가지고 문자열로 된 시간값을 출력합니다.
 * @param hour 시
 * @param minutes 분
 * @returns `오후` `00`시 `00`분
 */
export function get12HourTime(hour: number, minutes: number) {
  const ampm = hour >= 12 ? "오후" : "오전"
  const hour12 = (hour === 12 || hour === 0) ? 12 : hour % 12
  const pad2 = (num: number) => num.toString().padStart(2, "0")
  return `${ampm} ${pad2(hour12)}시 ${pad2(minutes)}분`
}

export function getStackTrace() {
  let stackTrace = (new Error()).stack ?? ""
  if (stackTrace.length > 0) {
    const stacks = stackTrace.split("\n")
    stacks.splice(0, 5)
    let delIndex = 0
    while (
      delIndex < stacks.length &&
      stacks[delIndex++].indexOf("node:events") < 0) {
    }
    stacks.splice(delIndex - 1, stacks.length - delIndex + 1)
    stackTrace = stacks.map((v) => v.replace(process.cwd(), ".")).join("\n")
  }
}