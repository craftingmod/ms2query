import type { Database } from "better-sqlite3"

import { MS2Database } from "../ms2/ms2database.ts"
import { BotBase } from "./base/BotBase.ts"
import { AdminCommand } from "./base/command/AdminCommand.ts"
import { PingCommand } from "./base/command/PingCommand.ts"
import { type ConfigBase, defaultConfigBase } from "./base/ConfigBase.ts"
import { BotDatabase } from "./botdatabase.ts"
import { AccRateCommand } from "./commands/AccRateCommand.ts"
import { CritRateCommand } from "./commands/CritRateCommand.ts"
import { FieldBossCommand } from "./commands/FieldBossCommand.ts"
import { LegionCommand } from "./commands/LegionCommand.ts"
import { MiniGameCommand } from "./commands/MiniGameCommand.ts"
import { MS2AdminCommand } from "./commands/MS2AdminCommand.ts"

const defaultConfig = {
  ...defaultConfigBase,
  guestbookToken: "",
}

export class MS2QueryBot extends BotBase {
  public readonly ms2db: MS2Database
  public readonly botdb: Database
  public override readonly globalConfig: typeof defaultConfig = defaultConfig
  constructor(token: string, database: MS2Database, dbPath: string) {
    super(token)
    // 변수 추가
    this.ms2db = database
    this.botdb = new BotDatabase(dbPath).database

    this.addCommand(new MS2AdminCommand(this))
    this.addCommand(new PingCommand())

    this.addCommand(new CritRateCommand())
    this.addCommand(new AccRateCommand())
    this.addCommand(new FieldBossCommand(this))
    this.addCommand(new MiniGameCommand())
    this.addCommand(new LegionCommand())
  }

  public override async setConfig(config: Partial<typeof defaultConfig>) {
    return super.setConfig(config)
  }
}