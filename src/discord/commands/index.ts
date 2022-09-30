import type { Command } from "../command.js";
import { AdminCommand } from "./AdminCommand.js";
import { CharSearchCommand } from "./CharSearchCommand.js";
import { CritRateCommand } from "./CritRateCommand.js";
import { FieldBossCommand } from "./FieldBossCommand.js";
import { MinigameCommand } from "./MinigameCommand.js";
import { Ping } from "./Ping.js";
import { RegionCommand } from "./RegionCommand.js";
import { TrophyCommand } from "./TrophyCommand.js";

export const commands: Command[] = [
  new Ping(),
  new AdminCommand(),
  new CritRateCommand(),
  new FieldBossCommand(),
  new MinigameCommand(),
  new RegionCommand(),
  new TrophyCommand(),
  new CharSearchCommand(),
]