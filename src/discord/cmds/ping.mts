import { SlashCommandBuilder } from "@discordjs/builders"
import { CacheType, CommandInteraction } from "discord.js"
import { BotInit } from "../botinit.mjs"
import { Command, CommandTools } from "../command.mjs"

export class Ping implements Command {
  public slash = new SlashCommandBuilder()
    .setName("ping")
    .setDescription("봇아 살아있니?")
  public async execute(interaction: CommandInteraction<CacheType>, bot: BotInit, tool: CommandTools) {
    await tool.replyErrorMessage("살아있어요!")
  }
}