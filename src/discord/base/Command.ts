import type { BaseMessageOptions, ChatInputCommandInteraction, Interaction, RESTPostAPIApplicationCommandsJSONBody, SlashCommandBuilder, SlashCommandOptionsOnlyBuilder, SlashCommandSubcommandBuilder, SlashCommandSubcommandGroupBuilder, SlashCommandSubcommandsOnlyBuilder } from "discord.js"


/**
 * Bot 인스턴스와 독립된 명령어 인터페이스
 */
export interface Command {
  /**
   * 메세지 응답을 강제로 미룰 지 여부
   */
  defer?: boolean,
  /**
   * 바인딩 된 슬래시 명령어
   * @todo 타입 좀 제대로 바꾸기
   */
  slash: SlashCommandBuilder | SlashCommandOptionsOnlyBuilder,
  /**
   * 위의 슬래시 명령어를 실행 시 실행될 함수
   * @param interaction 인터렉션
   */
  execute: (interaction: ChatInputCommandInteraction) => Promise<string | BaseMessageOptions | null>
  /**
   * 채팅 명령어는 아니고 기타 인터렉션 (수동 구현 필요)
   * @param interaction 인터렉션
   */
  rawExecute?: (interaction: Interaction) => Promise<unknown>
}