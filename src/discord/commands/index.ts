import type { Command } from "../Command.js";
import { AdminCommand } from "./AdminCommand.js";
import { SearchCommand } from "./SearchCommand.js";
import { CritRateCommand } from "./CritRateCommand.js";
import { FieldBossCommand } from "./FieldBossCommand.js";
import { MinigameCommand } from "./MinigameCommand.js";
import { Ping } from "./Ping.js";
import { RegionCommand } from "./RegionCommand.js";
import { TrophyCommand } from "./TrophyCommand.js";
import { WorldChatCommand } from "./WorldChatCommand.js";

/*
export const commands: Command[] = [
  new Ping(),
  new AdminCommand(),
  new CritRateCommand(),
  new FieldBossCommand(),
  new MinigameCommand(),
  new RegionCommand(),
  new TrophyCommand(),
  new SearchCommand(),
  new WorldChatCommand(),
]
*/

export const commands: Command[] = [
  new FieldBossCommand(),
]