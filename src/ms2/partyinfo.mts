import { CharacterInfo, CharacterUnknownInfo } from "./charinfo.mjs";

export interface PartyInfo {
  partyId: string
  leader: CharacterInfo
  members: CharacterUnknownInfo[]
  partyDate: {
    year: number,
    month: number,
    day: number,
  },
  clearSec: number,
  clearRank: number,
}