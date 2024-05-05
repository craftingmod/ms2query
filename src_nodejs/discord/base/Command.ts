import { SlashCommandBuilder, SlashCommandSubcommandBuilder, type SlashCommandOptionsOnlyBuilder, type SlashCommandSubcommandsOnlyBuilder, EmbedBuilder, type CacheType, Client, CommandInteraction, type Interaction, AttachmentBuilder, ButtonInteraction, StringSelectMenuInteraction } from "discord.js"
import type { RESTPostAPIApplicationCommandsJSONBody } from "discord.js"

import type { BotState } from "./BotBase.ts"

export type UserInteraction = StringSelectMenuInteraction | ButtonInteraction

export type SubCommandExecutors = { [key: string]: (interaction: CommandInteraction) => Promise<void> }

export type InteractionExecutors = { [key: string]: (interaction: UserInteraction, params: Record<string, string>) => Promise<void> }

export enum CommandPolicy {
  DM,
  Guild,
  All,
}

/**
 * Bot 인스턴스와 독립된 명령어 인터페이스
 */
export interface Command {
  /**
   * 커맨드 명렁어 실행 가능한 곳
   */
  runPolicy: CommandPolicy
  /**
   * 바인딩 된 슬래시 명령어
   */
  slash: { toJSON(): RESTPostAPIApplicationCommandsJSONBody, name: string }
  /**
   * 위의 슬래시 명령어를 실행 시 실행될 함수
   * @param interaction 
   */
  execute(interaction: CommandInteraction): Promise<void>
  /**
   * 슬래시 명령어 중 서브커맨드 실행을 모아둔 함수
   */
  executors?: SubCommandExecutors

  /**
   * 사용자 인터렉션 처리 함수 모음
   */
  interactions?: InteractionExecutors
}

/**
 * Bot 인스턴스랑 같이 바인딩되는 명령어 객체
 */
export abstract class DaemonCommand<T> implements Command {
  public abstract readonly runPolicy: CommandPolicy
  public abstract readonly slash: { toJSON(): RESTPostAPIApplicationCommandsJSONBody, name: string }
  public readonly executors: SubCommandExecutors = {}

  public readonly interactions: InteractionExecutors = {}

  public abstract execute(interaction: CommandInteraction): Promise<void>

  public constructor(protected bot: T) {

  }
  /**
   * 봇 초기화 후에 실행
   * 정말 중요한거 아니면 onStateChange 활용
   */
  public onLogin(): Promise<unknown> {
    return Promise.resolve()
  }
  /**
   * 봇의 Online 상태 변경 시 실행
   * @param isOnline 봇이 온라인 인가
   */
  public onStateChange(state: BotState): Promise<unknown> {
    return Promise.resolve()
  }
  /**
   * 봇이 완전히 종료될 때 실행
   * 정말 중요한거 아니면 onStateChange 활용
   */
  public onLogout(): Promise<unknown> {
    return Promise.resolve()
  }
}