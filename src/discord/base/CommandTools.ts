import { APIInteractionGuildMember, ButtonInteraction, CacheType, CommandInteraction, EmbedBuilder, GuildMember, Interaction, SelectMenuInteraction, User } from "discord.js"
import got from "got"
import { constants as fscon } from "node:fs"
import fs from "node:fs/promises"
import { UserInteraction } from "./Command"

export const COLOR_INFO = "#4a8df7"

/**
 * 권한 없음 메시지를 보냅니다.
 * @param interaction 인터렉션
 * @returns reply 결과
 */
export function replyNoPerm(interaction: UserInteraction | CommandInteraction) {
  return interaction.reply({
    embeds: [makeErrorEmbed("명령어를 사용할 권한이 없어요!")],
    ephemeral: true,
  })
}

/**
 * 다른 사람의 메시지에 대해 인터렉션을 할 시 보냅니다.
 * @param interaction 인터렉션
 * @returns reply 결과
 */
export function replyNoOwner(interaction: UserInteraction | CommandInteraction) {
  return interaction.reply({
    embeds: [makeErrorEmbed("메시지를 보낸 사람이 아니에요!")],
    ephemeral: true,
  })
}

/**
 * 에러 메시지를 담을 Embed를 만듭니다.
 * @param errormsg 에러 메시지
 * @returns Embed 객체
 */
export function makeErrorEmbed(errormsg: string) {
  const embed = new EmbedBuilder()
    .setColor("#992e22")
    .setTitle(":warning: 오류!")
    .setDescription(errormsg)
  return embed
}

interface ResponseInfo {
  title: string
  description: string
  author: User
  authorMember?: GuildMember | APIInteractionGuildMember | null
}

/**
 * 기본적인 정보 전달 Embed를 만듭니다.
 * @param info 기본 정보
 * @returns Embed 객체
 */
export function makeResponseEmbed(info: ResponseInfo) {
  const profile = getProfileOfUser(info.author, info.authorMember)
  const embed = new EmbedBuilder()
    .setColor(COLOR_INFO)
    .setTitle(info.title)
    .setDescription(info.description)
    .setFooter({
      text: profile.name,
      iconURL: profile.iconURL,
    })
    .setTimestamp(Date.now())
    .setThumbnail(profile.iconURL)

  return embed
}

/**
 * 사용자의 프로필 + 닉네임을 불러옵니다.
 * @param user 길드 없이 유저 정보
 * @param member 길드 안의 유저 정보
 * @returns 이름과 아이콘
 */
export function getProfileOfUser(user: User, member?: GuildMember | APIInteractionGuildMember | null) {
  if (member != null && member instanceof GuildMember) {
    return {
      name: member.displayName,
      iconURL: member.displayAvatarURL(),
    }
  }
  return {
    name: user.username,
    iconURL: user.displayAvatarURL(),
  }
}

/**
 * 명령어 인터렉션의 세부 옵션값을 가져옵니다.
 * @param interaction 명령어 인터렉션
 * @param name 세부 옵션 이름
 * @param defaultValue 기본 값
 * @returns 세부 옵션값
 */
export function getInteractionOption<T extends string | number | boolean>(interaction: CommandInteraction<CacheType>, name: string, defaultValue: T) {
  return (interaction.options.get(name)?.value ?? defaultValue) as T
}

/**
 * 현재 네트워크 시간을 가져옵니다.
 * @returns 네트워크 시간
 */
export async function getCurrentTimeForce() {
  const currentTime: { datetime: string } = await got("https://worldtimeapi.org/api/timezone/Asia/Seoul").json()
  const date = new Date(currentTime.datetime)
  return date
}

/**
 * 파일 경로가 존재하는지 확인합니다.
 * @param path 파일 경로
 * @returns 존재 여부
 */
export async function pathExist(path: string) {
  return fs.access(path, fscon.R_OK).then(() => true).catch(() => false)
}

/**
 * customId를 빌드합니다
 * @param data 데이터
 * @returns 보낼 문자열
 */
export function buildCustomId<T extends Record<string, string> & { sender: string }>(tag: string, data: T) {
  let customId = `cTag=${tag}^`
  for (const [key, value] of Object.entries(data)) {
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
          return v.split("=") as [string, string]
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
  return null
}

/**
 * subCommand에서 파라메터를 쉽게 불러옵니다.
 * @param interaction 인터렉션
 * @param name 파라메터 이름
 * @param defaultValue 기본 값
 * @returns 파라메터 값 
 */
export function getCommandParam<T extends number | boolean | string>(interaction: CommandInteraction, name: string, defaultValue: T) {
  const orgValue = interaction.options.get(name)?.value
  if (orgValue == null) {
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

export function get12HourTime(hour: number, minutes: number) {
  const ampm = hour >= 12 ? "오후" : "오전"
  const hour12 = (hour === 12 || hour === 0) ? 12 : hour % 12
  const pad2 = (num: number) => num.toString().padStart(2, "0")
  return `${ampm} ${pad2(hour12)}시 ${pad2(minutes)}분`
}