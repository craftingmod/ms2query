export const defaultConfigBase = {
  statusMessage: "", // 상태 메시지
  adminUserId: "", // 관리자 ID
  debugGuildId: "", // 테스트할 길드 ID
}

export type ConfigBase = Readonly<typeof defaultConfigBase>