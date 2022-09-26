import type { Command } from "../command.js";
import { AdminCommand } from "./AdminCommand.js";
import { Ping } from "./Ping.js";

export const commands: Command[] = [
  new Ping(),
  new AdminCommand(),
]