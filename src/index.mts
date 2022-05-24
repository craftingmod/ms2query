import { fetchClearedByDate, fetchClearedRate, fetchMainCharacterByName, fetchTrophyCount, searchLatestClearedPage } from "./ms2/ms2fetch.mjs"
import { DungeonId } from "./ms2/dungeonid.mjs"
import { MS2Analyzer } from "./ms2/ms2analyzer.mjs"
import got from "got"
import Enmap from "enmap"
import Debug from "debug"
import fs from "fs-extra"
import Path from "path"
import sqlite from "better-sqlite3"

import { REST } from "@discordjs/rest"
import { Routes, GatewayIntentBits } from "discord-api-types/v9"
import { Client } from "discord.js"
import { BotInit, BotToken } from "./discord/botinit.mjs"
import { Ping } from "./discord/cmds/ping.mjs"
import { CritRateCmd } from "./discord/cmds/critrate.mjs"
import { MinigameCmd } from "./discord/cmds/minigame.mjs"
import { FieldBossCmd } from "./discord/cmds/fieldboss.mjs"
import { CharSearchCmd } from "./discord/cmds/charsearch.mjs"
import { deserializeCharacterInfo, SerializedCInfo, TotalCharacterInfo } from "./ms2/charinfo.mjs"
import { PartyInfo } from "./ms2/partyinfo.mjs"

const debug = Debug("ms2:testmain")
debug("Hello World!")

async function analyzeMain() {
  const analyzer = new MS2Analyzer("./data", DungeonId.REVERSE_ZAKUM)
  await analyzer.init()
  await analyzer.analyze()

  debug("Done!")
}

