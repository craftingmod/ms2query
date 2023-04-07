import Debug from "debug"
import { DungeonId } from "./ms2/dungeonid.js"
import { fetchClearedByDate } from "./ms2/ms2fetch.js"
import { BotBase } from "./discord/base/BotBase.js"
import { AdminCommand } from "./discord/base/command/AdminCommand.js"
import fs from "node:fs/promises"
import { PingCommand } from "./discord/base/command/PingCommand.js"
import { MS2QueryBot } from "./discord/MS2QueryBot.js"
import { MS2Database } from "./ms2/ms2database.js"


const debug = Debug("ms2:debug:testMain")

const ms2db = new MS2Database("./data/store.db")


export async function testMain() {
  const botToken = await fs.readFile("./data/token.txt", "utf-8")
  const bot = new MS2QueryBot(botToken, ms2db, "./data/botstore.db")
  await bot.connect()
}

testMain()