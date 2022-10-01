import { AttachmentBuilder, CacheType, Client, CommandInteraction, EmbedBuilder, TextChannel } from "discord.js"
import type { BotInit } from "../botinit.js"
import { Command, CommandTools } from "../command.js"
import { SlashCommandBuilder } from "discord.js"
import { fetchGuildRank, fetchTrophyCount, fetchWorldChat } from "../../ms2/ms2fetch.js"
import { BroadcastType, getBroadcastChannels, insertBroadcastChannel } from "../structure/BroadcastChannel.js"
import { getLastWorldChat, insertWorldChat, WorldChatHistory } from "../structure/WorldChatHistory.js"
import { MS2Database } from "../../ms2/ms2database.js"
import { Database } from "better-sqlite3"
import { getProfileCache, insertProfileCache, isProfileCacheValid, ProfileCache } from "../structure/ProfileCache.js"
import { CharId } from "../../ms2/structure/CharId.js"
import { WorldChatType } from "../../ms2/structure/WorldChatType.js"
import { Job } from "../../ms2/charinfo.js"
import { JobIcon } from "../jobicon.js"
import cheerio from "cheerio"
import got from "got"
import Debug from "debug"

const debug = Debug("discordbot:debug:worldChatCommand")

export class WorldChatCommand implements Command {
  private worldChats: WorldChatHistory[] = []
  private syncTask: NodeJS.Timeout | null = null
  private bot: BotInit | null = null

  public slash = new SlashCommandBuilder()
    .setName("월드챗")
    .setDescription("월드챗 관련 명령어 입니다.")
    .addSubcommand(subcommand =>
      subcommand.setName("등록")
        .setDescription("월드/채널챗을 이 채널에 알립니다."))

  public async beforeInit(bot: BotInit) {
    const lastChat = getLastWorldChat(bot.botdb)
    const chats: WorldChatHistory[] = await this.fetchWorldchat(bot.ms2db)
    // Add chat history to database
    const newChats = chats.filter((chat) => chat.sentTime.getTime() > (lastChat?.sentTime?.getTime() ?? 0))
    if (newChats.length > 0) {
      insertWorldChat(bot.botdb, newChats)
    }
    this.worldChats = chats
  }

  public async afterInit(bot: BotInit) {
    this.bot = bot
    this.syncTask = setTimeout(() => {
      this.syncWorldChat()
    }, 10000)
  }

  private async syncWorldChat() {
    const bot = this.bot
    if (bot == null) {
      return
    }
    // Delta chats
    const chats = await this.fetchWorldchat(bot.ms2db)
    const newChats = chats.filter((chat) => {
      if (this.worldChats.length === 0) {
        return true
      } else {
        return chat.sentTime.getTime() > (this.worldChats[this.worldChats.length - 1]?.sentTime?.getTime() ?? 0)
      }
    })
    if (newChats.length > 0) {
      // 1. insert new chat to database
      insertWorldChat(bot.botdb, newChats)
      // 2. insert and shirink chats
      this.worldChats = this.worldChats.concat(newChats)
      while (this.worldChats.length > 100) {
        this.worldChats.shift()
      }
      // 3. broadcasting
      const broadcastChannels = getBroadcastChannels(bot.botdb, BroadcastType.WorldChat)
      for (const chat of newChats) {
        debug(`[New world chat] ${chat.senderName}: ${chat.content}`)
        const resp = await this.makeEmbed(chat, bot.ms2db, bot.botdb)
        for (const channel of broadcastChannels) {
          const textChannel = bot.client.guilds.cache.get(channel.guildId.toString())?.channels.cache.get(channel.channelId.toString()) as TextChannel
          await textChannel.send({
            files: resp.attaches,
            embeds: [
              resp.embed,
            ],
            content: resp.content,
          })
        }
      }
    }

    this.syncTask = setTimeout(() => {
      this.syncWorldChat()
    }, 10000)
  }

