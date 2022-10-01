import sqlite from "better-sqlite3"
import type { Database } from "better-sqlite3"
import { DungeonId } from "./dungeonid.js"
import { CharId, getCharId, getCharIdByName, getCharIdsByAccount, insertCharId, prepareCharId, updateCharId } from "./structure/CharId.js"
import { ClearInfo, parseQueryClearInfo, prepareClearInfo } from "./structure/ClearInfo.js"
import { forceNull } from "./util.js"
import { getNicknameHistory, NicknameHistory, prepareNicknameHistory } from "./structure/NickHistory.js"

export class MS2Database {
  public static readonly supportedDungeons = [
    DungeonId.REVERSE_ZAKUM,
    DungeonId.ILLUSION_SHUSHU,
    DungeonId.ILLUSION_HORUS,
    DungeonId.BLACK_BEAN,
    DungeonId.ILLUSION_DEVORAK,
    DungeonId.DOUBLE_BEAN,
    DungeonId.NORMAL_ROOK,
    DungeonId.HARD_ROOK,
    DungeonId.DELLA_ROSSA,
  ]
  private dbPath: String
  public database: Database
  public constructor(dbPath: string) {
    this.dbPath = dbPath
    this.database = new sqlite(dbPath)
    this.database.defaultSafeIntegers(true)
    this.init()
  }
  /**
   * 초기 설정
   */
  public init() {
    // 캐릭터 정보 불러오기
    prepareCharId(this.database)
    // 클리어 정보 불러오기
    for (const dungeonId of MS2Database.supportedDungeons) {
      this.prepareClearInfo(dungeonId)
    }
    // 닉네임 변경 정보 불러오기
    prepareNicknameHistory(this.database)
  }
  /**
   * 던전 기록 테이블 이름
   */
  public getTableNameByDungeon(dungeon: DungeonId) {
    // init 부분도 추가할 것
    switch (dungeon) {
      case DungeonId.REVERSE_ZAKUM:
        return "rzakHistory"
      case DungeonId.ILLUSION_SHUSHU:
        return "lbShushuHistory"
      case DungeonId.ILLUSION_HORUS:
        return "lbHorusHistory"
      case DungeonId.BLACK_BEAN:
        return "blackBeanHistory"
      case DungeonId.ILLUSION_DEVORAK:
        return "lbDevorakHistory"
      case DungeonId.DOUBLE_BEAN:
        return "doubleBeanHistory"
      case DungeonId.NORMAL_ROOK:
        return "normalRookHistory"
      case DungeonId.HARD_ROOK:
        return "hardRookHistory"
      case DungeonId.DELLA_ROSSA:
        return "normalRosaHistory"
      default:
        return ""
    }
  }
  /**
   * 클리어 정보 테이블 만들기
   * @param dungeonId 던전 ID
   */
  private prepareClearInfo(dungeonId: DungeonId) {
    prepareClearInfo(this.database, this.getTableNameByDungeon(dungeonId))
  }

  /**
   * 가장 최근에 클리어한 기록을 쿼리합니다
   * @param dungeonId 던전 ID
   * @returns 쿼리된 클리어 기록
   */
  public queryLatestClearInfo(dungeonId: DungeonId) {
    const value = this.database.prepare(/*sql*/`
      SELECT * FROM ${this.getTableNameByDungeon(dungeonId)} ORDER BY clearRank DESC LIMIT 1
    `).get()
    if (value == null) {
      return null
    }
    return parseQueryClearInfo(value)
  }

  /**
   * 아이디 정보를 닉네임으로 쿼리합니다.
   * @param name 닉네임
   * @returns 쿼리한 유저 정보
   */
  public queryCharacterByName(name: string) {
    return forceNull(getCharIdByName(this.database, name))
  }

  /**
   * 아이디 정보를 CID로 쿼리합니다.
   * @param cid CID
   * @returns 쿼리한 유저 정보
   */
  public queryCharacterById(cid: bigint) {
    return forceNull(getCharId(this.database, cid))
  }
  public queryCharactersByAccount(aid: bigint) {
    return getCharIdsByAccount(this.database, aid)
  }
  public queryMainCharacterByName(name: string) {
    const char = this.queryCharacterByName(name)
    if (char == null || char.mainCharacterId == null) {
      return null
    }
    return this.queryCharacterById(char.mainCharacterId)
  }
  public queryMainCharacterById(cid: bigint) {
    const char = this.queryCharacterById(cid)
    if (char == null || char.mainCharacterId == null) {
      return null
    }
    return this.queryCharacterById(char.mainCharacterId)
  }

  /**
   * 유저 정보를 변경합니다.
   * @param cid CID
   * @param info 바꿀 정보들
   */
  public modifyCharacterInfo(cid: bigint, info: Partial<CharId>) {
    updateCharId(this.database, cid, info)
  }
  /**
   * 유저 정보를 삽입합니다..
   * @param info 캐릭터 정보
   */
  public insertCharacterInfo(info: CharId) {
    insertCharId(this.database, [info])
  }

  /**
   * 닉네임 변경 기록을 CID로 쿼리합니다.
   * @param cid CID
   * @returns 쿼리한 닉네임 변경 기록
   */
  public queryNicknameHistory(cid: bigint): NicknameHistory | null {
    return getNicknameHistory(this.database, cid)
  }
}