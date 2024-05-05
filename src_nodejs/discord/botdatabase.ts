import type { Database } from "better-sqlite3"
import sqlite from "better-sqlite3"
import { prepareBroadcastChannel } from "./structure/BroadcastChannel.ts"
import { prepareProfileCache } from "./structure/ProfileCache.ts"
import { prepareWorldChatHistory } from "./structure/WorldChatHistory.ts"

export class BotDatabase {
  public database: Database

  public constructor(dbPath: string) {
    this.database = new sqlite(dbPath)
    this.database.defaultSafeIntegers(true)
    this.init()
  }

  public init() {
    prepareWorldChatHistory(this.database)
    prepareBroadcastChannel(this.database)
    prepareProfileCache(this.database)
  }

}