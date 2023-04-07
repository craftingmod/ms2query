import { CommandInteraction, CacheType, SlashCommandBuilder } from "discord.js";
import { BotBase, BotState } from "../BotBase.js";
import { CommandPolicy, DaemonCommand, SubCommandExecutors, UserInteraction } from "../Command.js";
import { getCommandParam, replyNoOwner, replyNoPerm } from "../CommandTools.js";

const checkMark = ":white_check_mark:"

export class AdminCommand extends DaemonCommand<BotBase> {
  public runPolicy = CommandPolicy.DM
  public slash = new SlashCommandBuilder()
    .setName("admin")
    .setDescription("봇 관리자용 명령어 입니다.")
    .addSubcommand(subcommand =>
      subcommand.setName(SubCommand.Activity)
        .setDescription("[봇 관리자] 상태 메시지를 변경합니다.")
        .addStringOption(option => option
          .setName(SubCommandValue.Message)
          .setDescription("바꿀 상태 메시지 입니다.")
          .setRequired(true)
        )
        .addStringOption(option => option
          .setName(SubCommandValue.State)
          .setDescription("봇의 상태 입니다.")
          .addChoices({
            name: "온라인",
            value: "online",
          }, {
            name: "자리 비움",
            value: "idle",
          }, {
            name: "다른 용무 중",
            value: "dnd",
          }, {
            name: "오프라인",
            value: "invisible",
          })
          .setRequired(false)
        )
    )
    .addSubcommand(subcommand =>
      subcommand.setName(SubCommand.Slash)
        .setDescription("[봇 관리자] 슬래시 명령어를 변경합니다.")
        .addStringOption(option =>
          option.setName("종류")
            .setDescription("업데이트 할 종류를 선택합니다.")
            .addChoices({
              name: "길드",
              value: "guild",
            }, {
              name: "글로벌",
              value: "global",
            })
            .setRequired(true)
        )
        .addBooleanOption(option =>
          option.setName("디버그")
            .setDescription("디버그 용도인지 확인합니다.")
            .setRequired(false)
        )
    )
  public override interactions = {}
  public override executors: SubCommandExecutors = {
    // now playing 바꾸기
    [SubCommand.Activity]: async (interaction: CommandInteraction) => {
      // 권한 확인
      if (interaction.user.id !== this.bot.globalConfig.adminUserId) {
        await replyNoPerm(interaction)
        return
      }
      // 파라메터 가져오기
      const activityParam = getCommandParam<string>(interaction, SubCommandValue.Message, "")
      const stateParam = getCommandParam<string>(interaction, SubCommandValue.State, "")
      // 액티비티 바꾸기
      await this.bot.setActivity(activityParam)
      // 상태 바꾸기
      if (stateParam.length > 0) {
        this.bot.setState(stateParam as BotState)
      }
      // 알림
      await interaction.reply({
        content: `${checkMark} 상태 메시지가 \`${activityParam}\`(으)로 변경되었습니다.`,
      })
    },
    // 슬래시 명령어 업데이트 하기
    [SubCommand.Slash]: async (interaction: CommandInteraction) => {
      // 권한 확인
      if (interaction.user.id !== this.bot.globalConfig.adminUserId) {
        await replyNoPerm(interaction)
        return
      }
      // 파라메터 가져오기
      const isDebug = getCommandParam(interaction, "디버그", false)
      const typeParam = getCommandParam<string>(interaction, "종류", "guild")
      if (typeParam === "guild") {
        // 길드 명령어 업데이트
        if (interaction.guild != null) {
          await this.bot.registerInteractionsGuild(interaction.guild, isDebug)
          await interaction.reply({
            content: `${checkMark} 명령어(길드)가 업데이트 되었습니다.`,
          })
          return
        }
        await interaction.reply({
          content: `${checkMark} 명령어(길드) 업데이트는 길드 내에서만 가능합니다.`,
        })
      } else {
        await this.bot.registerInteractionsGlobal(isDebug)
        await interaction.reply({
          content: `${checkMark} 명령어(글로벌)가 업데이트 되었습니다.`,
        })
      }
    }
  }

  public async execute(interaction: CommandInteraction) {
    await interaction.reply({
      content: JSON.stringify(interaction.options.data, null, 2),
    })
  }

}

enum SubCommand {
  Activity = "activity",
  Slash = "slash",
}

enum SubCommandValue {
  Message = "message",
  Modify = "modify",
  State = "state",
}