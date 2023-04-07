import { Job, CritCoef } from "./ms2CharInfo.js"

/**
 * 정확한 크리티컬 명중 확률 계산
 * @param attacker 공격자 (크명/LUK/직업)
 * @param critrate 피격자 (크리티컬 회피)
 * @returns 크리티컬 확률
 */
export function calcCritRate(attacker: { critRate: number, luk: number, job: Job }, defender: { criteva: number }) {
  const { critRate, luk, job } = attacker
  const { criteva } = defender
  return Math.min(0.4, (5.3 * critRate + luk * CritCoef[job]) / (2 * criteva) * 0.015)
}

/**
 * 크리티컬 확률 40%를 위한 크리티컬 명중 계산
 * @param attacker 공격자 (LUK/직업)
 * @param defender 피격자 (크리티컬 회피)
 * @returns 필요한 크리티컬 명중
 */
export function calcMaxCritRate(attacker: { luk: number, job: Job }, defender: { criteva: number }) {
  const { luk, job } = attacker
  const { criteva } = defender
  return Math.ceil(((1000 * 0.4 / 15) * (2 * criteva) - luk * CritCoef[job]) / 5.3)
}

/**
 * 정확한 명중 확률 계산
 * @param attacker 공격자 (명중/DEX) 
 * @param defender 피격자 (회피)
 * @returns 명중 확률
 */
export function calcAccRate(attacker: { accuracy: number, dex: number }, defender: { eva: number }) {
  const { accuracy, dex } = attacker
  const { eva } = defender

  const rawValue = (accuracy - 10) / (eva + 0.8 * accuracy) * 2
  const rawAdd = Math.min(0.05, Math.max(0, dex / (dex + 51) * 0.05))
  return Math.min(1, Math.max(0.1, rawValue + rawAdd))
}

/**
 * 명중 확률 100%를 위한 명중 계산
 * @param attacker 공격자 (DEX)
 * @param defender 피격자 (회피)
 * @returns 필요한 명중
 */
export function calcMaxAccRate(attacker: { dex: number }, defender: { eva: number }) {
  const { dex } = attacker
  const { eva } = defender

  const alpha = Math.min(0.05, Math.max(0, dex / (dex + 51) * 0.05))

  return (eva * (1 - alpha) + 20) / (1.2 + 0.8 * alpha)
}

export const accChartURL = "https://docs.google.com/spreadsheets/d/1wAg7YQhpVWldiTncndE24Ceoqh7JzETdKwDp49tid0Q/edit?usp=sharing"