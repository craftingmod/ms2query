import got from "got-cjs"
import cheerio, { Cheerio, Element } from "cheerio"
import { DungeonId } from "./dungeonid"
import { CharacterInfo, CharacterUnknownInfo, Job, MainCharacterInfo } from "./charinfo"
import { PartyInfo } from "./partyinfo"
import { CharacterNotFoundError, DungeonNotFoundError, InternalServerError, InvalidParameterError } from "./fetcherror"


const userAgent = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/80.0.3987.149 Safari/537.36"
const ms2Domain = `maplestory2.nexon.com`
const profilePrefix = `https://ua-maplestory2.nexon.com/`
const jobIconPrefix = `https://ssl.nexon.com/S2/Game/maplestory2/MAVIEW/ranking/`

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
export async function fetchClearedByDate(id: DungeonId, page: number) {
  const { body, statusCode } = await got(bossDateURL, {
    searchParams: {
      b: id,
      page,
    },
    headers: {
      "User-Agent": userAgent,
      "Referer": bossDateURL,
    }
  })
  if (statusCode !== 200) {
    throw new InternalServerError("Failed to fetch boss clear data\n" + body, body, statusCode)
  }
  const $ = cheerio.load(body)
  // check response is ok
  if ($(".table_info").length <= 0 || !$(".table_info").text().includes("보스 명예의 전당")) {
    throw new InternalServerError("Failed to fetch boss clear data\n" + body, body, statusCode)
  }
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
    let clearTimeNumbers = $i.find(".record").text().match(/\d+/g) ?? []
    if (clearTimeNumbers.length <= 0) {
      clearTimeNumbers = ["15", "0"]
    } else if (clearTimeNumbers.length === 1) {
      clearTimeNumbers.push("0")
    }
    const clearSec = Number.parseInt(clearTimeNumbers[0]) * 60 + Number.parseInt(clearTimeNumbers[1])
    // Party Id
    const partyId = $i.find(".party_list").attr("id") ?? ""
    // Members
    const members: Array<CharacterUnknownInfo> = []
    if (partyId.length >= 1) {
      const fetchMembers = (await got(bossMemberURL, {
        headers: {
          "User-Agent": userAgent,
          "Referer": bossDateURL,
        },
        searchParams: {
          r: partyId,
        }
      })).body
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
  const { body, statusCode } = await got(bossRateURL, {
    searchParams: {
      b: id,
      k: nickname,
    },
    headers: {
      "User-Agent": userAgent,
      "Referer": bossRateURL,
    }
  })
  if (statusCode !== 200) {
    throw new InternalServerError("Failed to fetch boss clear data\n" + body, body, statusCode)
  }
  const $ = cheerio.load(body)
  // check response is ok
  if ($(".table_info").length <= 0 || !$(".table_info").text().includes("보스 최다참여 순위")) {
    throw new InternalServerError("Failed to fetch boss clear data\n" + body, body, statusCode)
  }
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
  const { body, statusCode } = await got(trophyURL, {
    searchParams: {
      tp: "realtime",
      k: nickname,
    },
    headers: {
      "User-Agent": userAgent,
      "Referer": trophyURL,
    }
  })
  // check status code
  if (statusCode !== 200) {
    throw new InternalServerError("Failed to fetch trophy data\n" + body, body, statusCode)
  }
  const $ = cheerio.load(body)
  // check response is ok
  if ($(".table_info").length <= 0 || !$(".table_info").text().includes("개인 트로피")) {
    throw new InternalServerError("Failed to fetch trophy data\n" + body, body, statusCode)
  }
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
    return {
      characterId,
      job: Job.UNKNOWN,
      nickname,
      level: -1,
      trophyCount: Number.parseInt($i.find(".last_child").text().replace(",", "")),
    } as CharacterInfo & { trophyCount: number }
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

export async function fetchMainCharacterByName(nickname: string, year: number, month: number) {
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
    sParam["d"] = `${y}-${m}-01`
  } else {
    sParam["tp"] = "monthly"
    sParam["d"] = `${year}-${month}-01`
  }
  sParam["k"] = nickname
  const { body, statusCode } = await got(mainCharacterURL, {
    searchParams: sParam,
    headers: {
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
    },
  })
  // check status code
  if (statusCode !== 200) {
    throw new InternalServerError("Failed to fetch main character data\n" + body, body, statusCode)
  }
  const $ = cheerio.load(body)
  // check response is ok
  if ($(".table_info").length <= 0 || !$(".table_info").text().includes("스타 건축가")) {
    throw new InternalServerError("Failed to fetch main character data\n" + body, body, statusCode)
  }
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