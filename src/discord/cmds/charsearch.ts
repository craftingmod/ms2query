import { SlashCommandBuilder } from "@discordjs/builders"
import { CacheType, Client, Collection, CommandInteraction, Interaction, MessageActionRow, MessageAttachment, MessageEmbed, MessageSelectMenu, User } from "discord.js"
import Enmap from "enmap"
import { CharacterInfo, deserializeCharacterInfo, Job, JobNameMap, serializeCharacterInfo, SerializedCInfo, TotalCharacterInfo } from "../../ms2/charinfo"
import { fetchClearedByDate, fetchJobByName, fetchMainCharacterByName, fetchTrophyCount, searchLatestClearedPage } from "../../ms2/ms2fetch"
import { BotInit } from "../botinit"
import { Command, CommandTools } from "../command"
import Path from "path"
import { CharacterNotFoundError, InternalServerError } from "../../ms2/fetcherror"
import Debug from "debug"
import { JobIcon } from "../jobicon"
import { PartyInfo } from "../../ms2/partyinfo"
import fs from "fs-extra"

const debug = Debug("discordbot:debug:charsearch")

export class CharSearchCmd implements Command {
  public slash = new SlashCommandBuilder()
    .setName("search")
    .setDescription("캐릭터의 정보와 부캐를 검색합니다.")
    .addStringOption(option =>
      option.setName("nickname")
        .setDescription("검색하고 싶은 유저의 닉네임")
        .setRequired(true))

  protected cidStore: Enmap<string, string>
  protected characterStore: Enmap<string, SerializedCInfo>
  protected altStore: Enmap<string, string[]>
  protected rzakStore: PartyInfo[] = []
  protected dataDir: string
  public constructor() {
    this.dataDir = Path.resolve(".", "data")
    // Nickname -> CID
    this.cidStore = new Enmap<string, string>({
      name: "cidstore",
      autoFetch: true,
      fetchAll: true,
      dataDir: this.dataDir,
    })
    // CID -> User Info
    this.characterStore = new Enmap<string, SerializedCInfo>({
      name: "characterstore",
      autoFetch: true,
      fetchAll: true,
      dataDir: this.dataDir,
    })
    // AID -> CIDs
    this.altStore = new Enmap<string, string[]>({
      name: "altstore",
      autoFetch: true,
      fetchAll: true,
      dataDir: this.dataDir,
    })
  }

  public async beforeInit(client: Client<boolean>) {
    debug(`loading party list..`)
    const respDir = Path.resolve(this.dataDir, "resp")
    const jsonFiles = (await fs.readdir(respDir)).filter(f => f.endsWith(".json"))
    for (const filename of jsonFiles) {
      const partyList: PartyInfo[] = JSON.parse(await fs.readFile(Path.resolve(respDir, filename), "utf8"))
      this.rzakStore.push(...partyList)
    }
    debug(`loaded ${this.rzakStore.length} party list`)
  }

  public async execute(interaction: CommandInteraction<CacheType>, bot: BotInit, tool: CommandTools) {
    await interaction.deferReply()

    const nickname = interaction.options.getString("nickname") ?? ""
    if (nickname.length <= 1) {
      await interaction.editReply({
        content: `입력값이 너무 짪습니다.`,
      })
      return
    } else if (nickname.indexOf(" ") >= 0) {
      await interaction.editReply({
        content: `닉네임에는 공백을 넣을 수 없습니다. 가능한 사람도 있겠지만.. 어려워요.`,
      })
      return
    } else {
      const { embed, selectBox } = await this.searchUser(nickname, interaction.user)
      if (selectBox != null) {
        await interaction.editReply({
          embeds: [embed],
          components: [selectBox],
        })
      } else {
        await interaction.editReply({
          embeds: [embed],
        })
      }
    }
  }
  public async executeRaw(interaction: Interaction<CacheType>, bot: BotInit) {
    if (interaction.isSelectMenu()) {
      const { tag, userid } = CommandTools.parseCustomId(interaction.customId)
      if (!tag.startsWith("charsearch-chain-opt")) {
        return true
      }
      if (userid !== interaction.user.id) {
        await interaction.reply({
          embeds: [CommandTools.makeErrorMessage("선택권은 메시지 주인에게만 있어요!")],
          ephemeral: true,
        })
        return true
      }
      // code
      const nickname = interaction.values[0]
      const { embed, selectBox } = await this.searchUser(nickname, interaction.user)
      if (selectBox != null) {
        await interaction.update({
          embeds: [embed],
          components: [selectBox],
        })
      } else {
        await interaction.update({
          embeds: [embed],
        })
      }
    }
    return true
  }

