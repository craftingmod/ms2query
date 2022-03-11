import got from "got-cjs"
import cheerio, { Cheerio, Element, CheerioAPI } from "cheerio"
import { DungeonId } from "./dungeonid"
import { CharacterInfo, CharacterUnknownInfo, Job, MainCharacterInfo } from "./charinfo"
import { PartyInfo } from "./partyinfo"
import { CharacterNotFoundError, DungeonNotFoundError, InternalServerError, InvalidParameterError, WrongPageError } from "./fetcherror"
import { sleep } from "./util"
import { Agent as HttpAgent } from "http"
import { Agent as HttpsAgent } from "https"
import Debug from "debug"

const verbose = Debug("ms2:verbose:fetch")
const debug = Debug("ms2:verbose:debug")
const httpAgent = new HttpAgent({ keepAlive: true, maxSockets: 50 })
const httpsAgent = new HttpsAgent({ keepAlive: true, maxSockets: 50 })

const userAgent = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/97.0.2311.90 Safari/537.36"
const cooldown = 50
const maxRetry = 15
const ms2Domain = `maplestory2.nexon.com`
const profilePrefix = `https://ua-maplestory2.nexon.com/`
const jobIconPrefix = `https://ssl.nexon.com/S2/Game/maplestory2/MAVIEW/ranking/`
let lastRespTime = 0

const bossDateURL = `https://${ms2Domain}/Rank/Boss1`
const bossRateURL = `https://${ms2Domain}/Rank/Boss3`
const bossMemberURL = `https://${ms2Domain}/Rank/Boss1Party`
const trophyURL = `https://${ms2Domain}/Rank/Character`
const mainCharacterURL = `https://${ms2Domain}/Rank/Architect`

/**
 * Fetch boss clear data sorted by clear date
 * @param id Boss Id
 * @param page Page to fetch
 */
export async function fetchClearedByDate(id: DungeonId, page: number, detail = true) {
  const { body, statusCode } = await requestGet(bossDateURL, {
    "User-Agent": userAgent,
    "Referer": bossDateURL,
  }, {
    b: id,
    page,
  })
  const $ = cheerio.load(body)
  // check response is ok
  validateTableTitle($, "보스 명예의 전당")
  // check boss id is ok
  if ($(".no_data").length >= 1) {
    throw new DungeonNotFoundError(`Dungeon id ${id} not found.`)
  }

  const parties: PartyInfo[] = []
  const partyElements = $(".rank_list_boss1 > .board tbody tr").toArray()
  for (const el of partyElements) {
    const $i = $(el)
    // Leader
    const $leader = $i.find(".party_leader")
    const partyLeader: CharacterInfo = {
      job: queryJobFromIcon($leader.find(".name > img:nth-child(2)").attr("src") ?? ""),
      nickname: $leader.find(".name").text().trim(),
      level: queryLevelFromText($leader.find(".info").text().trim()),
      characterId: queryCIDFromImageURL($leader.find(".name > img:nth-child(1)").attr("src") ?? ""),
    }
    // Rank
    const rank = getRankFromElement($i)
    // Date
    let dateNumbers = $i.find(".date").text().match(/\d+/g) ?? []
    if (dateNumbers.length < 3) {
      dateNumbers = ["1970", "1", "1"]
    }
    const partyDate = {
      year: Number.parseInt(dateNumbers[0]),
      month: Number.parseInt(dateNumbers[1]),
      day: Number.parseInt(dateNumbers[2]),
    }
    // Clear Time
    const clearTimeText = $i.find(".record").text()
    // Minute
    const clearTimeTextMin = clearTimeText.match(/\d+분/g) ?? ["0분"]
    const clearTimeMin = Number.parseInt(clearTimeTextMin[0].replace("분", "").trim())
    // Second
    const clearTimeTextSec = clearTimeText.match(/\d+초/g) ?? ["0초"]
    const clearTimeSec = Number.parseInt(clearTimeTextMin[0].replace("초", "").trim())

    const clearSec = clearTimeMin * 60 + clearTimeSec
    // Party Id
    const partyId = $i.find(".party_list").attr("id") ?? ""
    // Members
    const members: Array<CharacterUnknownInfo> = []
    if (partyId.length >= 1 && detail) {
      const { body: fetchMembers } = await requestGet(bossMemberURL, {
        "User-Agent": userAgent,
        "Referer": bossDateURL,
      }, {
        r: partyId,
      })
      const $m = cheerio.load(fetchMembers)
      const memberElements = $m("ul > li").toArray()
      for (const el of memberElements) {
        const $i = $(el)
        const member: CharacterUnknownInfo = {
          job: queryJobFromIcon($i.find(".icon > img").attr("src") ?? ""),
          nickname: $i.find(".name").text().trim(),
          level: queryLevelFromText($i.find(".info").text()),
        }
        members.push(member)
      }
    }
    parties.push({
      partyId,
      leader: partyLeader,
      members,
      clearRank: rank,
      clearSec,
      partyDate,
    })
  }
  return parties
}
/**
 * Fetch boss clear rate(count) by name
 * @param id Boss Id
 * @param nickname Nickname
 */
