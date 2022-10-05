import { DungeonId } from "./dungeonid.js"
import { AdditionalDef, DataTypesLite, DefinedModelToJSObject, ModelToJSObject, SequelizeLite } from "../sqliteorm/SequelizeLite.js"
import { CharacterStoreInfo, defineCharacterInfo } from "./database/CharacterInfo.js"
import { defineNicknameInfo, NicknameInfo } from "./database/NicknameInfo.js"
import { defineWorldChatInfo } from "./database/WorldChatInfo.js"
import { defineClearInfo } from "./database/ClearInfo.js"

export class MS2Database extends SequelizeLite {
  public static readonly supportedDungeons: { [key in DungeonId]?: string } = {
    [DungeonId.REVERSE_ZAKUM]: "rzakHistory",
    [DungeonId.ILLUSION_SHUSHU]: "lbShushuHistory",
    [DungeonId.ILLUSION_HORUS]: "lbHorusHistory",
    [DungeonId.BLACK_BEAN]: "blackBeanHistory",
    [DungeonId.ILLUSION_DEVORAK]: "lbDevorakHistory",
    [DungeonId.DOUBLE_BEAN]: "doubleBeanHistory",
    [DungeonId.NORMAL_ROOK]: "normalRookHistory",
    [DungeonId.HARD_ROOK]: "hardRookHistory",
    [DungeonId.DELLA_ROSSA]: "normalRosaHistory",
  }

  /**
   * 던전 기록 테이블 이름
   */
  public static getTableNameByDungeon(dungeon: DungeonId) {
    return MS2Database.supportedDungeons[dungeon] ?? ""
  }

  /**
   * 캐릭터 정보 저장
   */
  public characterStore = defineCharacterInfo(this)

  /**
   * 닉네임 변경 기록 저장
   */
  public nicknameHistory = defineNicknameInfo(this)

  /**
   * 월드챗 기록 저장
   */
  public worldChatHistory = defineWorldChatInfo(this)

  /**
   * 던전 기록들 저장
   */
  public dungeonHistories = new Map<DungeonId, ReturnType<typeof defineClearInfo>>()

  public constructor(dbPath: string) {
    super(dbPath)
    // 클리어 정보 불러오기
    for (const [dungeonStr, tableName] of Object.entries(MS2Database.supportedDungeons)) {
      const dungeonId = Number(dungeonStr) as DungeonId
      this.dungeonHistories.set(dungeonId, defineClearInfo(this, MS2Database.getTableNameByDungeon(dungeonId)))
    }
  }

  /**
   * 가장 최근에 클리어한 기록을 쿼리합니다
   * @param dungeonId 던전 ID
   * @returns 쿼리된 클리어 기록
   */
  public queryLatestClearInfo(dungeonId: DungeonId) {
    const model = this.dungeonHistories.get(dungeonId)
    if (model == null) {
      return null
    }
    const lastInfo = model.findOne(null, {
      orderBy: [{
        columnName: "clearRank",
        order: "DESC",
      }]
    })
    return lastInfo
  }

  /**
   * 아이디 정보를 닉네임으로 쿼리합니다.
   * @param name 닉네임
   * @returns 쿼리한 유저 정보
   */
  public queryCharacterByName(name: string, ignoreDeleted = true) {
    if (ignoreDeleted) {
      return this.characterStore.findOne({
        nickname: name,
        isNicknameObsoleted: 0,
      })
    } else {
      return this.characterStore.findOne({
        nickname: name,
      })
    }
  }

  /**
   * 아이디 정보를 CID로 쿼리합니다.
   * @param cid CID
   * @returns 쿼리한 유저 정보
   */
  public queryCharacterById(cid: bigint) {
    return this.characterStore.findOne({
      characterId: cid,
    })
  }
  /**
   * 계정 ID 정보로 캐릭터들을 쿼리합니다.
   * @param aid 계정 ID
   * @returns 쿼리한 유저 정보들
   */
  public queryCharactersByAccount(aid: bigint) {
    return this.characterStore.findMany({
      accountId: aid,
    }, {
      orderBy: [{
        columnName: "characterId",
      }]
    })
  }
  /**
   * 닉네임으로 메인 캐릭터 이름을 쿼리합니다.
   * @param name 
   * @returns 
   */
  public queryMainCharacterByName(name: string) {
    const char = this.queryCharacterByName(name)
    if (char == null || char.mainCharacterId == null) {
      return null
    }
    return this.queryCharacterById(char.mainCharacterId)
  }
  /**
   * CID로 메인 캐릭터 이름을 쿼리합니다.
   * @param cid 캐릭터 ID
   * @returns 쿼리한 유저 정보
   */
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
  public modifyCharacterInfo(cid: bigint, info: Partial<CharacterStoreInfo>) {
    this.characterStore.updateOne({
      characterId: cid,
    }, info)
  }
  /**
   * 유저 정보를 삽입합니다..
   * @param info 캐릭터 정보
   */
  public insertCharacterInfo(info: CharacterStoreInfo) {
    this.characterStore.insertOne(info)
  }

  /**
   * 닉네임 변경 기록을 CID로 쿼리합니다.
   * @param cid CID
   * @returns 쿼리한 닉네임 변경 기록
   */
  public queryNicknameHistory(cid: bigint): NicknameInfo | null {
    return this.nicknameHistory.findOne({
      characterId: cid,
    })
  }
}