  protected async buildSelectBox(ms2user: TotalCharacterInfo, userid: string) {
    const characters = this.getCharacters(ms2user.accountId)
    for (let i = 0; i < characters.length; i += 1) {
      if (characters[i].job === Job.UNKNOWN) {
        try {
          const job = await fetchJobByName(ms2user.nickname)
          characters[i].job = job
        } catch (err) {
          // skip.
        }
      }
    }
    const optMap = characters.map((v) => {
      const out = {
        label: v.nickname,
        description: "",
        value: v.nickname,
        emoji: "💎",
        default: ms2user.characterId === v.characterId,
      }
      if (v.level > 0) {
        out.description += "Lv." + v.level + " "
      }
      if (v.job !== Job.UNKNOWN) {
        out.emoji = JobIcon[v.job]
        out.description += JobNameMap[v.job]
      }
      if (out.description.length <= 0) {
        out.description = "정보가 많이 부족해요 😭"
      }
      return out
    })

    const row = new MessageActionRow()
      .addComponents(
        new MessageSelectMenu()
          .setCustomId(CommandTools.createCustomId("charsearch-chain-opt", userid))
          .setPlaceholder("🔍 검색할 부캐를 선택해주세요.")
          .addOptions(optMap)
          .setDisabled(optMap.length <= 1)
      )
    return row
  }

  protected async searchUser(nickname: string, user: User) {

    let userinfo: TotalCharacterInfo | null = null
    try {
      const trophy = await fetchTrophyCount(nickname)
      const cid = trophy.characterId
      // check character info is in characterStore
      const charSInfo = this.characterStore.get(cid)
      if (charSInfo != null) {
        const charInfo = deserializeCharacterInfo(charSInfo)
        userinfo = charInfo
      } else {
        // trying to fetch main character
        const totalInfo = await this.spoofMainCharacter(trophy)
        userinfo = totalInfo
      }
      const embed = await this.buildUserInfo({
        ...trophy,
        ...userinfo,
      }, user)
      const selectBox = await this.buildSelectBox({
        ...trophy,
        ...userinfo,
      }, user.id)
      return { success: true, embed, selectBox }
    } catch (err) {
      const embed = new MessageEmbed()
      if (err instanceof CharacterNotFoundError) {
        embed.setTitle(":warning: 오류!")
        embed.setDescription(`\`${nickname}\` 캐릭터를 찾을 수 없습니다. 이름을 제대로 입력했는지 확인해 주세요.`)
      } else if (err instanceof InternalServerError) {
        embed.setTitle(":warning: 오류!")
        embed.setDescription(`서버와 통신에 오류가 발생하였습니다. 잠시 후 다시 시도해 주세요.`)
      } else {
        embed.setTitle(":warning: 오류!")
        embed.setDescription(`봇이 고장났어요.`)
        debug(err)
      }
      return { success: false, embed, selectBox: null }
    }
  }

