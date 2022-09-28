import { DungeonId } from "./dungeonid.js"
import { CharacterInfo, CharacterUnknownInfo, deserializeCharacterInfo, Job, serializeCharacterInfo, SerializedCInfo, TotalCharacterInfo } from "./charinfo.js"
import { fetchClearedByDate, fetchClearedRate, fetchMainCharacterByName, fetchTrophyCount, searchLatestClearedPage } from "./ms2fetch.js"
import { PartyInfo } from "./partyinfo.js"
import Debug from "debug"
import chalk from "chalk"
import { CharacterNotFoundError } from "./fetcherror.js"
import { MS2Database } from "./ms2database.js"
import { getNicknameHistory, insertNicknameHistory, NicknameHistory } from "./structure/NickHistory.js"
import { insertClearInfo, shirinkPartyId } from "./structure/ClearInfo.js"

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

    const latestPage = await searchLatestClearedPage(this.dungeonId)
    const indexedPage = getPage(this.ms2db.queryLatestClearInfo(this.dungeonId)?.clearRank)

    for (let page = indexedPage; page <= latestPage; page += 1) {
      await this.analyzePage(page)
    }
  }
  protected async analyzePage(page: number) {
    debug(`Analyzing page ${page}`)

    const pageParties = await fetchClearedByDate(this.dungeonId, page, true)
    pageParties.sort((a, b) => {
      return a.clearRank - b.clearRank
    })
    // this.partyInfoBuffer.push(...pageParties)
    for (const party of pageParties) {
      debug(`[${chalk.green(party.leader.nickname)}] Party member: [${party.members.map(m => chalk.green(m.nickname)).join(", ")}], ID: ${chalk.green(party.partyId)}`)
      // Add clear info
      const dungeonTableName = this.ms2db.getTableNameByDungeon(this.dungeonId)
      const memberIds: bigint[] = []
      // Migration leader & member
      for (const member of party.members) {
        const queryUser = this.ms2db.queryCharacterByName(member.nickname)
        if (queryUser != null && queryUser.trophy > 0 && member.job === queryUser.job && member.level === queryUser.level && member.nickname === queryUser.nickname) {
          // same state
          memberIds.push(BigInt(queryUser.characterId))
          this.ms2db.modifyCharacterInfo(queryUser.characterId, {
            lastUpdatedTime: BigInt(Date.now()),
          })
          continue
        }

        let fetchUser: CharacterInfo & { trophyCount: number }
        try {
          fetchUser = await fetchTrophyCount(member.nickname)
          if (fetchUser.characterId.length <= 0) {
            // Where is CID...? Example: crescent2 / 착한이름135
            debug(`[${chalk.red(member.nickname)}] CID Info is BROKEN!!!!`)
            memberIds.push(0n)
            continue
          }
        } catch (err) {
          if (err instanceof CharacterNotFoundError) {
            // Force CID Search
            const lostQuery = await fetchClearedRate(this.dungeonId, member.nickname)
            if (lostQuery.length <= 0) {
              // Really gone
              debug(`[${chalk.blueBright(member.nickname)}] Not Found. skipping.`)
              memberIds.push(BigInt(0))
              continue
            }
            // Lost character
            for (const lostCharacter of lostQuery) {
              if (this.ms2db.queryCharacterById(BigInt(lostCharacter.characterId)) == null) {
                this.ms2db.insertCharacterInfo({
                  characterId: BigInt(lostCharacter.characterId),
                  nickname: lostCharacter.nickname,
                  job: lostCharacter.job,
                  level: lostCharacter.level,
                  trophy: 0,
                  mainCharacterId: BigInt(0),
                  accountId: BigInt(0),
                  lastUpdatedTime: BigInt(Date.now()),
                  isNicknameObsoleted: 2,
                })
              } else {
                this.ms2db.modifyCharacterInfo(BigInt(lostCharacter.characterId), {
                  isNicknameObsoleted: 2,
                })
              }
            }
            memberIds.push(BigInt(lostQuery[0]?.characterId ?? 0))
            continue
          } else {
            throw err
          }
        }
        // Check is query broken?
        let isBroken = false
        const dungeonRanks = await fetchClearedRate(this.dungeonId, fetchUser.nickname)
        for (const rankHistory of dungeonRanks) {
          if (rankHistory.characterId.length <= 0) {
            continue
          }
          if (rankHistory.job === member.job && rankHistory.level === member.level) {
            // Target
            if (fetchUser.characterId !== rankHistory.characterId) {
              // Broken character (Deleted character and someone made character with same name)
              debug(`[${chalk.blueBright(fetchUser.nickname)}] BROKEN character!`)
              isBroken = true
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
                  lastUpdatedTime: BigInt(Date.now()),
                  isNicknameObsoleted: 2,
                })
              } else {
                this.ms2db.modifyCharacterInfo(BigInt(rankHistory.characterId), {
                  lastUpdatedTime: BigInt(Date.now()),
                  isNicknameObsoleted: 2,
                })
              }
              break
            }
          }
        }
        if (isBroken) {
          continue
        }
        memberIds.push(BigInt(fetchUser.characterId))
        // No user found or CID changed of name.
        if (queryUser == null || (queryUser.characterId !== BigInt(fetchUser.characterId))) {
          // Remark queryUser is deprecated
          if (queryUser != null) {
            // Queryuser is false
            this.ms2db.modifyCharacterInfo(queryUser.characterId, {
              isNicknameObsoleted: 1,
              lastUpdatedTime: BigInt(Date.now()),
            })
          }
          const queryIdUser = this.ms2db.queryCharacterById(BigInt(fetchUser.characterId))
          if (queryIdUser != null) {
            // Nickname was changed
            // Addp previous nickname
            const nickHistory = getNicknameHistory(this.ms2db.database, BigInt(fetchUser.characterId))
            let nickStack: string[] = []
            if (nickHistory == null) {
              nickStack = [queryIdUser.nickname, fetchUser.nickname]
            } else {
              nickStack = [...nickHistory.nicknames, fetchUser.nickname]
            }
            // put history
            insertNicknameHistory(this.ms2db.database, [
              {
                characterId: BigInt(fetchUser.characterId),
                nicknames: nickStack,
              },
            ])
            this.ms2db.modifyCharacterInfo(queryIdUser.characterId, {
              job: member.job,
              level: member.level,
              trophy: fetchUser.trophyCount,
              nickname: fetchUser.nickname,
              lastUpdatedTime: BigInt(Date.now()),
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
            lastUpdatedTime: BigInt(Date.now()),
            isNicknameObsoleted: 0,
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
                lastUpdatedTime: BigInt(Date.now()),
                isNicknameObsoleted: 0,
              })
            }
          }
          continue
        }
        if (fetchUser.nickname !== queryUser.nickname) {
          debug(`[${chalk.blueBright(fetchUser.characterId)}] Nickname Changed.`)
          const nickHistory = getNicknameHistory(this.ms2db.database, queryUser.characterId)
          // Add previous nicknames
          let nickStack: string[] = []
          if (nickHistory == null) {
            nickStack = [queryUser.nickname, fetchUser.nickname]
          } else {
            nickStack = [...nickHistory.nicknames, fetchUser.nickname]
          }
          // put history
          insertNicknameHistory(this.ms2db.database, [
            {
              characterId: BigInt(fetchUser.characterId),
              nicknames: nickStack,
            },
          ])
        }
        // Info changed
        this.ms2db.modifyCharacterInfo(queryUser.characterId, {
          job: member.job,
          level: member.level,
          trophy: fetchUser.trophyCount,
          nickname: fetchUser.nickname,
          lastUpdatedTime: BigInt(Date.now()),
          isNicknameObsoleted: 0,
        })
      }

      // Add
      insertClearInfo(this.ms2db.database, dungeonTableName, [
        {
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
        }
      ])
    }
    return pageParties
  }
}

export interface ASettings {
  afterDate: { year: number, month: number, day: number },
  lastPage: number,
}