async function migration1() {
  // Enmap
  const charStore = new Enmap<string, SerializedCInfo>({
    name: "characterstore",
    autoFetch: true,
    fetchAll: true,
    dataDir: "./data",
  })
  const cidStore = new Enmap<string, string>({
    name: "cidstore",
    autoFetch: true,
    fetchAll: true,
    dataDir: "./data",
  })
  // DungeonInfo
  const infMap: Map<string, { job: number, level: number }> = new Map()
  const fileList = await fs.readdir("./data/resp")
  console.log("Getting cache")
  for (const file of fileList) {
    const content = await fs.readFile(`./data/resp/${file}`, "utf8")
    const pinfo = JSON.parse(content) as PartyInfo[]
    for (const p of pinfo) {
      for (const member of p.members) {
        const cid = cidStore.get(member.nickname)
        if (member.job === 0 || cid == null || cid === "") {
          continue
        }
        if (infMap.has(cid)) {
          infMap.set(cid, { job: member.job, level: Math.max(infMap.get(cid)?.level ?? 0, member.level) })
        } else {
          infMap.set(cid, { job: member.job, level: member.level })
        }
      }
    }
  }
  console.log("Create DB")
  const alignDB = sqlite("./data/align2.db")
  // Create DB
  alignDB.prepare(`CREATE TABLE IF NOT EXISTS characterStore (
    charcterId bigint NOT NULL PRIMARY KEY,
    nickname varchar(20) NOT NULL,
    job tinyint,
    level tinyint,
    mainCharacterId bigint,
    accountId bigint
    )`).run()

  const charEntries = charStore.entries()
  const insertData: TotalCharacterInfo[] = []

  for (const [cid, cinfo] of charEntries) {
    const data = deserializeCharacterInfo(cinfo)
    if (data.job < 0 && infMap.has(cid)) {
      data.job = infMap.get(cid)?.job ?? -1
    }
    if (infMap.has(cid)) {
      data.level = infMap.get(cid)?.level ?? -1
    }
    if (cid === "") {
      continue
    }
    insertData.push(data)
  }
  // Transaction
  const insertRow = alignDB.prepare(`INSERT INTO characterStore (charcterId, nickname, job, level, mainCharacterId, accountId) VALUES (?, ?, ?, ?, ?, ?)`)
  alignDB.transaction((data: TotalCharacterInfo[]) => {
    for (const d of data) {
      insertRow.run(d.characterId, d.nickname, d.job, d.level, d.mainCharId, d.accountId)
    }
  })(insertData)

  // Save
  debug("Done!")
}
async function migration2() {
  // Enmap
  const charStore = new Enmap<string, SerializedCInfo>({
    name: "characterstore",
    autoFetch: true,
    fetchAll: true,
    dataDir: "./data",
  })
  const cidStore = new Enmap<string, string>({
    name: "cidstore",
    autoFetch: true,
    fetchAll: true,
    dataDir: "./data",
  })
  // load DB
  const alignDB = sqlite("./data/store.db")
  // Create table
  alignDB.prepare(`CREATE TABLE IF NOT EXISTS rzakHistory (
    clearRank int NOT NULL PRIMARY KEY,
    partyId varchar(26) NOT NULL,
    clearSec int NOT NULL,
    clearDate int NOT NULL,
    leader bigint,
    member1 bigint,
    member2 bigint,
    member3 bigint,
    member4 bigint,
    member5 bigint,
    member6 bigint,
    member7 bigint,
    member8 bigint,
    member9 bigint,
    member10 bigint
    )`).run()

  // DungeonInfo
  const fileList = await fs.readdir("./data/resp")
  console.log("Getting cache")

  const partyMap: Map<string, PartyInfo> = new Map()
  for (const file of fileList) {
    const content = await fs.readFile(`./data/resp/${file}`, "utf8")
    const pinfo = JSON.parse(content) as PartyInfo[]
    for (const p of pinfo) {
      if (!partyMap.has(p.partyId)) {
        partyMap.set(p.partyId, p)
      }
    }
  }

  const alignPush = alignDB.prepare(`INSERT INTO rzakHistory (clearRank, partyId, clearSec, clearDate, leader, member1, member2, member3, member4, member5, member6, member7, member8, member9, member10) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
  alignDB.transaction((plist: PartyInfo[]) => {
    for (const party of plist) {
      // fix parsed issue #2
      if (party.clearSec === 60 * 15) {
        if (party.leader.nickname === "그약" || party.leader.nickname === "새론") {
          party.clearSec = Math.floor(party.clearSec / 60)
        }
      } else if (party.clearSec % 60 === 0 && party.clearSec > 60 * 15) {
        party.clearSec = Math.floor(party.clearSec / 60)
      }

      const members = party.members.map((v) => {
        const out = cidStore.get(v.nickname) ?? ""
        if (out.length <= 0) {
          return null
        } else {
          return out
        }
      }).filter((v) => v != null) as string[]
      while (members.length < 10) {
        members.push("NULL")
      }
      const timestamp = Math.floor(Date.UTC(party.partyDate.year, party.partyDate.month - 1, party.partyDate.day) / 1000)
      alignPush.run(party.clearRank, party.partyId, party.clearSec, timestamp, party.leader.characterId, ...members)
    }
  })(Array.from(partyMap.values()))

  debug("Done!")
}


async function botMain() {
  const tokenPath = Path.resolve(".", "token.json")
  if (!await fs.pathExists(tokenPath)) {
    await fs.writeFile(tokenPath, JSON.stringify({ token: "", appid: "", prefix: "!", ownerid: "" }))
    throw new Error(`token is required! Path: ${tokenPath}`)
  }
  const secret: BotToken = JSON.parse(await fs.readFile(tokenPath, "utf8"))
  if (secret.token.length <= 0) {
    throw new Error("You must have been entered a token!")
  }

  const bot = new BotInit(secret)
  bot.addCommands(
    new Ping(),
    new CritRateCmd(),
    new MinigameCmd(),
    new FieldBossCmd(),
    new CharSearchCmd(),
  )
  await bot.connect()
  // await bot.registerInterationsGlobal()
}

async function registerCommand(token: string, appid: string) {
  const commands = [
    {
      name: "ping",
      description: "Replies with Pong!",
    }
  ]
  const rest = new REST({
    version: "9"
  }).setToken(token)

  try {
    await rest.put(Routes.applicationGuildCommands(appid, "817856558985379841"), { body: commands })
  } catch (err) {
    console.log(err)
  }
}

try {
  migration2()
  // botMain()
} catch (err) {
  console.error(err)
}