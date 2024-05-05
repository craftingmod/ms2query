import { SlashCommandBuilder, type RESTPostAPIApplicationCommandsJSONBody, type CommandInteraction } from "discord.js"

import type { MS2QueryBot } from "../MS2QueryBot.ts"
import { CommandPolicy, DaemonCommand, type SubCommandExecutors } from "../base/Command.ts"
import { getCommandParam, replyError } from "../base/CommandTools.ts"
import { fetchTrophyCount, verifyNickname } from "../../ms2/ms2fetch.ts"

export class SearchCommand extends DaemonCommand<MS2QueryBot> {
  protected readonly ms2db = this.bot.ms2db
  protected readonly botdb = this.bot.botdb

  public override runPolicy = CommandPolicy.Guild // 길드에서만 사용 가능하게 강제

  public override slash = new SlashCommandBuilder()
    .setName("검색")
    .setDescription("메이플스토리2 관련 정보를 검색합니다.")
    // 캐릭터 조회
    .addSubcommand(subcommand =>
      subcommand.setName(SubType.Character)
        .setDescription("특정 캐릭터의 정보를 조회합니다.")
        .addStringOption(option =>
          option.setName(Param.Name)
            .setDescription("조회할 캐릭터의 이름")
            .setRequired(true)
        )
    )

  public override executors = {
    // 캐릭터 검사
    [SubType.Character]: async (interaction: CommandInteraction) => {
      // 이름 가져오기
      const characterName = getCommandParam<string>(interaction, Param.Name, "")
      // 이름 유효성 체크
      if (!verifyNickname(characterName)) {
        // 유효한 이름이 아니면
        await replyError(interaction, "유효한 캐릭터 이름이 아닙니다.")
        return
      }
      // 응답 늦추기
      await interaction.deferReply()
      // 캐릭터 CID 가져오기
      const characterId = await fetchTrophyCount(characterName)
      if (characterId == null) {
        // 일단은 오류 반환
        await replyError(interaction, "(임시) 캐릭터 정보를 찾을 수 없습니다.")
        return
      }
      const characterInfoDB = this.ms2db.queryCharacterById(characterId.characterId)
      if (characterInfoDB == null) {
        // DB에 없을 때 처리
        await replyError(interaction, "(임시) 캐릭터 정보를 DB에서 찾을 수 없습니다.")
        return
      }
      await interaction.editReply({
        content: `CID: ${characterId.characterId}, AID: ${characterInfoDB.accountId}`,
      })
    }
  }

  public override async execute(interaction: CommandInteraction) {
    // nothing
  }
}

enum SubType {
  Character = "캐릭터",
}
enum Param {
  Name = "이름",
}