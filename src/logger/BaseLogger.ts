import chalk, { type ChalkInstance } from "chalk"
import Path from "node:path"
import { EdgeChar, EdgeLeftChar, getCurrentHMS, getScriptName, hash53, roundString } from "./LoggerUtil.ts"

const mySeed = 20150707
const tagLn = 20
const pathLn = 30
const totalLn = 70
const tagBg = "#333333"
const sourceBg = "#111111"

interface LogConfig {
  msgColor: ChalkInstance,
  backColor: ChalkInstance,
  headerChar: string,
  depth: number,
  logLevel: number,
}

/**
 * 로그를 출력합니다. 설정값 필수
 * @param tag 태그
 * @param logConf 메세지 타입 헤더 설정
 * @param msg 메세지
 */
export function log(tag: string, logConf: LogConfig, ...msg: unknown[]) {
  const scriptInfo = getScriptName(logConf.depth)

  if (tag.length <= 0) {
    tag = scriptInfo.fnName
  }

  let output = ""
  // 시간
  output += chalk.bgGray.gray(` ${getCurrentHMS()} `)
  // >
  output += chalk.bgHex(tagBg).gray(`${EdgeChar} `)
  // 태그
  output += colorStringRandom(
    roundString(tag, tagLn),
    chalk.bgHex(tagBg),
  )
  // 공백 하나
  output += chalk.bgHex(tagBg)(" ")
  // >
  output += chalk.hex(tagBg).bgHex(sourceBg)(`${EdgeChar} `)
  // 파일 경로
  output += colorStringRandom(
    roundString(`${scriptInfo.fileName} (${scriptInfo.fnName})`, pathLn),
    chalk.bgHex(sourceBg),
  )
  // 공백 하나
  output += chalk.bgHex(sourceBg)(" ")
  // >
  output += logConf.backColor.hex(sourceBg)(EdgeChar)
  // 메세지 타입별 표시
  output += logConf.backColor(` ${logConf.headerChar} `)

  // 출력할 게 없으면 공백 출력
  if (msg.length <= 0) {
    console.log(output)
    return output
  }

  // 출력할 게 하나고 primitie type이면 붙여서 출력
  if (msg.length === 1 && (typeof msg[0]) !== "object") {
    // output += logConf.backColor(" ")
    output += " "
    output += toColoredString(msg[0], logConf.msgColor)
    console.log(output)
    return output
  }

  // 2개 이상일 시 or JSON일시 분리해서 출력
  // output += logConf.backColor.hex(sourceBg)(EdgeLeftChar)
  output += logConf.msgColor.black(" Multiple Messages")
  console.log(output)
  for (const content of msg) {
    if ((typeof content) !== "object") {
      const message = toColoredString(content, logConf.msgColor)
      console.log(message)
      output += `\n${message}`
      continue
    }
    // object는 native 컬러에 맡기기
    console.log(content)
    output += `\n${JSON.stringify(content, null, 2)}`
  }

  // 출력 끝
  return output
}

/**
 * 문자열을 랜덤한 컬러로 출력
 */
function colorStringRandom(str: string, baseChalk: ChalkInstance = chalk) {
  const colors = [baseChalk.blueBright, baseChalk.cyanBright, baseChalk.greenBright, baseChalk.magentaBright, baseChalk.yellowBright]
  const hashedStr = hash53(str, mySeed)

  const colorFn = colors[hashedStr % colors.length]
  return colorFn(str)
}

/**
 * 모르는 값을 컬러 입힌 문자열로 변환합니다
 * @param data 데이터
 * @returns 컬러 입힌 문자열
 */
function toColoredString(data: unknown | null, baseChalk: ChalkInstance = chalk) {
  if (data === null) {
    return baseChalk.blue("null")
  }
  if (data === undefined) {
    return baseChalk.blue("undefined")
  }

  switch (typeof data) {
    case "bigint":
    case "number":
      return baseChalk.yellow(String(data))
      break
    case "boolean":
      return baseChalk.blue(String(data))
      break
    case "string":
      return baseChalk(data)
      break
    case "undefined":
      return baseChalk.blue("undefined")
      break
    case "function":
      return baseChalk(`[Function ${data.name}]`)
      break
    case "symbol":
      return baseChalk(`[Symbol ${data.description ?? "Unknown"}]`)
      break
    default:
      return baseChalk(`[Object object]`)
  }
  return ""
}