import { Database } from "better-sqlite3"

export interface ClearInfo {
  clearRank: number
  partyId: bigint
  clearSec: number
  clearDate: number
  memberCount: number
  leader: bigint
  member1: bigint | null
  member2: bigint | null
  member3: bigint | null
  member4: bigint | null
  member5: bigint | null
  member6: bigint | null
  member7: bigint | null
  member8: bigint | null
  member9: bigint | null
  member10: bigint | null
}

export function prepareClearInfo(db: Database, tableName: string) {
  db.prepare(/*sql*/`
    CREATE TABLE IF NOT EXISTS ${tableName} (
      clearRank int NOT NULL,
      partyId bigint NOT NULL PRIMARY KEY,
      clearSec int NOT NULL,
      clearDate int NOT NULL,
      memberCount tinyint NOT NULL,
      leader bigint NOT NULL,
      member1 bigint,
      member2 bigint,
      member3 bigint,
      member4 bigint,
      member5 bigint,
      member6 bigint,
      member7 bigint,
      member8 bigint,
      member9 bigint,
      member10 bigint
    )
  `).run()
}

export function insertClearInfo(db: Database, tableName: string, clearInfo: ClearInfo[]): number {
  const insert = db.prepare(/*sql*/`
    INSERT OR REPLACE INTO ${tableName} (
      clearRank,
      partyId,
      clearSec,
      clearDate,
      memberCount,
      leader,
      member1,
      member2,
      member3,
      member4,
      member5,
      member6,
      member7,
      member8,
      member9,
      member10
    ) VALUES (
     ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
    )
  `)
  return db.transaction((ids: ClearInfo[]) => {
    let changes = 0
    for (const id of ids) {
      changes += insert.run(
        id.clearRank,
        id.partyId,
        id.clearSec,
        id.clearDate,
        id.memberCount,
        id.leader,
        id.member1,
        id.member2,
        id.member3,
        id.member4,
        id.member5,
        id.member6,
        id.member7,
        id.member8,
        id.member9,
        id.member10,
      ).changes
    }
    return changes
  })(clearInfo)
}

export function shirinkPartyId(partyId: string) {
  return BigInt(partyId.substring(2, partyId.length - 2))
}

export function parseQueryClearInfo(value: any | null) {
  if (value == null) {
    return null
  }
  return {
    ...value,
    clearRank: Number(value.clearRank),
    clearSec: Number(value.clearSec),
    clearDate: Number(value.clearDate),
    memberCount: Number(value.memberCount),
  } as ClearInfo
}