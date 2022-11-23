export enum DungeonId {
  UNKNOWN = 0,

  DEVORAK = 23200007,
  CAPTAIN_MOAK = 23200015,
  PAPULATUS = 23200077,
  VARKANT = 23200068,
  NUTAMAN = 23200080,
  KANDURA = 23200082,
  CHAOS_BARLOG = 23290005,

  REVERSE_ZAKUM = 23000071,
  REVERSE_PINKBEAN = 23000088,
  LUKARAX_56 = 23200064,

  BJORN = 23000114,
  LUKARAX = 23200067,
  PINKBEAN = 23000115,
  RGB_EUPHERIA = 23501001,
  RGB_LANDEVIAN = 23501011,
  RGB_ISHURA = 23000113,
  BLACKSHARD_NEXUS = 23000118,

  ZAKUM_70 = 23000072,
  INFERNOG_70 = 23000150,
  HIDDEN_HANGER = 23503003,
  TIMAION = 23504101,
  TURKA = 23000122,

  ILLUSION_SHUSHU = 23500004,
  ILLUSION_HORUS = 23500006,
  BLACK_BEAN = 23000101,
  ILLUSION_DEVORAK = 23200008,
  DOUBLE_BEAN = 23000160,
  NORMAL_ROOK = 23000400,
  HARD_ROOK = 23000401,
  DELLA_ROSSA = 44100001,
}

export const dungeonNameMap: { [key in string]: DungeonId } = {

  "카데보": DungeonId.DEVORAK,
  "카모크": DungeonId.CAPTAIN_MOAK,
  "카파풀": DungeonId.PAPULATUS,
  "바르칸트": DungeonId.VARKANT,
  "누타만": DungeonId.NUTAMAN,
  "칸두라": DungeonId.KANDURA,
  "발록": DungeonId.CHAOS_BARLOG,

  "리자쿰": DungeonId.REVERSE_ZAKUM,
  "리핑빈": DungeonId.REVERSE_PINKBEAN,
  "레마드": DungeonId.LUKARAX_56,

  "븨에른": DungeonId.BJORN,
  "카마드": DungeonId.LUKARAX,
  "핑크빈": DungeonId.PINKBEAN,

  "그린": DungeonId.RGB_EUPHERIA,
  "블루": DungeonId.RGB_LANDEVIAN,
  "레드": DungeonId.RGB_ISHURA,
  "블챔": DungeonId.BLACKSHARD_NEXUS,

  "자쿰": DungeonId.ZAKUM_70,
  "인페": DungeonId.INFERNOG_70,
  "격납고": DungeonId.HIDDEN_HANGER,
  "티마이온": DungeonId.TIMAION,
  "투르카": DungeonId.TURKA,

  "어슈슈": DungeonId.ILLUSION_SHUSHU,
  "어루스": DungeonId.ILLUSION_HORUS,
  "어블빈": DungeonId.BLACK_BEAN,
  "어데보": DungeonId.ILLUSION_DEVORAK,
  "어블핑": DungeonId.DOUBLE_BEAN,
  "일루크": DungeonId.NORMAL_ROOK,
  "어루크": DungeonId.HARD_ROOK,
  "일로사": DungeonId.DELLA_ROSSA,
}

export const dungeonIdNameMap: { [key in DungeonId]: string } = Object.entries(dungeonNameMap).reduce((acc, [name, id]) => {
  acc[id] = name
  return acc
}, {} as Record<DungeonId, string>)

// 쿼리가능한 던전
export const queryDungeons = [
  DungeonId.REVERSE_ZAKUM,
  // 50
  DungeonId.DEVORAK,
  DungeonId.CHAOS_BARLOG,
  DungeonId.CAPTAIN_MOAK,
  DungeonId.PAPULATUS,
  DungeonId.VARKANT,
  DungeonId.NUTAMAN,
  DungeonId.KANDURA,
  DungeonId.LUKARAX_56,
  DungeonId.REVERSE_PINKBEAN,
  // 60
  DungeonId.BJORN,
  DungeonId.LUKARAX,
  DungeonId.PINKBEAN,
  // 60 - RGB
  DungeonId.RGB_EUPHERIA,
  DungeonId.RGB_LANDEVIAN,
  DungeonId.RGB_ISHURA,
  DungeonId.BLACKSHARD_NEXUS,
  // 70
  DungeonId.ZAKUM_70,
  DungeonId.INFERNOG_70,
  DungeonId.HIDDEN_HANGER,
  DungeonId.TIMAION,
  DungeonId.TURKA,
  // L.B
  DungeonId.ILLUSION_SHUSHU,
  DungeonId.ILLUSION_HORUS,
  DungeonId.BLACK_BEAN,
  DungeonId.ILLUSION_DEVORAK,
  DungeonId.DOUBLE_BEAN,
  DungeonId.NORMAL_ROOK,
  DungeonId.HARD_ROOK,
  DungeonId.DELLA_ROSSA,
]