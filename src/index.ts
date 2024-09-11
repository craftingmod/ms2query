import { Client, Events, GatewayIntentBits } from "discord.js"
import { BotBase } from "./discord/base/BotBase.ts"
import { baseConfig, type BaseConfig } from "./discord/base/BaseConfig.ts"
import { Logger } from "./logger/Logger.ts"
import chalk from "chalk"
import { PingCmd } from "./discord/command/PingCmd.ts"
import Path from "node:path"
import { AccRateCmd } from "./discord/command/AccRateCmd.ts"
import { MS2Bot } from "./discord/MS2Bot.ts"

process.env.LOGLEVEL = "0"

const simpleBot = new MS2Bot()
await simpleBot.connect()