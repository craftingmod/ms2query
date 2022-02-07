import { SlashCommandBuilder } from "@discordjs/builders"
import { RESTPostAPIApplicationCommandsJSONBody } from "discord-api-types/v9"
import { CacheType, Client, CommandInteraction, Interaction, MessageEmbed } from "discord.js"
import got from "got-cjs"
import { BotInit } from "./botinit"

export type BasicSlashBuilder = { name: string, toJSON(): RESTPostAPIApplicationCommandsJSONBody }

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
    const embed = new MessageEmbed()
      .setColor("#992e22")
      .setTitle(":warning: 오류!")
      .setDescription(errormsg)
    return this.interaction.reply({
      embeds: [embed],
      ephemeral: true,
    })
  }
  public async replySimplePrivate(msg: string) {
    return this.interaction.reply({
      content: msg,
      ephemeral: true,
    })
  }

  public static createCustomId(tag: string, userid: string) {
    return `${tag}:${userid}`
  }
  public static parseCustomId(customid: string) {
    if (customid.indexOf(":") < 0) {
      return { tag: customid, userid: "" }
    } else {
      return { tag: customid.split(":")[0], userid: customid.split(":")[1] }
    }
  }

  public static makeErrorMessage(errormsg: string) {
    const embed = new MessageEmbed()
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
}