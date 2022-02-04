import { fetchClearedByDate, fetchClearedRate, fetchMainCharacterByName, fetchTrophyCount, searchLatestClearedPage } from "./ms2/ms2fetch"
import { DungeonId } from "./ms2/dungeonid"
import { MS2Analyzer } from "./ms2/ms2analyzer"
import got from "got-cjs/dist/source"
import Enmap from "enmap"
import Debug from "debug"

const debug = Debug("ms2:testmain")
debug("Hello World!")

async function main() {
  const analyzer = new MS2Analyzer("./data", DungeonId.REVERSE_ZAKUM)
  await analyzer.init()
  await analyzer.analyze()

  debug("Done!")
}

try {
  main()
} catch (err) {
  console.error(err)
}