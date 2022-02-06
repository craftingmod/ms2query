import { GatewayIntentBits, Routes, RESTPostAPIApplicationCommandsJSONBody } from "discord-api-types/v9"
import { CacheType, Client, Collection, CommandInteraction, Guild, Interaction, MessageEmbed, User } from "discord.js"
import { EventEmitter } from "stream"
import { BasicSlashBuilder, Command, CommandTools } from "./command"
import Debug from "debug"
import { REST } from "@discordjs/rest"
import { SlashCommandBuilder } from "@discordjs/builders"
import chalk from "chalk"
import { MinigameCmd } from "./cmds/minigame"
import { CritRateCmd } from "./cmds/critrate"

const debug = Debug("discordbot:debug:botinit")

export class BotInit {
  protected readonly botToken: BotToken
  protected commands: Collection<string, Command>
  protected client: Client
  public constructor(token: BotToken) {
    this.botToken = token
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
    this.addCommands(
      new AdminCmd(),
    )
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
    this.client.user?.setStatus("online")
    this.client.user?.setActivity("")
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
      version: "9"
    }).setToken(this.botToken.token)

    try {
      await rest.put(Routes.applicationGuildCommands(this.botToken.appid, (guild instanceof Guild) ? guild.id : guild), { body: slashCmds.map((v) => v.toJSON()) })
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
      await interaction.reply({
        content: `명령어를 실행하는 도중 오류가 발생하였습니다!`,
        ephemeral: true
      })
    }
  }
}
/**
 * 슬래시 커맨드 갱신 명령어
 */
class AdminCmd implements Command {
  public slash = new SlashCommandBuilder()
    .setName("admin")
    .setDescription("관리자 명령어.")
    .addSubcommand(subcommand =>
      subcommand.setName("updateslash")
        .setDescription("/ 명령어를 갱신합니다."))
    .addSubcommand(subcommand =>
      subcommand.setName("nowplaying")
        .setDescription("현재 상태 메시지를 바꿉니다.")
        .addStringOption(option => option.setName("status").setDescription("현재 상태를 입력해주세요.").setRequired(true)))
  public async execute(interaction: CommandInteraction<CacheType>, bot: BotInit, tool: CommandTools) {
    if (!bot.isOwner(interaction.user)) {
      await tool.replySimplePrivate(`권한이 없습니다.`)
      return
    }
    const subcommand = interaction.options.getSubcommand(true)
    if (subcommand === "updateslash") {
      const guild = interaction.guild
      if (guild != null) {
        await bot.registerInterationsGuild(guild)
        await tool.replySimplePrivate(`등록되었습니다.`)
      } else {
        await tool.replySimplePrivate(`길드에서만 가능합니다.`)
      }
    } else if (subcommand === "nowplaying") {
      const changevalue = interaction.options.getString("status") ?? "Nothing"
      interaction.client.user?.setPresence({
        activities: [{ name: changevalue }],
        status: "online",
      })
      await tool.replySimplePrivate("변경 완료.")
    }
  }
}
export interface BotToken {
  token: string
  appid: string
  prefix: string
  ownerid: string
}