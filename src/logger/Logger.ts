import chalk from "chalk"
import { log } from "./BaseLogger.ts"

export class Logger {
  public constructor(protected tag: string) {

  }
  public debug(...messages: unknown[]) {
    return log(this.tag, {
      msgColor: chalk.reset,
      backColor: chalk.bgGreen.white.bold,
      headerChar: "D",
      depth: 3,
    }, ...messages)
  }
}