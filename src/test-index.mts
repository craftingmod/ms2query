import { DungeonId } from "./ms2/dungeonid.mjs"
import * as MS2Fetch from "./ms2/ms2fetch.mjs"

async function main() {
  const test = await MS2Fetch.fetchClearedByDate(DungeonId.DELLA_ROSSA, 1, true)
  console.log(test[0])
}

main()