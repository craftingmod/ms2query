import chalk from "chalk"
import { log } from "./BaseLogger.ts"

/**
 * 간단하게 쓸 로그 클래스
 */
export class Logger {
  protected stackDepth = 3
  /**
   * 로그 태그
   */
  protected tag: string
  /**
   * 함수 이름 보여줄지 여부
   */
  protected showFnName: boolean = true
  public constructor(
    /**
     * 메세지 앞에 붙을 태그
     */
    tagOrOptions: {
      tag: string,
      showFnName?: boolean,
      fnDepth?: number,
    } | string
  ) {
    // Tag 옵션이 문자열이면 바로 태그 처리
    if (typeof tagOrOptions === "string") {
      this.tag = tagOrOptions
      return
    }

    // Tag 옵션이 JSON일 시
    this.tag = tagOrOptions.tag
    this.showFnName = tagOrOptions.showFnName ?? true
    this.stackDepth = 3 + (tagOrOptions.fnDepth ?? 0)
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
      showFnName: this.showFnName,
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
      showFnName: this.showFnName,
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
      showFnName: this.showFnName,
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
      showFnName: this.showFnName,
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
      showFnName: this.showFnName,
    }, ...messages)
  }
}