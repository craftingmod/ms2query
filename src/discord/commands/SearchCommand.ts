import { ActionRowBuilder, AttachmentBuilder, ButtonBuilder, ButtonStyle, CacheType, CommandInteraction, EmbedBuilder, Interaction, Options, SelectMenuBuilder, User } from "discord.js"
import type { BotInit } from "../botinit.js"
import { Command, CommandTools } from "../command.js"
import { SlashCommandBuilder } from "discord.js"
import { constructHouseRankURL, constructTrophyURL, expandProfileURL, FALLBACK_PROFILE, fetchClearedRate, fetchGuestBook, fetchGuildRank, fetchMainCharacterByName, fetchTrophyCount, shirinkProfileURL, trophyURL } from "../../ms2/ms2fetch.js"
import Debug from "debug"
import { JobIcon } from "../jobicon.js"
import got from "got"
import { MS2Database } from "../../ms2/ms2database.js"
import { Job, JobNameMap, TrophyCharacterInfo } from "../../ms2/ms2CharInfo.js"
import { CharacterStoreInfo } from "../../ms2/database/CharacterInfo.js"
import { addMonths, getDay, getMonth, getYear, isBefore, isFuture, startOfMonth, subDays, subMonths } from "date-fns"
import { InternalServerError } from "../../ms2/fetcherror.js"
import { DungeonId, dungeonNameMap } from "../../ms2/dungeonid.js"
import { ClearInfo } from "../../ms2/database/ClearInfo.js"
import AdmZip from "adm-zip"
import xlsx from "node-xlsx"

const debug = Debug("discordbot:debug:charsearch")
const rejectAutoComplete = [DungeonId.NUTAMAN, DungeonId.KANDURA, DungeonId.REVERSE_PINKBEAN, DungeonId.LUKARAX_56, DungeonId.NORMAL_ROOK]
// 던전 선택지
const dungeonChocies = Object.entries(dungeonNameMap).map((v) => ({
  name: v[0],
  value: v[1].toString(),
})).filter((v) => {
  return !rejectAutoComplete.includes(Number(v.value) as DungeonId)
})

const charSearchTag = "char-search"
const searchCIDTag = "dungeon-search-cid"
const searchMonthTag = "dungeon-search-month"

type SheetData = Array<string | number | boolean | null | Date>[]

export class SearchCommand implements Command {
  public slash = new SlashCommandBuilder()
    .setName("검색")
    .setDescription("메이플스토리2 관련 정보를 검색합니다.")
    .addSubcommand(subcommand =>
      subcommand.setName("캐릭터")
        .setDescription("특정 캐릭터의 정보를 조회합니다.")
        .addStringOption(option =>
          option.setName("이름")
            .setDescription("조회할 캐릭터의 이름")
            .setRequired(true)
        )
    )
    .addSubcommand(subcommand =>
      subcommand.setName("던전")
        .setDescription("특정 캐릭터의 던전 기록을 조회합니다.")
        .addStringOption(option =>
          option.setName("던전이름")
            .setDescription("조회할 던전의 이름")
            .setRequired(true)
            .addChoices(...dungeonChocies)
        )
        .addStringOption(option =>
          option.setName("이름")
            .setDescription("조회할 캐릭터의 이름")
            .setRequired(true)
        )
        .addIntegerOption(option =>
          option.setName("날짜")
            .setDescription("조회할 날짜입니다. YYYYMM 형식으로 받습니다. (예시: 202210)")
            .setRequired(false)
        )
    )
    .addSubcommand(subcommand =>
      subcommand.setName("던전덤프")
        .setDescription("특정 캐릭터의 던전 기록을 모두 덤프합니다.")
        .addStringOption(option =>
          option.setName("이름")
            .setDescription("조회할 캐릭터의 이름")
            .setRequired(true)
        )
        .addBooleanOption(option =>
          option.setName("계정")
            .setDescription("계정에 있는 모든 캐릭터를 덤프합니다.")
            .setRequired(false)
        )
        .addStringOption(option =>
          option.setName("던전이름")
            .setDescription("덤프할 던전의 이름 (없으면 모두)")
            .setRequired(false)
            .addChoices(...dungeonChocies)
        )
    )
    .addSubcommand(subcommand =>
      subcommand.setName("방명록")
        .setDescription("특정 캐릭터의 방명록을 조회합니다.")
        .addStringOption(option =>
          option.setName("이름")
            .setDescription("조회할 캐릭터의 이름")
            .setRequired(true)
        )
        .addIntegerOption(option =>
          option.setName("페이지")
            .setDescription("조회할 페이지")
            .setRequired(false)
        )
    )

