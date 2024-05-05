import { CommandInteraction, SlashCommandBuilder, EmbedBuilder } from "discord.js"
import { accChartURL, calcAccRate, calcMaxAccRate } from "../../ms2/ms2Calc.ts"
import { type Command, CommandPolicy } from "../base/Command.ts"
import { getCommandParam, makeResponseEmbed } from "../base/CommandTools.ts"

export class AccRateCommand implements Command {
  public runPolicy = CommandPolicy.All
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

  public async execute(interaction: CommandInteraction) {
    // 파라메터들
    const accuracy = getCommandParam<number>(interaction, AccParam.ACCURACY, 0)
    const dex = getCommandParam<number>(interaction, AccParam.DEX, 0)

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
    const embed = makeResponseEmbed({
      title: ":dart: 명중 확률",
      description: [
        `명중: ${accuracy}`,
        `DEX: ${dex}`,
        `[자세히 보기](${accChartURL})`,
      ].join("\n"),
      author: interaction.user,
      authorMember: interaction.member,
    })

    // 명중 적기
    addField(embed, "루크", 78)
    addField(embed, "어슈슈", 94)
    addField(embed, "블핑빈", 98)
    addField(embed, "블랙빈", 108)
    addField(embed, "칸두라", 118)
    addField(embed, "로사", 131)

    await interaction.reply({
      embeds: [embed],
    })
  }
}

enum AccParam {
  ACCURACY = "명중",
  DEX = "dex",
}