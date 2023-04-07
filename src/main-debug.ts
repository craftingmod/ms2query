import Debug from "debug"
import { DungeonId } from "./ms2/dungeonid.js"
import { fetchClearedByDate } from "./ms2/ms2fetch.js"
import { BotBase } from "./discord/base/BotBase.js"
import { AdminCommand } from "./discord/base/command/AdminCommand.js"
import fs from "node:fs/promises"
import { PingCommand } from "./discord/base/command/PingCommand.js"


const debug = Debug("ms2:debug:testMain")
export async function testMain() {
  const botToken = await fs.readFile("./data/token.txt", "utf-8")
  const bot = new TestBot(botToken)
  await bot.connect()
}

class TestBot extends BotBase {
  constructor(token: string) {
    super(token)
    const adminCommand = new AdminCommand(this)
    this.addCommand(adminCommand)
    this.addCommand(new PingCommand())
  }
}

testMain()