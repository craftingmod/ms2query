import { DungeonId } from "./dungeonid.js"
import { CharacterInfo, CharacterMemberInfo, Job, MainCharacterInfo, TrophyCharacterInfo } from "./ms2CharInfo.js"
import { fetchClearedByDate, fetchClearedRate, fetchMainCharacterByName, fetchMainCharacterByNameDate, fetchTrophyCount, searchLatestClearedPage, shirinkProfileURL } from "./ms2fetch.js"
import { PartyInfo } from "./partyinfo.js"
import Debug from "debug"
import chalk from "chalk"
import { MS2Database } from "./ms2database.js"
import { shirinkPartyId } from "./database/ClearInfo.js"
import { CharacterStoreInfo } from "./database/CharacterInfo.js"
import { InternalServerError } from "./fetcherror.js"
import { addMonths, isFuture, subMonths } from "date-fns"

const debug = Debug("ms2:debug:analyzer")
const nicknameRefreshTime = 1000 * 60 * 60 * 24 * 7 // 7 days
const updateCooltime = 1000 * 60 * 60 * 24 * 1 // 1 day

export class MS2Analyzer {
  protected readonly dungeonId: DungeonId
  protected readonly ms2db: MS2Database
  protected readonly accountQueryBlacklist: Set<bigint> = new Set()

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
      try {
        await this.analyzePage(page)
      } catch (err) {
        if (err instanceof InternalServerError) {
          // Page Not found (some error)
          if (err.statusCode === 302 && err.responseHTML.indexOf("Object moved") >= 0) {
            // Page not found
            debug(`Skipping Page ${page} because of 302!!`)
            continue
          } else {
            throw err
          }
        }
      }
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
      const nowTime = Date.now()
      // 출력
      debug(`[${chalk.green(party.leader.nickname)}] Party member: [${party.members.map(m => chalk.green(m.nickname)).join(", ")}], ID: ${chalk.green(party.partyId)}`)
      // 파티 저장할 것
      const memberIds: bigint[] = []
      // 파티장
      const leader = party.leader
      // 클리어 날짜
      const partyDate = new Date(party.partyDate.year, party.partyDate.month - 1, party.partyDate.day)
      // 멤버마다 반복
      for (const member of party.members) {
        // 멤버 정보 저장
        memberIds.push(await this.fetchMemberInfo(leader, member, partyDate))
      }
      // 파티 정보 DB다가 넣기
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

