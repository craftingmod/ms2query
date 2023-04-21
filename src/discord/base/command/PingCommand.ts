import { CommandInteraction, SlashCommandBuilder } from "discord.js"

import { type Command, CommandPolicy } from "../Command.ts"

export class PingCommand implements Command {
  public runPolicy = CommandPolicy.All
  public slash = new SlashCommandBuilder()
    .setName("ping")
    .setDescription("봇이 살아있는지 핑합니다.")
  public async execute(interaction: CommandInteraction) {
    await interaction.reply("Pong!")
  }

  public executors = {}
  public interactions = {}
}