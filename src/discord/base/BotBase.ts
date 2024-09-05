import { Client, Collection, Events, GatewayIntentBits, TextChannel, REST, Routes } from "discord.js"
import type { RESTPostAPIChatInputApplicationCommandsJSONBody } from "discord.js"
import { type BaseConfig } from "./BaseConfig"
import { readJSON } from "./BaseUtil"
import Path from "node:path"
import { Logger } from "../../logger/Logger"
import { newQueue } from "@henrygd/queue"
import type { Command } from "./Command"
import fs from "node:fs/promises"

const Log = new Logger({
  tag: "BotBase",
  showFnName: false,
})


export abstract class BotBase<C extends BaseConfig> {
  /**
   * Discord.js 클라이언트 (내부용)
   */
  protected readonly client: Client<boolean>
  /**
   * Discord.js 클라이언트 (외부용)
   */
  public readyClient!: Client<true>
  /**
   * Discord REST API 접근용
   */
  protected rest: REST = new REST()
  /**
   * 간단한 전체 공유 설정
   */
  protected abstract globalConfig: C

  /**
   * 설정 경로
   */
  protected abstract readonly configPath: string

  /**
   * 커맨드 큐
   */
  protected readonly commandQueue = newQueue(2)

  /**
   * 커맨드 목록
   */
  protected readonly commands = new Collection<string, Command>()


  /**
   * Client의 GatewayIntentBits
   */
  protected readonly intentPerms = [GatewayIntentBits.Guilds]

  public constructor() {
    // 클라이언트 초기화
    this.client = new Client({
      intents: this.intentPerms,
    })
    this.registerEvents()
  }
  /**
   * 내부이벤트 등록용
   */
  private registerEvents() {

    // Ready
    this.client.once(Events.ClientReady, async (readyClient) => {
      this.readyClient = readyClient
      // onReady 실행 (명령어 추가 등...?)
      await this.onReady()
      // 명령어 Dev Guild에 등록
      await this.registerDevCommand()
    })

    // 명령어 인터렉션 생성
    this.client.on(Events.InteractionCreate, async (interaction) => {

      if (!interaction.isChatInputCommand()) {
        return
      }

      const command = this.commands.get(interaction.commandName)
      // 커맨드 없으면 생략
      if (command === undefined) {
        return
      }

      // 일단 Defer
      await interaction.deferReply()

      // 커맨드 큐에 추가
      this.commandQueue.add(async () => {
        try {
          await command.execute(interaction)
        } catch (error) {
          Log.error(error)
          if (interaction.replied || interaction.deferred) {
            await interaction.followUp({
              content: "There was an error while executing this command!",
              ephemeral: true,
            })
          } else {
            await interaction.reply({
              content: "There was an error while executing this command!",
              ephemeral: true,
            })
          }
        }
      })
    })
  }

  /**
   * 디스코드에 로그인
   */
  public async connect() {
    this.globalConfig = await readJSON(this.configPath, this.globalConfig)
    // 직접 설정해줘야 하는 값 검사
    const nonBlank = [this.globalConfig.token, this.globalConfig.clientId, this.globalConfig.devGuildId]
    if (nonBlank.find((v) => v.length <= 0) !== undefined) {
      throw new Error(`\"${this.configPath}\" 설정을 완료하여야 합니다!`)
    }
    // 로그인 (REST, Client)
    this.rest.setToken(this.globalConfig.token)
    await this.client.login(this.globalConfig.token)
  }

  /**
   * ready 이벤트시 호출
   */
  protected async onReady() {
    Log.verbose(`Ready! Logged in as ${this.readyClient.user.tag}`)

  }

  /**
   * Dev 서버에 커맨드 등록
   */
  protected async registerDevCommand() {
    try {
      Log.verbose(`${this.commands.size}개의 명령어를 등록 중입니다.`)
      // 명령어 JSON 형태로 가공
      const restCommands: RESTPostAPIChatInputApplicationCommandsJSONBody[] = []
      for (const command of this.commands.values()) {
        restCommands.push(command.slash.toJSON())
      }

      // Discord 서버에 등록
      const data = await this.rest.put(
        Routes.applicationGuildCommands(
          this.globalConfig.clientId,
          this.globalConfig.devGuildId,
        ), {
        body: restCommands,
      }) as { length: number }
      Log.verbose(`${data.length}개의 명령어를 등록 완료했습니다.`)
    } catch (error) {
      Log.error(error)
    }
  }

  /**
   * 디스코드 특정 채널에 메세지 로깅
   * @param msg 로깅할 메세지
   * @returns X
   */
  public async logToChannel(msg: unknown) {
    const channelId = this.globalConfig.logChannel
    if (channelId.length <= 0) {
      Log.verbose(msg)
      return
    }
    const channel = this.client.channels.cache.get(channelId)
    if (channel == null || !(channel instanceof TextChannel)) {
      Log.verbose(msg)
      return
    }
    const msgStr = String(msg)
    // 스택 정리
    let stackTrace = (new Error()).stack ?? ""
    if (stackTrace.length > 0) {
      const stacks = stackTrace.split("\n")
      stacks.splice(0, 4)
      let delIndex = 0
      while (
        delIndex < stacks.length &&
        stacks[delIndex++].indexOf("node:events") < 0) {
      }
      stacks.splice(delIndex - 1, stacks.length - delIndex + 1)
      stackTrace = stacks.join("\n")
    }
    // 메세지 출력
    Log.verbose(msg)
    try {
      await channel.send(`${msgStr}\n* Stack\n\`\`\`${stackTrace}\`\`\``)
    } catch (err) {
      Log.error(err)
    }
  }

  /**
   * 명령어 추가
   * @param command 커맨드
   */
  public addCommand(command: Command) {
    this.commands.set(command.slash.name, command)
  }

}