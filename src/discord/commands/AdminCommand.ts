
import { GatewayIntentBits, Routes, RESTPostAPIApplicationCommandsJSONBody } from "discord.js"
import { CacheType, Client, Collection, CommandInteraction, Guild, Interaction, User } from "discord.js"
import { Command, CommandTools } from "../command.js"
import { SlashCommandBuilder } from "discord.js"
import { BotInit } from "../botinit.js"
/**
 * 슬래시 커맨드 갱신 명령어
 */
export class AdminCommand implements Command {
  public slash = new SlashCommandBuilder()
    .setName("admin")
    .setDescription("관리자 명령어.")
    .addSubcommand(subcommand =>
      subcommand.setName("updateslash")
        .setDescription("/ 명령어를 갱신합니다."))
    .addSubcommand(subcommand =>
      subcommand.setName("nowplaying")
        .setDescription("현재 상태 메시지를 바꿉니다.")
        .addStringOption(option => option.setName("status").setDescription("현재 상태를 입력해주세요.").setRequired(true)))
  public async execute(interaction: CommandInteraction<CacheType>, bot: BotInit, tool: CommandTools) {
    if (!bot.isOwner(interaction.user)) {
      await tool.replySimplePrivate(`권한이 없습니다.`)
      return
    }
    for (const subCommand of interaction.options.data) {
      if (subCommand.name == "nowplaying") {
        const status = interaction.options.get("status")?.value?.toString() ?? ""
        interaction.client.user?.setPresence({
          activities: [{ name: status }],
          status: "online",
        })
        await tool.replySimplePrivate("변경 완료")
      }
    }
    /*
    interaction.options.get("updateslash")
    const subcommand = interaction.options.getSubcommand(true)
    if (subcommand === "updateslash") {
      const guild = interaction.guild
      if (guild != null) {
        await bot.registerInterationsGuild(guild)
        await tool.replySimplePrivate(`등록되었습니다.`)
      } else {
        await tool.replySimplePrivate(`길드에서만 가능합니다.`)
      }
    } else if (subcommand === "nowplaying") {
      const changevalue = interaction.options.getString("status") ?? "Nothing"
      interaction.client.user?.setPresence({
        activities: [{ name: changevalue }],
        status: "online",
      })
      await tool.replySimplePrivate("변경 완료.")
    }
    */
  }
}