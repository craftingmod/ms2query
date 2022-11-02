import { DungeonId } from "./ms2/dungeonid.js"
import { fetchClearedByDate, fetchMainCharacterByName } from "./ms2/ms2fetch.js"
import Debug from "debug"
import { MS2Analyzer } from "./ms2/ms2analyzer.js"
import { MS2Database } from "./ms2/ms2database.js"

const ms2db = new MS2Database("./data/store.db")
const debug = Debug("ms2:debug:main")

/*
const ms2Analyzer = new MS2Analyzer(ms2db, DungeonId.CHAOS_BARLOG)
await ms2Analyzer.analyze()
*/
/*
const pageParties = await fetchClearedByDate(DungeonId.REVERSE_ZAKUM, 8080, true)
debug(pageParties)
*/

const mainChar = await fetchMainCharacterByName("대타출동인형")
debug(mainChar)