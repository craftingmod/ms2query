import { TOKEN, PREFIX, OWNERID } from './config.js'
import { BotInit } from './discord/botbase.js'
import { commands } from './discord/commands/index.js'
import Debug from "debug"
import { MS2Database } from './ms2/ms2database.js'
import { CommandTools } from './discord/Command.js'
import { addDays, addSeconds, setHours, setMinutes, setSeconds } from 'date-fns'
import { DungeonId, queryDungeons } from './ms2/dungeonid.js'
import { MS2Analyzer } from './ms2/ms2analyzer.js'

const debug = Debug("ms2:debug:main")
const ms2db = new MS2Database("./data/store.db")
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

const updateHour = 5 // 5AM

const bot = new BotInit({
  token: TOKEN,
  prefix: PREFIX,
  ownerid: OWNERID,
}, ms2db, "./data/botstore.db") // Bot
bot.addCommands(...commands)

async function botMain() {
  // 연결하기
  await bot.connect()

  while (true) {
    // Update DB every day
    const currentTime = await CommandTools.getCurrentTime()
    if (currentTime.getHours() < updateHour) {
      const updateTime = setMinutes(setHours(currentTime, updateHour), 0)
      // const updateTime = addSeconds(currentTime, 30)
      await sleep(updateTime.getTime() - currentTime.getTime())
    } else {
      // next day
      const updateTime = setHours(setMinutes(setSeconds(addDays(currentTime, 1), 0), 0), updateHour) // sec/min/hours
      // const updateTime = addSeconds(currentTime, 30)
      await sleep(updateTime.getTime() - currentTime.getTime())
    }
    // 봇 숨기기
    bot.setOffline()
    // 데이터 베이스 업데이트 하기
    await syncDB()
    // 다시 봇 활성화
    bot.setOnline()
  }
}

async function syncDB() {
  // debug(ms2db.queryLatestClearInfo(DungeonId.DOUBLE_BEAN))
  for (const dungeon of queryDungeons) {
    const ms2Analyzer = new MS2Analyzer(ms2db, dungeon)
    await ms2Analyzer.analyze(false)
  }
}

botMain()