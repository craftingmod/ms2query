import { TOKEN, PREFIX, OWNERID } from './config.js'
import { BotInit } from './discord/botinit.js'
import { commands } from './discord/commands/index.js'
import Debug from "debug"
import { fixDB2, fixDB3, fixDB4, fixDB5 } from './fixdb.js'
import { MS2Database } from './ms2/ms2database.js'
import { testMain } from './test-index.js'
import { DungeonId } from './ms2/dungeonid.js'
import { MS2Analyzer } from './ms2/ms2analyzer.js'
import { fetchClearedByDate, fetchMainCharacterByName, fetchTrophyCount } from './ms2/ms2fetch.js'
import { AdditionalDef, DataTypesLite, ModelLite, SequelizeLite } from './sqliteorm/SequelizeLite.js'

const debug = Debug("ms2:debug:main")

export const ms2db = new MS2Database("./data/store.db")

/*
export const ms2db = new MS2Database("./data/store.db")

const bot = new BotInit({
	token: TOKEN,
	prefix: PREFIX,
	ownerid: OWNERID,
}, ms2db, "./data/botstore.db")
*/
// bot.addCommands(...commands)

// await bot.connect()
// fixDB3()
// fixDB4()

async function dbMain() {
	// debug(ms2db.queryLatestClearInfo(DungeonId.DOUBLE_BEAN))
	const queryDungeons = [
		DungeonId.REVERSE_ZAKUM,
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
	}
}
await dbMain()
async function queryMain() {
	/*
	const result = await fetchClearedByDate(DungeonId.NORMAL_ROOK, 11, true)
	debug(result)
	*/
	const user = ms2db.queryCharacterByName("벨붕")
	debug(user)
}
// queryMain()
// fixDB5()
// debug(await fetchTrophyCount("힐러오라버니"))
// testMain()

// fixDB4()