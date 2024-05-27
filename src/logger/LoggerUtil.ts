export const EdgeChar = ""
export const EdgeLeftChar = ""

/**
 * 현재 시간 리턴
 */
export function getTimeStr() {
  const date = new Date()
  const year = String(date.getFullYear()).padStart(4, "0")
  const month = pad2(date.getMonth() + 1)
  const day = pad2(date.getDate())
  const hour = pad2(date.getHours())
  const minute = pad2(date.getMinutes())
  const sec = pad2(date.getSeconds())

  return `${year}-${month}-${day}|${hour}:${minute}:${sec}`
}

/**
 * 현재 시/분/초 리턴
 */
export function getCurrentHMS() {
  const date = new Date()
  const hour = pad2(date.getHours())
  const minute = pad2(date.getMinutes())
  const sec = pad2(date.getSeconds())
  return `${hour}:${minute}:${sec}`
}

/**
 * 1 -> 01 패딩
 */
export function pad2(num: number) {
  return String(num).padStart(2, "0")
}

/**
 * 호출된 스크립트 이름
 * @returns 스크립트 이름, 함수 이름
 */
export function getScriptName(depth: number = 3) {
  // fallback
  const fallback = {
    filePath: "unknown",
    fileName: "unknown",
    fnName: "unknown",
  }

  const stack = (new Error()).stack
  if (stack == null) {
    return fallback
  }

  const stackArr = stack.split("\n")
  stackArr.unshift()
  if (stackArr.length <= 1) {
    return fallback
  }

  // 0: Error name
  // 1: getScriptName
  // 2: fn name of this
  // 3: call name
  let line = stackArr[depth] ?? "unknown"
  line = line.replace(process.cwd(), ".")

  let fnName = "unknown"
  if (line.indexOf("(") >= 0) {
    fnName = line.substring(line.indexOf("at") + 3, line.indexOf("(") - 1)
  }

  // (Path) 정규식 쿼리
  const filePaths = line.match(/\(.+?\)/i) ?? ["(unknown)"]
  // 0번째
  let filePath = filePaths[0] ?? "(unknown)"
  // 0번째를 경로로 변환
  filePath = filePath.substring(1, filePath.length - 1).replace(/\\/ig, "/")
  // : 제거
  if (filePath.indexOf(":") > 0) {
    filePath = filePath.substring(0, filePath.indexOf(":"))
  }
  const fileName = filePath.substring(filePath.lastIndexOf("/") + 1)

  return {
    filePath,
    fileName,
    fnName,
  }
}

/**
 * 문자열을 ln에 맞춥니다. (오른쪽 패딩)
 * @param str 문자열
 * @param ln 길이
 */
export function roundString(str: string, ln: number) {
  if (ln <= 0) {
    return str
  }
  if (str.length <= ln) {
    return str.padEnd(ln, " ")
  }
  const pivot = Math.floor(ln / 2) - 1
  const dot = "".padStart(ln - (pivot * 2), ".")
  return `${str.substring(0, pivot)
    }${dot}${str.substring(str.length - pivot)
    }`
}

/**
 * String을 53비트 Hash화
 */
export function hash53(str: string, seed = 0) {
  let h1 = 0xdeadbeef ^ seed, h2 = 0x41c6ce57 ^ seed;
  for (let i = 0, ch; i < str.length; i++) {
    ch = str.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507);
  h1 ^= Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507);
  h2 ^= Math.imul(h1 ^ (h1 >>> 13), 3266489909);

  return 4294967296 * (2097151 & h2) + (h1 >>> 0);
}