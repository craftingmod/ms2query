/**
 * 봇 기본 설정
 */
export const baseConfig = {
  /**
   * 토큰
   */
  token: "",
  /**
   * 클라이언트 ID
   */
  clientId: "",
  /**
   * 명령어 테스트 할 길드
   */
  devGuildId: "",
  /**
   * 상태 메세지
   */
  statusMessage: "Bot on!",
  /**
   * 로그 찍을 채널
   */
  logChannel: "",
}

export type BaseConfig = typeof baseConfig