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