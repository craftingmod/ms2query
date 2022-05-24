import sqlite, { Database } from "better-sqlite3"
import { DungeonId } from "./dungeonid.mjs"

export class MS2Database {
  private dbPath: String
  public database: Database
  public constructor(dbPath: string) {
    this.dbPath = dbPath
    this.database = new sqlite(dbPath)
    this.init()
  }
  /**
   * 초기 설정
   */
  public init() {
    // 캐릭터 정보 테이블
    this.database.prepare(/*sql*/`
      CREATE TABLE IF NOT EXISTS characterStore (
        charcterId bigint NOT NULL PRIMARY KEY,
        nickname varchar(20) NOT NULL,
        job tinyint NOT NULL DEFAULT 0,
        trophy tinyint NOT NULL DEFAULT -1,
        level tinyint NOT NULL DEFAULT -1,
        mainCharacterId bigint,
        accountId bigint,
        updateDate bigint
      )`).run()
    // 리자쿰 테이블
    this.createDungeonHistoryTable(getTableNameByDungeon(DungeonId.REVERSE_ZAKUM))
  }
  /**
   * 던전 기록용 테이블을 만든다
   * @param tableName 테이블 이름 
   */
  protected createDungeonHistoryTable(tableName: string | DungeonId) {
    if (typeof tableName !== "string") {
      tableName = getTableNameByDungeon(tableName)
    }
    this.database.prepare(/*sql*/`
      CREATE TABLE IF NOT EXISTS ${tableName} (
        clearRank int NOT NULL PRIMARY KEY,
        partyId varchar(26) NOT NULL,
        clearSec int NOT NULL,
        clearDate int NOT NULL,
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
      )`).run()
  }
}

export function getTableNameByDungeon(dungeon: DungeonId) {
  switch (dungeon) {
    case DungeonId.REVERSE_ZAKUM:
      return "rzakHistory"
    default:
      return ""
  }
}