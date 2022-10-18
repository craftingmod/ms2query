import { DungeonId } from "./dungeonid.js"
import { AdditionalDef, DataTypesLite, DefinedModelToJSObject, ModelToJSObject, SequelizeLite } from "../sqliteorm/SequelizeLite.js"
import { CharacterStoreInfo, defineCharacterInfo } from "./database/CharacterInfo.js"
import { defineNicknameInfo, NicknameInfo } from "./database/NicknameInfo.js"
import { defineWorldChatInfo, WorldChatInfo } from "./database/WorldChatInfo.js"
import { defineClearInfo } from "./database/ClearInfo.js"
import { CharacterInfo, Job, MainCharacterInfo, TrophyCharacterInfo } from "./ms2CharInfo.js"
import { shirinkProfileURL } from "./ms2fetch.js"
import { addDays, isFuture } from "date-fns"

export class MS2Database extends SequelizeLite {
  public static readonly supportedDungeons: { [key in DungeonId]?: string } = {
    // Reverse Zakum
    [DungeonId.REVERSE_ZAKUM]: "Lv50Zakum",
    // 50
    [DungeonId.DEVORAK]: "Lv50Devorak",
    [DungeonId.CHAOS_BALOG]: "Lv50Balrog",
    [DungeonId.CAPTAIN_MOAK]: "Lv50Moak",
    [DungeonId.PAPULATUS]: "Lv50Papulatus",
    [DungeonId.VARKANT]: "Lv50Varkant",
    [DungeonId.NUTAMAN]: "Lv50Nutaman",
    [DungeonId.KANDURA]: "Lv50Kandura",
    [DungeonId.LUKARAX_56]: "Lv56Lukarax",
    [DungeonId.REVERSE_PINKBEAN]: "Lv56PinkBean",
    // 60
    [DungeonId.BJORN]: "Lv60Bjorn",
    [DungeonId.LUKARAX]: "Lv60Lukarax",
    [DungeonId.PINKBEAN]: "Lv60PinkBean",
    // 60-RGB
    [DungeonId.RGB_EUPHERIA]: "Lv60Eupheria",
    [DungeonId.RGB_LANDEVIAN]: "Lv60Landevian",
    [DungeonId.RGB_ISHURA]: "Lv60Ishura",
    [DungeonId.BLACKSHARD_NEXUS]: "Lv60BlackShardNexus",
    // 70
    [DungeonId.ZAKUM_70]: "Lv70Zakum",
    [DungeonId.INFERNOG_70]: "Lv70Infernog",
    [DungeonId.HIDDEN_HANGER]: "Lv70Hanger",
    [DungeonId.TIMAION]: "Lv70Timaion",
    [DungeonId.TURKA]: "Lv70Turka",
    // L.B
    [DungeonId.ILLUSION_SHUSHU]: "Lv71Shushu",
    [DungeonId.ILLUSION_HORUS]: "Lv71Horus",
    [DungeonId.BLACK_BEAN]: "Lv71BlackBean",
    [DungeonId.ILLUSION_DEVORAK]: "Lv71Devorak",
    [DungeonId.DOUBLE_BEAN]: "Lv71DoubleBean",
    [DungeonId.NORMAL_ROOK]: "Lv71RookNormal",
    [DungeonId.HARD_ROOK]: "Lv71RookHard",
    [DungeonId.DELLA_ROSSA]: "Lv71RosaNormal",
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
  public queryCharacterByName(name: string, ignoreDeleted = false) {
    if (ignoreDeleted) {
      return this.characterStore.findOne({
        nickname: name,
      })
    } else {
      return this.characterStore.findOne({
        nickname: name,
        isNicknameObsoleted: 0,
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
    const copyInfo = { ...info }
    if (copyInfo.trophy != null && copyInfo.trophy <= 0) {
      copyInfo.trophy = null
    }
    if (copyInfo.job != null && copyInfo.job === Job.UNKNOWN) {
      copyInfo.job = null
    }
    if (copyInfo.level != null && copyInfo.level <= 0) {
      copyInfo.level = null
    }
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

  public static parseCharacterInfo(characterInfo: CharacterInfo | TrophyCharacterInfo, mainCharInfo: MainCharacterInfo | null = null) {
    const totalInfo: Partial<CharacterStoreInfo> = {
      characterId: characterInfo.characterId,
      nickname: characterInfo.nickname,
      job: characterInfo.job,
      level: characterInfo.level,
      mainCharacterId: mainCharInfo?.characterId ?? 0n,
      accountId: mainCharInfo?.accountId ?? 0n,
      starHouseDate: mainCharInfo?.houseDate ?? null,
      houseName: mainCharInfo?.houseName ?? null,
      profileURL: shirinkProfileURL(characterInfo.profileURL),
    }
    if ("trophyCount" in characterInfo) {
      totalInfo.trophy = characterInfo.trophyCount
    } else {
      totalInfo.trophy = null
    }
    return totalInfo as Omit<CharacterStoreInfo, "isNicknameObsoleted" | "lastUpdatedTime">
  }

  public static isProfileValid(charInfo: CharacterStoreInfo) {
    if (charInfo.profileURL == null) {
      return false
    }
    if (charInfo.profileURL.length <= 0) {
      return false
    }
    if (isFuture(addDays(charInfo.lastUpdatedTime, 7))) {
      return true
    }
    return false
  }

}
