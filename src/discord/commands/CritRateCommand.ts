import { ActionRowBuilder, CacheType, CommandInteraction, Embed, EmbedBuilder, Interaction, MessageSelectOption, SelectMenuBuilder } from "discord.js"
import type { BotInit } from "../botinit.js"
import type { Command } from "../command.js"
import { CommandTools } from "../command.js"
import { SlashCommandBuilder } from "discord.js"

import { JobName, Job, JobNameMap, CritCoef } from "../../ms2/charinfo.js"
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

  public slash = new SlashCommandBuilder()
    .setName("크리확률")
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

  public async execute(interaction: CommandInteraction<CacheType>, bot: BotInit, tool: CommandTools) {
    const critRate = CommandTools.parseNumber(
      interaction.options.get(CritRateCommand.CRITRATE)?.value, 0)
    const luk = CommandTools.parseNumber(
      interaction.options.get(CritRateCommand.LUK)?.value, 0)
    const job = CommandTools.parseNumber(interaction.options.get(CritRateCommand.JOB)?.value, Job.UNKNOWN) as Job

    const addField = (modifyEmbed: EmbedBuilder, dungeonname: string, criteva: number) => {
      const fieldCritRate = this.getCritRate(criteva, critRate, luk, job) * 100
      const critRateStr = fieldCritRate.toFixed(2)
      const maxCritAcc = this.getMaxCritRate(criteva, luk, job)

      modifyEmbed.addFields({
        name: dungeonname,
        value: `**${critRateStr}**% (최대 크명 **${maxCritAcc}**)`,
        inline: false,
      })
    }

    // embed
    const embed = new EmbedBuilder()
      .setColor(CommandTools.COLOR_INFO)
      .setTitle(":crossed_swords: 크리티컬 확률")
      .setAuthor(tool.retrieveAuthor())
      .setDescription(`크리티컬 명중: ${critRate}\nLUK: ${luk}\n직업: ${JobIcon[job]} ${JobNameMap[job]}`)

    addField(embed, "환영 던전", 70)
    addField(embed, "60제 던전 / 로사", 90)
    addField(embed, "블챔/70쿰페/티마이온", 100)

    // select menu
    /*
    const row = new ActionRowBuilder<SelectMenuBuilder>()
      .addComponents(
        new SelectMenuBuilder()
          .setCustomId(CommandTools.createCustomId("critrate-job-selection", interaction.user.id))
          .setPlaceholder("직업을 선택해주세요.")
          .addOptions(CritRateCommand.JOB_SELECTION) 
      )
    */

    await interaction.reply({
      embeds: [embed],
    })
  }
  public async executeRaw(interaction: Interaction<CacheType>, bot: BotInit) {
    if (interaction.isSelectMenu()) {
      const { tag, userid } = CommandTools.parseCustomId(interaction.customId)
      if (tag === "critrate-job-selection") {
        if (userid === interaction.user.id) {
          const orgEmbed = interaction.message.embeds[0]
          if (orgEmbed == null) {
            return true
          }
          const modifyEmbed = new EmbedBuilder(orgEmbed.data)
          const jobIndex = Number.parseInt(interaction.values[0]!!) as Job
          const critrate = Number.parseInt(orgEmbed.fields[0]?.value ?? "0")
          const luk = Number.parseInt(orgEmbed.fields[1]?.value ?? "0")

          modifyEmbed.spliceFields(0, orgEmbed.fields.length)
          modifyEmbed.setDescription(`크리티컬 명중: ${critrate}\nLUK: ${luk}\n직업: ${JobIcon[jobIndex]} ${JobNameMap[jobIndex]}`)

          const addField = (dungeonname: string, criteva: number) => {
            const critRate = this.getCritRate(criteva, critrate, luk, jobIndex) * 100
            const critRateStr = critRate.toFixed(2)
            const maxCritAcc = this.getMaxCritRate(criteva, luk, jobIndex)

            modifyEmbed.addFields({
              name: dungeonname,
              value: `**${critRateStr}**% (최대 크명 **${maxCritAcc}**)`,
              inline: false,
            })
          }

          addField("환영 던전", 70)
          addField("60제 던전 / 로사", 90)
          addField("블챔/70쿰페/티마이온", 100)

          modifyEmbed.setTitle(`크리티컬 확률`)
          await interaction.update({
            embeds: [modifyEmbed],
            components: [],
          })
        } else {
          await interaction.reply({
            embeds: [CommandTools.makeErrorMessage("선택권은 메시지 주인에게만 있어요!")],
            ephemeral: true,
          })
        }
        return false
      }
    }
    return true
  }
  private getCritRate(criteva: number, critrate: number, luk: number, job: Job) {
    return Math.min(0.4, (5.3 * critrate + luk * CritCoef[job]) / (2 * criteva) * 0.015)
  }
  private getMaxCritRate(criteva: number, luk: number, job: Job) {
    return Math.ceil(((1000 * 0.4 / 15) * (2 * criteva) - luk * CritCoef[job]) / 5.3)
  }
}