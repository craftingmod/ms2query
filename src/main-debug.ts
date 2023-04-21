import Debug from "debug"
import { DungeonId } from "./ms2/dungeonid.ts"
import { fetchClearedByDate } from "./ms2/ms2fetch.ts"
import { BotBase } from "./discord/base/BotBase.ts"
import { AdminCommand } from "./discord/base/command/AdminCommand.ts"
import fs from "node:fs/promises"
import { PingCommand } from "./discord/base/command/PingCommand.ts"
import { MS2QueryBot } from "./discord/MS2QueryBot.ts"
import { MS2Database } from "./ms2/ms2database.ts"


const debug = Debug("ms2:debug:testMain")

const ms2db = new MS2Database("./data/store.db")


export async function testMain() {
  const botToken = await fs.readFile("./data/token.txt", "utf-8")
  const bot = new MS2QueryBot(botToken, ms2db, "./data/botstore.db")
  await bot.connect()
}

testMain()