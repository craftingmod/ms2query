
import { GatewayIntentBits, Routes, RESTPostAPIApplicationCommandsJSONBody } from "discord.js"
import { CacheType, Client, Collection, CommandInteraction, Guild, Interaction, User } from "discord.js"
import { Command } from "../Command.js"
import { SlashCommandBuilder } from "discord.js"
import { BotInit } from "../botbase.js"
/**
 * 슬래시 커맨드 갱신 명령어
 */
export class AdminCommand extends Command {
  public slash = new SlashCommandBuilder()
    .setName("admin")
    .setDescription("관리자 명령어입니다.")
    .addSubcommand(subcommand =>
      subcommand.setName("updateslash")
        .setDescription("/ 명령어를 갱신합니다. (글로벌 or 길드)")
        .addBooleanOption(option => option
          .setName("글로벌")
          .setDescription("글로벌로 갱신할지 여부")
          .setRequired(false))
    )
    .addSubcommand(subcommand =>
      subcommand.setName("removeslash")
        .setDescription("/ 명령어를 없앱니다. (글로벌 or 길드)")
        .addBooleanOption(option => option
          .setName("글로벌")
          .setDescription("글로벌로 갱신할지 여부")
          .setRequired(false))
    )
    .addSubcommand(subcommand =>
      subcommand.setName("nowplaying")
        .setDescription("현재 상태 메시지를 바꿉니다.")
        .addStringOption(option => option.setName("status").setDescription("현재 상태를 입력해주세요.").setRequired(true)))
    .addSubcommand(subcommand =>
      subcommand.setName("maintenance")
        .setDescription("봇을 오프라인 상태로 전환합니다.")
        .addBooleanOption(option => option.setName("offline").setDescription("오프라인으로 전환할지 여부").setRequired(true))
    )
    .addSubcommand(subcommand =>
      subcommand.setName("guestbooktoken")
        .setDescription("방명록 토큰을 설정합니다.")
        .addStringOption(option => option.setName("token").setDescription("토큰입니다.").setRequired(true))
    )
  public async execute(interaction: CommandInteraction<CacheType>, bot: BotInit) {
    if (!bot.isOwner(interaction.user)) {
      await tool.replySimplePrivate(`권한이 없습니다.`)
      return
    }
    for (const subCommand of interaction.options.data) {
      if (subCommand.name === "nowplaying") {
        const status = interaction.options.get("status")?.value?.toString() ?? ""
        bot.statusMessage = status
        interaction.client.user?.setActivity({
          name: status,
        })
        await tool.replySimplePrivate("변경 완료")
      } else if (subCommand.name === "updateslash") {
        const isGlobal = Boolean(interaction.options.get("글로벌")?.value ?? false)
        if (interaction.guild != null && !isGlobal) {
          await bot.registerInteractionsGuild(interaction.guild)
          await tool.replySimplePrivate(`등록되었습니다.`)
        } else {
          await bot.registerInteractionsGlobal()
          await tool.replySimplePrivate(`등록되었습니다.`)
        }
      } else if (subCommand.name === "removeslash") {
        const isGlobal = interaction.options.get("글로벌")?.value ?? false
        if (interaction.guild != null && !isGlobal) {
          await bot.clearInteractionsGuild(interaction.guild)
          await tool.replySimplePrivate(`삭제되었습니다.`)
        } else {
          await bot.clearInteractionsGlobal()
          await tool.replySimplePrivate(`삭제되었습니다.`)
        }
      } else if (subCommand.name === "maintenance") {
        const isOffline = Boolean(interaction.options.get("offline")?.value ?? false)
        if (isOffline) {
          bot.setOffline()
        } else {
          bot.setOnline()
        }
        await tool.replySimplePrivate(`적용되었습니다.`)
      } else if (subCommand.name === "guestbooktoken") {
        const token = interaction.options.get("token")?.value?.toString() ?? ""
        if (token.length <= 0) {
          await tool.replySimplePrivate(`토큰을 입력해주세요.`)
          return
        }
        bot.globalConfig["guestbooktoken"] = token
        await bot.saveConfig()
        await tool.replySimplePrivate(`저장되었습니다.`)
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