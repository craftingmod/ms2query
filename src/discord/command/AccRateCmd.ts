import { ChatInputCommandInteraction, EmbedBuilder, SlashCommandBuilder } from "discord.js"
import type { Command } from "../base/Command.ts"
import { getCommandParam, getUserFromInteract, Pallete } from "../base/CommandTools.ts"
import { accChartURL, calcAccRate, calcMaxAccRate } from "../../ms2/MS2Calc.ts"

export class AccRateCmd implements Command {
  public slash = new SlashCommandBuilder()
    .setName("명중")
    .setDescription("캐릭터의 명중 확률을 구해줍니다.")
    // 명중
    .addNumberOption(option =>
      option.setName(AccParam.ACCURACY)
        .setDescription("캐릭터의 명중")
        .setRequired(true))
    // DEX
    .addNumberOption(option =>
      option.setName(AccParam.DEX)
        .setDescription("캐릭터의 DEX")
        .setRequired(true)
    )

  public async execute(interaction: ChatInputCommandInteraction) {
    // 파라메터들
    const accuracy = getCommandParam<number>(interaction, AccParam.ACCURACY, 0)
    const dex = getCommandParam<number>(interaction, AccParam.DEX, 0)

    // 필드 추가
    const addField = (modifyEmbed: EmbedBuilder, dungeonname: string, eva: number) => {
      const fieldAccRate = calcAccRate({ accuracy, dex }, { eva }) * 100
      const accRateStr = fieldAccRate.toFixed(2)
      const maxAcc = calcMaxAccRate({ dex }, { eva })
      const maxAccStr = Math.ceil(maxAcc).toString()

      modifyEmbed.addFields({
        name: dungeonname,
        value: `**${accRateStr}**% (요구 명중 **${maxAccStr}**)`,
        inline: false,
      })
    }

    // Embed 생성
    const sender = getUserFromInteract(interaction)
    const embedBuilder = new EmbedBuilder()
    embedBuilder.setColor(Pallete.Purple)
    embedBuilder.setTitle(":dart: 명중 확률")
    embedBuilder.setDescription([
      `명중: ${accuracy}`,
      `DEX: ${dex}`,
      `[자세히 보기](${accChartURL})`,
    ].join("\n"))
    embedBuilder.setAuthor({
      name: sender.name,
      iconURL: sender.avatar,
    })

    // 명중 적기
    addField(embedBuilder, "루크", 78)
    addField(embedBuilder, "어슈슈", 94)
    addField(embedBuilder, "어블핑", 98)
    addField(embedBuilder, "블랙빈", 108)
    addField(embedBuilder, "칸두라", 118)
    addField(embedBuilder, "로사", 131)
    return {
      embeds: [embedBuilder],
    }
  }


}

enum AccParam {
  ACCURACY = "명중",
  DEX = "dex",
}