  public async execute(interaction: CommandInteraction<CacheType>, bot: BotInit, tool: CommandTools) {
    const ms2db = bot.ms2db
    for (const subCommand of interaction.options.data) {
      if (subCommand.name === "캐릭터") {
        // 캐릭터 쿼리 타입인경우
        // 이름 유효성 체크
        let nickname = interaction.options.get("이름")?.value?.toString() ?? ""
        if (nickname.length <= 1 || nickname.indexOf(" ") >= 0) {
          await tool.replySimple("캐릭터 이름은 2글자 이상이고 띄어쓰기가 없어야 해요.")
          return
        }

        // 응답 늦추기
        await interaction.deferReply()
        // 캐릭터 정보 응답
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
      } else if (subCommand.name === "던전") {
        // 던전 쿼리 타입인경우
        // 이름 유효성 체크
        const nickname = interaction.options.get("이름")?.value?.toString() ?? ""
        // 날짜..
        const nowDate = new Date(Date.now())
        const customDate = interaction.options.get("날짜")?.value as number ?? CommandTools.toYYYYMM(nowDate)
        if (nickname.length <= 1 || nickname.indexOf(" ") >= 0) {
          await tool.replySimple("캐릭터 이름은 2글자 이상이고 띄어쓰기가 없어야 해요.")
          return
        }
        // 응답 늦추기
        await interaction.deferReply()
        // 던전 종류
        const dungeonIdStr = interaction.options.get("던전이름")?.value?.toString() ?? ""
        const dungeonType = Number.parseInt(dungeonIdStr)
        // 던전 데이터베이스 테이블
        const dungeonTable = ms2db.dungeonHistories.get(dungeonType)!!
        // 캐릭터 정보 불러오기
        const trophyCharacter = await fetchTrophyCount(nickname)
        if (trophyCharacter == null) {
          await interaction.editReply({
            content: `${nickname} 캐릭터를 찾을 수 없습니다.`,
          })
          return
        }
        const charInfo = ms2db.queryCharacterById(trophyCharacter.characterId)
        if (charInfo == null) {
          await interaction.editReply({
            content: `기록된 ${nickname} 캐릭터의 정보가 없습니다.`,
          })
          return
        }
        const historyResult = await this.makeHistoryEmbed(charInfo.characterId, dungeonType, CommandTools.parseYYYYMM(customDate), ms2db, interaction.user.id)
        if (historyResult == null) {
          await interaction.editReply({
            content: `${charInfo.nickname}님에 대한 기록이 없습니다.`,
          })
          break
        }
        await interaction.editReply({
          embeds: [historyResult.embed],
          components: historyResult.components,
        })
      } else if (subCommand.name === "던전덤프") {
        // 이름 유효성 체크
        const nickname = interaction.options.get("이름")?.value?.toString() ?? ""
        if (nickname.length <= 1 || nickname.indexOf(" ") >= 0) {
          await tool.replySimple("캐릭터 이름은 2글자 이상이고 띄어쓰기가 없어야 해요.")
          return
        }
        const charInfo = ms2db.queryCharacterByName(nickname, false)
        if (charInfo == null) {
          await tool.replySimple("캐릭터를 찾을 수 없습니다.")
          return
        }
        // 계정 덤프인지 체크
        const isAccountDump = interaction.options.get("계정")?.value as boolean ?? false
        // 특정 던전만 덤프인지 체크
        const targetDungeonStr = interaction.options.get("던전이름")?.value as string | null
        const targetDungeon = targetDungeonStr == null ? null : Number(targetDungeonStr) as DungeonId | null
        // 순회할 캐릭터들
        const characters = [charInfo]
        if (isAccountDump && (charInfo.accountId ?? 0n) !== 0n) {
          const accChars = ms2db.queryCharactersByAccount(charInfo.accountId!!)
          for (const char of accChars) {
            if (charInfo.characterId !== char.characterId) {
              characters.push(char)
            }
          }
        }
        // 던전 순회
        await interaction.deferReply()
        // 정해진 던전 or 모든 던전
        const dungeons = (targetDungeon != null) ? [targetDungeon] : Object.values(dungeonNameMap)
        // 던전 이름 목록
        const dungeonNames = dungeons.map((d) => {
          const name = Object.entries(dungeonNameMap).find((v) => v[1] === d)!![0]
          if (name == null) {
            throw new Error("DungeonId에 대응되는 이름(dungeonNameMap)을 넣어주세요!!!")
          }
          return name
        })
        // 파일은 하나로
        // 엑셀 데이터
        const sheets: Array<{ name: string, data: SheetData, options: object }> = []
        // 헤더(첫 페이지) 데이터
        const headerData: SheetData = [
          ["뽑은 날짜", new Date(Date.now())],
          [""],
          ["닉네임", "CID", ...dungeonNames]
        ]
        // 캐릭터별 클리어 횟수 모음
        const charClearRates: Map<bigint, number[]> = new Map()
        // 던전마다 순회
        for (let i = 0; i < dungeons.length; i++) {
          const dungeonId = dungeons[i]!!
          // 던전 이름
          const dungeonName = dungeonNames[i]!!
          // 데이터
          const data: Array<string | number | boolean | null | Date>[] = [
            ["clearRank", "clearDate", "clearSec", "playCharacter", "leader", "member1", "member2", "member3", "member4", "member5", "member6", "member7", "member8", "member9", "member10"],
          ]
          // 던전 테이블
          const dungeonTable = ms2db.dungeonHistories.get(dungeonId)
          if (dungeonTable == null) {
            throw new Error("던전에 매칭되는 테이블을 찾을 수 없습니다!")
          }
          const clearInfo: Array<ReturnType<typeof parseHistory> & { charName: string }> = []
          // 캐릭터별 클리어 파티들 모두 쿼리
          for (const char of characters) {
            const characterId = char.characterId
            // 들어간 파티 조회
            const parties = dungeonTable.findMany({
              member1: characterId,
              member2: characterId,
              member3: characterId,
              member4: characterId,
              member5: characterId,
              member6: characterId,
              member7: characterId,
              member8: characterId,
              member9: characterId,
              member10: characterId,
            }, {
              queryAsOR: true,
            }).map((v) => ({
              ...parseHistory(v, ms2db),
              charName: char.nickname,
            }))
            // 클리어 파티에 넣기
            clearInfo.push(...parties)
            // 클리어 횟수 추가
            if (!charClearRates.has(characterId)) {
              charClearRates.set(characterId, new Array(dungeons.length).fill(0))
            }
            const clearRates = charClearRates.get(characterId)!!
            clearRates[i] = parties.length
            // 넣고 끝
          }
          // 클리어 파티 정렬 (내림차)
          clearInfo.sort((a, b) => b.clearRank - a.clearRank)
          // 데이터에 넣기
          for (const party of clearInfo) {
            const row: Array<string | number | boolean | null | Date> = [party.clearRank, this.clearDateToDate(party.clearDate), party.clearSec, party.charName, party.leader?.nickname ?? ""]
            for (let i = 0; i < 10; i += 1) {
              if (i < party.members.length) {
                const member = party.members[i]!!
                row.push(member.nickname)
              } else {
                row.push(null)
              }
            }
            data.push(row)
          }
          // 여백 설정
          const cols = [{ wch: 8 }, { wch: 10 }, { wch: 8 }, { wch: 12 }]
          for (let i = 0; i < 11; i += 1) {
            cols.push({ wch: 12 })
          }
          // 시트 넣기
          sheets.push({
            name: dungeonName,
            data,
            options: { "!cols": cols },
          })
        }
        // 헤더 시트 빌드
        for (const char of characters) {
          const clearRates = charClearRates.get(char.characterId)
          if (clearRates == null) {
            headerData.push([char.nickname, char.characterId.toString(), ...new Array(dungeons.length).fill(0)])
            continue
          }
          headerData.push([char.nickname, char.characterId.toString(), ...clearRates])
        }
        // 헤더 시트 넣기
        sheets.unshift({
          name: "요약",
          data: headerData,
          options: { "!cols": [{ wch: 12 }, { wch: 20 }] },
        })
        // 출력 캐릭터이름?
        const outCharId = ((charInfo.mainCharacterId ?? 0n) === 0n) ? charInfo.characterId : charInfo.mainCharacterId!!
        // Xlsx 출력
        const xlsxBuffer = xlsx.build(sheets)
        let xlsxAttaches: AttachmentBuilder
        // 파일 첨부 (너무 크면 압축)
        if (xlsxBuffer.length > 2 * 1024 * 1024) {
          // BIG SIZE
          const zip = new AdmZip()
          zip.addFile(`dungeons-${nickname}.xlsx`, xlsxBuffer)
          const zipBuf = zip.toBuffer()
          if (zipBuf.length > 8 * 1024 * 1024) {
            await interaction.editReply("파일이 너무 큽니다.")
            return
          }
          xlsxAttaches = new AttachmentBuilder(zipBuf)
          xlsxAttaches.setName(`dungeons-${outCharId}.zip`)
        } else {
          xlsxAttaches = new AttachmentBuilder(xlsxBuffer)
          xlsxAttaches.setName(`dungeons-${outCharId}.xlsx`)
        }
        // Embed 생성
        const { embed, selectBox, attaches } = await this.searchUser(nickname, interaction.user.id, bot.ms2db)
        try {
          await interaction.editReply({
            content: `${nickname}님의 ${isAccountDump ? "계정" : "캐릭터"} 던전 기록 덤프입니다.`,
            embeds: [embed],
            files: [...attaches, xlsxAttaches],
          })
        } catch (err) {
          console.error(err)
          await interaction.editReply({
            content: "보내기에 실패했습니다.",
          })
        }
      } else if (subCommand.name === "방명록") {
        // 토큰 있는지 검사
        const token = bot.globalConfig["guestbooktoken"]
        if (token == null) {
          await interaction.editReply("방명록 조회를 위한 token이 없습니다. 관리자에게 문의해주세요.")
          return
        }
        // 닉네임
        const nickname = interaction.options.get("이름")?.value?.toString() ?? ""
        const page = Math.max(1, Number(interaction.options.get("페이지")?.value ?? 1))
        // 응답 늦추기
        await interaction.deferReply()
        // 캐릭터 정보 가져오기
        const charInfo = ms2db.queryCharacterByName(nickname, false)
        if (charInfo == null) {
          await interaction.editReply("캐릭터를 찾을 수 없습니다.")
          return
        }
        if (charInfo.accountId == null || charInfo.accountId === 0n) {
          await interaction.editReply("계정 정보를 찾을 수 없는 캐릭터입니다.")
          return
        }
        // 메인 캐릭터 정보
        const mainCharInfo = ms2db.queryCharacterById(charInfo.mainCharacterId ?? -200n)
        // 방명록
        const guestBook = await fetchGuestBook(token, charInfo.accountId, page)
        if (guestBook == null) {
          await interaction.editReply("방명록 조회에 실패했습니다.")
          return
        }
        // Embed 만들기
        const embed = new EmbedBuilder()
        if (mainCharInfo != null) {
          embed.setAuthor({
            name: mainCharInfo.nickname,
            iconURL: expandProfileURL(mainCharInfo.profileURL),
          })
        }
        embed.setThumbnail(expandProfileURL(charInfo.profileURL))
        embed.setTitle(`${JobIcon[charInfo.job as Job | null ?? Job.UNKNOWN]} ${nickname} (${page} 페이지)`)
        // 방명록을 embed에 넣기
        let desc = `* 총 ${guestBook.commentCount}개의 방명록이 있습니다.\n\n`
        for (const comment of guestBook.comments) {
          if (comment.isOwner === 1) {
            desc += `**[집주인]** ${CommandTools.escapeMarkdown(comment.comment)}\n`
          } else {
            desc += `${JobIcon[comment.job as Job]} **[Lv.${comment.level} ${comment.nickname}]** ${CommandTools.escapeMarkdown(comment.comment)}\n`
          }
          if (comment.replyComment != null) {
            desc += `ㄴ **[집주인]** ${CommandTools.escapeMarkdown(comment.replyComment)}\n`
          }
          desc += "\n"
        }
        embed.setDescription(desc)
        await interaction.editReply({
          content: `${nickname}님의 방명록입니다.`,
          embeds: [embed],
        })
      }
    }
  }
  public async executeRaw(interaction: Interaction<CacheType>, bot: BotInit) {
    const customId = (interaction as any)["customId"] as string | undefined
    if (customId == null) {
      return true
    }
    const { tag, userid } = CommandTools.parseCustomId(customId)
    // 선택 메뉴
    if (interaction.isSelectMenu()) {
      // 본인 확인
      if (userid !== interaction.user.id) {
        await interaction.reply({
          embeds: [CommandTools.makeErrorMessage("선택권은 메시지 주인에게만 있어요!")],
          ephemeral: true,
        })
        return true
      }
      if (tag.startsWith(charSearchTag)) {
        await interaction.deferUpdate()
        // 닉네임 
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
      } else if (tag.startsWith(searchCIDTag)) {
        // 닉네임
        const nickname = interaction.values[0] ?? ""
        if (nickname.length <= 0) {
          await interaction.editReply({
            content: `잘못된 선택입니다.`,
          })
          return false
        }
        await interaction.deferUpdate()
        // CID 불러오기
        const dataTag = tag.substring(searchCIDTag.length)
        const [targetYYYYMMStr, dummy, dungeonIdStr] = dataTag.split("-") as [string, string, string]
        const character = bot.ms2db.queryCharacterByName(nickname, false)
        if (character == null) {
          await interaction.editReply({
            content: `캐릭터를 찾을 수 없습니다.`,
          })
          return false
        }
        // 코드 복붙
        const dungeonId = Number(dungeonIdStr) as DungeonId
        const targetYYYYMM = CommandTools.parseYYYYMM(Number(targetYYYYMMStr))
        // embed
        const embedObj = await this.makeHistoryEmbed(character.characterId, dungeonId, targetYYYYMM, bot.ms2db, userid)
        if (embedObj == null) {
          await interaction.editReply({
            content: "데이터가 없습니다.",
          })
          return false
        }
        await interaction.editReply({
          embeds: [embedObj.embed],
          components: embedObj.components,
        })
        return false
      }
      // 선택 메뉴 끝
    } else if (interaction.isButton()) {
      // 버튼
      if (tag.startsWith(searchMonthTag)) {
        // Month 옮기기?
        await interaction.deferUpdate()
        const dataTag = tag.substring(searchMonthTag.length)
        const [targetYYYYMMStr, charIdStr, dungeonIdStr] = dataTag.split("-") as [string, string, string]
        const characterId = BigInt(charIdStr)
        const dungeonId = Number(dungeonIdStr) as DungeonId
        const targetYYYYMM = CommandTools.parseYYYYMM(Number(targetYYYYMMStr))
        // embed
        const embedObj = await this.makeHistoryEmbed(characterId, dungeonId, targetYYYYMM, bot.ms2db, userid)
        if (embedObj == null) {
          await interaction.editReply({
            content: "데이터가 없습니다.",
          })
          return false
        }
        await interaction.editReply({
          embeds: [embedObj.embed],
          components: embedObj.components,
        })
        return false
      }
    }
    return true
  }

