import type { Database } from "better-sqlite3"

export interface NicknameHistory {
  characterId: bigint
  nicknames: string[]
}

export function prepareNicknameHistory(db: Database) {
  db.prepare(/*sql*/`
    CREATE TABLE IF NOT EXISTS nickHistory (
      characterId bigint NOT NULL PRIMARY KEY,
      nicknames varchar(255) NOT NULL
    )
  `).run()
}

export function getNicknameHistory(db: Database, characterId: bigint): NicknameHistory | null {
  const result = db.prepare(/*sql*/`
    SELECT * FROM nickHistory WHERE characterId = ?
  `).get(characterId)
  if (result != null) {
    return {
      characterId: result.characterId,
      nicknames: result.nicknames.split(","),
    }
  }
  return null
}

export function insertNicknameHistory(db: Database, nickHistory: NicknameHistory[]) {
  const insert = db.prepare(/*sql*/`
    INSERT OR REPLACE INTO nickHistory (
      characterId,
      nicknames
    ) VALUES (
      ?,
      ?
    )
  `)
  db.transaction((nickHistory: NicknameHistory[]) => {
    for (const nick of nickHistory) {
      insert.run(nick.characterId, nick.nicknames.join(","))
    }
  })(nickHistory)
}