  /**
   * 파티 멤버 정보에서 CID를 가져옵니다
   * @param leader 파티장 정보
   * @param member 파티원 정보
   * @returns CID
   */
  protected async fetchMemberInfo(leader: CharacterInfo, member: CharacterMemberInfo, clearDate: Date): Promise<bigint> {
    const nowTime = Date.now()
    // 저번 달
    const prevDate = subMonths(nowTime, 1)
    // characterStore DB에서 불러옴 (삭제 감지 X)
    let queryUser: CharacterStoreInfo | null = null
    if (leader.nickname === member.nickname) {
      queryUser = this.ms2db.queryCharacterById(leader.characterId)
    } else {
      queryUser = this.ms2db.queryCharacterByName(member.nickname)
    }
    // 유저의 직업/레벨/닉네임이 같은 경우 (트로피 있고) 업데이트 마킹만 해둠
    if (queryUser != null) {
      const isSameNickname = (queryUser.nickname === member.nickname) && (!this.shouldUpdateInfo(queryUser)) // 닉네임 확인..
      const isSameInfo = queryUser.job === member.job && queryUser.level != null && queryUser.level >= member.level // 레벨하고 직업 무결성 확인 (레벨은 같거나 낮으면 OK, 직업은 같으면 OK)
      const hasTrophy = (queryUser.trophy ?? 0) > 0
      const hasProfile = queryUser.profileURL != null
      // 계정 쿼리됐는지 검색 (마이그레이션)
      const queryAcc = (queryUser.accountId ?? 0) !== 0n && queryUser.starHouseDate != null
      const queryNoAcc = (queryUser.accountId ?? 0) === 0n && queryUser.houseQueryDate >= this.toYYYYMM(prevDate)
      // 가장 마지막으로 갱신된 타임스탬프 구하기
      const updateTimeDelta = Math.abs(nowTime - queryUser.lastUpdatedTime.getTime())

      if (isSameNickname && isSameInfo && hasTrophy && hasProfile && (queryAcc || queryNoAcc) && updateTimeDelta < updateCooltime) {
        // 업데이트 필요 없음 (마킹만)
        debug(`[${chalk.green(member.nickname)}] Skipping because enough information exists`)
        /* 업데이트 안했으므로 표기 하지 않기
        this.ms2db.modifyCharacterInfo(queryUser.characterId, {
          lastUpdatedTime: new Date(nowTime),
        })
        */
        return queryUser.characterId
      }
    }
    // 업데이트가 필요한 정보

    // 트로피 정보 파싱
    const fetchUser = await fetchTrophyCount(member.nickname)

    // 트로피 결과가 없으면 (무조건 "삭제")
    if (fetchUser == null) {
      // 데이터베이스에서 삭제된 유저 찾기
      const lostDBUser = this.ms2db.characterStore.findOne({
        nickname: member.nickname,
        job: member.job,
        isNicknameObsoleted: 2,
      })
      // 삭제된 유저가 데이터베이스에 있으면
      if (lostDBUser != null) {
        // 처리하지 말고 값 출력
        debug(`[${chalk.blueBright(member.nickname)}] was deleted.`)
        return lostDBUser.characterId
      }
      // 삭제된 유저가 데이터베이스에 없으면
      // 클경에서 닉네임 검색
      const lostQuery = await fetchClearedRate(this.dungeonId, member.nickname)
      if (lostQuery.length <= 0) {
        // 흔적도 없이 사라짐
        debug(`[${chalk.blueBright(member.nickname)}] Not Found. skipping.`)
        // 0으로 처리하고 반환
        return 0n
      }
      // 던전 기록에서 CID 검색
      let lostCID = 0n
      // 던전 기록 순회
      for (const lostCharacter of lostQuery) {
        // 캐릭터 쿼리 (ID로)
        const lostQuery = this.ms2db.queryCharacterById(BigInt(lostCharacter.characterId))
        // 데이터베이스 마킹
        if (lostQuery == null) {
          // 데이터베이스에 없으면
          // 이름 검색이 안되고 던전 검색에서 되면 삭제된 캐릭터
          // 삭제 기록 추가
          this.ms2db.insertCharacterInfo({
            characterId: BigInt(lostCharacter.characterId),
            nickname: lostCharacter.nickname,
            job: lostCharacter.job,
            level: lostCharacter.level,
            trophy: null,
            mainCharacterId: BigInt(0),
            accountId: BigInt(0),
            isNicknameObsoleted: 2,
            houseQueryDate: this.toYYYYMM(prevDate),
            starHouseDate: null,
            houseName: null,
            profileURL: shirinkProfileURL(lostCharacter.profileURL),
            lastUpdatedTime: new Date(nowTime),
          })
        } else {
          // 데이터베이스에 있으면
          // 트로피 검색이 안되므로 닉네임이 바뀌었든 뭐든 유효하진 않음
          // 삭제된 캐릭터로 마킹 (닉네임은 실시간이니까 1은 아님)
          this.ms2db.modifyCharacterInfo(BigInt(lostCharacter.characterId), {
            profileURL: shirinkProfileURL(lostCharacter.profileURL),
            isNicknameObsoleted: 2,
            lastUpdatedTime: new Date(nowTime),
          })
        }
        // CID 마킹
        // 레벨과 직업이랑 닉네임이 같으면
        if (lostCharacter.job === member.job && lostCharacter.level === member.level && lostCharacter.nickname === member.nickname) {
          // CID 정하기
          lostCID = lostCharacter.characterId
        }
      }
      // CID 반환
      return lostCID
    }
    // 캐릭터 ID 검색 결과가 0이면 (프로필 사진이 생성안된 경우)
    // 예시: crescent2 / 착한이름135
    if (fetchUser.characterId === 0n) {
      debug(`[${chalk.red(member.nickname)}] CID Info is BROKEN!!!!`)
      // DB에 있으면 DB값 반환
      if (queryUser != null) {
        return queryUser.characterId
      }
      // 없으면 닉네임 변경된 흔적이라도 찾아보기
      const modifiedQueryUser = this.ms2db.characterStore.findOne({
        nickname: member.nickname,
        isNicknameObsoleted: 1,
      })
      if (modifiedQueryUser != null) {
        return modifiedQueryUser.characterId
      }
      // 없으면 0 반환
      return 0n
    }
    // 드디어 정상적인 유저가 쿼리로 잡혔을 때
    // 닉네임이 변경되었으면 닉네임 변경 기록 추가
    const fetchQueryUser = this.ms2db.queryCharacterById(fetchUser.characterId)
    if (fetchQueryUser != null && fetchQueryUser.nickname !== member.nickname) {
      // 닉네임 기록
      const nickHistory = this.ms2db.nicknameHistory.findOne({
        characterId: BigInt(fetchUser.characterId),
      })
      let nickStack: string[] = []
      if (nickHistory == null) {
        nickStack = [fetchQueryUser.nickname, fetchUser.nickname]
      } else {
        nickStack = [...nickHistory.nicknames, fetchUser.nickname]
      }
      // 닉네임 기록 마킹
      this.ms2db.nicknameHistory.insertOne({
        characterId: BigInt(fetchUser.characterId),
        nicknames: nickStack,
      })
    }
    // 데이터베이스에 있는데 CID가 다르다면
    if (queryUser != null && queryUser.characterId !== fetchUser.characterId) {
      // 닉네임 변경된 유저
      // 닉네임 변경된 유저로 마킹
      this.ms2db.modifyCharacterInfo(queryUser.characterId, {
        isNicknameObsoleted: 1,
        lastUpdatedTime: new Date(nowTime),
      })
      // 새로 바뀐 유저로 queryUser 바꾸기
      queryUser = this.ms2db.queryCharacterById(fetchUser.characterId)
    }
    // 유저 정보 업데이트
    // 레벨 관련 수정... (레벨은 그 시점 기준!)
    if (queryUser != null && queryUser.characterId === fetchUser.characterId && queryUser.job === member.job) {
      fetchUser.level = Math.max(queryUser.level ?? -1, fetchUser.level)
    } else {
      fetchUser.level = member.level
    }
    fetchUser.job = member.job
    await this.updateCharacterInfo(fetchUser, clearDate)
    // 반환
    return fetchUser.characterId
  }

