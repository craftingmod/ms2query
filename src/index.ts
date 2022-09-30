import { TOKEN, PREFIX, OWNERID } from './config.js'
import { BotInit } from './discord/botinit.js'
import { commands } from './discord/commands/index.js'
import Debug from "debug"
import { fixDB2, fixDB3 } from './fixdb.js'
import { MS2Database } from './ms2/ms2database.js'
import { testMain } from './test-index.js'
import { DungeonId } from './ms2/dungeonid.js'
import { Job } from './ms2/charinfo.js'
import { MS2Analyzer } from './ms2/ms2analyzer.js'
import { fetchMainCharacterByName, fetchTrophyCount } from './ms2/ms2fetch.js'

const debug = Debug("ms2:debug:main")

export const ms2db = new MS2Database("./data/store.db")

const bot = new BotInit({
	token: TOKEN,
	prefix: PREFIX,
	ownerid: OWNERID,
}, ms2db)
bot.addCommands(...commands)

await bot.connect()
// fixDB3()

async function dbMain() {
	// debug(ms2db.queryLatestClearInfo(DungeonId.DOUBLE_BEAN))
	for (const dungeon of MS2Database.supportedDungeons) {
		const ms2Analyzer = new MS2Analyzer(ms2db, dungeon)
		await ms2Analyzer.analyze()
	}
}
// await dbMain()
async function queryMain() {
	const result = await fetchMainCharacterByName("작은창고")
	debug(result)
}
// queryMain()
// debug(await fetchTrophyCount("힐러오라버니"))
// testMain()