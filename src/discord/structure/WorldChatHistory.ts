import type { Database } from "better-sqlite3";
import { WorldChatType } from "../../ms2/database/WorldChatType";

export interface WorldChatHistory {
  senderId: bigint | null,
  senderName: string,
  worldChatType: WorldChatType,
  content: string,
  sentTime: Date,
}

export interface DBWorldChatHistory {
  senderId: bigint | null,
  senderName: string,
  worldChatType: bigint,
  content: string,
  sentTime: bigint,
}

export function prepareWorldChatHistory(db: Database) {
  db.prepare(/*sql*/`
    CREATE TABLE IF NOT EXISTS worldChatHistory (
      senderId bigint,
      senderName varchar(20) NOT NULL,
      worldChatType tinyint NOT NULL,
      content varchar(255) NOT NULL,
      sentTime bigint NOT NULL
    )
  `).run()
}

export function getLastWorldChat(db: Database) {
  const result: DBWorldChatHistory | null = db.prepare(/*sql*/`
    SELECT * FROM worldChatHistory ORDER BY sentTime DESC LIMIT 1
  `).get()
  if (result != null) {
    return convertDBValue(result)
  }
  return null
}

export function insertWorldChat(db: Database, worldChats: WorldChatHistory[]) {
  const insert = db.prepare(/*sql*/`
    INSERT INTO worldChatHistory (senderId, senderName, worldChatType, content, sentTime)
    VALUES (?, ?, ?, ?, ?)
  `)
  db.transaction((worldChats: WorldChatHistory[]) => {
    for (const worldChat of worldChats) {
      insert.run(worldChat.senderId, worldChat.senderName, worldChat.worldChatType, worldChat.content, worldChat.sentTime.getTime() / 1000)
    }
  })(worldChats)
}

function convertDBValue(result: DBWorldChatHistory): WorldChatHistory {
  return {
    senderId: result.senderId,
    senderName: result.senderName,
    worldChatType: Number(result.worldChatType) as WorldChatType,
    content: result.content,
    sentTime: new Date(Number(result.sentTime) * 1000),
  }
}