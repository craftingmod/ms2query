import { TOKEN, PREFIX, OWNERID } from './config.js'
import { BotInit } from './discord/botinit.js'
import { commands } from './discord/commands/index.js'
import Debug from "debug"
import { MS2Database } from './ms2/ms2database.js'
import { CommandTools } from './discord/command.js'
import { addDays, addSeconds, setHours, setMinutes, setSeconds } from 'date-fns'
import { DungeonId } from './ms2/dungeonid.js'
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
  // 봇 끄기
  await bot.disconnect()
  // 데이터 베이스 업데이트 하기
  await syncDB()
  // 10초 후에 다시 실행
  setInterval(() => botMain(), 10000)
}

async function syncDB() {
  // debug(ms2db.queryLatestClearInfo(DungeonId.DOUBLE_BEAN))
  const queryDungeons = [
    DungeonId.REVERSE_ZAKUM,
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
  }
}

botMain()