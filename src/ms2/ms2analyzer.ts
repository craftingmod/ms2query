import { DungeonId } from "./dungeonid.js"
import { CharacterInfo, Job } from "./ms2CharInfo.js"
import { fetchClearedByDate, fetchClearedRate, fetchMainCharacterByName, fetchTrophyCount, searchLatestClearedPage, shirinkProfileURL } from "./ms2fetch.js"
import { PartyInfo } from "./partyinfo.js"
import Debug from "debug"
import chalk from "chalk"
import { MS2Database } from "./ms2database.js"
import { shirinkPartyId } from "./database/ClearInfo.js"

const debug = Debug("ms2:debug:analyzer")

export class MS2Analyzer {
  protected readonly dungeonId: DungeonId
  protected readonly ms2db: MS2Database

  public constructor(db: MS2Database, dungeonId: DungeonId = DungeonId.REVERSE_ZAKUM) {
    this.ms2db = db
    this.dungeonId = dungeonId
  }
  public async analyze() {
    const getPage = (rank: number | null | undefined) => {
      if (rank == null) {
        return 1
      }
      return Math.floor(rank / 10) + 1
    }

    const indexedPage = getPage(this.ms2db.queryLatestClearInfo(this.dungeonId)?.clearRank)
    const latestPage = await searchLatestClearedPage(this.dungeonId, indexedPage)

    for (let page = indexedPage; page <= latestPage; page += 1) {
      await this.analyzePage(page)
    }
  }
  protected async analyzePage(page: number) {
    debug(`Analyzing page ${page}`)
    const searchYYYYMM = this.getPreviousYYYYMM()
    const pageParties = await fetchClearedByDate(this.dungeonId, page, true)
    pageParties.sort((a, b) => {
      return a.clearRank - b.clearRank
    })
    // this.partyInfoBuffer.push(...pageParties)
    for (const party of pageParties) {
      debug(`[${chalk.green(party.leader.nickname)}] Party member: [${party.members.map(m => chalk.green(m.nickname)).join(", ")}], ID: ${chalk.green(party.partyId)}`)
      // Add clear info
      const dungeonTableName = MS2Database.getTableNameByDungeon(this.dungeonId)
      const memberIds: bigint[] = []
      const leader = party.leader
      // Migration leader & member
      for (const member of party.members) {
        const queryUser = this.ms2db.queryCharacterByName(member.nickname)
        // 유저의 직업/레벨/닉네임이 같은 경우 (트로피 있고) 업데이트 마킹만 해둠
        if (queryUser != null && (queryUser.trophy ?? 0) > 0 && member.job === queryUser.job && member.level === queryUser.level && member.nickname === queryUser.nickname && ((queryUser.accountId ?? 0) !== 0n && queryUser.starHouseDate != null)) {
          // same state
          memberIds.push(BigInt(queryUser.characterId))
          this.ms2db.modifyCharacterInfo(queryUser.characterId, {
            lastUpdatedTime: new Date(Date.now()),
          })
          continue
        }

        let fetchUser: CharacterInfo & { trophyCount: number }

        if (queryUser != null && queryUser.trophy != null && member.nickname === leader.nickname) {
          // 정보 재활용
          fetchUser = {
            ...leader,
            trophyCount: queryUser.trophy,
          }
        } else {
          const fetchResult = await fetchTrophyCount(member.nickname)
          if (fetchResult == null) {
            // CID 강제 검색
            const lostQuery = await fetchClearedRate(this.dungeonId, member.nickname)
            if (lostQuery.length <= 0) {
              // Really gone
              debug(`[${chalk.blueBright(member.nickname)}] Not Found. skipping.`)
              memberIds.push(BigInt(0))
              continue
            }
            // Lost character
            let lostCID = 0n
            for (const lostCharacter of lostQuery) {
              if (lostCharacter.job === member.job && lostCharacter.level === member.level) {
                lostCID = lostCharacter.characterId
              }
              if (this.ms2db.queryCharacterById(BigInt(lostCharacter.characterId)) == null) {
                this.ms2db.insertCharacterInfo({
                  characterId: BigInt(lostCharacter.characterId),
                  nickname: lostCharacter.nickname,
                  job: lostCharacter.job,
                  level: lostCharacter.level,
                  trophy: null,
                  mainCharacterId: BigInt(0),
                  accountId: BigInt(0),
                  isNicknameObsoleted: 2,
                  houseQueryDate: searchYYYYMM.year * 100 + searchYYYYMM.month,
                  starHouseDate: null,
                  houseName: null,
                  profileURL: shirinkProfileURL(lostCharacter.profileURL),
                  lastUpdatedTime: new Date(Date.now()),
                })
              } else {
                this.ms2db.modifyCharacterInfo(BigInt(lostCharacter.characterId), {
                  isNicknameObsoleted: 2,
                  lastUpdatedTime: new Date(Date.now()),
                })
              }
            }
            if (lostCID !== 0n) {
              memberIds.push(lostCID)
            } else {
              memberIds.push(BigInt(lostQuery[0]?.characterId ?? 0))
            }
            continue
          } else if (fetchResult.characterId === 0n) {
            // CID 없음 (Example: crescent2 / 착한이름135)
            debug(`[${chalk.red(member.nickname)}] CID Info is BROKEN!!!!`)
            memberIds.push(0n)
            continue
          } else {
            fetchUser = fetchResult
          }
        }
        // 새로 파싱
        const dungeonRanks = await fetchClearedRate(this.dungeonId, fetchUser.nickname)
        for (const rankHistory of dungeonRanks) {
          if (rankHistory.characterId <= 0n) {
            continue
          }
          if (rankHistory.job === member.job && rankHistory.level === member.level) {
            // Target
            if (fetchUser.characterId !== rankHistory.characterId) {
              // Broken character (Deleted character and someone made character with same name)
              debug(`[${chalk.blueBright(fetchUser.nickname)}] BROKEN character!`)
              memberIds.push(BigInt(rankHistory.characterId))
              // Mark as broken
              if (this.ms2db.queryCharacterById(BigInt(rankHistory.characterId)) == null) {
                this.ms2db.insertCharacterInfo({
                  characterId: BigInt(rankHistory.characterId),
                  nickname: rankHistory.nickname,
                  job: rankHistory.job,
                  level: rankHistory.level,
                  trophy: 0,
                  mainCharacterId: BigInt(0),
                  accountId: BigInt(0),
                  isNicknameObsoleted: 2,
                  houseQueryDate: searchYYYYMM.year * 100 + searchYYYYMM.month,
                  starHouseDate: null,
                  houseName: null,
                  profileURL: shirinkProfileURL(rankHistory.profileURL),
                  lastUpdatedTime: new Date(Date.now()),
                })
              } else {
                this.ms2db.modifyCharacterInfo(BigInt(rankHistory.characterId), {
                  isNicknameObsoleted: 2,
                  lastUpdatedTime: new Date(Date.now()),
                })
              }
              continue
            }
          }
        }
        memberIds.push(BigInt(fetchUser.characterId))
        // No user found or CID changed of name.
        if (queryUser != null && (queryUser.characterId === BigInt(fetchUser.characterId))) {
          // 1. Check accountID is spoofed
          if (queryUser.accountId !== 0n && queryUser.starHouseDate == null) {
            // Query House again
            const queryYear = queryUser.houseQueryDate / 100
            const queryMonth = queryUser.houseQueryDate % 100
            const houseQuery = await fetchMainCharacterByName(fetchUser.nickname, [2015, 7], [searchYYYYMM.year, searchYYYYMM.month])
            if (houseQuery == null) {
              // Error? Skip.
              debug(`Housing not found for ${fetchUser.nickname}!`)
            } else {
              const characters = this.ms2db.queryCharactersByAccount(houseQuery.accountId)
              for (const char of characters) {
                this.ms2db.modifyCharacterInfo(char.characterId, {
                  houseQueryDate: searchYYYYMM.year * 100 + searchYYYYMM.month,
                  starHouseDate: houseQuery.houseDate,
                  houseName: houseQuery.houseName,
                  lastUpdatedTime: new Date(Date.now()),
                })
              }
            }
          } else if (queryUser.accountId === 0n && queryUser.houseQueryDate < searchYYYYMM.year * 100 + searchYYYYMM.month) {
            // Query House between interval
            const houseQuery = await fetchMainCharacterByName(fetchUser.nickname, [queryUser.houseQueryDate / 100, queryUser.houseQueryDate % 100], [searchYYYYMM.year, searchYYYYMM.month + 1])
            if (houseQuery == null) {
              this.ms2db.modifyCharacterInfo(fetchUser.characterId, {
                houseQueryDate: searchYYYYMM.year * 100 + searchYYYYMM.month,
              })
            } else {
              const characters = this.ms2db.queryCharactersByAccount(houseQuery.accountId)
              for (const char of characters) {
                this.ms2db.modifyCharacterInfo(char.characterId, {
                  houseQueryDate: searchYYYYMM.year * 100 + searchYYYYMM.month,
                  starHouseDate: houseQuery.houseDate,
                  houseName: houseQuery.houseName,
                  lastUpdatedTime: new Date(Date.now()),
                })
              }
            }
          } else if (queryUser == null || (queryUser.characterId !== BigInt(fetchUser.characterId))) {
            // Remark queryUser is deprecated
            if (queryUser != null) {
              // Queryuser is false
              this.ms2db.modifyCharacterInfo(queryUser.characterId, {
                isNicknameObsoleted: 1,
                lastUpdatedTime: new Date(Date.now()),
              })
            }
            const queryIdUser = this.ms2db.queryCharacterById(BigInt(fetchUser.characterId))
            if (queryIdUser != null) {
              // Nickname was changed
              // Addp previous nickname
              const nickHistory = this.ms2db.nicknameHistory.findOne({
                characterId: BigInt(fetchUser.characterId),
              })
              let nickStack: string[] = []
              if (nickHistory == null) {
                nickStack = [queryIdUser.nickname, fetchUser.nickname]
              } else {
                nickStack = [...nickHistory.nicknames, fetchUser.nickname]
              }
              // put history
              this.ms2db.nicknameHistory.insertOne({
                characterId: BigInt(fetchUser.characterId),
                nicknames: nickStack,
              })
              this.ms2db.modifyCharacterInfo(queryIdUser.characterId, {
                job: member.job,
                level: member.level,
                trophy: fetchUser.trophyCount,
                nickname: fetchUser.nickname,
                lastUpdatedTime: new Date(Date.now()),
                isNicknameObsoleted: 0,
              })
              continue
            }
            debug(`[${chalk.blueBright(fetchUser.nickname)}] Spoofing Main Character`)
            const mainChar = await fetchMainCharacterByName(member.nickname)
            debug(`[${chalk.blueBright(fetchUser.nickname)}] Main Character: ${chalk.yellow(mainChar?.nickname ?? "None")}`)
            this.ms2db.insertCharacterInfo({
              characterId: BigInt(fetchUser.characterId),
              nickname: fetchUser.nickname,
              job: member.job,
              level: member.level,
              trophy: fetchUser.trophyCount,
              mainCharacterId: BigInt(mainChar?.characterId ?? "0"),
              accountId: BigInt(mainChar?.accountId ?? "0"),
              isNicknameObsoleted: 0,
              houseQueryDate: searchYYYYMM.year * 100 + searchYYYYMM.month,
              starHouseDate: mainChar?.houseDate ?? null,
              houseName: mainChar?.houseName ?? null,
              profileURL: shirinkProfileURL(fetchUser.profileURL),
              lastUpdatedTime: new Date(Date.now()),
            })
            // Also check main character
            if (mainChar != null) {
              const mainCharQuery = this.ms2db.queryCharacterById(BigInt(mainChar.characterId))
              if (mainCharQuery == null) {
                debug(`[${chalk.blueBright(mainChar.nickname)}] Main Character Not Found. Inserting.`)
                this.ms2db.insertCharacterInfo({
                  characterId: BigInt(mainChar.characterId),
                  nickname: mainChar.nickname,
                  job: Job.UNKNOWN,
                  level: 0,
                  trophy: 0,
                  mainCharacterId: BigInt(mainChar.characterId),
                  accountId: BigInt(mainChar.accountId),
                  isNicknameObsoleted: 0,
                  houseQueryDate: searchYYYYMM.year * 100 + searchYYYYMM.month,
                  starHouseDate: mainChar.houseDate,
                  houseName: mainChar.houseName,
                  profileURL: shirinkProfileURL(mainChar.profileURL),
                  lastUpdatedTime: new Date(Date.now()),
                })
              }
            }
            continue
          }
          // Nickname changed
          if (fetchUser.nickname !== queryUser.nickname) {
            debug(`[${chalk.blueBright(fetchUser.characterId)}] Nickname Changed.`)
            const nickHistory = this.ms2db.nicknameHistory.findOne({
              characterId: BigInt(fetchUser.characterId),
            })
            // Add previous nicknames
            let nickStack: string[] = []
            if (nickHistory == null) {
              nickStack = [queryUser.nickname, fetchUser.nickname]
            } else {
              nickStack = [...nickHistory.nicknames, fetchUser.nickname]
            }
            // put history
            this.ms2db.nicknameHistory.insertOne({
              characterId: BigInt(fetchUser.characterId),
              nicknames: nickStack,
            })
          }
          // Info changed
          this.ms2db.modifyCharacterInfo(queryUser.characterId, {
            job: member.job,
            level: member.level,
            trophy: fetchUser.trophyCount,
            nickname: fetchUser.nickname,
            lastUpdatedTime: new Date(Date.now()),
            isNicknameObsoleted: 0,
            profileURL: shirinkProfileURL(fetchUser.profileURL),
          })
        }

        // Add
        this.ms2db.dungeonHistories.get(this.dungeonId)?.insertOne({
          clearRank: party.clearRank,
          partyId: shirinkPartyId(party.partyId),
          clearSec: party.clearSec,
          clearDate: party.partyDate.year * 10000 + party.partyDate.month * 100 + party.partyDate.day,
          memberCount: party.members.length,
          leader: BigInt(party.leader.characterId),
          member1: memberIds[0] ?? null,
          member2: memberIds[1] ?? null,
          member3: memberIds[2] ?? null,
          member4: memberIds[3] ?? null,
          member5: memberIds[4] ?? null,
          member6: memberIds[5] ?? null,
          member7: memberIds[6] ?? null,
          member8: memberIds[7] ?? null,
          member9: memberIds[8] ?? null,
          member10: memberIds[9] ?? null,
        })
      }
      return pageParties
    }
  }

  private getPreviousYYYYMM() {
    const now = new Date(Date.now())
    const year = now.getFullYear()
    const month = now.getMonth()
    if (month === 0) {
      return { year: year - 1, month: 12 }
    } else {
      return { year: year, month: month } // 1 month offset
    }
  }
}

export interface ASettings {
  afterDate: { year: number, month: number, day: number },
  lastPage: number,
}