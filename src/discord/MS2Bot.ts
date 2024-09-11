import { BotBase } from "./base/BotBase.ts"
import type { Command } from "./base/Command.ts"
import { AccRateCmd } from "./command/AccRateCmd.ts"
import { PingCmd } from "./command/PingCmd.ts"
import { type MS2BotConfig, MS2BotDefaultConfig } from "./MS2BotConfig.ts"
import Path from "node:path"

export class MS2Bot extends BotBase<MS2BotConfig> {
  protected globalConfig = MS2BotDefaultConfig
  protected configPath: string = Path.resolve("data", "config2.json")

  protected async onReady() {
    await super.onReady()
    this.addCommand(
      new PingCmd(),
      new AccRateCmd(),
    )
  }
}