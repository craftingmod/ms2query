import type { CacheType, CommandInteraction } from "discord.js"
import type { BotInit } from "../botinit.js"
import type { Command, CommandTools } from "../command.js"
import { SlashCommandBuilder } from "discord.js"
import { fetchGuildRank, fetchWorldChat } from "../../ms2/ms2fetch.js"

export class Ping implements Command {
  public slash = new SlashCommandBuilder()
    .setName("ping")
    .setDescription("봇이 살아있는지 핑합니다.")
  public async execute(interaction: CommandInteraction<CacheType>, bot: BotInit, tool: CommandTools) {
    await tool.replySimple("Pong!")
  }
}