import { AdditionalDef, DataTypesLite, DefinedModelToJSObject, SequelizeLite } from "../../sqliteorm/SequelizeLite.js"

/**
 * 닉네임 정보 모델
 */
export type NicknameInfo = DefinedModelToJSObject<ReturnType<typeof defineNicknameInfo>>

export function defineNicknameInfo(seq: SequelizeLite) {
  return seq.define("nickHistory", {
    characterId: DataTypesLite.BIGINT,
    nicknames: DataTypesLite.STRING_ARRAY,
  }, {
    characterId: [AdditionalDef.PRIMARY_KEY],
  })
}