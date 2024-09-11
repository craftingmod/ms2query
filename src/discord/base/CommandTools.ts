import { ChatInputCommandInteraction, GuildMember, type Interaction } from "discord.js"

/**
 * 색상 팔레트
 */
export enum Pallete {
  Red = "#ff443a",
  Orange = "#ff9f0a",
  Yellow = "#ffd60a",
  Green = "#30d158",
  Mint = "#63e6e2",
  Teal = "#40c8e0",
  Cyan = "#64d3ff",
  Blue = "#0a84ff",
  Indigo = "#5e5ce6",
  Purple = "#bf5af2",
  Pink = "#ff375f",
  Brown = "#ac8e68",
  Grey = "#98989d",
}

/**
 * 인터렉션으로 부터 유저 정보를 받아옵니다.
 * @param interaction 인터렉션
 * @returns 유저 정보
 */
export function getUserFromInteract(interaction: Interaction) {
  const user = interaction.user
  const userAvatar = user.displayAvatarURL({
    forceStatic: true,
  })
  const username = user.displayName

  // 길드 내에서
  if (interaction.inGuild()) {
    const member = interaction.member
    if (member instanceof GuildMember) {
      return {
        name: member.displayName,
        avatar: member.displayAvatarURL({
          forceStatic: true,
        })
      }
    }
    // 캐시 없을 때
    return {
      name: member.nick ?? username,
      avatar: member.avatar ?? userAvatar,
    }
  }
  // 길드 없으면 Fallback값 리턴
  return {
    name: username,
    avatar: userAvatar,
  }
}

/**
 * customId를 빌드합니다
 * @param data 데이터
 * @returns 보낼 문자열
 */
export function buildCustomId<T extends Record<string, string> & { sender: string }>(tag: string, data: T) {
  let customId = `cTag=${tag}^`
  for (const [key, value] of Object.entries(data)) {
    // key 오류 검사
    if (key.indexOf("=") >= 0 || key.indexOf(";")) {
      throw new Error("key에 =나 ;를 사용할 수 없습니다.")
    }
    // value 오류 검사
    if (value.indexOf(";") >= 0) {
      throw new Error("value에 =나 ;를 사용할 수 없습니다.")
    }
    // 검사 확인
    customId += `${key}=${value};`
  }
  if (customId.endsWith(";")) {
    customId = customId.substring(0, customId.length - 1)
  }
  return customId
}

/**
 * customId를 파싱합니다.
 * @param tag 검사할 태그
 * @param value string 형태의 customId 데이터
 * @returns 파싱된 데이터 or null
 */
export function parseCustomId<T extends Record<string, string> & { sender: string }>(value: string) {
  const tagSplitIndex = value.indexOf("^")
  if (value.startsWith("cTag=") && tagSplitIndex > 0) {
    const valueTag = value.substring(5, tagSplitIndex)
    const result: Record<string, string> = {}
    if (value.length > tagSplitIndex + 1) {
      const data = value
        .substring(tagSplitIndex + 1)
        .split(";")
        .map((v) => {
          const equalIndex = v.indexOf("=")
          return [v.substring(0, equalIndex), v.substring(equalIndex + 1)]
        })
      for (const [key, value] of data) {
        result[key] = value
      }
    }
    return {
      tag: valueTag,
      data: result as T,
    }
  }
  return undefined
}

/**
 * Command에서 파라메터를 쉽게 불러옵니다.
 * @param interaction 인터렉션
 * @param name 파라메터 이름
 * @param defaultValue 기본 값
 * @returns 파라메터 값 
 */
export function getCommandParam<T extends number | boolean | string>(interaction: ChatInputCommandInteraction, name: string, defaultValue: T) {
  const orgValue = interaction.options.get(name)?.value
  if (orgValue === undefined) {
    return defaultValue
  }
  if (typeof defaultValue === "number") {
    return Number(orgValue) as T
  }
  if (typeof defaultValue === "boolean") {
    return Boolean(orgValue) as T
  }
  return orgValue as T
}