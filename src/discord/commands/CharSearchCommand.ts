import { ActionRowBuilder, AttachmentBuilder, CacheType, CommandInteraction, EmbedBuilder, Interaction, SelectMenuBuilder, User } from "discord.js"
import type { BotInit } from "../botinit.js"
import { Command, CommandTools } from "../command.js"
import { SlashCommandBuilder } from "discord.js"
import { fetchGuildRank, fetchMainCharacterByName, fetchTrophyCount } from "../../ms2/ms2fetch.js"
import Debug from "debug"
import { JobIcon } from "../jobicon.js"
import { Job, JobNameMap, TotalCharacterInfo } from "../../ms2/charinfo.js"
import { CharId } from "../../ms2/structure/CharId.js"
import got from "got"
import { MS2Database } from "../../ms2/ms2database.js"
import { CharacterNotFoundError, InternalServerError } from "../../ms2/fetcherror.js"

const debug = Debug("discordbot:debug:charsearch")

type TrophyCharId = CharId & { trophyRank: number, profileURL: string }

export class CharSearchCommand implements Command {
  public slash = new SlashCommandBuilder()
    .setName("캐릭터검색")
    .setDescription("캐릭터에 대한 정보를 검색합니다.")
    .addStringOption(option =>
      option.setName("이름")
        .setDescription("검색할 캐릭터의 이름")
        .setRequired(true)
    )

  public async execute(interaction: CommandInteraction<CacheType>, bot: BotInit, tool: CommandTools) {
    const nickname = interaction.options.get("이름")?.value?.toString() ?? ""
    if (nickname.length <= 1) {
      await tool.replySimple("캐릭터 이름은 2글자 이상이에요.")
      return
    } else if (nickname.indexOf(" ") >= 0) {
      await tool.replySimple("캐릭터 이름에 공백이 있으면 안돼요. (한분 계시긴 합니다만...)")
      return
    }
    await interaction.deferReply()

    const { embed, selectBox, attaches } = await this.searchUser(nickname, interaction.user.id, bot.ms2db)
    if (selectBox != null) {
      await interaction.editReply({
        embeds: [embed],
        components: [selectBox],
        files: attaches,
      })
    } else {
      await interaction.editReply({
        embeds: [embed],
        files: attaches,
      })
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
      await interaction.deferUpdate()
      // code
      const nickname = interaction.values[0] ?? ""
      const { embed, selectBox, attaches } = await this.searchUser(nickname, interaction.user.id, bot.ms2db)
      if (selectBox != null) {
        await interaction.editReply({
          embeds: [embed],
          components: [selectBox],
          files: attaches,
        })
      } else {
        await interaction.editReply({
          embeds: [embed],
          files: attaches,
        })
      }
    }
    return true
  }

