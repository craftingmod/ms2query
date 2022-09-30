import { GatewayIntentBits, Routes } from "discord.js"
import type { CacheType, Interaction } from "discord.js"
import { Client, Collection, CommandInteraction, Guild, User, REST, SlashCommandBuilder } from "discord.js"
import { BasicSlashBuilder, Command, CommandTools } from "./command.js"
import Debug from "debug"
import chalk from "chalk"
import { AdminCommand } from "./commands/AdminCommand.js"
import { MS2Database } from "../ms2/ms2database.js"

const debug = Debug("discordbot:debug:botinit")

export class BotInit {
  public readonly ms2db: MS2Database
  protected readonly botToken: BotToken
  protected commands: Collection<string, Command>
  protected client: Client
  protected appId = ""
  public constructor(token: BotToken, database: MS2Database) {
    this.botToken = token
    this.ms2db = database
    this.commands = new Collection()
    this.client = new Client({
      intents: [GatewayIntentBits.Guilds]
    })
    this.client.on("ready", this.onReady.bind(this))
    this.client.on("interactionCreate", this.onInteractionCreate.bind(this))
    // interaction register
    this.client.on("message", async (msg) => {
      debug(`${msg.author.tag} sent ${msg.content}`)
      if (msg.guild == null) {
        return
      }
      if (msg.content === `${token.prefix}register`) {
        await this.registerInterationsGuild(msg.guild)
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
  /**
   * 디스코드에 연결
   */
  public async connect() {
    for (const [_, cmd] of this.commands) {
      if (cmd.beforeInit != null) {
        await cmd.beforeInit(this.client)
      }
    }
    await this.client.login(this.botToken.token)

    this.appId = this.client.user?.id ?? ""
    this.client.user?.setStatus("online")
    this.client.user?.setActivity("")
    // 슬래시 명령어 등록
    const guilds = await this.client.guilds.fetch()
    for (const guild of guilds.values()) {
      debug(`Registering command in ${chalk.cyan(guild.name)}...`)
      await this.registerInterationsGuild(guild.id)
    }
  }
  /**
   * 길드에 슬래시 명령어 등록
   * @param guild 길드 
   */
  public async registerInterationsGuild(guild: Guild | string) {
    const slashCmds: BasicSlashBuilder[] = []
    for (const cmd of this.commands.values()) {
      slashCmds.push(cmd.slash)
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
  public async registerInterationsGlobal() {
    const slashCmds: BasicSlashBuilder[] = []
    for (const cmd of this.commands.values()) {
      slashCmds.push(cmd.slash)
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
    for (const cmd of this.commands.values()) {
      if (cmd.executeRaw != null) {
        const result = await cmd.executeRaw(interaction, this)
        if (!result) {
          return
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
    const tools = new CommandTools(interaction)
    try {
      await this.commands.get(interaction.commandName)?.execute(interaction, this, tools)
      debug(`${chalk.blueBright(interaction.commandName)} is executed.`)
    } catch (error) {
      debug(`${chalk.blueBright(interaction.commandName)} ${chalk.redBright("execution failed!")}`)
      debug(error)
      try {
        await interaction.deleteReply()
        await interaction.reply({
          content: `명령어를 실행하는 도중 오류가 발생하였습니다!`,
          ephemeral: true
        })
      } catch (err2) {
        console.error(err2)
      }
    }
  }
}
export interface BotToken {
  token: string
  prefix: string
  ownerid: string
}