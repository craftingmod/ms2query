import { Client, Collection, Events, GatewayIntentBits, TextChannel, REST, Routes, EmbedBuilder, subtext, codeBlock } from "discord.js"
import type { ChatInputCommandInteraction, DMChannel, RESTPostAPIChatInputApplicationCommandsJSONBody } from "discord.js"
import { type BaseConfig } from "./BaseConfig.ts"
import { readJSON, writeJSON } from "./BaseUtil.ts"
import Path from "node:path"
import { Logger } from "../../logger/Logger.ts"
import { newQueue } from "@henrygd/queue"
import type { Command } from "./Command.ts"
import fs from "node:fs/promises"
import { Pallete } from "./CommandTools.ts"

const Log = new Logger({
  tag: "BotBase",
  showFnName: false,
})


export abstract class BotBase<C extends BaseConfig> {
  /**
   * Discord.js 클라이언트 (내부용)
   */
  protected readonly initClient: Client<false>
  /**
   * Discord.js 클라이언트 (외부용)
   */
  public client!: Client<true>
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


  public ownerDM!: DMChannel

  /**
   * Client의 GatewayIntentBits
   */
  protected readonly intentPerms = [GatewayIntentBits.Guilds]

  public constructor() {
    // 클라이언트 초기화
    this.initClient = new Client({
      intents: this.intentPerms,
    })
    this.registerEvents()
  }
  /**
   * 내부이벤트 등록용
   */
  private registerEvents() {

    // Ready
    this.initClient.once(Events.ClientReady, async (readyClient) => {
      this.client = readyClient
      // DM채널 생성
      await this.createOwnerDM()
      // onReady 실행 (명령어 추가 등...?)
      await this.onReady()
      // 명령어 Dev Guild에 등록
      await this.registerDevCommand()
    })

    // 명령어 인터렉션 생성
    this.initClient.on(Events.InteractionCreate, async (interaction) => {
      if (!interaction.isChatInputCommand()) {
        return
      }

      await this.onInteraction(interaction)
    })
  }

  private async onInteraction(interaction: ChatInputCommandInteraction) {
    const command = this.commands.get(interaction.commandName)
    // 커맨드 없으면 생략
    if (command === undefined) {
      return
    }

    // 큐 있으면 Defer
    if (command.defer === true || this.commandQueue.active() > 0) {
      await interaction.deferReply()
    }

    // 커맨드 큐에 추가
    const commandFn = async () => {
      try {

        // 결과값으로 메세지 업데이트
        const commandResult = await command.execute(interaction)
        if (interaction.replied || commandResult === null) {
          // 사용자가 처리했으므로 생략
          return
        }

        // 인터렉션 수정
        if (interaction.deferred) {
          await interaction.editReply(commandResult)
        } else {
          await interaction.reply(commandResult)
        }

      } catch (error) {
        Log.error(error)

        // 에러 응답하기
        if (interaction.replied || interaction.deferred) {
          await interaction.followUp({
            content: "명령어를 실행하는 데 오류가 발생했습니다.",
            ephemeral: true,
          })
        } else {
          await interaction.reply({
            content: "명령어를 실행하는 데 오류가 발생했습니다.",
            ephemeral: true,
          })
        }
        // 에러 형식 아니면 취소
        if (!(error instanceof Error)) {
          return
        }

        // DM으로 에러 보내기
        const errorEmbed = new EmbedBuilder()
        errorEmbed.setColor(Pallete.Red)
        errorEmbed.setTitle("명령어 실행 오류")
        errorEmbed.setDescription(`${error.message}`)
        errorEmbed.addFields({
          name: "오류 채널",
          value: interaction.channelId,
        })
        try {
          const errorStack = error.stack?.replaceAll(process.cwd(), ".") ?? "-"
          await this.ownerDM.send({
            content: codeBlock(errorStack),
            embeds: [errorEmbed],
          })
        } catch (err2) {
          Log.error(err2)
        }
      }
    }

    this.commandQueue.add(commandFn)
  }

  /**
   * 디스코드에 로그인
   */
  public async connect() {
    this.globalConfig = await readJSON(this.configPath, this.globalConfig)
    // 직접 설정해줘야 하는 값 검사
    const nonBlank = [this.globalConfig.token, this.globalConfig.clientId, this.globalConfig.devGuildId, this.globalConfig.botOwner]
    if (nonBlank.find((v) => v.length <= 0) !== undefined) {
      await writeJSON(this.configPath, this.globalConfig)
      throw new Error(`\"${this.configPath}\" 설정을 완료하여야 합니다!`)
    }
    // 로그인 (REST, Client)
    this.rest.setToken(this.globalConfig.token)
    await this.initClient.login(this.globalConfig.token)
  }

  /**
   * ready 이벤트시 호출
   */
  protected async onReady() {
    Log.verbose(`Ready! Logged in as ${this.client.user.tag}`)

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
   * 봇 소유자 DM채널 생성
   */
  protected async createOwnerDM() {
    this.ownerDM = await this.client.users.createDM(this.globalConfig.botOwner)
    await this.ownerDM.send({
      content: "Bot Ready!",
    })
  }

  /**
   * 디스코드 특정 채널에 메세지 로깅
   * @param msg 로깅할 메세지
   * @returns X
   */
  public async logToChannel(msg: unknown) {
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
      await this.ownerDM.send(`${msgStr}\n* Stack\n\`\`\`${stackTrace}\`\`\``)
    } catch (err) {
      Log.error(err)
    }
  }

  /**
   * 명령어 추가
   * @param command 커맨드
   */
  public addCommand(...commands: Command[]) {
    for (const cmd of commands) {
      this.commands.set(cmd.slash.name, cmd)
    }
  }
}