export async function fetchClearedRate(id: DungeonId, nickname: string) {
  const { body, statusCode } = await requestGet(bossRateURL, {
    "User-Agent": userAgent,
    "Referer": bossRateURL,
  }, {
    b: id,
    k: nickname,
  })

  const $ = cheerio.load(body)
  // check response is ok
  validateTableTitle($, "보스 최다참여 순위")
  // check boss id is ok
  if ($(".no_data").length >= 1) {
    throw new CharacterNotFoundError(`Character ${nickname} not found.`, nickname)
  }

  const $el = $(".rank_list_boss3 > .board tbody tr")
  if ($el.length >= 1) {
    const $i = $el.first()
    // rank
    const rank = getRankFromElement($i)
    // parse character info
    const job = queryJobFromIcon($i.find(".character > img:nth-child(2)").attr("src") ?? "")
    const characterId = queryCIDFromImageURL($i.find(".character > img:nth-child(1)").attr("src") ?? "")
    return {
      characterId,
      job,
      nickname,
      level: -1,
      clearedCount: Number.parseInt($i.find(".record").text().replace(",", "")),
      clearedRank: rank,
    } as CharacterInfo & { clearedCount: number, clearedRank: number }
  } else {
    throw new CharacterNotFoundError(`Character ${nickname} not found.`, nickname)
  }
}
/**
 * Fetch trophy count by name
 * @param nickname Nickname
 */
export async function fetchTrophyCount(nickname: string) {
  const { body, statusCode } = await requestGet(trophyURL, {
    "User-Agent": userAgent,
    "Referer": trophyURL,
  }, {
    tp: "realtime",
    k: nickname,
  })
  const $ = cheerio.load(body)
  // check response is ok
  validateTableTitle($, "개인 트로피")
  // check no person
  if ($(".no_data").length >= 1) {
    throw new CharacterNotFoundError(`Character ${nickname} not found.`, nickname)
  }
  // make
  const $el = $(".rank_list_character > .board tbody tr")
  if ($el.length >= 1) {
    const $i = $el.first()
    // rank
    const rank = getRankFromElement($i)
    // parse character info
    const characterId = queryCIDFromImageURL($i.find(".character > img:nth-child(1)").attr("src") ?? "")
    // profile image
    const profileURL = $i.find(".character > img").attr("src") ?? ""
    return {
      characterId,
      job: Job.UNKNOWN,
      nickname,
      level: -1,
      trophyCount: Number.parseInt($i.find(".last_child").text().replace(",", "")),
      trophyRank: rank,
      profileURL,
    } as CharacterInfo & { trophyCount: number, trophyRank: number, profileURL: string }
  } else {
    throw new CharacterNotFoundError(`Character ${nickname} not found.`, nickname)
  }
}
/**
 * Try to fetch job from nickname
 * using reverse zakum
 * @param name Nickname
 */
export async function fetchJobByName(nickname: string) {
  try {
    const rzakRate = await fetchClearedRate(DungeonId.REVERSE_ZAKUM, nickname)
    return rzakRate.job
  } catch (err) {
    if (err instanceof CharacterNotFoundError) {
      // We can't guess
      return Job.UNKNOWN
    }
    throw err
  }
}
/**
 * Try to fetch main character id
 * @param nickname Nickname
 * @param year check year
 * @param month check month
 */
