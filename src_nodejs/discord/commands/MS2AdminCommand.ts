import { CommandInteraction } from "discord.js"

import { AdminCommand } from "../base/command/AdminCommand.ts"
import { getCommandParam, makeResponseEmbed } from "../base/CommandTools.ts"
import { MS2QueryBot } from "../MS2QueryBot.ts"

export class MS2AdminCommand extends AdminCommand {
  public override readonly bot: MS2QueryBot
  constructor(bot: MS2QueryBot) {
    super(bot)
    this.bot = bot
    // 방명록 커맨드 추가
    this.slash.addSubcommand(subcommand =>
      subcommand.setName(ActionType.GuestbookToken)
        .setDescription("방명록 토큰을 설정합니다.")
        .addStringOption(option => option
          .setName("token")
          .setDescription("방명록 조회에 사용하는 토큰입니다.")
          .setRequired(true)
        )
    )

    // 방명록 커맨드 처리
    this.executors[ActionType.GuestbookToken] = async (interaction: CommandInteraction) => {
      const token = getCommandParam<string>(interaction, "token", "guestbookToken")
      this.bot.setConfig({ guestbookToken: token })

      await interaction.reply({
        embeds: [makeResponseEmbed({
          title: "방명록 토큰 저장",
          description: "저장되었습니다.",
          author: interaction.user,
          authorMember: interaction.member,
        })]
      })

    }
  }
}

enum ActionType {
  GuestbookToken = "guestbooktoken",
}