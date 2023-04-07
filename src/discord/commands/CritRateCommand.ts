import { CommandInteraction, EmbedBuilder, SlashCommandBuilder } from "discord.js"
import { accChartURL, calcCritRate, calcMaxCritRate } from "../../ms2/ms2Calc.js"

import { CritCoef, Job, JobName, JobNameMap } from "../../ms2/ms2CharInfo.js"
import { Command, CommandPolicy } from "../base/Command.js"
import { getCommandParam, makeResponseEmbed } from "../base/CommandTools.js"
import { JobIcon } from "../jobicon.js"


export class CritRateCommand implements Command {
  private static readonly CRITRATE = "크명"
  private static readonly LUK = "luk"
  private static readonly JOB = "직업"
  public static readonly JOB_SELECTION = [
    {
      label: JobName.Knight,
      value: Job.Knight.toString(),
      emoji: JobIcon[Job.Knight],
    },
    {
      label: JobName.Archer,
      value: Job.Archer.toString(),
      emoji: JobIcon[Job.Archer],
    },
    {
      label: JobName.RuneBlader,
      value: Job.RuneBlader.toString(),
      emoji: JobIcon[Job.RuneBlader],
    },
    {
      label: JobName.Berserker,
      value: Job.Berserker.toString(),
      emoji: JobIcon[Job.Berserker],
    },
    {
      label: JobName.SoulBinder,
      value: Job.SoulBinder.toString(),
      emoji: JobIcon[Job.SoulBinder],
    },
    {
      label: JobName.Striker,
      value: Job.Striker.toString(),
      emoji: JobIcon[Job.Striker],
    },
    {
      label: JobName.Thief,
      value: Job.Thief.toString(),
      emoji: JobIcon[Job.Thief],
    },
    {
      label: JobName.Assassin,
      value: Job.Assassin.toString(),
      emoji: JobIcon[Job.Assassin],
    },
    {
      label: JobName.Wizard,
      value: Job.Wizard.toString(),
      emoji: JobIcon[Job.Wizard],
    },
    {
      label: JobName.Priest,
      value: Job.Priest.toString(),
      emoji: JobIcon[Job.Priest],
    },
    {
      label: JobName.Beginner,
      value: Job.Beginner.toString(),
      emoji: JobIcon[Job.Beginner],
    },
    {
      label: JobName.HeavyGunner,
      value: Job.HeavyGunner.toString(),
      emoji: JobIcon[Job.HeavyGunner],
    },
  ]

  public runPolicy = CommandPolicy.All

  public slash = new SlashCommandBuilder()
    .setName("크명")
    .setDescription("캐릭터의 크리티컬 확률을 구해줍니다.")
    // 직업
    .addStringOption(option => {
      const selection = Object.entries(JobNameMap).map((v) => {
        const [key, name] = v
        if (name === JobName.UNKNOWN) {
          return {
            name: "",
            value: "",
          }
        }
        return {
          name,
          value: key,
        }
      }).filter((v) => v.name.length > 0).sort((a, b) => a.name.localeCompare(b.name))
      return option.setName(CritRateCommand.JOB)
        .setDescription("캐릭터의 직업")
        .setRequired(true)
        .addChoices(...selection)
    })
    // 크명
    .addNumberOption(option =>
      option.setName(CritRateCommand.CRITRATE)
        .setDescription("캐릭터의 크리티컬 명중")
        .setRequired(true))
    // LUK
    .addNumberOption(option =>
      option.setName(CritRateCommand.LUK)
        .setDescription("캐릭터의 LUK")
        .setRequired(true)
    )

  public async execute(interaction: CommandInteraction) {
    // 파라메터들
    const critRate = getCommandParam<number>(interaction, CritRateCommand.CRITRATE, 0)
    const luk = getCommandParam<number>(interaction, CritRateCommand.LUK, 0)
    const job = getCommandParam<number>(interaction, CritRateCommand.JOB, Job.UNKNOWN) as Job


    const addField = (modifyEmbed: EmbedBuilder, dungeonname: string, criteva: number) => {
      const fieldCritRate = calcCritRate({ critRate, luk, job }, { criteva }) * 100
      const critRateStr = fieldCritRate.toFixed(2)
      const maxCritAcc = calcMaxCritRate({ luk, job }, { criteva })

      modifyEmbed.addFields({
        name: dungeonname,
        value: `**${critRateStr}**% (한계 크명 **${maxCritAcc}**)`,
        inline: false,
      })
    }

    // EMBED 생성
    const embed = makeResponseEmbed({
      title: ":crossed_swords: 크리티컬 확률",
      description: [
        `크리티컬 명중: ${critRate}`,
        `LUK: ${luk}`,
        `직업: ${JobIcon[job]} ${JobNameMap[job]}`,
        `[자세히 보기](${accChartURL})`,
      ].join("\n"),
      author: interaction.user,
      authorMember: interaction.member,
    })

    // 크리티컬 확률 적기
    addField(embed, "허수아비", 50)
    addField(embed, "환영 던전", 70)
    addField(embed, "60제 던전/로사", 90)
    addField(embed, "블챔/70쿰페/티마이온", 100)

    await interaction.reply({
      embeds: [embed],
    })
  }
}