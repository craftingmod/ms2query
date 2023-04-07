import { DiscordAPIError, EmbedBuilder, GatewayIntentBits, Routes } from "discord.js"
import type { CacheType, Interaction } from "discord.js"
import { Client, Collection, CommandInteraction, Guild, User, REST, SlashCommandBuilder } from "discord.js"
import { BasicSlashBuilder, Command } from "./Command.js"
import Debug from "debug"
import chalk from "chalk"
import fs from "node:fs/promises"
import { AdminCommand } from "./commands_old/AdminCommand.js"
import { MS2Database } from "../ms2/ms2database.js"
import { BotDatabase } from "./botdatabase.js"
import { Database } from "better-sqlite3"

const debug = Debug("discordbot:debug:botinit")

export class OldBotBase {
  public readonly ms2db: MS2Database
  public readonly botdb: Database
  public readonly client: Client
  public statusMessage = "상태 메시지"
  public globalConfig: Record<string, string> = {} // 봇 전반적으로 쓰는 Config
  protected readonly botToken: BotToken
  protected commands: Collection<string, Command>
  protected isOffline = false
  protected appId = ""
  public constructor(token: BotToken, database: MS2Database, botDBPath: string) {
    this.botToken = token
    this.ms2db = database
    this.botdb = new BotDatabase(botDBPath).database
    this.commands = new Collection()
    this.client = new Client({
      intents: [
        GatewayIntentBits.Guilds,
      ],
    })
    this.client.on("ready", this.onReady.bind(this))
    this.client.on("interactionCreate", this.onInteractionCreate.bind(this))
    // Bootstrap interaction registration
    this.client.on("message", async (msg) => {
      debug(`${msg.author.tag} sent ${msg.content}`)
      if (msg.guild == null) {
        return
      }
      if (msg.content === `${token.prefix}register`) {
        await this.registerInteractionsGuild(msg.guild)
        await msg.reply("Command registered!")
      }
    })
  }
  /**
   * Add commands 
   * @param cmds 
   */
  public addCommands(...cmds: Command[]) {
    for (const cmd of cmds) {
      debug(`Command ${chalk.blueBright(cmd.slash.name)} is registered.`)
      this.commands.set(cmd.slash.name, cmd)
    }
  }
  public async saveConfig() {
    // 간단한 것만 저장해주세요
    await fs.writeFile("./data/config.json", JSON.stringify(this.globalConfig, null, 2))
  }
  /**
   * 디스코드에 연결
   */
  public async connect() {
    this.globalConfig = JSON.parse(await fs.readFile("./data/config.json", "utf-8").catch(() => "{}"))
    for (const [_, cmd] of this.commands) {
      await cmd.beforeInit()
    }
    await this.client.login(this.botToken.token)
    for (const [_, cmd] of this.commands) {
      await cmd.afterInit()
    }

    this.appId = this.client.user?.id ?? ""
    this.setOnline()
    // this.client.user?.setActivity("")
    // 슬래시 명령어 등록
    /*
    const guilds = await this.client.guilds.fetch()
    for (const guild of guilds.values()) {
      debug(`Registering command in ${chalk.cyan(guild.name)}...`)
      await this.registerInteractionsGuild(guild.id)
    }
    */
  }
  public async disconnect() {
    for (const [_, cmd] of this.commands) {
      await cmd.onDisconnect()
    }
    // this.commands.clear()
    this.setOffline()
    this.client.destroy()
  }
  /**
   * 봇 비활성화
   */
  public setOffline() {
    this.client.user?.setStatus("invisible")
    this.isOffline = true
  }
  /**
   * 다시 봇 활성화
   */
  public setOnline() {
    // statusMessage
    this.client.user?.setStatus("online")
    this.client.user?.setActivity({
      name: this.statusMessage,
    })
    this.isOffline = false
  }
  /**
   * 봇 활성화 여부
   */
  public isOnline() {
    return !this.isOffline
  }
  /**
   * 길드에 슬래시 명령어 등록
   * @param guild 길드 
   */
  public async registerInteractionsGuild(guild: Guild | string) {
    const slashCmds: BasicSlashBuilder[] = []
    for (const cmd of this.commands.values()) {
      if (cmd.slash.name !== "admin") {
        slashCmds.push(cmd.slash)
      }
    }

    const rest = new REST({
      version: "10"
    }).setToken(this.botToken.token)

    try {
      await rest.put(Routes.applicationGuildCommands(this.appId, (guild instanceof Guild) ? guild.id : guild), { body: slashCmds.map((v) => v.toJSON()) })
    } catch (err) {
      console.log(err)
    }
  }
  public async registerInteractionsGlobal() {
    const slashCmds: BasicSlashBuilder[] = []
    for (const cmd of this.commands.values()) {
      if (cmd.slash.name === "admin") {
        slashCmds.push(cmd.slash)
      }
    }

    const rest = new REST({
      version: "10"
    }).setToken(this.botToken.token)

    try {
      await rest.put(Routes.applicationCommands(this.appId), { body: slashCmds.map((v) => v.toJSON()) })
    } catch (err) {
      console.log(err)
    }
  }
  public async clearInteractionsGuild(guild: Guild | string) {
    const slashCmds: BasicSlashBuilder[] = []

    const rest = new REST({
      version: "10"
    }).setToken(this.botToken.token)

    try {
      await rest.put(Routes.applicationGuildCommands(this.appId, (guild instanceof Guild) ? guild.id : guild), { body: slashCmds.map((v) => v.toJSON()) })
    } catch (err) {
      console.log(err)
    }
  }
  public async clearInteractionsGlobal() {
    const slashCmds: BasicSlashBuilder[] = []
    for (const cmd of this.commands.values()) {
      if (cmd.slash.name === "admin") {
        slashCmds.push(cmd.slash)
      }
    }

    const rest = new REST({
      version: "10"
    }).setToken(this.botToken.token)

    try {
      await rest.put(Routes.applicationCommands(this.appId), { body: slashCmds.map((v) => v.toJSON()) })
    } catch (err) {
      console.log(err)
    }
  }
  /**
   * 봇 소유자인지 확인
   * @param user 유저
   * @returns 봇 소유자면 True, 아니면 False
   */
  public isOwner(user: string | User) {
    if (user instanceof User) {
      return this.botToken.ownerid === user.id
    } else {
      return this.botToken.ownerid === user
    }
  }
  /**
   * on ready event
   * @param client 
   */
  protected async onReady(client: Client) {
    debug(`Bot is logined as ${chalk.greenBright(client.user?.tag)}!`)
  }
  /**
   * on Interaction Created
   * @param interaction interaction
   * @returns 
   */
  protected async onInteractionCreate(interaction: Interaction<CacheType>) {
    // raw execute
    if (!this.isOffline) {
      for (const cmd of this.commands.values()) {
        if (cmd.executeRaw != null) {
          const result = await cmd.executeRaw(interaction, this)
          if (!result) {
            return
          }
        }
      }
    }
    if (!interaction.isCommand()) {
      return
    }
    if (!this.commands.has(interaction.commandName)) {
      debug(`Unknown command: ${chalk.redBright(interaction.commandName)}`)
      return
    }
    if (this.isOffline && interaction.commandName !== "admin") {
      debug(`${chalk.blueBright(interaction.commandName)} is rejected due to offline mode.`)
      await interaction.reply({
        content: `봇 시스템 점검 중입니다.`,
        ephemeral: true,
      })
      return
    }
    const tools = new CommandTools(interaction)
    try {
      await this.commands.get(interaction.commandName)?.execute(interaction, this, tools)
      debug(`${chalk.blueBright(interaction.commandName)} is executed.`)
    } catch (error) {
      debug(`${chalk.blueBright(interaction.commandName)} ${chalk.redBright("execution failed!")}`)
      debug(error)
      const errorEmbed = new EmbedBuilder()
      errorEmbed.setTitle("명령어 실행 오류")
      errorEmbed.setDescription("오류가 발생하였습니다.")
      if (error instanceof DiscordAPIError) {
        errorEmbed.addFields({
          name: "오류 내용",
          value: `\`\`\`${error.message}\`\`\``,
        })
        errorEmbed.addFields({
          name: "오류난 채널",
          value: interaction.channelId,
        })
        const errorStack = error.stack?.split("\n") ?? []
        if (errorStack.length > 0) {
          // 스택트레이스 아닌 2개 삭제
          errorStack.splice(0, 2)
          const stackTrace = errorStack.join("\n").replace(/\\/ig, "/")
          errorEmbed.setDescription(` * 스택 트레이스\n\`\`\`${stackTrace}\`\`\``)
        }
      } else {
        errorEmbed.addFields({
          name: "오류 내용",
          value: `\`\`\`${error}\`\`\``,
        })
      }
      errorEmbed.setTimestamp(Date.now())
      errorEmbed.setAuthor({
        name: interaction.user.tag,
        iconURL: interaction.user.displayAvatarURL({
          forceStatic: true,
        }),
      });
      try {
        this.client.users.cache.get(this.botToken.ownerid)?.send({
          content: "명령어를 실행하는 도중 오류가 발생하였습니다.",
          embeds: [errorEmbed],
        })
      } catch (err2) {
        debug(err2)
      }
      try {
        await interaction.editReply({
          content: "오류가 발생하였습니다.",
        })
        /*
        await interaction.deleteReply().catch(() => { })
        await interaction.reply({
          content: "오류가 발생하였습니다. 오류는 개발자에게 자동으로 제보됩니다.",
          ephemeral: true,
        })
        */
      } catch (err3) {
        debug(err3)
      }
    }
  }
}
export interface BotToken {
  token: string
  prefix: string
  ownerid: string
}