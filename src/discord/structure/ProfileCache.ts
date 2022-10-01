import { Database } from "better-sqlite3";

export interface ProfileCache {
  characterId: bigint,
  profileImage: string,
  lastUpdatedTime: bigint,
}

export function prepareProfileCache(db: Database) {
  db.prepare(/*sql*/`
    CREATE TABLE IF NOT EXISTS profileCache (
      characterId bigint NOT NULL PRIMARY KEY,
      profileImage varchar(100) NOT NULL,
      lastUpdatedTime bigint NOT NULL
    )
  `).run()
}

export function getProfileCache(db: Database, characterId: bigint): ProfileCache | null {
  const result: ProfileCache | null = db.prepare(/*sql*/`
    SELECT * FROM profileCache WHERE characterId = ?
  `).get(characterId)
  if (result != null) {
    return result
  }
  return null
}

export function insertProfileCache(db: Database, profileCaches: ProfileCache[]) {
  const insert = db.prepare(/*sql*/`
    INSERT OR REPLACE INTO profileCache (characterId, profileImage, lastUpdatedTime)
    VALUES (?, ?, ?)
  `)
  db.transaction((profileCaches: ProfileCache[]) => {
    for (const profileCache of profileCaches) {
      insert.run(profileCache.characterId, profileCache.profileImage, profileCache.lastUpdatedTime)
    }
  })(profileCaches)
}

export function isProfileCacheValid(profileCache: ProfileCache) {
  return Date.now() - Number(profileCache.lastUpdatedTime) < 1000 * 60 * 60 * 24 // 24 hour
}