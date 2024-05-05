import Debug from "debug"
import chalk from "chalk"
import fs from "node:fs/promises"
import { Client, GatewayIntentBits, Guild, REST, type RESTPostAPIApplicationCommandsJSONBody, type RESTPostAPIApplicationGuildCommandsJSONBody, Routes } from "discord.js"
import type { Interaction } from "discord.js"

import { CommandPolicy, DaemonCommand } from "./Command.ts"
import type { Command } from "./Command.ts"
import { type ConfigBase, defaultConfigBase } from "./ConfigBase.ts"
import { parseCustomId, replyNoOwner } from "./CommandTools.ts"
import { PingCommand } from "./command/PingCommand.ts"
import { AdminCommand } from "./command/AdminCommand.ts"


const debug = Debug("discordbot:debug:botbase")

export class BotBase {
  /**
   * 봇 클라이언트
   */
  public readonly client: Client

  /**
   * 봇의 전역 설정
   */
  public globalConfig: ConfigBase = { ...defaultConfigBase } // 봇 전반적으로 쓰는 Config

  /**
   * 봇 토큰
   */
  protected readonly botToken: string
  /**
   * 커맨드 모음
   */
  protected readonly commands: Map<string, Command | DaemonCommand<BotBase>> = new Map()
  /**
   * 현재 상태
   */
  protected state: BotState = BotState.INVISIBLE
  /**
   * 앱 ID
   */
  protected appId = ""

  /**
   * 생성자
   * @param token 봇의 토큰
   */
  public constructor(token: string) {
    this.botToken = token
    this.client = new Client({
      intents: [
        GatewayIntentBits.Guilds,
      ]
    })
    // ready시 실행
    this.client.on("ready", () => {
      return this.onReady()
    })
    // 인터렉션 생성시 실행
    this.client.on("interactionCreate", (interaction) => {
      return this.onInteractionCreate(interaction)
    })
  }
  /**
   * 디스코드에 연결
   */
  public async connect() {
    // 설정 불러오기
    this.globalConfig = {
      ...this.globalConfig,
      ...JSON.parse(await fs.readFile("./data/config.json", "utf-8").catch(() => "{}")),
    }
    await this.client.login(this.botToken)
  }
  /**
   * 명렁어 추가
   */
  public addCommand(command: Command) {
    this.commands.set(command.slash.name, command)
  }

  /**
   * 상태 전환
   * @param state 현재 상태
   */
  public setState(state: BotState) {
    this.client.user?.setStatus(state)
  }

  /**
   * 활동 설정
   * @param message 활동?
   */
  public async setActivity(message: string, save = true) {
    this.client.user?.setActivity(message)
    await this.setConfig({ statusMessage: message })
  }

  /**
   * Config 설정 후 저장
   * @param config 설정?
   */
  public async setConfig(config: Partial<typeof this.globalConfig>) {
    this.globalConfig = {
      ...this.globalConfig,
      ...config,
    }
    await fs.writeFile("./data/config.json", JSON.stringify(this.globalConfig, null, 2))
  }

