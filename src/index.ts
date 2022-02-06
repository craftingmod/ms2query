import { fetchClearedByDate, fetchClearedRate, fetchMainCharacterByName, fetchTrophyCount, searchLatestClearedPage } from "./ms2/ms2fetch"
import { DungeonId } from "./ms2/dungeonid"
import { MS2Analyzer } from "./ms2/ms2analyzer"
import got from "got-cjs/dist/source"
import Enmap from "enmap"
import Debug from "debug"
import fs from "fs-extra"
import Path from "path"

import { REST } from "@discordjs/rest"
import { Routes, GatewayIntentBits } from "discord-api-types/v9"
import { Client } from "discord.js"
import { BotInit, BotToken } from "./discord/botinit"
import { Ping } from "./discord/cmds/ping"
import { CritRateCmd } from "./discord/cmds/critrate"
import { MinigameCmd } from "./discord/cmds/minigame"
import { FieldBossCmd } from "./discord/cmds/fieldboss"
import { CharSearchCmd } from "./discord/cmds/charsearch"

const debug = Debug("ms2:testmain")
debug("Hello World!")

async function main() {
  const analyzer = new MS2Analyzer("./data", DungeonId.REVERSE_ZAKUM)
  await analyzer.init()
  await analyzer.analyze()

  debug("Done!")
}
async function botMain() {
  const tokenPath = Path.resolve(".", "token.json")
  if (!await fs.pathExists(tokenPath)) {
    await fs.writeFile(tokenPath, JSON.stringify({ token: "", appid: "", prefix: "!", ownerid: "" }))
    throw new Error(`token is required! Path: ${tokenPath}`)
  }
  const secret: BotToken = JSON.parse(await fs.readFile(tokenPath, "utf8"))
  if (secret.token.length <= 0) {
    throw new Error("You must have been entered a token!")
  }

  const bot = new BotInit(secret)
  bot.addCommands(
    new Ping(),
    new CritRateCmd(),
    new MinigameCmd(),
    new FieldBossCmd(),
    new CharSearchCmd(),
  )
  await bot.connect()
}

async function registerCommand(token: string, appid: string) {
  const commands = [
    {
      name: "ping",
      description: "Replies with Pong!",
    }
  ]
  const rest = new REST({
    version: "9"
  }).setToken(token)

  try {
    await rest.put(Routes.applicationGuildCommands(appid, "817856558985379841"), { body: commands })
  } catch (err) {
    console.log(err)
  }
}

try {
  botMain()
} catch (err) {
  console.error(err)
}