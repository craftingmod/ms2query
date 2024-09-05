import type { ChatInputCommandInteraction, CommandInteraction, SlashCommandBuilder } from "discord.js"

/**
 * Bot 인스턴스와 독립된 명령어 인터페이스
 */
export interface Command {
  /**
   * 바인딩 된 슬래시 명령어
   */
  slash: SlashCommandBuilder
  /**
   * 위의 슬래시 명령어를 실행 시 실행될 함수
   * @param interaction 
   */
  execute(interaction: ChatInputCommandInteraction): Promise<unknown>
}