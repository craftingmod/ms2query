import { EmbedBuilder, SlashCommandBuilder } from "discord.js"
import { CommandInteraction } from "discord.js"

import { type Command, CommandPolicy } from "../base/Command.ts"
import { getCurrentTimeForce, makeResponseEmbed } from "../base/CommandTools.ts"

export class LegionCommand implements Command {
  public slash = new SlashCommandBuilder()
    .setName("군단전")
    .setDescription("다음 군단전 정보를 알려줘요!")

  public runPolicy = CommandPolicy.All

  public async execute(interaction: CommandInteraction) {
    const date = await getCurrentTimeForce()
    let hour = date.getHours()
    const minute = date.getMinutes()
    if (minute >= 55) {
      hour += 1
    }
    const displayTime = hour % 12 === 0 ? 12 : (hour % 12)
    const isPM = hour >= 12
    let title = ""
    let description = ""
    if (minute >= 50 && minute < 55) {
      title = "현재 진행중인 군단전"
      description = "두개 중 하나가 진행되고 있어요."
    } else {
      title = "다음 군단전"
      description = `다음 군단전은 \`${isPM ? "오후" : "오전"} ${displayTime}시 50분\`에 진행되어요.`
    }
    const replyEmbed = makeResponseEmbed({
      title,
      description,
      author: interaction.user,
      authorMember: interaction.member,
    })

    if (hour % 2 === 0) {
      // 짝
      replyEmbed.setAuthor({
        name: "짝수 시각 군단전"
      })
      replyEmbed.addFields({
        name: "군단전 1",
        value: Legions.TYPEB_1,
      }, {
        name: "군단전 2",
        value: Legions.TYPEB_2,
      })
    } else {
      // 홀
      replyEmbed.setAuthor({
        name: "홀수 시각 군단전"
      })
      replyEmbed.addFields({
        name: "군단전 1",
        value: Legions.TYPEA_1,
      }, {
        name: "군단전 2",
        value: Legions.TYPEA_2,
      })
    }
    await interaction.reply({
      embeds: [replyEmbed],
    })
  }
}

enum Legions {
  TYPEA_1 = "푸르카우 평원", // 홀
  TYPEA_2 = "지크벤 루트", // 홀 
  TYPEB_1 = "생태 실험 구역", // 짝
  TYPEB_2 = "바베니 전초기지", // 짝
}