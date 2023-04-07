import { ActionRowBuilder, AttachmentBuilder, ButtonBuilder, ButtonStyle, CacheType, Client, CommandInteraction, Embed, EmbedBuilder, Interaction, MessageSelectOption, SelectMenuBuilder } from "discord.js"
import type { BotInit } from "../botbase.js"
import type { Command } from "../Command.js"
import * as CommandTools from "../CommandTools.js"
import { SlashCommandBuilder } from "discord.js"

export class MinigameCommand implements Command {
  public slash = new SlashCommandBuilder()
    .setName("미니게임")
    .setDescription("다음에 나올 미니게임을 보여줍니다.")

  public async execute(interaction: CommandInteraction<CacheType>, bot: BotInit, tool: CommandTools) {
    const date = await CommandTools.getCurrentTime()

    const embed = this.getKayEmbed(date.getHours(), date.getMinutes())

    const row = this.createController(interaction.user.id)

    await interaction.reply({
      embeds: [embed],
      components: [row],
    })
  }
  public async executeRaw(interaction: Interaction<CacheType>, bot: BotInit) {
    if (interaction.isButton()) {
      const { tag, userid } = CommandTools.parseCustomId(interaction.customId)

      if (!tag.startsWith("minigame")) {
        return true
      }

      if (userid !== interaction.user.id) {
        await interaction.reply({
          embeds: [CommandTools.makeErrorMessage("선택권은 메시지 주인에게만 있어요!")],
          ephemeral: true,
        })
        return true
      }
      const timeField = interaction.message.embeds[0]?.fields?.[3]?.value ?? "0:5"
      const time = timeField.split(":").map((v) => Number.parseInt(v))
      if (tag === "minigame-show-prev") {
        if (time[1]!! >= 30) {
          time[1] -= 30
        } else {
          time[1] += 30
          if (time[0]!! <= 0) {
            time[0] = 23
          } else {
            time[0] -= 1
          }
        }
      } else if (tag === "minigame-show-next") {
        if (time[1]!! >= 30) {
          time[1] -= 30
          if (time[0]!! >= 23) {
            time[0] = 0
          } else {
            time[0] += 1
          }
        } else {
          time[1] += 30
        }
      } else {
        return true
      }
      const row = this.createController(interaction.user.id)
      await interaction.update({
        embeds: [this.getKayEmbed(time[0]!!, time[1]!!)],
        components: [row],
      })
      return false
    }
    return true
  }

  protected createController(userid: string) {
    const row = new ActionRowBuilder<ButtonBuilder>()
      .addComponents(
        new ButtonBuilder()
          .setCustomId(CommandTools.buildCustomId(Action.ShowPrev, { sender: userid }))
          .setLabel("◀️")
          .setStyle(ButtonStyle.Primary),
        new ButtonBuilder()
          .setCustomId(CommandTools.buildCustomId(Action.ShowNext, { sender: userid }))
          .setLabel("▶️")
          .setStyle(ButtonStyle.Primary)
      )
    return row
  }

  protected getKayEmbed(hour: number, minute: number) {
    const { hour: ghour, minute: gminute, games } = this.getKayEvent(hour, minute)
    const [game1, game2, game3] = games

    const hour12 = (ghour % 12 === 0) ? 12 : ghour % 12

    const embed = new EmbedBuilder()
      .setTitle(`${ghour >= 12 ? "오후" : "오전"} ${hour12.toString().padStart(2, "0")}시 ${gminute.toString().padStart(2, "0")}분에 나올 미니게임`)
      .setColor(CommandTools.COLOR_INFO)
      .addFields({
        name: "첫번째 미니게임",
        value: game1 ?? "-",
        inline: false,
      }, {
        name: "두번째 미니게임",
        value: game2 ?? "-",
        inline: false,
      }, {
        name: "PvP",
        value: game3 ?? "-",
        inline: false,
      }, {
        name: "시각",
        value: `${ghour.toString().padStart(2, "0")}:${gminute.toString().padStart(2, "0")}`,
        inline: false,
      })
    return embed
  }

  protected getKayEvent(hour: number, minute: number) {
    if (minute >= 36) {
      if (hour >= 23) {
        hour = 0
      } else {
        hour += 1
      }
      minute = 5
    } else if (minute <= 4) {
      minute = 5
    } else if (minute >= 6 && minute <= 34) {
      minute = 35
    }
    const out = {
      hour,
      minute,
      games: [Minigame.OXQuiz, Minigame.LudibriumEscape, Minigame.TreasureHunt],
    }
    hour %= 3
    if ((hour === 0 && minute === 5) || (hour === 1 && minute === 35)) {
      out.games = [Minigame.OXQuiz, Minigame.LudibriumEscape, Minigame.TreasureHunt]
    } else if ((hour === 0 && minute === 35) || (hour === 2 && minute === 5)) {
      out.games = [Minigame.CrazyRunners, Minigame.SpringBeach, Minigame.BloodyMiner]
    } else if (hour === 1 && minute === 5) {
      out.games = [Minigame.DanceDanceStop, Minigame.TrapMaster, Minigame.RedColosseum]
    } else if (hour === 2 && minute === 35) {
      out.games = [Minigame.DanceDanceStop, Minigame.FinalSurvival, Minigame.RedColosseum]
    }
    return out
  }
}

enum Minigame {
  OXQuiz = "메이플 OX 퀴즈쇼",
  LudibriumEscape = "루디브리엄 대탈출",
  TreasureHunt = "바르보사의 보물섬",
  CrazyRunners = "크레이지 러너즈",
  SpringBeach = "스프링 비치",
  DanceDanceStop = "댄스댄스스탑",
  TrapMaster = "트랩 마스터",
  FinalSurvival = "파이널 서바이버",
  RedColosseum = "붉은 결투장",
  BloodyMiner = "피눈물 광산",
}

enum Action {
  ShowPrev = "minigame-show-prev",
  ShowNext = "minigame-show-next",
}