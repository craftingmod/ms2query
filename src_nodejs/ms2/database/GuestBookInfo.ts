import { AdditionalDef, DataTypesLite, type DefinedModelToJSObject, SequelizeLite } from "../../sqliteorm/SequelizeLite.ts"

/**
 * 방명록 정보 모델
 */
export type GuestBookInfo = DefinedModelToJSObject<ReturnType<typeof defineGuestBookInfo>>
export type RawGuestBookInfo = Omit<GuestBookInfo, "characterId">

export function defineGuestBookInfo(seq: SequelizeLite) {
  return seq.define("guestBookStore", {
    commentId: DataTypesLite.INTEGER,
    ownerAccountId: DataTypesLite.BIGINT,
    nickname: DataTypesLite.STRING,
    comment: DataTypesLite.STRING,
    replyComment: DataTypesLite.STRING_NULLABLE,
    replyCommentDate: DataTypesLite.DATE_NULLABLE,
    characterId: DataTypesLite.BIGINT,
    job: DataTypesLite.INTEGER,
    level: DataTypesLite.INTEGER,
    isOwner: DataTypesLite.INTEGER,
    commentDate: DataTypesLite.DATE,
  }, {
    commentId: [AdditionalDef.PRIMARY_KEY],
  })
}

export function shirinkPartyId(partyId: string) {
  return BigInt(partyId.substring(2, partyId.length - 2))
}