  protected shouldUpdateInfo(info: CharacterStoreInfo) {
    return Math.abs(Date.now() - info.lastUpdatedTime.getTime()) >= nicknameRefreshTime
  }

  protected async updateCharacterInfo(charInfo: TrophyCharacterInfo, clearDate: Date) {
    // yyyymm 출력용
    const currentDate = new Date(Date.now())
    const prevDate = subMonths(currentDate, 1)
    // DB에서 대상 캐릭터 탐색
    const dbTargetCharacter = this.ms2db.queryCharacterById(charInfo.characterId)
    // 시작점 설정
    let mainCharacterInfo: MainCharacterInfo | null
    // DB에 대상 캐릭터가 있을 때
    if (dbTargetCharacter != null) {
      // 가장 최근 갱신 날짜
      const lastYYYYMM = dbTargetCharacter.houseQueryDate
      // 갱신 날짜가 1달도 안지났을 때
      if (Math.abs(this.toYYYYMM(prevDate) - lastYYYYMM) === 0) {
        // 기본적인 정보만 업데이트
        this.ms2db.modifyCharacterInfo(charInfo.characterId, {
          nickname: charInfo.nickname,
          job: charInfo.job,
          level: Math.max(dbTargetCharacter.level ?? -1, charInfo.level),
          trophy: charInfo.trophyCount,
          isNicknameObsoleted: 0,
          profileURL: shirinkProfileURL(charInfo.profileURL),
          lastUpdatedTime: new Date(Date.now()),
        })
        // 패스
        return
      }
      // 계정 정보가 있는지 검사
      if ((dbTargetCharacter.accountId ?? 0n) !== 0n) {
        // starHouseDate가 없으면 처음부터 갱신
        if (dbTargetCharacter.starHouseDate == null) {
          // 파티 던전 일 부터 2015년 7월까지 계산
          mainCharacterInfo = await fetchMainCharacterByName(
            charInfo.nickname,
            new Date(2015, 6, 1),
            clearDate,
            true,
          )
          if (mainCharacterInfo == null) {
            // 파티 던전 일부터 현재까지 계산
            mainCharacterInfo = await fetchMainCharacterByName(
              charInfo.nickname,
              clearDate,
              currentDate,
              false,
            )
          }
        } else {
          // 있으면 날자 찝어서 갱신
          const searchDate = this.parseYYYYMM(dbTargetCharacter.starHouseDate)
          mainCharacterInfo = await fetchMainCharacterByNameDate(charInfo.nickname, searchDate)
        }
      } else {
        // 가장 마지막 갱신의 다음 달
        const startDate = addMonths(lastYYYYMM, 1)
        // DB의 하우징 검색 날자 다음 달부터 현재 일까지 불러옵니다
        // 미래가 아니라면
        if (!isFuture(startDate)) {
          mainCharacterInfo = await fetchMainCharacterByName(charInfo.nickname, startDate, currentDate)
        } else {
          // 없음...
          mainCharacterInfo = null
        }
      }
    } else {
      // DB에 대상 캐릭터가 없을 때
      // 파티 던전 일 부터 2015년 7월까지 계산
      mainCharacterInfo = await fetchMainCharacterByName(
        charInfo.nickname,
        new Date(2015, 6, 1),
        clearDate,
        true,
      )
      if (mainCharacterInfo == null) {
        // 파티 던전 일부터 현재까지 계산
        mainCharacterInfo = await fetchMainCharacterByName(
          charInfo.nickname,
          clearDate,
          currentDate,
          false,
        )
      }
    }

    // 본캐 탐색
    // 본캐가 잡혔으면
    if (mainCharacterInfo != null) {
      // DB의 메인 캐릭터를 불러옴
      const dbMainChar = this.ms2db.queryCharacterById(mainCharacterInfo.characterId)
      // 메인 캐릭터가 DB에 없으면
      if (dbMainChar == null) {
        // 메인 캐릭터 정보 저장
        const isSameWithCharInfo = charInfo.characterId === mainCharacterInfo.characterId
        this.ms2db.insertCharacterInfo({
          characterId: mainCharacterInfo.characterId,
          nickname: mainCharacterInfo.nickname,
          job: isSameWithCharInfo ? charInfo.job : null,
          level: isSameWithCharInfo ? charInfo.level : null,
          trophy: isSameWithCharInfo ? charInfo.trophyCount : null,
          mainCharacterId: mainCharacterInfo.mainCharacterId,
          accountId: mainCharacterInfo.accountId,
          isNicknameObsoleted: 0,
          houseQueryDate: this.toYYYYMM(prevDate),
          starHouseDate: mainCharacterInfo.houseDate,
          houseName: mainCharacterInfo.houseName,
          profileURL: shirinkProfileURL(mainCharacterInfo.profileURL),
          lastUpdatedTime: new Date(Date.now()),
        })
      }
      // 본캐의 부캐 정보들 모두 업데이트
      const characters: CharacterStoreInfo[] = this.ms2db.queryCharactersByAccount(mainCharacterInfo.accountId)
      for (const altChar of characters) {
        this.ms2db.modifyCharacterInfo(altChar.characterId, {
          mainCharacterId: mainCharacterInfo.mainCharacterId,
          houseName: mainCharacterInfo.houseName,
          starHouseDate: mainCharacterInfo.houseDate,
          houseQueryDate: this.toYYYYMM(prevDate),
        })
      }
    }
    // DB에 캐릭터 데이터가 없으면
    if (dbTargetCharacter == null) {
      // 캐릭터 정보 저장
      this.ms2db.insertCharacterInfo({
        characterId: charInfo.characterId,
        nickname: charInfo.nickname,
        job: charInfo.job,
        level: charInfo.level,
        trophy: charInfo.trophyCount,
        mainCharacterId: mainCharacterInfo?.characterId ?? 0n,
        accountId: mainCharacterInfo?.accountId ?? 0n,
        isNicknameObsoleted: 0,
        houseQueryDate: this.toYYYYMM(prevDate),
        starHouseDate: mainCharacterInfo?.houseDate ?? null,
        houseName: mainCharacterInfo?.houseName ?? null,
        profileURL: shirinkProfileURL(charInfo.profileURL),
        lastUpdatedTime: new Date(Date.now()),
      })
    } else {
      // DB에 캐릭터 정보가 있으면 마지막만 갱신?
      // 공통적으로 직업 정보 꼭 갱신해주기..
      if (mainCharacterInfo != null) {
        // AID가 안잡혀있을 시 업데이트
        if ((dbTargetCharacter.accountId ?? 0n) === 0n) {
          this.ms2db.modifyCharacterInfo(charInfo.characterId, {
            nickname: charInfo.nickname,
            job: charInfo.job,
            level: Math.max(dbTargetCharacter.level ?? -1, charInfo.level),
            trophy: charInfo.trophyCount,
            mainCharacterId: mainCharacterInfo.mainCharacterId,
            houseName: mainCharacterInfo.houseName,
            starHouseDate: mainCharacterInfo.houseDate,
            houseQueryDate: this.toYYYYMM(prevDate),
            isNicknameObsoleted: 0,
            profileURL: shirinkProfileURL(charInfo.profileURL),
            lastUpdatedTime: new Date(Date.now()),
          })
        } else {
          // AID가 잡혀 있으면 위에서 이미 업뎃했으니 마킹만 해두기
          this.ms2db.modifyCharacterInfo(charInfo.characterId, {
            nickname: charInfo.nickname,
            job: charInfo.job,
            level: Math.max(dbTargetCharacter.level ?? -1, charInfo.level),
            trophy: charInfo.trophyCount,
            isNicknameObsoleted: 0,
            profileURL: shirinkProfileURL(charInfo.profileURL),
            lastUpdatedTime: new Date(Date.now()),
          })
        }
      } else {
        // 메인 캐릭터가 안잡히면 그냥 쿼리 시간하고 마킹만 해둠
        this.ms2db.modifyCharacterInfo(charInfo.characterId, {
          nickname: charInfo.nickname,
          job: charInfo.job,
          level: Math.max(dbTargetCharacter.level ?? -1, charInfo.level),
          trophy: charInfo.trophyCount,
          houseQueryDate: this.toYYYYMM(prevDate),
          isNicknameObsoleted: 0,
          profileURL: shirinkProfileURL(charInfo.profileURL),
          lastUpdatedTime: new Date(Date.now()),
        })
      }
    }
  }

  protected parseYYYYMM(value: number): Date {
    const year = value / 100
    const month = value % 100
    return new Date(year, month - 1, 1)
  }

  protected toYYYYMM(date: Date): number {
    return date.getFullYear() * 100 + date.getMonth() + 1
  }
}

export interface ASettings {
  afterDate: { year: number, month: number, day: number },
  lastPage: number,
}