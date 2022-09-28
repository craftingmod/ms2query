import Database from "better-sqlite3"
import test from "node:test"
import { getCharId, insertCharId, prepareCharId } from './ms2/structure/CharId.js'
import { ClearInfo, insertClearInfo, prepareClearInfo } from "./ms2/structure/ClearInfo.js"

export async function fixDB2() {
  const db = new Database("data/store.db")
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
  prepareClearInfo(db, "rzakHistory")
  insertClearInfo(db, "rzakHistory", mColumns)
}

export async function fixDB3() {
  const db = new Database("data/store.db")
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
  prepareClearInfo(db, "rzakHistory")
  insertClearInfo(db, "rzakHistory", mColumns)
}