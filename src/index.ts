import { tokenDebug } from "../data/token.json"
import { Client, Events, GatewayIntentBits } from "discord.js"
import { BotBase } from "./discord/base/BotBase.ts"
import { baseConfig, type BaseConfig } from "./discord/base/BaseConfig.ts"
import { Logger } from "./logger/Logger.ts"

/*
class SimpleBot extends BotBase<BaseConfig> {
  protected globalConfig = baseConfig
}

const simpleBot = new SimpleBot(tokenDebug)

await simpleBot.connect()
*/

const logger = new Logger("indexTS")

logger.debug("MAIN", "Hi")

function test1() {
  logger.debug("123", 123, true, "Hihi", { aa: 123, bb: false })
}

test1()