  protected async buildUserInfo(ms2user: TotalCharacterInfo & { trophyCount: number, trophyRank: number, profileURL: string }, discordUser: User) {
    const embed = new MessageEmbed()
    // thumbnail
    embed.setThumbnail(ms2user.profileURL)
    // color
    embed.setColor("#57f288")
    // description
    embed.setDescription("🔍 자료가 부족합니다. 😭\n")
    // username
    embed.setTitle(`**${ms2user.nickname}**`)
    // trophy
    embed.addField("🏆 트로피", `${ms2user.trophyCount}개 (${ms2user.trophyRank}등)`, true)
    // Image
    embed.setThumbnail(ms2user.profileURL)
    // Footer
    embed.setFooter({
      text: discordUser.username,
      iconURL: discordUser.avatarURL() ?? discordUser.defaultAvatarURL,
    })
    // Job
    if (ms2user.job === Job.UNKNOWN) {
      try {
        const job = await fetchJobByName(ms2user.nickname)
        embed.addField("💼 직업", `${JobIcon[job]} ${JobNameMap[job]}`, true)
      } catch (err) {
        if (!(err instanceof CharacterNotFoundError)) {
          console.error(err)
        }
      }
    } else {
      embed.addField("💼 직업", `${JobIcon[ms2user.job]} ${JobNameMap[ms2user.job]}`, true)
    }
    // Level
    if (ms2user.level > 0) {
      embed.addField("📈 레벨", `Lv.${ms2user.level}`, true)
    }
    // CharacterID
    embed.addField("🔑 캐릭터 식별자", `${ms2user.characterId}`, false)

    // Rzak relationship
    // accountid, prob
    const relationMap = new Collection<string, number>()
    for (const party of this.rzakStore) {
      const myMember = party.members.find(m => this.cidStore.get(m.nickname) === ms2user.characterId)
      if (myMember == null) {
        continue
      }
      // add relationships...
      for (const member of party.members) {
        if (member.nickname === myMember.nickname) {
          continue
        }
        const cid = this.cidStore.get(member.nickname)
        if (cid != null) {
          const cinfo = this.characterStore.get(cid)
          if (cinfo != null) {
            const info = deserializeCharacterInfo(cinfo)
            if (info.accountSpoofed) {
              relationMap.set(info.accountId, (relationMap.get(info.accountId) ?? 0) + 1)
              relationMap.set("total", (relationMap.get("total") ?? 0) + 1)
            }
          }
        }
      }
    }

    // add relation info..
    const rTotal = relationMap.get("total") ?? 0
    if (rTotal > 0) {
      const rEntires = [...relationMap.entries()].sort((a, b) => b[1] - a[1])
      let maxLine = 7

      let desc = `🤝 던전을 같이 다닌 비율\n\n`
      for (const [accountId, count] of rEntires) {
        if (accountId === "total") {
          continue
        }
        if (--maxLine < 0) {
          break
        }
        const cinfoArr = this.getCharacters(accountId)
        let mainCharName = ""
        let subChars: string[] = []
        for (const cinfo of cinfoArr) {
          if (cinfo.characterId === cinfo.mainCharId) {
            mainCharName = cinfo.nickname
          } else {
            subChars.push(cinfo.nickname)
          }
        }
        desc += `[\`${Math.floor((count / rTotal) * 10000) / 100}%\`] **${mainCharName}**${subChars.length >= 1 ? " + " + subChars.join(",") : ""}\n`
      }
      embed.setDescription(desc)
    }

    // Account Related
    if (ms2user.accountSpoofed) {
      embed.addField("🔐 계정 식별자", ms2user.accountId, false)
      if (ms2user.mainCharId !== ms2user.characterId) {
        try {
          const mainSI = this.characterStore.get(ms2user.mainCharId)
          if (mainSI != null) {
            const mainC = deserializeCharacterInfo(mainSI)
            const mainTrophy = await fetchTrophyCount(mainC.nickname)
            // Owner profile
            embed.setAuthor({
              name: mainTrophy.nickname,
              iconURL: mainTrophy.profileURL,
            })
          }
        } catch (err) {
          console.log(err)
        }
      } else {
        // Owner Profile..?
        embed.setAuthor({
          name: ms2user.nickname,
          iconURL: ms2user.profileURL,
        })
      }
      const characters = this.getCharacters(ms2user.accountId)
      embed.addField("📝 캐릭터 목록", characters.map(c => c.nickname).join(", "), true)
    }

    return embed
  }

  protected getCharacters(aid: string) {
    const cidArr = this.altStore.get(aid) ?? []
    const crinfoArr = cidArr.map((v) => this.characterStore.get(v) ?? null).filter(v => v != null) as SerializedCInfo[]
    const cinfoArr = crinfoArr.map((v) => deserializeCharacterInfo(v))
    return cinfoArr
  }

  protected async spoofMainCharacter(character: CharacterInfo) {
    const mainChar = await fetchMainCharacterByName(character.nickname)
    const currentChar: TotalCharacterInfo = {
      ...character,
      mainCharId: "",
      accountId: "",
      accountSpoofed: false,
    }
    if (mainChar != null) {
      currentChar.mainCharId = mainChar.characterId
      currentChar.accountId = mainChar.accountId
      currentChar.accountSpoofed = true
      // update main character info
      const mainTotalChar: TotalCharacterInfo = {
        ...mainChar,
        mainCharId: mainChar.characterId,
        accountSpoofed: true,
      }
      if (!(this.altStore.has(mainChar.accountId))) {
        this.altStore.set(mainChar.accountId, [mainChar.characterId])
      }
      const altList = this.altStore.get(mainChar.accountId) ?? []
      altList.push(currentChar.characterId)
      this.altStore.set(mainChar.accountId, [...new Set(altList)])

      this.characterStore.set(mainTotalChar.characterId, serializeCharacterInfo(mainTotalChar))
    }
    // update current character info
    this.characterStore.set(currentChar.characterId, serializeCharacterInfo(currentChar))
    return {
      ...currentChar,
      mainCharacterName: mainChar?.nickname ?? "",
    } as TotalCharacterInfo & { mainCharacterName: string }
  }
}