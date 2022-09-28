import { Database } from "better-sqlite3"
import { Job } from "../charinfo.js"

export interface CharId {
  characterId: bigint
  nickname: string
  job: Job
  level: number
  trophy: number
  mainCharacterId: bigint | null
  accountId: bigint | null
  lastUpdatedTime: bigint
  isNicknameObsoleted: number
}

export interface DBCharId {
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

export function prepareCharId(db: Database) {
  db.prepare(/*sql*/`
    CREATE TABLE IF NOT EXISTS characterStore (
      characterId bigint NOT NULL PRIMARY KEY,
      nickname varchar(20) NOT NULL,
      job tinyint,
      level tinyint,
      trophy int,
      mainCharacterId bigint,
      accountId bigint,
      lastUpdatedTime bigint NOT NULL,
      isNicknameObsoleted tinyint NOT NULL DEFAULT 0
    )
  `).run()
}

export function getCharId(db: Database, characterId: bigint): CharId | null {
  const result: DBCharId | null = db.prepare(/*sql*/`
    SELECT * FROM characterStore WHERE characterId = ?
  `).get(characterId)
  if (result != null) {
    return convertDBValue(result)
  }
  return null
}

export function getCharIdByName(db: Database, nickname: string): CharId | null {
  const result: DBCharId | null = db.prepare(/*sql*/`
    SELECT * FROM characterStore WHERE nickname = ? AND isNicknameObsoleted = 0
  `).get(nickname)
  if (result != null) {
    return convertDBValue(result)
  }
  return null
}

export function getCharIdsByAccount(db: Database, accountId: bigint): CharId[] {
  const results: DBCharId[] = db.prepare(/*sql*/`
    SELECT * FROM characterStore WHERE accountId = ?
  `).all(accountId)
  return results.map(convertDBValue).filter((v) => v != null) as CharId[]
}

export function insertCharId(db: Database, charId: CharId[]): number {
  const insert = db.prepare(/*sql*/`
    INSERT OR REPLACE INTO characterStore (
      characterId,
      nickname,
      job,
      level,
      trophy,
      mainCharacterId,
      accountId,
      lastUpdatedTime
    ) VALUES (
      ?, ?, ?, ?, ?, ?, ?, ?
    )
  `)
  return db.transaction((ids: CharId[]) => {
    let changes = 0
    for (const id of ids) {
      changes += insert.run(
        id.characterId,
        id.nickname,
        (id.job == null || id.job <= 0) ? null : id.job,
        (id.level == null || id.level <= 0) ? null : id.level,
        (id.trophy == null || id.trophy <= 0) ? null : id.trophy,
        id.mainCharacterId,
        id.accountId,
        id.lastUpdatedTime
      ).changes
    }
    return changes
  })(charId)
}

export function updateCharId(db: Database, cid: bigint, values: Partial<CharId>) {
  const update = db.prepare(/*sql*/`
    UPDATE characterStore SET ${Object.keys(values).map(k => `${k} = ?`).join(", ")} WHERE characterId = ?
  `).run(
    ...Object.values(values),
    cid
  )
}

function convertDBValue(dbValue: DBCharId | null): CharId | null {
  if (dbValue == null) return null
  return {
    characterId: dbValue.characterId,
    nickname: dbValue.nickname,
    job: safeGetInt(dbValue.job, Job.UNKNOWN) as Job,
    level: safeGetInt(dbValue.level, 0),
    trophy: safeGetInt(dbValue.trophy, 0),
    mainCharacterId: dbValue.mainCharacterId,
    accountId: dbValue.accountId,
    lastUpdatedTime: dbValue.lastUpdatedTime,
    isNicknameObsoleted: Number(dbValue.isNicknameObsoleted),
  }
}

function safeGetInt(value: bigint | null, dfValue: number): number {
  return value == null ? dfValue : Number(value)
}