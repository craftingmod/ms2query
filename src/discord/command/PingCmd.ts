import { ChatInputCommandInteraction, SlashCommandBuilder, type BaseMessageOptions } from "discord.js"
import type { Command } from "../base/Command.ts"

export class PingCmd implements Command {
  public defer = true
  public slash = new SlashCommandBuilder()
    .setName("ping")
    .setDescription("핑핑")

  public async execute(interaction: ChatInputCommandInteraction) {
    return `퐁`
  }
}