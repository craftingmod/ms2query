import { MS2Database } from "../ms2database";
import { fetchTrophyCount } from "../ms2fetch";
import Debug from "debug"

const debug = Debug("ms2:debug:ms2query")

export class MS2Query extends MS2Database {
  /**
   * 트로피의 개수를 불러옵니다.
   * @param nickname 닉네임
   */
  public async searchTrophyCount(nickname: string) {
    const trophyInfo = await fetchTrophyCount(nickname)

  }
  /**
   * `characterId`의 캐릭터의 닉네임이 `currentNickname`
   * 으로 변경되었음을 마킹
   * @param characterId 캐릭터 ID
   * @param currentNickname 현재 이름
   */
  public markNicknameChanged(characterId: bigint, currentNickname: string) {
    // characterId의 유저
    const userById = this.queryCharacterById(characterId)
    if (userById != null && userById.nickname !== currentNickname) {
      // currentNickname하고 characterId의 닉네임하고 다르다면 기록
      // 현재 캐릭터의 닉네임 기록
      const nickHistory = this.nicknameHistory.findOne({
        characterId: characterId,
      })
      let nickStack = [] as string[]
      // 닉네임 변경사항 기록
      if (nickHistory == null) {
        nickStack = [userById.nickname, currentNickname]
      } else {
        nickStack = [...nickHistory.nicknames, currentNickname]
      }
      // 기록 마킹
      this.nicknameHistory.insertOne({
        characterId,
        nicknames: nickStack,
      })
      // 닉네임 변경 반영
      this.characterStore.updateOne({
        characterId,
      }, {
        nickname: currentNickname,
      })
    }
  }
}