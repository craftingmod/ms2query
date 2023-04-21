import { AdditionalDef, DataTypesLite, type DefinedModelToJSObject, SequelizeLite } from "../../sqliteorm/SequelizeLite.js"

/**
 * 닉네임 정보 모델
 */
export type WorldChatInfo = DefinedModelToJSObject<ReturnType<typeof defineWorldChatInfo>>

export function defineWorldChatInfo(seq: SequelizeLite) {
  return seq.define("worldChatHistory", {
    characterId: DataTypesLite.BIGINT_NULLABLE,
    characterName: DataTypesLite.STRING,
    worldChatType: DataTypesLite.INTEGER,
    content: DataTypesLite.STRING,
    timestamp: DataTypesLite.BIGINT,
  })
}

export enum WorldChatType {
  World,
  Channel,
}