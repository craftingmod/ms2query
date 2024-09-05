import { SlashCommandBuilder } from "discord.js"
import type { Command } from "../base/Command"
import { sleep } from "../base/BaseUtil"

export const PingCmd: Command = {
  slash: new SlashCommandBuilder()
    .setName("ping")
    .setDescription("핑핑"),
  execute: async (interaction) => {
    await sleep(5000)
    await interaction.editReply("퐁!")
  }
}