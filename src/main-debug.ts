import { DungeonId } from "./ms2/dungeonid.js"
import { fetchClearedByDate, fetchGuestBook, fetchMainCharacterByName } from "./ms2/ms2fetch.js"
import Debug from "debug"
import { MS2Analyzer } from "./ms2/ms2analyzer.js"
import { MS2Database } from "./ms2/ms2database.js"

const ms2db = new MS2Database("./data/store.db")
const debug = Debug("ms2:debug:main")