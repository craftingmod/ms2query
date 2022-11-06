import { AdditionalDef, DataTypesLite, DefinedModelToJSObject, SequelizeLite } from "../../sqliteorm/SequelizeLite.js"

/**
 * 클리어 정보 모델
 */
export type ClearInfo = DefinedModelToJSObject<ReturnType<typeof defineClearInfo>>

export function defineClearInfo(seq: SequelizeLite, tableName: string) {
  return seq.define(tableName, {
    clearRank: DataTypesLite.INTEGER,
    partyId: DataTypesLite.BIGINT,
    clearSec: DataTypesLite.INTEGER,
    clearDate: DataTypesLite.INTEGER,
    memberCount: DataTypesLite.INTEGER,
    leader: DataTypesLite.BIGINT,
    member1: DataTypesLite.BIGINT_NULLABLE,
    member2: DataTypesLite.BIGINT_NULLABLE,
    member3: DataTypesLite.BIGINT_NULLABLE,
    member4: DataTypesLite.BIGINT_NULLABLE,
    member5: DataTypesLite.BIGINT_NULLABLE,
    member6: DataTypesLite.BIGINT_NULLABLE,
    member7: DataTypesLite.BIGINT_NULLABLE,
    member8: DataTypesLite.BIGINT_NULLABLE,
    member9: DataTypesLite.BIGINT_NULLABLE,
    member10: DataTypesLite.BIGINT_NULLABLE,
  }, {
    partyId: [AdditionalDef.PRIMARY_KEY],
  })
}

export function shirinkPartyId(partyId: string) {
  return BigInt(partyId.substring(2, partyId.length - 2))
}