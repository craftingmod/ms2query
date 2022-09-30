import { SlashCommandBuilder, SlashCommandSubcommandBuilder, SlashCommandOptionsOnlyBuilder, SlashCommandSubcommandsOnlyBuilder, EmbedBuilder, CacheType, Client, CommandInteraction, Interaction } from "discord.js"
import got from "got"
import type { BotInit } from "./botinit.js"
import fs from "node:fs/promises"
import { constants as fscon } from "node:fs"

export type BasicSlashBuilder = SlashCommandBuilder | SlashCommandSubcommandBuilder | SlashCommandOptionsOnlyBuilder | SlashCommandSubcommandsOnlyBuilder | Omit<SlashCommandBuilder, "addSubcommand" | "addSubcommandGroup">

export interface Command {
  slash: BasicSlashBuilder
  beforeInit?: (client: Client) => Promise<void>
  execute: (interaction: CommandInteraction<CacheType>, bot: BotInit, tool: CommandTools) => Promise<unknown>
  executeRaw?: (interaction: Interaction<CacheType>, bot: BotInit) => Promise<boolean>
}

export class CommandTools {
  public static readonly COLOR_INFO = "#abcdef"
  protected interaction: CommandInteraction<CacheType>
  public constructor(interaction: CommandInteraction<CacheType>) {
    this.interaction = interaction
  }
  /**
   * 에러 메시지를 출력합니다.
   * @param errormsg 에러 메세지
   * @returns Promise
   */
  public async replyErrorMessage(errormsg: string) {
    const embed = new EmbedBuilder()
      .setColor("#992e22")
      .setTitle(":warning: 오류가 있습니다.")
      .setDescription(errormsg)
    return this.interaction.reply({
      embeds: [embed],
      ephemeral: true,
    })
  }
  /**
   * DM으로 답변합니다.
   * @param msg 메세지
   * @returns Promise
   */
  public async replySimplePrivate(msg: string) {
    return this.interaction.reply({
      content: msg,
      ephemeral: true,
    })
  }

  public async replySimple(msg: string) {
    return this.interaction.reply({
      content: msg,
    })
  }

  public retrieveAuthor() {
    return { name: this.interaction.user.username ?? "", iconURL: this.interaction.user.avatarURL() ?? "" }
  }

  public parseNumber(value: string | number | boolean | undefined, dfValue: number): number {
    if (value == null) {
      return dfValue
    }
    if (typeof value === "number") {
      return value
    } else if (typeof value === "string") {
      const parsed = parseInt(value)
      if (isNaN(parsed)) {
        return dfValue
      } else {
        return parsed
      }
    } else {
      return value ? 1 : 0
    }
  }

  public static createCustomId(tag: string, userid: string) {
    return `${tag}:${userid}`
  }
  public static parseCustomId(customid: string) {
    if (customid.indexOf(":") < 0) {
      return { tag: customid, userid: "" }
    } else {
      return { tag: customid.split(":")[0]!!, userid: customid.split(":")[1]!! }
    }
  }

  public static makeErrorMessage(errormsg: string) {
    const embed = new EmbedBuilder()
      .setColor("#992e22")
      .setTitle(":warning: 오류!")
      .setDescription(errormsg)
    return embed
  }

  public static async getCurrentTime() {
    const currentTime: { datetime: string } = await got("https://worldtimeapi.org/api/timezone/Asia/Seoul").json()
    const date = new Date(currentTime.datetime)
    return date
  }

  public static async pathExist(path: string) {
    return fs.access(path, fscon.R_OK).then(() => true).catch(() => false)
  }
}