import { CacheType, CommandInteraction, EmbedBuilder } from "discord.js"
import type { BotInit } from "../botinit.js"
import { Command, CommandTools } from "../command.js"
import { SlashCommandBuilder } from "discord.js"

export class RegionCommand implements Command {
  public slash = new SlashCommandBuilder()
    .setName("군단전")
    .setDescription("다음 군단전 정보를 알려줘요!")
  public async execute(interaction: CommandInteraction<CacheType>, bot: BotInit, tool: CommandTools) {
    const date = await CommandTools.getCurrentTime()
    let hour = date.getHours()
    const minute = date.getMinutes()
    const replyEmbed = new EmbedBuilder()
    replyEmbed.setColor(CommandTools.COLOR_INFO)
    if (minute >= 55) {
      hour += 1
    }
    const displayTime = hour % 12 === 0 ? 12 : (hour % 12)
    const isPM = hour >= 12
    if (minute >= 50 && minute < 55) {
      replyEmbed.setTitle("현재 진행중인 군단전")
      replyEmbed.setDescription("두개 중 하나가 진행되고 있어요.")
    } else {
      replyEmbed.setTitle("다음 군단전")
      replyEmbed.setDescription(`다음 군단전은 \`${isPM ? "오후" : "오전"} ${displayTime}시 50분\`에 진행되어요.`)
    }
    if (hour % 2 === 0) {
      // 짝
      replyEmbed.setFooter({
        text: "짝수 시각 군단전"
      })
      replyEmbed.addFields({
        name: "군단전 1",
        value: Regions.TYPEB_1,
      }, {
        name: "군단전 2",
        value: Regions.TYPEB_2,
      })
    } else {
      // 홀
      replyEmbed.setFooter({
        text: "홀수 시각 군단전"
      })
      replyEmbed.addFields({
        name: "군단전 1",
        value: Regions.TYPEA_1,
      }, {
        name: "군단전 2",
        value: Regions.TYPEA_2,
      })
    }
    await interaction.reply({
      embeds: [replyEmbed],
    })
  }
}

enum Regions {
  TYPEA_1 = "푸르카우 평원", // 홀
  TYPEA_2 = "지크벤 루트", // 홀 
  TYPEB_1 = "생태 실험 구역", // 짝
  TYPEB_2 = "바베니 전초기지", // 짝
}