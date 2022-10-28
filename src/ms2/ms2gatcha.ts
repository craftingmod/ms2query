import { fetchCapsuleList } from "./ms2fetch.js";

export interface MS2CapsuleItem {
  itemName: string,
  itemTier: MS2ItemTier,
  itemTrade: MS2Tradable,
  quantity: number,
  chancePercent: number, // float
}

/**
 * 글로벌 서버 기준 아이템 티어 
 */
export enum MS2ItemTier {
  NORMAL,
  RARE,
  EXCEPTIONAL,
  EPIC, // 엑설런트
  LEGENDARY,
  ASCENDENT, // 에픽
}

export enum MS2Tradable {
  TRADEABLE,
  ACCOUNT_BOUND,
  CHARACTER_BOUND,
}

export interface MS2CapsuleCoin {
  itemName: string,
  coin: number,
}

export class MS2CapsuleSimulator {
  protected items: MS2CapsuleItem[] = []
  protected chances: number[] = []
  protected sumChances: number = 0

  public async loadTable(capsuleId: number) {
    const gatcha = await fetchCapsuleList(capsuleId)
    if (gatcha["여자"] != null) {
      this.items.push(...gatcha["여자"])
    } else if (gatcha["없음"] != null) {
      this.items.push(...gatcha["없음"])
    } else {
      throw new Error("가챠 데이터 값이 없습니다.")
    }
    let chance = 0
    for (const item of this.items) {
      const c = Math.floor(item.chancePercent * 1000)
      chance += c
      this.sumChances += c
      this.chances.push(chance)
    }
  }
  // Simulate picking one of items from sorted chances proabability with binary search
  public simulateOnce() {
    const rand = Math.floor(Math.random() * this.sumChances)
    let left = 0
    let right = this.chances.length - 1
    while (left < right) {
      const mid = Math.floor((left + right) / 2)
      if (this.chances[mid]!! <= rand) {
        left = mid + 1
      } else {
        right = mid
      }
    }
    return this.items[left]!!
  }
  public simulateUntilGet(items: MS2CapsuleCoin[], transformer?: (item: MS2CapsuleItem) => string[] | null) {
    const histories: MS2CapsuleItem[] = []
    // 남은 뽑아야 할 아이템
    const leftPiece = items.map((item) => item)
    let coin = 0
    while (leftPiece.length > 0) {
      // 시뮬레이션한 아이템
      const item = this.simulateOnce()
      histories.push(item)
      let isItem = false
      let requiredCoin = 0
      // 변형된 결과로 루프
      const transformed = transformer?.(item) ?? [item.itemName]
      for (const name of transformed) {
        for (let i = 0; i < leftPiece.length; i += 1) {
          const left = leftPiece[i]!!
          if (left.itemName === name) {
            isItem = true
            leftPiece.splice(i, 1)
            break
          }
        }
      }
      // 필요한 코인 계산
      for (const left of leftPiece) {
        requiredCoin += left.coin
      }
      // 아이템이 아니면 코인을 추가
      if (!isItem) {
        coin += 1
      }
      // 필요한 코인이 현재 코인보다 작으면 끝
      if (requiredCoin <= coin) {
        break
      }
    }
    return histories
  }
  public constructor() {

  }
}