export async function fetchMainCharacterByNameDate(nickname: string, year: number, month: number) {
  // parameter check
  if (year < 2015) {
    throw new InvalidParameterError("Year should be >= 2025", "year")
  }
  if (year === 2015 && month < 8) {
    throw new InvalidParameterError("Date must be future than 2015/07", "year, month")
  }
  if (month <= 0 || month > 12) {
    throw new InvalidParameterError("Month must be in 1~12", "year, month")
  }
  const date = new Date(Date.now())
  const currentMonth = date.getMonth() + 1
  const currentYear = date.getFullYear()
  if (year > currentYear || (year === currentYear && month > currentMonth)) {
    throw new InvalidParameterError("Date must be past than current date", "year, month")
  }
  // fetch
  let sParam: Record<string, string> = {}
  if (year === currentYear && month === currentMonth) {
    sParam["tp"] = "realtime"
    let y = currentYear
    let m = currentMonth
    if (m === 1) {
      y -= 1
      m = 12
    } else {
      m -= 1
    }
    sParam["d"] = `${y}-${m.toString().padStart(2, "0")}-01`
  } else {
    sParam["tp"] = "monthly"
    sParam["d"] = `${year}-${month.toString().padStart(2, "0")}-01`
  }
  sParam["k"] = nickname
  const { body, statusCode } = await requestGet(mainCharacterURL, {
    "User-Agent": "MapleStory2",
    "X-ms2-acc-sn": "0",
    "X-ms2-char-job": "0",
    "X-ms2-char-level": "10",
    "X-ms2-char-sn": "0",
    "X-ms2-char-world": "1",
    "X-ms2-guild-name": "",
    "X-ms2-guild-sn": "0",
    "X-ms2-window-type": "1",
    "Referer": mainCharacterURL,
  }, sParam)

  const $ = cheerio.load(body)
  // check response is ok
  validateTableTitle($, "스타 건축가")
  // check no person
  if ($(".no_data").length >= 1) {
    throw new CharacterNotFoundError(`Character ${nickname} not found.`, nickname)
  }

  // fetch
  const $el = $(".rank_list_interior > .board tbody tr")
  if ($el.length >= 1) {
    const $i = $el.first()
    // rank
    const rank = getRankFromElement($i)
    // parse character info
    const aidRawStr = $i.find(".left > a").attr("href") ?? ""
    let aid: string = ""
    if (aidRawStr.length >= 1) {
      const rawarr = aidRawStr.substring(0, aidRawStr.length - 1).split(";").pop() ?? "ms2.moveToHouse(0)"
      const queryarr = rawarr.substring(4).match(/\d+/)
      if (queryarr != null) {
        aid = queryarr[0]
      }
    }
    const characterId = queryCIDFromImageURL($i.find(".character > img:nth-child(1)").attr("src") ?? "")
    const characterName = $i.find(".character").text().trim()
    return {
      accountId: aid,
      characterId,
      job: Job.UNKNOWN,
      nickname: characterName,
      level: -1,
      houseName: $i.find(".left > .addr").text().trim(),
      houseScore: Number.parseInt($i.find(".last_child").text().trim()),
    } as MainCharacterInfo & { houseName: string, houseScore: number }
  } else {
    throw new CharacterNotFoundError(`Character ${nickname} not found.`, nickname)
  }
}

export async function fetchMainCharacterByName(nickname: string, limitSearch: number = 9999) {
  const find = async (year: number, month: number, countCallback: () => void) => {
    try {
      const mainChar = await fetchMainCharacterByNameDate(nickname, year, month)
      return mainChar
    } catch (err) {
      if (err instanceof CharacterNotFoundError) {
        // step down
        countCallback()
        if (month === 1) {
          month = 12
          year -= 1
        } else {
          month -= 1
        }
        return null
      } else {
        throw err
      }
    }
  }

  const date = new Date(Date.now())
  let month = date.getMonth() + 1
  let year = date.getFullYear()

  // 1. Current ~ 2021/01
  while (year >= 2021 && month >= 1) {
    if (--limitSearch < 0) {
      return null
    }
    const mainChar = await find(year, month, () => {
      if (month === 1) {
        month = 12
        year -= 1
      } else {
        month -= 1
      }
    })
    if (mainChar != null) {
      return mainChar
    }
  }
  // 2. 2015/08~2015/12
  year = 2015
  month = 8
  while (year <= 2015 && month <= 12) {
    if (--limitSearch < 0) {
      return null
    }
    const mainChar = await find(year, month, () => {
      if (month === 12) {
        month = 1
        year += 1
      } else {
        month += 1
      }
    })
    if (mainChar != null) {
      return mainChar
    }
  }
  // 3. 2019/12~2020/12
  year = 2019
  month = 12
  while (year <= 2020 && month <= 12) {
    if (--limitSearch < 0) {
      return null
    }
    const mainChar = await find(year, month, () => {
      if (month === 12) {
        month = 1
        year += 1
      } else {
        month += 1
      }
    })
    if (mainChar != null) {
      return mainChar
    }
  }
  // 3. 2016/01~2019/11
  year = 2019
  month = 11
  while (year >= 2016 && month >= 1) {
    if (--limitSearch < 0) {
      return null
    }
    const mainChar = await find(year, month, () => {
      if (month === 1) {
        month = 12
        year -= 1
      } else {
        month -= 1
      }
    })
    if (mainChar != null) {
      return mainChar
    }
  }

  return null
}

