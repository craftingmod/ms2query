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