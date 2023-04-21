import { Job } from "../ms2/ms2CharInfo.ts";

/*
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
*/
/* @todo 직접 봇을 돌릴 시에 수정바람 */
export const JobIcon: { [key in Job]: string } = [
  "❔",
  "<:Archer:939687181759430676>",
  "<:Assassin:939687255793094676>",
  "<:Berserker:939687255252025355>",
  "<:HeavyGunner:939687255394643988>",
  "<:Knight:939687255461732372>",
  "<:Priest:939690169026621450>",
  "<:RuneBlader:939690177658515556>",
  "<:SoulBinder:939687255457550356>",
  "<:Striker:939687255407230989>",
  "<:Thief:939687255239454811>",
  "<:Wizard:939687255436574831>",
  "<:Beginner:939689316534353920>",
]