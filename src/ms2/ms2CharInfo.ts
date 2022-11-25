/**
 * 직업 목록 (A-Z 정렬 후에 초보자 추가)
 */
export enum Job {
  UNKNOWN,
  Archer,
  Assassin,
  Berserker,
  HeavyGunner,
  Knight,
  Priest,
  RuneBlader,
  SoulBinder,
  Striker,
  Thief,
  Wizard,
  Beginner,
}

/**
 * 직업 이름
 */
export enum JobName {
  UNKNOWN = "정보 없음",
  Archer = "레인저",
  Assassin = "어쌔신",
  Berserker = "버서커",
  HeavyGunner = "헤비거너",
  Knight = "나이트",
  Priest = "프리스트",
  RuneBlader = "룬블레이더",
  SoulBinder = "소울바인더",
  Striker = "스트라이커",
  Thief = "시프",
  Wizard = "위자드",
  Beginner = "초보자",
}

/**
 * 직업 -> 직업 이름
 */
export const JobNameMap: { [key in Job]: JobName } = [
  JobName.UNKNOWN,
  JobName.Archer,
  JobName.Assassin,
  JobName.Berserker,
  JobName.HeavyGunner,
  JobName.Knight,
  JobName.Priest,
  JobName.RuneBlader,
  JobName.SoulBinder,
  JobName.Striker,
  JobName.Thief,
  JobName.Wizard,
  JobName.Beginner,
]

/**
 * 크리티컬 계수
 */
export const CritCoef: { [key in Job]: number } = [
  0,
  6.4575,
  0.55125,
  4.305,
  2.03875,
  3.78,
  7.34125,
  3.78,
  3.40375,
  2.03875,
  0.60375,
  3.40375,
  1.63625,
]

/**
 * 던전 파티원 멤버에서 나오는 캐릭터 정보
 */
export interface CharacterMemberInfo {
  job: Job
  nickname: string
  level: number
}

/**
 * 던전 리더에서 나오는 정보
 */
export interface CharacterInfo extends CharacterMemberInfo {
  characterId: bigint
  profileURL: string
}

/**
 * 트로피 검색에서 나오는 정보
 */
export interface TrophyCharacterInfo extends CharacterInfo {
  trophyRank: number
  trophyCount: number
}
/**
 * 던전 클리어 순위에서 나오는 정보
 */
export interface DungeonClearedCharacterInfo extends CharacterInfo {
  clearedCount: number
  clearedRank: number
}

/**
 * 메인 캐릭터 정보
 */
export interface MainCharacterInfo extends CharacterInfo {
  mainCharacterId: bigint
  accountId: bigint
  houseName: string
  houseScore: number
  houseRank: number
  houseDate: number // yyyymm
}

/*
export interface TotalCharacterInfo extends MainCharacterInfo, PredictCharacterInfo {
  accountSpoofed: boolean
}
*/