  public async execute(interaction: CommandInteraction<CacheType>, bot: BotInit, tool: CommandTools) {
    for (const subCommand of interaction.options.data) {
      if (subCommand.name === "등록") {
        if (interaction.guildId == null) {
          await tool.replySimple("서버에서만 사용할 수 있습니다.")
          break
        }
        insertBroadcastChannel(bot.botdb, [{
          guildId: BigInt(interaction.guildId),
          channelId: BigInt(interaction.channelId),
          broadcastType: BroadcastType.WorldChat,
          registeredTime: new Date(Date.now()),
        }])
        await tool.replySimple("등록되었습니다.")
      }
    }
  }

  private shirinkChatContent(content: string) {
    const $ = cheerio.load(content.replace(/<\/?span.*?>/ig, "`"))
    return $.text()
  }

  private async makeEmbed(chat: WorldChatHistory, ms2db: MS2Database, botdb: Database) {
    const attaches: AttachmentBuilder[] = []
    const embed = new EmbedBuilder()
    const mainChar = ms2db.queryMainCharacterByName(chat.senderName)
    let hasMain = false
    if (mainChar != null) {
      const mainProfile = await this.fetchProfileImageByInfo(mainChar, botdb)
      // mainProfile thumbnail
      if (mainProfile != null) {
        hasMain = true
        const attachment = await CommandTools.makeAttachment(mainProfile.profileImage, "main_profile.png")
        attaches.push(attachment.attach)
        embed.setAuthor({
          name: mainChar.nickname,
          iconURL: attachment.url,
        })
      }
    }
    const talkChar = ms2db.queryCharacterByName(chat.senderName)
    const talkTrophyChar = await fetchTrophyCount(chat.senderName)
    const prefix = chat.worldChatType === WorldChatType.World ? "월드" : "채널"
    const color = chat.worldChatType === WorldChatType.World ? "#52c8ff" : "#52ff6e"
    embed.setColor(color)
    if (talkChar != null) {
      embed.setTitle(`${talkChar.job !== Job.UNKNOWN ? JobIcon[talkChar.job] + " " : ""}${talkChar.level > 0 ? `Lv.${talkChar.level} ` : ""}${talkChar.nickname}`)
    } else {
      embed.setTitle(`${chat.senderName}`)
    }
    if (talkTrophyChar != null) {
      if (mainChar != null && mainChar.characterId === BigInt(talkTrophyChar.characterId) && hasMain) {
        embed.setThumbnail("attachment://main_profile.png")
      } else {
        const attachment = await CommandTools.makeAttachment(talkTrophyChar.profileURL, "char_profile.png")
        attaches.push(attachment.attach)
        embed.setThumbnail(attachment.url)
      }
    }
    let chatContent = chat.content
    if (chatContent.length <= 0) {
      chatContent = "내용 없음(이모티콘)"
    }
    embed.setDescription(chatContent)
    embed.setTimestamp(chat.sentTime)
    embed.setFooter({
      text: `${prefix} 채팅`
    })
    return {
      attaches,
      embed,
      content: `**[${prefix}][${chat.senderName}]** ${chatContent}`,
    }
  }

  private async fetchProfileImageByInfo(charInfo: CharId, botdb: Database) {
    const cachedProfile = getProfileCache(botdb, charInfo.characterId)
    if (cachedProfile == null || !isProfileCacheValid(cachedProfile)) {
      // Update profile
      const trophyInfo = await fetchTrophyCount(charInfo.nickname)
      if (BigInt(trophyInfo.characterId) === charInfo.characterId) {
        const _profile: ProfileCache = {
          characterId: BigInt(trophyInfo.characterId),
          profileImage: trophyInfo.profileURL,
          lastUpdatedTime: BigInt(Date.now()),
        }
        insertProfileCache(botdb, [_profile])
        return _profile
      }
    }
    return null
  }

  private async fetchWorldchat(ms2db: MS2Database): Promise<WorldChatHistory[]> {
    return (await fetchWorldChat()).map((chat) => {
      const charId = ms2db.queryCharacterByName(chat.nickname)
      return {
        senderId: charId?.characterId ?? null,
        senderName: charId?.nickname ?? chat.nickname,
        worldChatType: chat.type,
        content: this.shirinkChatContent(chat.message),
        sentTime: chat.time,
      }
    })
  }
}