export async function searchLatestClearedPage(dungeon: DungeonId) {
  let minPage = 1
  let maxPage = 1
  let determined = false
  // 1. Check the point of no query
  while (true) {
    const clearedParties = await fetchClearedByDate(dungeon, minPage, false)
    if (clearedParties.length === 10) {
      minPage *= 2
    } else if (clearedParties.length === 0) {
      maxPage = minPage
      minPage /= 2
      break
    } else {
      determined = true
      break
    }
  }
  if (!determined) {
    // 2. min-max binary search
    while (minPage < maxPage) {
      const midPage = Math.floor((minPage + maxPage) / 2)
      const clearedParties = await fetchClearedByDate(dungeon, midPage, false)
      if (clearedParties.length === 10) {
        minPage = midPage
        if (minPage + 1 === maxPage) {
          break
        }
      } else if (clearedParties.length === 0) {
        maxPage = midPage
      } else {
        minPage = midPage
        maxPage = midPage
        break
      }
    }
  }
  const lastParties = await fetchClearedByDate(dungeon, minPage + 1, false)
  if (lastParties.length >= 1) {
    return minPage + 1
  } else {
    return minPage
  }
}

async function requestGet(url: string, headers: Record<string, string>, params: Record<string, any>) {
  let timeDelta = Date.now() - lastRespTime
  if (lastRespTime > 0) {
    if (timeDelta < cooldown) {
      await sleep(cooldown - timeDelta)
    }
  }
  const ctime = Date.now()
  lastRespTime = ctime
  const urlparams = new URLSearchParams(params)
  verbose(`Fetching ${url}?${decodeURIComponent(urlparams.toString())}`)
  for (let i = 0; i < maxRetry; i += 1) {
    const { body, statusCode } = await got(url, {
      searchParams: params,
      headers,
      followRedirect: false,
      retry: {
        limit: 3,
      },
      agent: {
        http: httpAgent,
        https: httpsAgent,
      },
    })
    if (statusCode !== 200) {
      if (i === maxRetry - 1) {
        throw new InternalServerError("Failed to fetch data.", body, statusCode, url)
      } else {
        await sleep(2000)
      }
    } else {
      return { body, statusCode }
    }
  }
  // unreachable
  return { body: "", statusCode: 0 }
}

/**
 * Extract CharacterId from character profile image url
 * @param imageURL Image URL
 */
function queryCIDFromImageURL(imageURL: string) {
  if (imageURL.startsWith(profilePrefix)) {
    let cid = ""
    const queryURL = imageURL.substring(profilePrefix.length)
    const query = queryURL.split("/")
    for (let i = 0; i < query.length; i++) {
      if (i === 3) {
        cid = query[i]
        break
      }
    }
    return cid
  } else {
    return ""
  }
}
/**
 * Extract Job from character job icon url
 * @param iconURL Icon URL
 */
function queryJobFromIcon(iconURL: string) {
  if (iconURL.startsWith(jobIconPrefix)) {
    let postfix = iconURL.substring(jobIconPrefix.length)
    postfix = postfix.substring(4)
    postfix = postfix.substring(0, postfix.indexOf(".png")).toLowerCase()
    switch (postfix) {
      case "archer":
        return Job.Archer
      case "assassin":
        return Job.Assassin
      case "berserker":
        return Job.Berserker
      case "heavygunner":
        return Job.HeavyGunner
      case "knight":
        return Job.Knight
      case "priest":
        return Job.Priest
      case "runeblader":
        return Job.RuneBlader
      case "soulbinder":
        return Job.SoulBinder
      case "striker":
        return Job.Striker
      case "thief":
        return Job.Thief
      case "wizard":
        return Job.Wizard
      case "beginner":
        return Job.Beginner
      default:
        return Job.Beginner
    }
  } else {
    return Job.Beginner
  }
}
/**
 * Query Level from Lv.xx
 * @param lvtext Lv.xx
 */
function queryLevelFromText(lvtext: string) {
  if (lvtext.startsWith("Lv.") && lvtext.length >= 4) {
    return Number.parseInt(lvtext.substring(3))
  } else {
    return -1
  }
}

function getRankFromElement($i: Cheerio<Element>) {
  const rankStr = $i.find(".first_child").text()
  let rank = 0
  if (rankStr.length <= 0) {
    rank = Number.parseInt(($i.find(".first_child > img").attr("alt")?.match(/\d+/) ?? ["0"])[0])
    if (Number.isNaN(rank)) {
      rank = 0
    }
  } else {
    rank = Number.parseInt(rankStr)
  }
  return rank
}

function validateTableTitle($: CheerioAPI, title: string) {
  if ($(".table_info").length <= 0 || !$(".table_info").text().includes(title)) {
    throw new WrongPageError(`We cannot find ${title} title.`)
  }
}