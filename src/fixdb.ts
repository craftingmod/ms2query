import sqlite from "better-sqlite3"
import { CommandTools } from "./discord/command.js"
import { defineCharacterInfo } from "./ms2/database/CharacterInfo.js"
import { ClearInfo } from "./ms2/database/ClearInfo.js"
import { Job } from "./ms2/ms2CharInfo.js"
import { AdditionalDef, DataTypesLite, ModelToJSObject, SequelizeLite } from "./sqliteorm/SequelizeLite.js"

export async function fixDB2() {
  const db = new sqlite("data/store.db")
  db.defaultSafeIntegers(true) // BigInt

  const columns = db.prepare(/*sql*/`
    SELECT * FROM rzakHistory2
  `).all()

  const mColumns = columns.map((v) => {
    let memberCount = 10
    const convertSafe = (v: string | bigint | null) => {
      if (v == null) {
        return null
      }
      if (typeof v === "bigint") {
        return v
      }
      if (v.toLowerCase() == 'null') {
        return null
      }
      return BigInt(v)
    }
    for (let i = 1; i <= 10; i += 1) {
      const value = convertSafe(v[`member${i}`])
      if (value == null || value <= 0n) {
        memberCount = i
        break
      }
    }
    return {
      clearRank: v.clearRank,
      partyId: BigInt((v.partyId as string).substring(2, 21)),
      clearSec: v.clearSec,
      clearDate: v.clearDate,
      memberCount: memberCount,
      leader: convertSafe(v.leader),
      member1: convertSafe(v.member1),
      member2: convertSafe(v.member2),
      member3: convertSafe(v.member3),
      member4: convertSafe(v.member4),
      member5: convertSafe(v.member5),
      member6: convertSafe(v.member6),
      member7: convertSafe(v.member7),
      member8: convertSafe(v.member8),
      member9: convertSafe(v.member9),
      member10: convertSafe(v.member10),
    } as ClearInfo
  })
  // prepareClearInfo(db, "rzakHistory")
  // insertClearInfo(db, "rzakHistory", mColumns)
}

export async function fixDB3() {
  const db = new sqlite("data/store.db")
  db.defaultSafeIntegers(true) // BigInt

  // db.prepare(/*sql*/`ALTER TABLE rzakHistory RENAME TO rzakHistory2`).run()

  const columns: ClearInfo[] = db.prepare(/*sql*/`
    SELECT * FROM rzakHistory2
  `).all()
  const mColumns = columns.map((v) => {
    const cDate = new Date(Number.parseInt(v.clearDate.toString()) * 1000)
    return {
      ...v,
      clearDate: cDate.getUTCFullYear() * 10000 + (cDate.getUTCMonth() + 1) * 100 + cDate.getUTCDate(),
    } as ClearInfo
  })
  // prepareClearInfo(db, "rzakHistory")
  // insertClearInfo(db, "rzakHistory", mColumns)
}

interface LegacyStore {
  charcterId: bigint,
  nickname: string,
  job: Job,
  level: number | null,
  mainCharacterId: bigint,
  accountId: bigint,
}

interface MigrateDBCharId {
  characterId: bigint
  nickname: string
  job: bigint | null
  level: bigint | null
  trophy: bigint | null
  mainCharacterId: bigint | null
  accountId: bigint | null
  lastUpdatedTime: bigint
  isNicknameObsoleted: bigint
}

export async function fixDB4() {
  const legacyDB = new OldDB()
  const orgDB = new NewDB()
  const legacyList = legacyDB.characterStore.findAll({
    orderBy: [{
      columnName: "charcterId",
    }]
  }).map((v) => v.charcterId)

  const insertList: ModelToJSObject<typeof orgDB.characterStore.modelDef>[] =
    orgDB.characterStoreOld.findAll().map((v) => {
      const isInLegacy = binarySearchChar(legacyList, v.characterId)
      return {
        characterId: v.characterId,
        nickname: v.nickname,
        job: v.job === Job.UNKNOWN ? null : v.job,
        level: (v.level == null || v.level <= 0) ? null : v.level,
        trophy: (v.trophy == null || v.trophy <= 0) ? null : v.trophy,
        mainCharacterId: v.mainCharacterId,
        accountId: v.accountId,
        isNicknameObsoleted: v.isNicknameObsoleted,
        houseQueryDate: (isInLegacy) ? 202203 : 202209,
        starHouseDate: null,
        houseName: null,
        profileURL: null,
        lastUpdatedTime: v.lastUpdatedTime,
      }
    })

  orgDB.characterStore.insertMany(insertList)
}

export function fixDB5() {
  const currentDB = new SequelizeLite("./data/store.db")
  const newDB = new SequelizeLite("./data/store_new.db")
  const currentQuery = defineCharacterInfo(currentDB)
  const newQuery = defineCharacterInfo(newDB)

  const dataArr = newQuery.findAll()
  currentQuery.insertMany(dataArr)
}


function binarySearchChar(list: bigint[], characterId: bigint): boolean {
  let left = 0
  let right = list.length - 1
  while (left <= right) {
    const mid = Math.floor((left + right) / 2)
    const midValue = list[mid]!!
    if (midValue === characterId) {
      return true
    }
    if (midValue < characterId) {
      left = mid + 1
    } else {
      right = mid - 1
    }
  }
  return false
}

class OldDB extends SequelizeLite {
  public characterStore = this.define("characterStore", {
    charcterId: DataTypesLite.BIGINT,
    nickname: DataTypesLite.STRING,
    job: DataTypesLite.INTEGER_NULLABLE,
    level: DataTypesLite.INTEGER_NULLABLE,
    mainCharacterId: DataTypesLite.BIGINT_NULLABLE,
    accountId: DataTypesLite.BIGINT_NULLABLE,
  }, {
    charcterId: [AdditionalDef.PRIMARY_KEY],
  })

  constructor() {
    super("./data/store_old.db")
  }
}

class NewDB extends SequelizeLite {
  public characterStoreOld = this.define("characterStore2", {
    characterId: DataTypesLite.BIGINT,
    nickname: DataTypesLite.STRING,
    job: DataTypesLite.INTEGER_NULLABLE,
    level: DataTypesLite.INTEGER_NULLABLE,
    trophy: DataTypesLite.INTEGER_NULLABLE,
    mainCharacterId: DataTypesLite.BIGINT_NULLABLE,
    accountId: DataTypesLite.BIGINT_NULLABLE,
    lastUpdatedTime: DataTypesLite.DATE,
    isNicknameObsoleted: DataTypesLite.INTEGER,
  }, {
    characterId: [AdditionalDef.PRIMARY_KEY],
  })

  public characterStore = this.define("characterStore", {
    characterId: DataTypesLite.BIGINT,
    nickname: DataTypesLite.STRING,
    job: DataTypesLite.INTEGER_NULLABLE,
    level: DataTypesLite.INTEGER_NULLABLE,
    trophy: DataTypesLite.INTEGER_NULLABLE,
    mainCharacterId: DataTypesLite.BIGINT_NULLABLE,
    accountId: DataTypesLite.BIGINT_NULLABLE,
    isNicknameObsoleted: DataTypesLite.INTEGER,
    houseQueryDate: DataTypesLite.INTEGER,
    starHouseDate: DataTypesLite.INTEGER_NULLABLE,
    houseName: DataTypesLite.STRING_NULLABLE,
    profileURL: DataTypesLite.STRING_NULLABLE,
    lastUpdatedTime: DataTypesLite.DATE,
  }, {
    characterId: [AdditionalDef.PRIMARY_KEY],
  })

  constructor() {
    super("./data/store.db")
  }
}