  protected async buildSelectBox(accountId: string | bigint, ms2UserId: bigint, ms2db: MS2Database, discordUserId: string) {
    if (accountId === 0n || accountId === "0") {
      return null
    }
    const characters = ms2db.queryCharactersByAccount(BigInt(accountId)).sort((a, b) => {
      return CommandTools.compareBigInt(a.characterId, b.characterId)
    })
    if (characters.length <= 0) {
      return null
    }
    const optMap = characters.map((v) => {
      const out = {
        label: v.nickname,
        description: "",
        value: v.nickname,
        emoji: "❔",
        default: ms2UserId === v.characterId,
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

    const row = new ActionRowBuilder<SelectMenuBuilder>()
      .addComponents(
        new SelectMenuBuilder()
          .setCustomId(CommandTools.createCustomId("charsearch-chain-opt", discordUserId))
          .setPlaceholder("🔍 검색할 부캐를 선택해주세요.")
          .addOptions(optMap)
          .setDisabled(optMap.length <= 1)
      )
    return row
  }

  protected async searchUser(nickname: string, userid: string, ms2db: MS2Database) {

    let userinfo: TotalCharacterInfo | null = null
    try {
      const trophy = await fetchTrophyCount(nickname)
      const cid = trophy.characterId
      // check character info is in characterStore

      let _charInfo = ms2db.queryCharacterById(BigInt(cid))
      // Parse and put charInfo if not exist
      if (_charInfo == null) {
        const mainCharacter = await fetchMainCharacterByName(nickname)
        if (mainCharacter != null) {
          _charInfo = {
            characterId: BigInt(cid),
            nickname,
            job: 0,
            level: -1,
            trophy: trophy.trophyCount,
            mainCharacterId: BigInt(mainCharacter.characterId),
            accountId: BigInt(mainCharacter.accountId),
            lastUpdatedTime: BigInt(Date.now()),
            isNicknameObsoleted: 0,
          }
          if (mainCharacter.characterId !== trophy.characterId) {
            // Add main character to db
            const mainCharInfo: CharId = {
              characterId: BigInt(mainCharacter.characterId),
              nickname: mainCharacter.nickname,
              job: 0,
              level: -1,
              trophy: -1,
              mainCharacterId: BigInt(mainCharacter.characterId),
              accountId: BigInt(mainCharacter.accountId),
              lastUpdatedTime: BigInt(Date.now()),
              isNicknameObsoleted: 0,
            }
            ms2db.insertCharacterInfo(mainCharInfo)
          }
        } else {
          _charInfo = {
            characterId: BigInt(cid),
            nickname,
            job: 0,
            level: -1,
            trophy: trophy.trophyCount,
            mainCharacterId: BigInt(0),
            accountId: BigInt(0),
            lastUpdatedTime: BigInt(Date.now()),
            isNicknameObsoleted: 0,
          }
        }
        ms2db.insertCharacterInfo(_charInfo)
      }
      const charInfo: TrophyCharId = {
        ..._charInfo!!,
        trophy: trophy.trophyCount,
        trophyRank: trophy.trophyRank,
        profileURL: trophy.profileURL,
      }

      const embed = await this.buildUserInfo(charInfo, ms2db)
      const selectBox = await this.buildSelectBox(charInfo.accountId ?? 0n, charInfo.characterId, ms2db, userid)
      return {
        success: true,
        embed: embed.embed,
        attaches: embed.attaches,
        selectBox: selectBox,
      }
    } catch (err) {
      const embed = new EmbedBuilder()
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
      return { success: false, embed: embed, attaches: [], selectBox: null }
    }
  }

  protected async buildUserInfo(ms2user: TrophyCharId, ms2db: MS2Database) {
    // main character
    const spoofedMain = ms2user.accountId != null && ms2user.accountId > 0n
    const mainUser = spoofedMain ? ms2db.queryCharacterById(ms2user.mainCharacterId!!) : null
    // init values
    const attaches: AttachmentBuilder[] = []
    const embed = new EmbedBuilder()
    // thumbnail
    const characterProfileBuffer = await got(ms2user.profileURL).buffer()
    attaches.push(
      new AttachmentBuilder(characterProfileBuffer)
        .setName("char_profile.png")
    )
    embed.setThumbnail("attachment://char_profile.png")
    // main header icon
    if (mainUser != null && mainUser.characterId !== ms2user.characterId) {
      // Main Character Icon
      const mainTrophyInfo = await fetchTrophyCount(mainUser.nickname)
      const mainProfile = new AttachmentBuilder(await got(mainTrophyInfo.profileURL).buffer()).setName("main_profile.png")
      attaches.push(mainProfile)
      embed.setAuthor({
        name: mainUser.nickname,
        iconURL: "attachment://main_profile.png",
      })
    } else {
      embed.setAuthor({
        name: ms2user.nickname,
        iconURL: "attachment://char_profile.png",
      })
    }
    // color
    embed.setColor("#57f288")
    // description
    // embed.setDescription("🔍 자료가 부족합니다. 😭\n")
    // username
    embed.setTitle(`${JobIcon[ms2user.job]} ${ms2user.nickname}`)
    // trophy, job, level, character id
    embed.addFields({
      name: "🏆 트로피",
      value: `${CommandTools.commaNumber(ms2user.trophy)}개 (${ms2user.trophyRank}위)`,
      inline: true,
    }, {
      name: "💼 직업",
      value: `${JobIcon[ms2user.job]} ${JobNameMap[ms2user.job]}`,
      inline: true,
    }, {
      name: "📈 레벨",
      value: `Lv. ${ms2user.level}`,
      inline: true,
    }, {
      name: "🔑 캐릭터 식별자",
      value: ms2user.characterId.toString(),
      inline: false,
    })
    // account related identification
    if (mainUser != null) {
      embed.addFields({
        name: "🔐 계정 식별자",
        value: ms2user.accountId?.toString() ?? "없음",
        inline: false,
      }, {
        name: "👤 메인 캐릭터",
        value: `${JobIcon[mainUser.job]} ${mainUser.nickname}`,
        inline: false,
      })
      // Character List
      const charList = ms2db.queryCharactersByAccount(ms2user.accountId!!).sort((a, b) => {
        return CommandTools.compareBigInt(a.characterId, b.characterId)
      })
      let leftStr = ""
      let rightStr = ""

      const makeLevelStr = (c: CharId, bold: boolean) => {
        if (bold) {
          return `**Lv.${c.level} ${c.nickname}**`
        } else {
          return `Lv.${c.level} ${c.nickname}`
        }
      }
      if (charList.length <= 8) {
        for (const c of charList) {
          const isBold = c.characterId === ms2user.characterId
          leftStr += `${JobIcon[c.job]} ${makeLevelStr(c, isBold)}\n`
        }
      } else {
        const half = Math.ceil(charList.length / 2)
        for (let i = 0; i < half; i++) {
          const c = charList[i]!!
          const isBold = c.characterId === ms2user.characterId
          leftStr += `${JobIcon[c.job]} ${makeLevelStr(c, isBold)}\n`
        }
        for (let i = half; i < charList.length; i += 1) {
          const c = charList[i]!!
          const isBold = c.characterId === ms2user.characterId
          rightStr += `${JobIcon[c.job]} ${makeLevelStr(c, isBold)}\n`
        }
      }
      if (leftStr.length > 0) {
        embed.addFields({
          name: "👥 캐릭터 목록",
          value: leftStr,
          inline: rightStr.length > 0,
        })
      }
      if (rightStr.length > 0) {
        embed.addFields({
          name: "📝 2페이지",
          value: rightStr,
          inline: true,
        })
      }
    }
    return {
      embed: embed,
      attaches: attaches,
    }
  }
}