  protected async buildSelectBox(accountId: string | bigint, ms2UserId: bigint, ms2db: MS2Database, discordUserId: string, customTag: string) {
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
        isObsoleted: v.isNicknameObsoleted !== 0,
      }
      if ((v.level ?? 0) > 0) {
        out.description += "Lv." + v.level + " "
      }
      if (v.job !== Job.UNKNOWN) {
        const job = (v.job ?? Job.UNKNOWN) as Job
        out.emoji = JobIcon[job]
        out.description += JobNameMap[job]
      }
      if (out.description.length <= 0) {
        out.description = "정보 없음"
      }
      if (out.emoji.length <= 0) {
        out.emoji = "❔"
      }
      return out
    })
    const uniqueOptMap = optMap.filter((v, i, a) => {
      return !v.isObsoleted && a.findIndex((v2) => v2.label === v.label) === i
    })

    const row = new ActionRowBuilder<SelectMenuBuilder>()
      .addComponents(
        new SelectMenuBuilder()
          .setCustomId(CommandTools.createCustomId(customTag, discordUserId))
          .setPlaceholder("🔍 검색할 부캐를 선택해주세요.")
          .addOptions(uniqueOptMap)
          .setDisabled(uniqueOptMap.length <= 1)
      )
    return row
  }

  protected async searchUser(nickname: string, userid: string, ms2db: MS2Database) {
    // Embed 만드는 함수 압축
    const makeEmbed = async (charInfo: CharacterStoreInfo, trophyInfo: TrophyCharacterInfo | null) => {
      let profile = trophyInfo?.profileURL ?? null
      if (profile == null) {
        profile = charInfo.profileURL
      }
      const safeCharInfo = {
        ...charInfo,
        trophy: trophyInfo?.trophyCount ?? charInfo?.trophy ?? 0,
        trophyRank: trophyInfo?.trophyRank ?? -1,
        profileURL: profile == null ? FALLBACK_PROFILE : shirinkProfileURL(profile),
      }

      const embed = await this.buildUserInfo(safeCharInfo, ms2db)
      const selectBox = await this.buildSelectBox(charInfo.accountId ?? 0n, charInfo.characterId, ms2db, userid, charSearchTag)
      return {
        success: true,
        embed: embed.embed,
        attaches: embed.attaches,
        selectBox: selectBox,
      }
    }
    try {
      const nowDate = new Date(Date.now())
      const prevDate = subMonths(nowDate, 1)
      const trophy = await fetchTrophyCount(nickname)
      // 검색 결과가 없으면
      if (trophy == null) {
        // 1. 데이터베이스에 있는지 확인
        const cachedCharacter = ms2db.queryCharacterByName(nickname, false)
        // 캐시된 캐릭터가 있으면 그걸 표시
        if (cachedCharacter != null) {
          return makeEmbed(cachedCharacter, null)
        }
        // 캐시된 캐릭터가 없으면...
        // 본캐 찾아보기
        const mainChar = await fetchMainCharacterByName(nickname)
        // 2. 본캐가 있으면
        if (mainChar != null) {
          // 본캐 정보 가지고오기
          const mainCharDB = ms2db.queryCharacterById(mainChar.characterId)
          const mainTrophy = await fetchTrophyCount(mainChar.nickname)
          // 데이터베이스에 있으면
          if (mainCharDB != null) {
            // 그 정보로 출력
            const result = await makeEmbed(mainCharDB, mainTrophy)
            result.embed.setAuthor({
              name: nickname,
              iconURL: FALLBACK_PROFILE,
            })
            return result
          }
          // 데이터베이스에 본캐 정보가 없으면...
          // 단순 정보 출력
          const result = await makeEmbed({
            ...mainChar,
            isNicknameObsoleted: 0,
            trophy: mainTrophy?.trophyCount ?? 0,
            houseQueryDate: 0,
            starHouseDate: null,
            lastUpdatedTime: new Date(Date.now()),
          }, mainTrophy)
          // Author 조정
          result.embed.setAuthor({
            name: nickname,
            iconURL: FALLBACK_PROFILE,
          })
          return result
        } else {
          // 본캐가 없으면 실패
          const embed = new EmbedBuilder()
          embed.setTitle(":warning: 오류!")
          embed.setDescription(`\`${nickname}\` 캐릭터를 찾을 수 없습니다. 이름을 제대로 입력했는지 확인해 주세요.`)
          return { success: false, embed: embed, attaches: [], selectBox: null }
        }
      }

      const cid = trophy.characterId
      // check character info is in characterStore
      let charInfo: CharacterStoreInfo | null = ms2db.queryCharacterById(BigInt(cid))
      // Parse and put charInfo if not exist
      if (charInfo == null) {
        const mainCharInfo = await fetchMainCharacterByName(nickname)
        if (mainCharInfo != null) {
          charInfo = {
            characterId: BigInt(cid),
            nickname: nickname,
            job: null,
            level: null,
            trophy: trophy.trophyCount,
            mainCharacterId: BigInt(mainCharInfo.characterId),
            accountId: BigInt(mainCharInfo.accountId),
            isNicknameObsoleted: 0,
            houseQueryDate: CommandTools.toYYYYMM(prevDate),
            starHouseDate: mainCharInfo.houseDate,
            houseName: mainCharInfo.houseName,
            profileURL: shirinkProfileURL(trophy.profileURL),
            lastUpdatedTime: nowDate,
          }
          if (mainCharInfo.characterId !== trophy.characterId) {
            // Add main character to db
            ms2db.insertCharacterInfo({
              characterId: BigInt(mainCharInfo.characterId),
              nickname: mainCharInfo.nickname,
              job: 0,
              level: null,
              trophy: null,
              mainCharacterId: BigInt(mainCharInfo.characterId),
              accountId: BigInt(mainCharInfo.accountId),
              isNicknameObsoleted: 0,
              houseQueryDate: CommandTools.toYYYYMM(prevDate),
              starHouseDate: mainCharInfo.houseDate,
              houseName: mainCharInfo.houseName,
              profileURL: shirinkProfileURL(mainCharInfo.profileURL),
              lastUpdatedTime: new Date(Date.now()),
            })
          }
        } else {
          charInfo = {
            characterId: BigInt(cid),
            nickname,
            job: null,
            level: null,
            trophy: trophy.trophyCount,
            mainCharacterId: BigInt(0),
            accountId: BigInt(0),
            isNicknameObsoleted: 0,
            houseQueryDate: CommandTools.toYYYYMM(prevDate),
            starHouseDate: null,
            houseName: null,
            profileURL: shirinkProfileURL(trophy.profileURL),
            lastUpdatedTime: new Date(Date.now()),
          }
        }
        ms2db.insertCharacterInfo(charInfo)
      }
      const safeCharInfo = {
        ...charInfo,
        trophy: trophy.trophyCount,
        trophyRank: trophy.trophyRank,
        profileURL: shirinkProfileURL(trophy.profileURL),
      }

      const embed = await this.buildUserInfo(safeCharInfo, ms2db)
      const selectBox = await this.buildSelectBox(charInfo.accountId ?? 0n, charInfo.characterId, ms2db, userid, charSearchTag)
      return {
        success: true,
        embed: embed.embed,
        attaches: embed.attaches,
        selectBox: selectBox,
      }
    } catch (err) {
      const embed = new EmbedBuilder()
      if (err instanceof InternalServerError) {
        embed.setTitle(":warning: 오류!")
        embed.setDescription(`서버와 통신에 오류가 발생하였습니다. 잠시 후 다시 시도해 주세요.`)
      } else {
        embed.setTitle(":warning: 오류!")
        embed.setDescription(`봇이 고장났어요.\n` + err)
        debug(err)
      }
      return { success: false, embed: embed, attaches: [], selectBox: null }
    }
  }

  protected async buildUserInfo(ms2user: CharacterStoreInfo & { trophyRank: number }, ms2db: MS2Database) {
    let description = ""
    // main character
    const spoofedMain = ms2user.accountId != null && ms2user.accountId > 0n
    const mainUser = spoofedMain ? ms2db.queryCharacterById(ms2user.mainCharacterId!!) : null
    // init values
    const attaches: AttachmentBuilder[] = []
    const embed = new EmbedBuilder()
    // thumbnail
    const characterProfileBuffer = await got(
      expandProfileURL(ms2user.profileURL ?? FALLBACK_PROFILE),
    ).buffer()
    attaches.push(
      new AttachmentBuilder(characterProfileBuffer)
        .setName("char_profile.png")
    )
    embed.setThumbnail("attachment://char_profile.png")
    // Trophy link
    description += `[🏆 트로피 랭킹](${constructTrophyURL(ms2user.nickname)})\n`
    // main header icon
    if (mainUser != null) {
      // 프로필
      if (mainUser.characterId !== ms2user.characterId) {
        // Use cache or fetch
        let mainProfileURL = mainUser.profileURL
        if (mainProfileURL == null || !MS2Database.isProfileValid(mainUser)) {
          mainProfileURL = (await fetchTrophyCount(mainUser.nickname))?.profileURL ?? FALLBACK_PROFILE
        } else {
          mainProfileURL = expandProfileURL(mainProfileURL)
        }
        const mainProfile = new AttachmentBuilder(await got(
          expandProfileURL(mainProfileURL),
        ).buffer()).setName("main_profile.png")
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
      // 집 랭킹
      if (mainUser.starHouseDate != null) {
        description += `[🏠 집 랭킹](${constructHouseRankURL(ms2user.nickname, mainUser.starHouseDate)})\n`
      }
    } else {
      embed.setAuthor({
        name: ms2user.nickname,
        iconURL: "attachment://char_profile.png",
      })
    }
    if (mainUser != null && mainUser.characterId !== ms2user.characterId) {
      // Main Character Icon
      const mainTrophyInfo = await fetchTrophyCount(mainUser.nickname)
      if (mainTrophyInfo != null) {
        const mainProfile = new AttachmentBuilder(await got(
          expandProfileURL(mainTrophyInfo.profileURL),
        ).buffer()).setName("main_profile.png")
        attaches.push(mainProfile)
        embed.setAuthor({
          name: mainUser.nickname,
          iconURL: "attachment://main_profile.png",
        })
      }
    } else {
      embed.setAuthor({
        name: ms2user.nickname,
        iconURL: "attachment://char_profile.png",
      })
    }
    // Description
    embed.setDescription(description)
    // color
    embed.setColor("#57f288")
    // description
    // embed.setDescription("🔍 자료가 부족합니다. 😭\n")
    // username
    const job = (ms2user.job ?? Job.UNKNOWN) as Job
    embed.setTitle(`${JobIcon[job]} ${ms2user.nickname}`)
    // trophy, job, level, character id
    embed.addFields({
      name: "🏆 트로피",
      value: `${CommandTools.commaNumber(ms2user.trophy ?? 0)}개 (${ms2user.trophyRank ?? 0}위)`,
      inline: true,
    }, {
      name: "💼 직업",
      value: `${JobIcon[job]} ${JobNameMap[job]}`,
      inline: true,
    }, {
      name: "📈 레벨",
      value: `Lv. ${ms2user.level}`,
      inline: true,
    })
    const nickHistory = ms2db.queryNicknameHistory(ms2user.characterId)
    if (nickHistory != null && nickHistory.nicknames.length > 0) {
      embed.addFields({
        name: "📔 닉네임 변경 기록",
        value: nickHistory.nicknames.join(", "),
        inline: false,
      })
    }
    embed.addFields({
      name: "🔑 캐릭터 식별자",
      value: ms2user.characterId.toString(),
      inline: false,
    })
    // account related identification
    if (mainUser != null) {
      // 식별자, 메인 캐릭터
      embed.addFields({
        name: "🔐 계정 식별자",
        value: ms2user.accountId?.toString() ?? "없음",
        inline: false,
      }, {
        name: "👤 메인 캐릭터",
        value: `${JobIcon[(mainUser.job ?? Job.UNKNOWN) as Job]} ${mainUser.nickname}`,
        inline: false,
      })
      if (mainUser.starHouseDate != null) {
        // 집 이름
        const year = Math.floor(mainUser.starHouseDate / 100)
        const month = mainUser.starHouseDate % 100
        embed.addFields({
          name: `🏠 집 이름`,
          value: `${mainUser.houseName ?? "없음"}\n> ${year}년 ${month}월 기준`,
          inline: false,
        })
      }
      // Character List
      const charList = ms2db.queryCharactersByAccount(ms2user.accountId!!).sort((a, b) => {
        return CommandTools.compareBigInt(a.characterId, b.characterId)
      })
      let leftStr = ""
      let rightStr = ""

      const makeLevelStr = (c: { level: number | bigint | null, nickname: string, isNicknameObsoleted: number }, bold: boolean) => {
        let text = ""
        if (bold) {
          text = `**Lv.${c.level ?? "??"} ${c.nickname}**`
        } else {
          text = `Lv.${c.level ?? "??"} ${c.nickname}`
        }
        if (c.isNicknameObsoleted !== 0) {
          text = `~~${text}~~`
        }
        return text
      }
      if (charList.length <= 8) {
        for (const c of charList) {
          const isBold = c.characterId === ms2user.characterId
          leftStr += `${JobIcon[CommandTools.getJob(c.job)]} ${makeLevelStr(c, isBold)}\n`
        }
      } else {
        const half = Math.ceil(charList.length / 2)
        for (let i = 0; i < half; i++) {
          const c = charList[i]!!
          const isBold = c.characterId === ms2user.characterId
          leftStr += `${JobIcon[CommandTools.getJob(c.job)]} ${makeLevelStr(c, isBold)}\n`
        }
        for (let i = half; i < charList.length; i += 1) {
          const c = charList[i]!!
          const isBold = c.characterId === ms2user.characterId
          rightStr += `${JobIcon[CommandTools.getJob(c.job)]} ${makeLevelStr(c, isBold)}\n`
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

  protected queryHistory(ms2db: MS2Database, dungeonId: DungeonId, characterId: bigint, queryDate: Date) {
    const nextDate = addMonths(queryDate, 1)

    const dayPair: Record<number, Array<ReturnType<typeof parseHistory>>> = {}
    // 던전 테이블
    const dungeonTable = ms2db.dungeonHistories.get(dungeonId)
    if (dungeonTable == null) {
      return dayPair
    }
    // 파싱 시도
    let membersQuery = ``
    const membersParam: bigint[] = []
    for (let i = 1; i <= 10; i += 1) {
      membersParam.push(characterId)
      membersQuery += `member${i} = ?`
      if (i < 10) {
        membersQuery += ` OR `
      }
    }
    // SQL 실행
    //  (clearDate >= ? AND clearDate < ?) AND (member1 = ? OR member2 = ? OR member3 = ? OR member4 = ? OR member5 = ? OR member6 = ? OR member7 = ? OR member8 = ? OR member9 = ? OR member10 = ?)
    const query = dungeonTable.findManySQL(/*sql*/`(clearDate >= ? AND clearDate < ?) AND (${membersQuery})`, [this.toYYYYMMDD(queryDate), this.toYYYYMMDD(nextDate), ...membersParam], {
      orderBy: [{
        columnName: "clearRank",
        order: "DESC",
      }],
    }).map((v) => parseHistory(v, ms2db))

    for (const party of query) {
      if (dayPair[party.clearDate] == null) {
        dayPair[party.clearDate] = []
      }
      dayPair[party.clearDate]!!.push(party)
    }

    return dayPair
  }

  protected async makeHistoryEmbed(characterId: bigint, dungeonType: DungeonId, queryDate: Date, ms2db: MS2Database, sender: string) {
    const user = ms2db.queryCharacterById(characterId)
    if (user == null) {
      return null
    }
    const nickname = user.nickname
    const job = CommandTools.getJob(user.job)
    // 던전 이름
    const dungeonName = Object.entries(dungeonNameMap).find((v) => v[1] === dungeonType)!![0]

    const queries = this.queryHistory(ms2db, dungeonType, characterId, startOfMonth(queryDate))

    const monthClearRate = Object.values(queries).reduce((acc, cur) => acc + cur.length, 0)
    const clearRate = (await fetchClearedRate(dungeonType, nickname)).find((v) => v.characterId === user.characterId)

    // Embed 첨부
    const color = "#f5bcdb"
    const yyyymm = CommandTools.toYYYYMM(queryDate)
    const yyyymmKorean = `${getYear(queryDate)}년 ${getMonth(queryDate) + 1}월`
    const title = `[${dungeonName}] ${yyyymmKorean} 기록`
    const description = `🗡️ Lv.${user.level} **${user.nickname}** ${JobIcon[job]}\n🥇 **${clearRate?.clearedCount ?? 0}**번 클리어\n📅 이번 달 **${monthClearRate}**번 클리어`
    const thumbnail = clearRate?.profileURL ?? expandProfileURL(user.profileURL ?? FALLBACK_PROFILE)
    const author = {
      iconURL: thumbnail,
      name: `${user.nickname}`,
    }
    if (user.mainCharacterId != null) {
      const mainChar = ms2db.queryCharacterById(user.mainCharacterId)
      if (mainChar != null) {
        author.iconURL = expandProfileURL(mainChar.profileURL ?? FALLBACK_PROFILE)
        author.name = mainChar.nickname
      }
    }

    const currentDate = new Date(Date.now())
    const endDate = subDays(addMonths(queryDate, 1), 1)
    const endDateMin = isFuture(endDate) ? currentDate : endDate
    // embed 생성
    const embed = new EmbedBuilder()
    embed.setColor(color)
    embed.setTitle(title)
    embed.setDescription(description)
    embed.setThumbnail(thumbnail)
    embed.setAuthor(author)
    embed.setFooter({
      text: `${CommandTools.toKoreanDate(queryDate)} ~ ${CommandTools.toKoreanDate(endDateMin)} 기준`,
    })
    embed.setTimestamp(Date.now())

    let totalLn = 0
    let elseStr = ""
    for (const query of Object.entries(queries)) {
      const dateNum = Number.parseInt(query[0])
      const date = this.parseYYYYMMDD(dateNum)
      const parties = query[1]
      // 겹친 파티원 목록
      const equalParties = parties.reduce((acc, cur, idx, arr) => {
        if (idx === 0) {
          // 누산기에 추가
          acc.push([cur])
          return acc
        }
        const prevParties = acc[acc.length - 1]!!
        const prevParty = prevParties[prevParties.length - 1]!!
        // 파티 멤버가 같은지 체크
        if (arraysEqual(prevParty.members.map((v) => v.characterId), cur.members.map((v) => v.characterId))) {
          // 같으면 누산기에 추가
          prevParties.push(cur)
        } else {
          // 다르면 새로운 누산기에 추가
          acc.push([cur])
        }
        return acc
      }, [] as ReturnType<typeof parseHistory>[][])
      let partyStr = ""
      let dayRun = 0
      for (const innerParties of equalParties) {
        if (dayRun++ >= 6) {
          partyStr += `📢 그 외 \`${equalParties.length - dayRun}\`회 클리어\n`
          break
        }
        if (totalLn >= 5700) {
          break
        }
        const party = innerParties[0]!!
        const members = party.members.map((member) => {
          const jobPrefix = `\`${JobNameMap[CommandTools.getJob(member.job)].substring(0, 1)}\``
          const isBold = member.characterId === party.leader?.characterId
          const nickname = isBold ? `**${member.nickname}**` : member.nickname
          return `${jobPrefix}${nickname}`
        })
        // const postfix = innerParties.map((v) => `[\`${v.clearRank}\`] ${this.clearSecToKorean(party.clearSec)}`).join(", ")
        const timePostfix = innerParties.map((v) => this.clearSecToKorean(v.clearSec)).join(", ")
        const clearCountPostfix = innerParties.length > 1 ? `\n🟢 ${innerParties.length}회 ` : " "

        const partyStrAppend = `⚪ ${members.join(", ")}${clearCountPostfix}🕐 ${timePostfix}\n\n`
        // 
        if (partyStr.length + partyStrAppend.length >= 1000) {
          partyStr += "...\n"
          break
        } else {
          partyStr += partyStrAppend
        }
      }
      if (totalLn + partyStr.length >= 5700) {
        totalLn = 5700
        // 5700자 이상이면 더이상 추가하지 않음 (Discord Embed 제한)
        elseStr += `${this.clearDateToKorean(dateNum)}\n`
        continue
      }
      totalLn += partyStr.length
      embed.addFields({
        name: this.clearDateToKorean(dateNum),
        value: partyStr,
      })
    }
    if (elseStr.length > 0) {
      embed.addFields({
        name: "그 외 날짜",
        value: elseStr,
      })
    }
    // 컴포넌트 생성
    const components: (ButtonBuilder | SelectMenuBuilder)[] = []
    const infoTags = [characterId.toString(), dungeonType.toString()].join("-")
    // 이전 버튼
    const prevBtn = new ButtonBuilder()
    const prevDate = subMonths(queryDate, 1)
    prevBtn.setCustomId(CommandTools.createCustomId(`${searchMonthTag}${CommandTools.toYYYYMM(prevDate)}-${infoTags}`, sender))
    prevBtn.setStyle(ButtonStyle.Success)
    prevBtn.setEmoji("◀")
    prevBtn.setDisabled(isBefore(queryDate, new Date(2015, 8 - 1, 1)))
    // 날짜 표시 버튼
    const dateBtn = new ButtonBuilder()
    dateBtn.setCustomId(`nohandle_month_display`)
    dateBtn.setDisabled(true)
    dateBtn.setStyle(ButtonStyle.Secondary)
    dateBtn.setLabel(yyyymmKorean)
    // 다음 버튼
    const nextBtn = new ButtonBuilder()
    const nextDate = addMonths(queryDate, 1)
    nextBtn.setCustomId(CommandTools.createCustomId(`${searchMonthTag}${CommandTools.toYYYYMM(nextDate)}-${infoTags}`, sender))
    nextBtn.setStyle(ButtonStyle.Success)
    nextBtn.setEmoji("▶")
    nextBtn.setDisabled(isFuture(endDate))
    // 이전 다음 버튼 row
    const monthRow = new ActionRowBuilder<ButtonBuilder>()
    monthRow.addComponents([prevBtn, dateBtn, nextBtn])
    // 두번째 Row
    const selectBoxRow = await this.buildSelectBox(user.accountId ?? 0n, user.characterId, ms2db, sender, `${searchCIDTag}${CommandTools.toYYYYMM(queryDate)}-${infoTags}`)

    // Rows
    const rows: ActionRowBuilder<ButtonBuilder | SelectMenuBuilder>[] = [monthRow]
    if (selectBoxRow != null) {
      rows.push(selectBoxRow)
    }

    return {
      embed,
      components: rows,
    }
  }

  protected clearDateToDate(clearDate: number) {
    return this.parseYYYYMMDD(clearDate)
  }

  protected clearDateToKorean(clearDate: number) {
    return CommandTools.toKoreanDate(this.clearDateToDate(clearDate))
  }

  protected clearSecToKorean(clearSec: number) {
    let output = ""
    if (clearSec >= 60) {
      const min = Math.floor(clearSec / 60)
      output += `${min}분`
      clearSec -= min * 60
    }
    if (clearSec > 0) {
      if (output.length > 0) {
        output += " "
      }
      output += `${clearSec}초`
    }
    return output
  }

  protected toYYYYMMDD(date: Date) {
    return `${date.getFullYear()}${(date.getMonth() + 1).toString().padStart(2, "0")}${date.getDate().toString().padStart(2, "0")}`
  }

  protected parseYYYYMMDD(dateNum: number) {
    const year = Math.floor(dateNum / 10000)
    const month = Math.floor((dateNum % 10000) / 100) - 1
    const day = dateNum % 100
    return new Date(year, month, day)
  }
}

function parseHistory(dungeonHistory: ClearInfo, ms2db: MS2Database) {
  const members: CharacterStoreInfo[] = []
  let leader: CharacterStoreInfo | null = null
  for (let i = 1; i <= dungeonHistory.memberCount; i += 1) {
    const member: bigint | null = (dungeonHistory as any)[`member${i}`]
    if (member == null) {
      break
    }
    if (member === 0n) {
      continue
    }
    const memberInfo = ms2db.queryCharacterById(member)
    if (memberInfo != null) {
      if (dungeonHistory.leader === member) {
        leader = memberInfo
      }
      members.push(memberInfo)
    }
  }
  members.sort((a, b) => CommandTools.compareBigInt(a.characterId, b.characterId))
  return {
    partyId: dungeonHistory.partyId,
    clearRank: dungeonHistory.clearRank,
    clearSec: dungeonHistory.clearSec,
    clearDate: dungeonHistory.clearDate,
    members,
    leader,
  }
}

function arraysEqual<T>(a: T[] | null, b: T[] | null) {
  if (a == null || b == null) {
    return false
  }
  if (a === b) return true
  if (a.length !== b.length) return false

  for (let i = 0; i < a.length; i += 1) {
    if (a[i] !== b[i]) return false
  }
  return true
}