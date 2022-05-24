import { SlashCommandBuilder } from "@discordjs/builders"
import { debug } from "console"
import { CacheType, CommandInteraction, MessageEmbed, MessageActionRow, MessageSelectMenu, MessageSelectOptionData, Interaction } from "discord.js"
import { JobName, Job, JobNameMap, CritCoef } from "../../ms2/charinfo.mjs"
import { BotInit } from "../botinit.mjs"
import { Command, CommandTools } from "../command.mjs"
import { JobIcon } from "../jobicon.mjs"

export class CritRateCmd implements Command {
  public static readonly CRITRATE = "critrate"
  public static readonly LUK = "luk"
  public static readonly JOB_SELECTION: MessageSelectOptionData[] = [
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
    .setName("crit")
    .setDescription("크리티컬 확률을 구해줍니다.")
    // 크명
    .addNumberOption(option => option.setName(CritRateCmd.CRITRATE).setDescription("캐릭터의 크리티컬 명중").setRequired
      (true))
    // LUK
    .addNumberOption(option => option.setName(CritRateCmd.LUK).setDescription("캐릭터의 LUK").setRequired(true))

  public async execute(interaction: CommandInteraction<CacheType>, bot: BotInit) {
    const critRate = interaction.options.getNumber(CritRateCmd.CRITRATE) ?? 0
    const luk = interaction.options.getNumber(CritRateCmd.LUK) ?? 0

    // embed 
    const embed = new MessageEmbed()
      .setColor(CommandTools.COLOR_INFO)
      .setTitle("크리티컬 확률 계산")
      .setAuthor({ name: interaction.user.username ?? "", iconURL: interaction.user.avatarURL() ?? "" })
      .setDescription("직업을 선택해 주세요.")
      .addField("크리티컬 명중", critRate.toString(), true)
      .addField("LUK", luk.toString(), true)

    // select menu
    const row = new MessageActionRow()
      .addComponents(
        new MessageSelectMenu()
          .setCustomId(CommandTools.createCustomId("critrate-job-selection", interaction.user.id))
          .setPlaceholder("직업을 선택해주세요.")
          .addOptions(CritRateCmd.JOB_SELECTION)
      )

    await interaction.reply({
      embeds: [embed],
      components: [row],
    })
  }
  public async executeRaw(interaction: Interaction<CacheType>, bot: BotInit) {
    if (interaction.isSelectMenu()) {
      const { tag, userid } = CommandTools.parseCustomId(interaction.customId)
      if (tag === "critrate-job-selection") {
        if (userid === interaction.user.id) {
          const modifyEmbed = new MessageEmbed(interaction.message.embeds[0])
          const jobIndex = Number.parseInt(interaction.values[0]) as Job
          const critrate = Number.parseInt(modifyEmbed.fields[0].value)
          const luk = Number.parseInt(modifyEmbed.fields[1].value)

          modifyEmbed.spliceFields(0, modifyEmbed.fields.length)
          modifyEmbed.setDescription(`크리티컬 명중: ${critrate}\nLUK: ${luk}\n직업: ${JobIcon[jobIndex]} ${JobNameMap[jobIndex]}`)

          const addField = (dungeonname: string, criteva: number) => {
            modifyEmbed.addField(dungeonname, `**${(this.getCritRate(criteva, critrate, luk, jobIndex) * 100).toFixed(2)
              }**% (최대 크명 **${this.getMaxCritRate(criteva, luk, jobIndex)
              }**)`, false)
          }

          addField("환영 던전", 70)
          addField("60제 던전", 90)
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