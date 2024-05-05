import Debug from "debug"
import { DungeonId } from "./ms2/dungeonid.ts"
import { fetchClearedByDate } from "./ms2/ms2fetch.ts"
import { BotBase } from "./discord/base/BotBase.ts"
import { AdminCommand } from "./discord/base/command/AdminCommand.ts"
import fs from "node:fs/promises"
import { PingCommand } from "./discord/base/command/PingCommand.ts"
import { MS2QueryBot } from "./discord/MS2QueryBot.ts"
import { MS2Database } from "./ms2/ms2database.ts"


const debug = Debug("ms2:debug:testMain")

const ms2db = new MS2Database("./data/store.db")


export async function testMain() {
  const rosadb = ms2db.dungeonHistories.get(DungeonId.ILLUSION_HORUS)!!
  const queries = rosadb.findAll()
  const charData = new Map<bigint, string>()
  const findChar = (characterId: bigint | null) => {
    if (characterId == null) {
      return "-"
    }
    if (charData.has(characterId)) {
      return charData.get(characterId)!!
    }
    const queryData = ms2db.queryCharacterById(characterId)
    if (queryData == null) {
      charData.set(characterId, "?")
      return "?"
    }
    charData.set(characterId, queryData.nickname)
    return queryData.nickname
  }

  let csvData = "clearRank,partyId,clearSec,clearDate,memberCount,leader,member1,member2,member3,member4,member5,member6\n"
  for (const query of queries) {
    csvData += `${query.clearRank},${query.partyId},${query.clearSec},${query.clearDate},${query.memberCount},${findChar(query.leader)},${findChar(query.member1)},${findChar(query.member2)},${findChar(query.member3)},${findChar(query.member4)},${findChar(query.member5)},${findChar(query.member6)}\n`
  }
  await fs.writeFile("./data/230617/horus.csv", csvData)
}

testMain()