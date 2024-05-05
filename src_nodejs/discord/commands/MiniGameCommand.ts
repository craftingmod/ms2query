import { CommandInteraction, SlashCommandBuilder, User, GuildMember, type APIInteractionGuildMember, ButtonBuilder, ActionRowBuilder, ButtonStyle } from "discord.js";

import { type Command, CommandPolicy, type InteractionExecutors } from "../base/Command.ts"
import { buildCustomId, get12HourTime, getCurrentTimeForce, makeResponseEmbed } from "../base/CommandTools.ts"

const oneDayMinute = 60 * 24

export class MiniGameCommand implements Command {
  public runPolicy = CommandPolicy.All
  public slash = new SlashCommandBuilder()
    .setName("미니게임")
    .setDescription("다음에 나올 미니게임을 보여줍니다.")

  public interactions: InteractionExecutors = {
    [Action.ShowClock]: async (interaction, params) => {
      const targetTime = Number(params["time"])
      // embed 생성
      const { embed, kayTime } = this.getKayEmbed(targetTime, { user: interaction.user, member: interaction.member })
      // row 똑같이 생성
      const row = this.createController(interaction.user.id, kayTime)
      // 수정
      await interaction.update({
        embeds: [embed],
        components: [row],
      })
    },
  }

  public async execute(interaction: CommandInteraction) {
    const date = await getCurrentTimeForce()

    // 케이 이벤트 Embed 불러오기
    const { embed, kayTime } = this.getKayEmbed(date.getHours() * 60 + date.getMinutes(), { user: interaction.user, member: interaction.member })

    const row = this.createController(interaction.user.id, kayTime)

    await interaction.reply({
      embeds: [embed],
      components: [row],
    })
  }

  protected createController(userid: string, targetTime: number) {
    const prevTime = (targetTime + oneDayMinute - 30) % oneDayMinute
    const nextTime = (targetTime + 30) % oneDayMinute
    const row = new ActionRowBuilder<ButtonBuilder>()
      .addComponents(
        new ButtonBuilder()
          .setCustomId(buildCustomId(Action.ShowClock, { sender: userid, time: prevTime.toString() }))
          .setLabel("◀️")
          .setStyle(ButtonStyle.Primary),
        new ButtonBuilder()
          .setCustomId(buildCustomId(Action.ShowClock, { sender: userid, time: nextTime.toString() }))
          .setLabel("▶️")
          .setStyle(ButtonStyle.Primary)
      )
    return row
  }

  /**
   * 특정 시간의 케이 이벤트 Embed 정보를 가져옵니다.
   * @param hour 시간
   * @param minute 분
   * @returns 케이 이벤트 정보 Embed
   */
  protected getKayEmbed(minutesOfDay: number, user: { user: User, member?: GuildMember | APIInteractionGuildMember | null }) {
    // 케이 이벤트불러오기
    const kayEvent = this.getKayEvent(minutesOfDay)
    const [game1, game2, game3] = kayEvent.games
    // 현재 시각
    const hour = Math.floor(minutesOfDay / 60)
    const minute = minutesOfDay % 60
    const targetTime = get12HourTime(hour, minute)

    const embed = makeResponseEmbed({
      title: `🎲 미니게임 정보`,
      description: `열리는 시각: **${get12HourTime(kayEvent.hour, kayEvent.minute)}**`,
      author: user.user,
      authorMember: user.member ?? null,
    })

    embed.addFields({
      name: "🥇 첫번째 미니게임",
      value: game1 ?? "-",
      inline: false,
    }, {
      name: "🥈 두번째 미니게임",
      value: game2 ?? "-",
      inline: false,
    }, {
      name: "⚔️ PvP",
      value: game3 ?? "-",
      inline: false,
    })
    return {
      embed,
      kayTime: kayEvent.hour * 60 + kayEvent.minute,
    }
  }

  /**
   * 케이 이벤트 목록 불러오기
   * @param minutesOfDay 24시간 단위로 몇분 지났나
   * @returns 케이 이벤트 정보
   */
  protected getKayEvent(minutesOfDay: number) {
    minutesOfDay %= 60 * 24 // 24시간 단위로 자르기

    let hour = Math.floor(minutesOfDay / 60)
    let minute = minutesOfDay % 60

    if (minute >= 36) {
      hour += 1
      minute = 5
    } else if (minute <= 4) {
      minute = 5
    } else if (minute >= 6 && minute <= 34) {
      minute = 35
    }

    const out = {
      hour: hour % 24,
      minute,
      games: [Minigame.OXQuiz, Minigame.LudibriumEscape, Minigame.TreasureHunt] as [Minigame, Minigame, Minigame],
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
  ShowClock = "minigame-show-clock",
}