import { AdditionalDef, DataTypesLite, type DefinedModelToJSObject, SequelizeLite } from "../../sqliteorm/SequelizeLite.js"

/**
 * 캐릭터 정보 모델
 */
export type CharacterStoreInfo = DefinedModelToJSObject<ReturnType<typeof defineCharacterInfo>>

export function defineCharacterInfo(seq: SequelizeLite) {
  return seq.define("characterStore", {
    characterId: DataTypesLite.BIGINT,
    nickname: DataTypesLite.STRING,
    job: DataTypesLite.INTEGER_NULLABLE,
    level: DataTypesLite.INTEGER_NULLABLE,
    trophy: DataTypesLite.INTEGER_NULLABLE,
    mainCharacterId: DataTypesLite.BIGINT_NULLABLE,
    accountId: DataTypesLite.BIGINT_NULLABLE,
    isNicknameObsoleted: DataTypesLite.INTEGER,
    houseQueryDate: DataTypesLite.INTEGER,
    starHouseDate: DataTypesLite.INTEGER_NULLABLE,
    houseName: DataTypesLite.STRING_NULLABLE,
    profileURL: DataTypesLite.STRING_NULLABLE,
    lastUpdatedTime: DataTypesLite.DATE,
  }, {
    characterId: [AdditionalDef.PRIMARY_KEY],
  })
}