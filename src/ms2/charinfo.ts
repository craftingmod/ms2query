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

export enum JobName {
  UNKNOWN = "몰루",
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

export interface CharacterUnknownInfo {
  job: Job
  nickname: string
  level: number
}

export interface CharacterInfo extends CharacterUnknownInfo {
  characterId: string
}

export interface PredictCharacterInfo extends CharacterInfo {
  mainCharId: string
}

export interface MainCharacterInfo extends CharacterInfo {
  accountId: string
}

export interface TotalCharacterInfo extends MainCharacterInfo, PredictCharacterInfo {
  accountSpoofed: boolean
}

export type SerializedCInfo = [string, string, Job, number, string, string, boolean]

export function serializeCharacterInfo(info: TotalCharacterInfo) {
  // cid, nickanme 
  return [info.characterId, info.nickname, info.job, info.level, info.mainCharId, info.accountId, info.accountSpoofed] as SerializedCInfo
}

export function deserializeCharacterInfo(info: SerializedCInfo): TotalCharacterInfo {
  return {
    characterId: info[0],
    nickname: info[1],
    job: info[2],
    level: info[3],
    mainCharId: info[4],
    accountId: info[5],
    accountSpoofed: info[6],
  }
}