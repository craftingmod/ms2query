import { Client, Events, GatewayIntentBits } from "discord.js"
import { BotBase } from "./discord/base/BotBase.ts"
import { baseConfig, type BaseConfig } from "./discord/base/BaseConfig.ts"
import { Logger } from "./logger/Logger.ts"
import chalk from "chalk"
import { PingCmd } from "./discord/command/PingCmd.ts"
import Path from "node:path"

process.env.LOGLEVEL = "0"

class SimpleBot extends BotBase<BaseConfig> {
  protected globalConfig = baseConfig
  protected configPath: string = Path.resolve("data", "config2.json")

  protected async onReady() {
    await super.onReady()
    this.addCommand(PingCmd)
  }
}

const simpleBot = new SimpleBot()
await simpleBot.connect()