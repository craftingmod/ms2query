import chalk from "chalk"
import { log } from "./BaseLogger.ts"

/**
 * 간단하게 쓸 로그 클래스
 */
export class Logger {
  protected readonly stackDepth = 3
  public constructor(
    /**
     * 메세지 앞에 붙을 태그
     */
    protected tag: string
  ) {

  }
  /**
   * 디버그 메세지를 출력합니다
   * @param messages 메세지
   * @returns 출력된 raw 콘솔값
   */
  public debug(...messages: unknown[]) {
    return log(this.tag, {
      msgColor: chalk.reset,
      backColor: chalk.bgGreen.white.bold,
      headerChar: "D",
      depth: this.stackDepth,
      logLevel: 2,
    }, ...messages)
  }
  /**
   * 로깅 메세지를 출력합니다
   * @param messages 메세지
   * @returns 출력된 raw 콘솔값
   */
  public verbose(...messages: unknown[]) {
    return log(this.tag, {
      msgColor: chalk.reset,
      backColor: chalk.bgWhite.white.bold,
      headerChar: "V",
      depth: this.stackDepth,
      logLevel: 1,
    }, ...messages)
  }
  /**
   * 정보 레벨 메세지를 출력합니다.
   * @param messages 메세지
   * @returns 출력된 raw 콘솔값
   */
  public info(...messages: unknown[]) {
    return log(this.tag, {
      msgColor: chalk.reset,
      backColor: chalk.bgBlue.gray.bold,
      headerChar: "I",
      depth: this.stackDepth,
      logLevel: 3,
    }, ...messages)
  }
  /**
   * 주의 레벨 메세지를 출력합니다.
   * @param messages 메세지 
   * @returns 출력된 raw 콘솔값
   */
  public warning(...messages: unknown[]) {
    return log(this.tag, {
      msgColor: chalk.yellow,
      backColor: chalk.bgYellow.black.bold,
      headerChar: "W",
      depth: this.stackDepth,
      logLevel: 4,
    }, ...messages)
  }
  /**
   * 에러 레벨 메세지를 출력합니다.
   * @param messages 메세지
   * @returns 출력된 raw 콘솔값
   */
  public error(...messages: unknown[]) {
    return log(this.tag, {
      msgColor: chalk.red,
      backColor: chalk.bgRed.black.bold,
      headerChar: "E",
      depth: this.stackDepth,
      logLevel: 5,
    }, ...messages)
  }
}