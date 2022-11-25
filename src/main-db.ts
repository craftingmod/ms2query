import { TOKEN, PREFIX, OWNERID } from './config.js'
import { BotInit } from './discord/botinit.js'
import { commands } from './discord/commands/index.js'
import Debug from "debug"
import { fixDB2, fixDB3, fixDB4, fixDB5 } from './fixdb.js'
import { MS2Database } from './ms2/ms2database.js'
import { testMain } from './test-index.js'
import { DungeonId, dungeonIdNameMap, queryDungeons } from './ms2/dungeonid.js'
import { MS2Analyzer } from './ms2/ms2analyzer.js'
import { fetchClearedByDate, fetchMainCharacterByName, fetchMainCharacterByNameDate, fetchTrophyCount, profilePrefixLong } from './ms2/ms2fetch.js'
import { AdditionalDef, DataTypesLite, ModelLite, SequelizeLite } from './sqliteorm/SequelizeLite.js'
import { ClearInfo, defineClearInfo } from './ms2/database/ClearInfo.js'
import { CommandTools } from './discord/command.js'
import { subMonths } from 'date-fns'
import chalk from 'chalk'
import { MainCharacterInfo } from './ms2/ms2CharInfo.js'

const debug = Debug("ms2:debug:main")
const ms2db = new MS2Database("./data/store.db")

/**
 * profileURL이 https://로 시작되는 데이터를 수정합니다.
 */
function fixProfileURL() {
	const profileFix = ms2db.database.prepare(/*sql*/`SELECT * FROM characterStore WHERE profileURL LIKE ('https' || '%')`).all()
	for (const charInfo of profileFix) {
		charInfo.profileURL = charInfo.profileURL.replace(profilePrefixLong, "")
		ms2db.database.prepare(/*sql*/`UPDATE characterStore SET profileURL = ? WHERE characterId = ?`).run(charInfo.profileURL, charInfo.characterId)
	}
}