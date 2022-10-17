import { TOKEN, PREFIX, OWNERID } from './config.js'
import { BotInit } from './discord/botinit.js'
import { commands } from './discord/commands/index.js'
import Debug from "debug"
import { MS2Database } from './ms2/ms2database.js'

const debug = Debug("ms2:debug:main")

const ms2db = new MS2Database("./data/store.db")

async function botMain() {
  const bot = new BotInit({
    token: TOKEN,
    prefix: PREFIX,
    ownerid: OWNERID,
  }, ms2db, "./data/botstore.db")
  bot.addCommands(...commands)

  await bot.connect()
}

await botMain()