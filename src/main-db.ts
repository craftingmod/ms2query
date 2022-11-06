import { TOKEN, PREFIX, OWNERID } from './config.js'
import { BotInit } from './discord/botinit.js'
import { commands } from './discord/commands/index.js'
import Debug from "debug"
import { fixDB2, fixDB3, fixDB4, fixDB5 } from './fixdb.js'
import { MS2Database } from './ms2/ms2database.js'
import { testMain } from './test-index.js'
import { DungeonId, dungeonIdNameMap } from './ms2/dungeonid.js'
import { MS2Analyzer } from './ms2/ms2analyzer.js'
import { fetchClearedByDate, fetchMainCharacterByName, fetchTrophyCount } from './ms2/ms2fetch.js'
import { AdditionalDef, DataTypesLite, ModelLite, SequelizeLite } from './sqliteorm/SequelizeLite.js'
import { ClearInfo, defineClearInfo } from './ms2/database/ClearInfo.js'

const debug = Debug("ms2:debug:main")
const ms2db = new MS2Database("./data/store.db")

const queryDungeons = [
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
for (const dungeon of queryDungeons) {
	const ms2Analyzer = new MS2Analyzer(ms2db, dungeon)
	await ms2Analyzer.analyze()
	/*
	console.log(`Inserting ${dungeonIdNameMap[dungeon]}...`)
	const dungeonTable = ms2db.dungeonHistories.get(dungeon)!!
	const history = dungeonTable.findAll()
	// remove duplicate of history
	console.log(`Filtering duplicate...`)
	const historyMap: Map<bigint, ClearInfo> = new Map()
	for (const clearInfo of history) {
		historyMap.set(clearInfo.partyId, clearInfo)
	}
	const historyList = Array.from(historyMap.values())
	console.log(`Putting model...`)
	ms2db.dropTable(dungeonTable.tableName)
	const model = defineClearInfo(ms2db, dungeonTable.tableName)
	model.insertMany(historyList)
	*/
}