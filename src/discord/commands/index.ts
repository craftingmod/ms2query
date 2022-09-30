import type { Command } from "../command.js";
import { AdminCommand } from "./AdminCommand.js";
import { CritRateCommand } from "./CritRateCommand.js";
import { FieldBossCommand } from "./FieldBossCommand.js";
import { MinigameCommand } from "./MinigameCommand.js";
import { Ping } from "./Ping.js";

export const commands: Command[] = [
  new Ping(),
  new AdminCommand(),
  new CritRateCommand(),
  new FieldBossCommand(),
  new MinigameCommand()
]