  /**
   * Slash Commands를 Guild에 등록
   * @param guildId Guild ID
   */
  public async registerInteractionsGuild(guild: Guild, isDebug: boolean = false) {
    const rest = new REST({
      version: "10"
    }).setToken(this.botToken)

    const registerCommands: RESTPostAPIApplicationCommandsJSONBody[] = []
    for (const [_, cmd] of this.commands) {
      // 길드 명렁어 ONLY거나 디버깅 시에만 등록
      if (cmd.runPolicy === CommandPolicy.Guild || isDebug) {
        registerCommands.push(cmd.slash.toJSON())
      }
    }
    try {
      await rest.put(
        Routes.applicationGuildCommands(this.appId, guild.id), {
        body: registerCommands,
      })
      debug(`${chalk.green(guild.name)} 길드의 명령어 등록이 완료되었습니다.`)
    } catch (err) {
      debug(`명령어 등록 중 오류가 발생했습니다: ${chalk.red(err)}`)
    }
  }
  /**
   * Slash Commands를 글로벌에 등록
   */
  public async registerInteractionsGlobal(isDebug = false) {
    const rest = new REST({
      version: "10"
    }).setToken(this.botToken)

    const registerCommands: RESTPostAPIApplicationCommandsJSONBody[] = []
    for (const [_, cmd] of this.commands) {
      // DM ONLY거나 전체일 시에만 등록
      if (cmd.runPolicy === CommandPolicy.DM || cmd.runPolicy === CommandPolicy.All) {
        registerCommands.push(cmd.slash.toJSON())
      }
    }
    try {
      await rest.put(
        Routes.applicationCommands(this.appId), {
        body: isDebug ? [] : registerCommands,
      })
      debug(`전체 명령어 등록이 완료되었습니다.`)
    } catch (err) {
      debug(`명령어 등록 중 오류가 발생했습니다: ${chalk.red(err)}`)
    }
  }

  /**
   * ================ protected ================
   */

  /**
   * 봇이 로그인 됐을 시 실행
   */
  protected async onReady() {
    // 로그 찍기
    const botName = this.client.user?.tag ?? "unknown"
    debug(`봇이 ${chalk.greenBright(botName)}로 로그인 되었습니다!`)
    // AppID 등록
    this.appId = this.client.user!!.id
    // 명령어에게 온라인 전달
    for (const [_, cmd] of this.commands) {
      if (cmd instanceof DaemonCommand) {
        await cmd.onLogin()
      }
    }
    // 활성화 상태로 전환
    this.setState(BotState.ONLINE)
    // 활동 설정
    await this.setActivity(this.globalConfig.statusMessage, false)
    // 명령어 등록
    const debugGuild = this.globalConfig.debugGuildId
    if (debugGuild.length > 0) {
      const guild = this.client.guilds.resolve(debugGuild)
      if (guild != null) {
        await this.registerInteractionsGuild(guild, true)
      }
    }
  }

  /**
   * 인터렉션 실행 함수
   * @param interaction 인터렉션 
   */
  protected async onInteractionCreate(interaction: Interaction) {
    // Command 인터렉션인지 체크
    if (interaction.isCommand()) {
      // Command 인터렉션일 경우 명령 실행
      const cmd = this.commands.get(interaction.commandName)
      if (cmd == null) {
        return
      }
      // 서브커맨드 검사
      let isSub = false
      const data = interaction.options.data
      if (data.length >= 1) {
        for (const subData of data) {
          // executor 없으면 패스
          if (cmd.executors == null) {
            continue
          }
          const exec = cmd.executors[subData.name]
          if (exec != null) {
            await exec(interaction)
            isSub = true
          }
        }
      }
      if (isSub) {
        return
      }
      // 명령어 실행
      await cmd.execute(interaction)
      return
    }
    // Command 인터렉션이 아닌 경우에는
    // custom-id로 구별
    if (interaction.isButton() || interaction.isSelectMenu()) {
      const customId = interaction.customId
      const parsedData = parseCustomId(customId)
      // custom-id 규격이 이상할 경우
      if (parsedData == null) {
        debug(`알 수 없는 custom-id 입니다! (${chalk.red(customId)})`)
        return
      }
      // 사용자 검사
      if (interaction.user.id !== parsedData.data.sender) {
        await replyNoOwner(interaction)
        return
      }
      // 인터렉션 명령어 실행
      for (const cmd of this.commands.values()) {
        // interactions 없으면 패스
        if (cmd.interactions == null) {
          continue
        }
        const userInteraction = cmd.interactions[parsedData.tag]
        if (userInteraction == null) {
          continue
        }
        await userInteraction(interaction, parsedData.data)
        break
      }
      return
    }
    throw new Error("구현되지 않은 인터렉션 입니다.")
  }

}

export enum BotState {
  ONLINE = "online",
  IDLE = "idle",
  DO_NOT_DISTURB = "dnd",
  INVISIBLE = "invisible",
}