import type { Database } from "better-sqlite3"

export interface BroadcastChannel {
  guildId: bigint,
  channelId: bigint,
  broadcastType: BroadcastType,
  registeredTime: Date,
}

export enum BroadcastType {
  UNKNOWN,
  WorldChat,
}

export function prepareBroadcastChannel(db: Database) {
  db.prepare(/*sql*/`
    CREATE TABLE IF NOT EXISTS broadcastChannel (
      guildId bigint NOT NULL,
      channelId bigint NOT NULL,
      broadcastType tinyint NOT NULL,
      registeredTime bigint NOT NULL
    )
  `).run()
}

export function getBroadcastChannels(db: Database, broadcastType: BroadcastType): BroadcastChannel[] {
  const result: BroadcastChannel[] = db.prepare(/*sql*/`
    SELECT * FROM broadcastChannel WHERE broadcastType = ?
  `).all(broadcastType)
  return result
}

export function insertBroadcastChannel(db: Database, broadcastChannels: BroadcastChannel[]) {
  const insert = db.prepare(/*sql*/`
    INSERT INTO broadcastChannel (guildId, channelId, broadcastType, registeredTime)
    VALUES (?, ?, ?, ?)
  `)
  db.transaction((broadcastChannels: BroadcastChannel[]) => {
    for (const broadcastChannel of broadcastChannels) {
      insert.run(broadcastChannel.guildId, broadcastChannel.channelId, broadcastChannel.broadcastType, broadcastChannel.registeredTime.getTime())
    }
  })(broadcastChannels)
}

export function deleteBroadcastChannel(db: Database, broadcastChannels: BroadcastChannel[]) {
  const deleteQuery = db.prepare(/*sql*/`
    DELETE FROM broadcastChannel WHERE guildId = ? AND channelId = ? AND broadcastType = ?
  `)
  db.transaction((broadcastChannels: BroadcastChannel[]) => {
    for (const broadcastChannel of broadcastChannels) {
      deleteQuery.run(broadcastChannel.guildId, broadcastChannel.channelId, broadcastChannel.broadcastType)
    }
  })(broadcastChannels)
}