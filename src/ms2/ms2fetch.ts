import got from "got"
import cheerio from "cheerio"
import type { Cheerio, Element, CheerioAPI } from "cheerio"
import chalk from "chalk"
import { DungeonId } from "./dungeonid.js"
import type { PartyInfo } from "./partyinfo.js"
import { DungeonNotFoundError, InternalServerError, InvalidParameterError, WrongPageError } from "./fetcherror.js"
import { sleep } from "./util.js"
import { Agent as HttpAgent } from "http"
import { Agent as HttpsAgent } from "https"
import Debug from "debug"
import { WorldChatType } from "./database/WorldChatInfo.js"
import type { CharacterInfo, CharacterMemberInfo, DungeonClearedCharacterInfo, MainCharacterInfo, TrophyCharacterInfo } from "./ms2CharInfo.js"
import { Job } from "./ms2CharInfo.js"
import { addMonths, isAfter, isBefore, startOfMonth, subMonths } from "date-fns"
import { type MS2CapsuleItem, MS2ItemTier, MS2Tradable } from "./ms2gatcha.js"
import type { GuestBookInfo, RawGuestBookInfo } from "./database/GuestBookInfo.js"

const verbose = Debug("ms2:verbose:fetch")
const debug = Debug("ms2:verbose:debug")
const httpAgent = new HttpAgent({ keepAlive: true, maxSockets: 50 })
const httpsAgent = new HttpsAgent({ keepAlive: true, maxSockets: 50 })
const ms2BrowserHeader = {
  "User-Agent": "MapleStory2",
  "X-ms2-acc-sn": "0",
  "X-ms2-char-job": "0",
  "X-ms2-char-level": "10",
  "X-ms2-char-sn": "0",
  "X-ms2-char-name": "NAME",
  "X-ms2-char-world": "1",
  "X-ms2-guild-name": "",
  "X-ms2-guild-sn": "0",
  "X-ms2-window-type": "1",
}

const userAgent = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/97.0.2311.90 Safari/537.36"
const cooldown = 300 // ms
const retryCooldown = 5 // sec
const maxRetry = 4
const ms2Domain = `maplestory2.nexon.com`
const profilePrefix = `https://ua-maplestory2.nexon.com/`
export const profilePrefixLong = `${profilePrefix}profile/`
const jobIconPrefix = `https://ssl.nexon.com/S2/Game/maplestory2/MAVIEW/ranking/`
let lastRespTime = 0

const mainURL = `https://${ms2Domain}/Main/Index`
const bossDateURL = `https://${ms2Domain}/Rank/Boss1`
const bossRateURL = `https://${ms2Domain}/Rank/Boss3`
const bossMemberURL = `https://${ms2Domain}/Rank/Boss1Party`
export const trophyURL = `https://${ms2Domain}/Rank/Character`
const mainCharacterURL = `https://${ms2Domain}/Rank/Architect`
const guildTrophyURL = `https://${ms2Domain}/Rank/Guild`
const worldChatURL = `https://${ms2Domain}/Now/GetMessage`
const gatchaURL = `https://${ms2Domain}/Probability/StoreView`

export const FALLBACK_PROFILE = `https://cdn.discordapp.com/attachments/895664006637965383/1045635182524383312/ico_default.png` // Fallback.
export const MIN_QUERY_DATE = new Date(2015, 7, 1) // 2015/8/1

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
    const imageURL = $leader.find(".name > img:nth-child(1)").attr("src") ?? ""
    const partyLeader: CharacterInfo = {
      characterId: queryCIDFromImageURL(imageURL),
      job: queryJobFromIcon($leader.find(".name > img:nth-child(2)").attr("src") ?? ""),
      nickname: $leader.find(".name").text().trim(),
      level: queryLevelFromText($leader.find(".info").text().trim()),
      profileURL: imageURL,
    }
    // Rank
    const rank = getRankFromElement($i)
    // Date
    let dateNumbers = $i.find(".date").text().match(/\d+/g) ?? []
    if (dateNumbers.length < 3) {
      dateNumbers = ["1970", "1", "1"]
    }
    const partyDate = {
      year: Number.parseInt(dateNumbers[0] ?? "1970"),
      month: Number.parseInt(dateNumbers[1] ?? "1"),
      day: Number.parseInt(dateNumbers[2] ?? "1"),
    }
    // Clear Time
    const clearTimeText = $i.find(".record").text()
    // 분
    const clearTimeTextMin = clearTimeText.match(/\d+분/g) ?? ["0분"]
    const clearTimeMin = Number.parseInt(clearTimeTextMin[0]?.replace("분", "")?.trim() ?? "0")
    // 초
    const clearTimeTextSec = clearTimeText.match(/\d+초/g) ?? ["0초"]
    const clearTimeSec = Number.parseInt(clearTimeTextSec[0]?.replace("초", "")?.trim() ?? "0")

    const clearSec = clearTimeMin * 60 + clearTimeSec
    // Party Id
    const partyId = $i.find(".party_list").attr("id") ?? ""
    // Members
    const members: Array<CharacterMemberInfo> = []
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
        const member: CharacterMemberInfo = {
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
    return []
  }

  const $el = $(".rank_list_boss3 > .board tbody tr")
  const output: Array<DungeonClearedCharacterInfo> = []
  if ($el.length >= 1) {
    const list = $el.get()
    for (const $listI of list) {
      const $i = $($listI)
      // rank
      const rank = getRankFromElement($i)
      // parse character info
      const job = queryJobFromIcon($i.find(".character > img:nth-child(2)").attr("src") ?? "")
      const imageURL = $i.find(".character > img:nth-child(1)").attr("src") ?? ""
      const characterId = queryCIDFromImageURL(imageURL)
      output.push({
        characterId,
        job,
        nickname,
        level: -1,
        clearedCount: Number.parseInt($i.find(".record").text().replace(",", "")),
        clearedRank: rank,
        profileURL: imageURL,
      })
    }
    return output
  }
  return []
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
  if (statusCode === 403) {
    return null
  }
  const $ = cheerio.load(body)
  // check response is ok
  validateTableTitle($, "개인 트로피")
  // check no person
  if ($(".no_data").length >= 1) {
    return null
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
    const result: TrophyCharacterInfo = {
      characterId,
      job: Job.UNKNOWN,
      nickname,
      level: -1,
      trophyCount: Number.parseInt($i.find(".last_child").text().replace(",", "")),
      trophyRank: rank,
      profileURL,
    }
    return result
  } else {
    return null
  }
}

export async function fetchMainCharacterByNameDate(nickname: string, time: Date) {
  return fetchMainCharacterByNameTime(nickname, time.getFullYear(), time.getMonth() + 1)
}

/**
 * Try to fetch main character id
 * @param nickname Nickname
 * @param year check year
 * @param month check month
 */
export async function fetchMainCharacterByNameTime(nickname: string, year: number, month: number) {
  // parameter check
  if (year < 2015) {
    throw new InvalidParameterError("Year should be >= 2015", "year")
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
    ...ms2BrowserHeader,
    "Referer": mainCharacterURL,
  }, sParam)

  const $ = cheerio.load(body)
  // check response is ok
  validateTableTitle($, "스타 건축가")
  // check no person
  if ($(".no_data").length >= 1) {
    return null
  }

  // fetch
  const $el = $(".rank_list_interior > .board tbody tr")
  if ($el.length >= 1) {
    const $i = $el.first()
    // parse character info
    const aidRawStr = $i.find(".left > a").attr("href") ?? ""
    let aid: string = ""
    if (aidRawStr.length >= 1) {
      const rawarr = aidRawStr.substring(0, aidRawStr.length - 1).split(";").pop() ?? "ms2.moveToHouse(0)"
      const queryarr = rawarr.substring(4).match(/\d+/)
      if (queryarr != null) {
        aid = queryarr[0] ?? ""
      }
    }
    const imageURL = $i.find(".character > img:nth-child(1)").attr("src") ?? ""
    const characterId = queryCIDFromImageURL(imageURL)
    const characterName = $i.find(".character").text().trim()
    const houseName = $i.find(".left > .addr").text().trim()
    const houseScore = Number.parseInt($i.find(".last_child").text().trim())
    const houseRank = getRankFromElement($i)

    const result: MainCharacterInfo = {
      // CharacterMemberInfo
      job: Job.UNKNOWN,
      nickname: characterName,
      level: -1,
      // CharacterInfo
      characterId,
      profileURL: imageURL,
      // MainCharacterInfo
      mainCharacterId: characterId,
      accountId: (aid.length <= 0) ? 0n : BigInt(aid),
      houseName,
      houseScore,
      houseRank,
      houseDate: year * 100 + month,
    }
    return result
  } else {
    return null
  }
}
/**
 * 메인 캐릭터를 이름으로 조회합니다
 * @param nickname 닉네임
 * @param startDate 검색을 시작할 날짜 (과거)
 * @param startDate 검색을 끝낼 날짜 (현재)
 * @returns 메인 캐릭터 or null
 */
export async function fetchMainCharacterByName(nickname: string, startDate: Date | [number, number] = MIN_QUERY_DATE /* 2015/8 */, endDate: Date | [number, number] = new Date(Date.now()), isDesc = true) {
  // Compactiviy
  if (Array.isArray(startDate)) {
    startDate = new Date(startDate[0], startDate[1] - 1)
  }
  if (Array.isArray(endDate)) {
    endDate = new Date(endDate[0], endDate[1] - 1)
  }
  startDate = startOfMonth(startDate)
  endDate = startOfMonth(endDate)

  if (isBefore(startDate, new Date(2015, 7))) {
    throw new Error("Start should not be before 2015/8")
  }
  if (isAfter(endDate, new Date(Date.now()))) {
    throw new Error("End should not be after current date")
  }
  let parsingDate = new Date(isDesc ? endDate : startDate)
  while (!isBefore(parsingDate, startDate) && !isAfter(parsingDate, endDate)) {
    const year = parsingDate.getFullYear()
    const month = parsingDate.getMonth() + 1
    const mainChar = await fetchMainCharacterByNameTime(nickname, year, month)
    if (mainChar != null) {
      return mainChar
    }
    parsingDate = isDesc ? subMonths(parsingDate, 1) : addMonths(parsingDate, 1)
  }
  return null
}

export async function searchLatestClearedPage(dungeon: DungeonId, startPage: number = 1) {
  let minPage = startPage
  let maxPage = startPage
  let determined = false
  // 1. Check the point of no query
  while (true) {
    try {
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
    } catch (err) {
      if (err instanceof InternalServerError) {
        if (err.statusCode === 302 && err.responseHTML.indexOf("Object moved") >= 0) {
          // DB Error but exists
          minPage *= 2
        } else {
          throw err
        }
      }
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

export async function fetchGuildRank(guildname: string, queryUser: boolean = false) {
  const { body, statusCode } = await requestGet(guildTrophyURL, {
    "User-Agent": userAgent,
    "Referer": guildTrophyURL,
  }, {
    tp: "realtime",
    k: guildname,
  })
  const $ = cheerio.load(body)
  // check response is ok
  validateTableTitle($, "길드원 전체의 트로피 개수")
  // check no person
  if ($(".no_data").length >= 1) {
    return null
  }
  // make
  const $el = $(".rank_list_guild > .board tbody tr")

  if ($el.length >= 1) {
    const rank = getRankFromElement($el)
    const guildProfileURL = $el.find(".character > img").attr("src") ?? null
    const guildId = queryCIDFromImageURL(guildProfileURL ?? "")
    const guildName = $el.find(".character").text().trim()
    const leaderName = $el.find(":nth-child(3)").text().trim()
    let leaderInfo: CharacterInfo & { profileURL: string } | null = null
    if (queryUser) {
      leaderInfo = await fetchTrophyCount(leaderName)
    }
    const trophyCount = Number.parseInt($el.find(":nth-child(4)").text().trim().replace(/,/g, ""))
    return {
      rank,
      guildId,
      guildName,
      guildProfileURL,
      leaderName,
      leaderInfo,
      trophyCount,
    }
  } else {
    return null
  }
}

export async function fetchWorldChat() {
  const { body, statusCode } = await requestGet(worldChatURL, {
    "User-Agent": userAgent,
    "Referer": mainURL,
  }, {})
  if (statusCode !== 200) {
    return []
  }
  const response = JSON.parse(body) as Array<{
    message: string,
    HHmm: string,
    time: string,
    ch_name: string,
    type: string,
  }>
  return response.map((v) => {
    let chatType = WorldChatType.Channel
    if (v.type.indexOf("channel") >= 0) {
      chatType = WorldChatType.Channel
    } else if (v.type.indexOf("world") >= 0) {
      chatType = WorldChatType.World
    }
    return {
      message: v.message,
      time: new Date(Number.parseInt(v.time) * 1000),
      nickname: v.ch_name,
      type: chatType,
    }
  })
}

export async function fetchCapsuleList(capsuleId: number) {
  const url = `${gatchaURL}/${capsuleId}`
  const { body, statusCode } = await requestGet(url, {
    "User-Agent": userAgent,
    "Referer": url,
  }, {})
  // DOM 로드
  const $ = cheerio.load(body)
  // Row 
  const trs = $(".p_item2 > tbody").find("tr").get()
  const result: { [key in string]?: MS2CapsuleItem[] } = {}
  let categoryName = "없음"
  for (const row of trs) {
    const $row = $(row)
    const tds = $row.find("td").get()
    // 아이템
    const item: MS2CapsuleItem = {
      itemName: "",
      itemTier: MS2ItemTier.NORMAL,
      itemTrade: MS2Tradable.ACCOUNT_BOUND,
      quantity: 0,
      chancePercent: 0,
    }
    let offset = 0
    for (let i = 0; i < tds.length; i += 1) {
      const $column = $(tds[i])
      if (i === 0 && Number($column.attr("rowspan") ?? "0") > 0) {
        // 분류
        categoryName = $column.text().trim()
        offset += 1
        continue
      }
      // 데이터 넣기
      const text = $column.text().trim()
      switch (i - offset) {
        case 0:
          item.itemName = text
          break
        case 1:
          item.itemTier = getTierFromText(text)
          break
        case 2:
          item.itemTrade = getTradableFromText(text)
          break
        case 3:
          item.quantity = Number.parseInt(text.substring(0, text.length - 2))
          break
        case 4:
          item.chancePercent = Number.parseFloat(text.substring(0, text.length - 1))
          break
        default:
          throw new Error("Unknown column")
      }
    }
    // Result에 넣기
    if (result[categoryName] === undefined) {
      result[categoryName] = []
    }
    result[categoryName]?.push(item)
  }
  return result
}

export async function fetchGuestBook(token: string, aid: bigint, page: number = 1) {
  const url = `https://${ms2Domain}/Guestbook`
  const { body, statusCode } = await requestGet(url, {
    ...ms2BrowserHeader,
    "X-ms2-token": token,
    "Referer": url,
  }, {
    "s": aid.toString(),
    "page": page.toString(),
  })

  if (body.indexOf("방명록") < 0) {
    return null
  }

  const $ = cheerio.load(body)
  // 방명록 응답 AID
  const guestBookAid = $("#hiddenOwner").attr("value")
  if (guestBookAid !== aid.toString()) {
    throw new Error(`Guestbook aid가 예상과 다릅니다. ${guestBookAid}`)
  }
  // 글 갯수
  const commentCountStr = $(".comment_section > .noti > strong").text().trim()
  const commentCount = Number((commentCountStr.match(/^\d+/i) ?? [0])[0]!!)
  const commentsEl = $(".comment_section > div").get()
  const comments: RawGuestBookInfo[] = []
  for (let i = 0; i < commentsEl.length; i += 1) {
    const element = commentsEl[i]!!
    const $el = $(element)
    // 댓글 내용
    const comment = $el.find(".comment").text().trim()
    // 댓글 날짜
    const timeStr = $el.find(".time").text().trim().split("-")
    const commentDateRaw = {
      year: Number.parseInt(timeStr[0] ?? "1970"),
      month: Number.parseInt(timeStr[1] ?? "1"),
      day: Number.parseInt(timeStr[2] ?? "1"),
    }
    const commentDate = new Date(commentDateRaw.year, commentDateRaw.month - 1, commentDateRaw.day)
    // 댓글 ID
    const commentId = Number($el.find(".report > a > img").attr("data-seq") ?? "-1")
    // 집주인 댓글일 시에는 마지막 커맨트에 추가
    if ($el.attr("class") === "owner") {
      if (comments.length >= 1) {
        const prevComment = comments[comments.length - 1]!!
        prevComment.replyComment = comment
        prevComment.replyCommentDate = commentDate
        continue
      }
    }
    // 집주인 여부
    const isOwner = $el.find("h3 > strong > img").attr("alt") === "집주인"
    // 닉네임
    const nickname = $el.find("h3 > strong").text().trim()
    // 직업
    const job = queryJobFromIcon($el.find("h3 > span > img").attr("src") ?? "")
    // 레벨
    const level = Number($el.find("h3 > span").text().trim().substring(3))

    comments.push({
      commentId,
      ownerAccountId: BigInt(guestBookAid),
      nickname,
      comment,
      replyComment: null,
      replyCommentDate: null,
      job,
      level,
      commentDate,
      isOwner: isOwner ? 1 : 0,
    })
  }
  return {
    commentCount,
    page,
    comments,
  }
}

async function requestGet(url: string, headers: Record<string, string>, params: Record<string, any>, ignore302 = false) {
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
      agent: {
        http: httpAgent,
        https: httpsAgent,
      },
    })
    if (statusCode === 302 && body.indexOf("Object moved to ") >= 0) {
      // 과부하 or 404
      if (i === maxRetry - 1) {
        throw new InternalServerError("Failed to fetch data.", body, statusCode, url)
      } else {
        verbose(`[${chalk.redBright("MS2 Not Found")}] Retrying after ${chalk.cyan(retryCooldown)} sec... (${chalk.yellowBright(i + 1)}/${chalk.blueBright(maxRetry)})`)
        await sleep(1000 * retryCooldown)
        continue
      }
    }
    return { body, statusCode }
  }
  // unreachable
  return { body: "", statusCode: 0 }
}

/**
 * Extract CharacterId from character profile image url
 * @param imageURL Image URL
 */
function queryCIDFromImageURL(imageURL: string): bigint {
  if (imageURL.length > 0 && imageURL.startsWith(profilePrefix)) {
    let cid = 0n
    const queryURL = imageURL.substring(profilePrefix.length)
    const query = queryURL.split("/")
    for (let i = 0; i < query.length; i++) {
      if (i === 3) {
        cid = BigInt(query[i] ?? "0")
        break
      }
    }
    return cid
  } else {
    return 0n
  }
}

export function constructTrophyURL(nickname: string) {
  return `${trophyURL}?tp=realtime&k=${nickname}`
}

export function constructHouseRankURL(nickname: string, time: number) {
  const year = Math.floor(time / 100)
  const month = time % 100
  return `${mainCharacterURL}?tp=monthly&d=${year}-${month.toString().padStart(2, "0")}-01&k=${nickname}`
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
    rank = Number.parseInt(($i.find(".first_child > img").attr("alt")?.match(/\d+/) ?? ["0"])[0] ?? "0")
    if (Number.isNaN(rank)) {
      rank = 0
    }
  } else {
    rank = Number.parseInt(rankStr)
  }
  return rank
}

function getTierFromText(text: string) {
  const textMap: { [key in string]?: MS2ItemTier } = {
    "노멀": MS2ItemTier.NORMAL,
    "레어": MS2ItemTier.RARE,
    "엘리트": MS2ItemTier.EXCEPTIONAL,
    "엑설런트": MS2ItemTier.EPIC,
    "레전더리": MS2ItemTier.LEGENDARY,
    "에픽": MS2ItemTier.ASCENDENT,
  }
  return textMap[text] ?? MS2ItemTier.NORMAL
}

function getTradableFromText(text: string) {
  const textMap: { [key in string]?: MS2Tradable } = {
    "거래가능": MS2Tradable.TRADEABLE,
    "계정 귀속": MS2Tradable.ACCOUNT_BOUND,
    "캐릭터 귀속": MS2Tradable.CHARACTER_BOUND,
  }
  return textMap[text] ?? MS2Tradable.ACCOUNT_BOUND
}

function validateTableTitle($: CheerioAPI, title: string) {
  if ($(".table_info").length <= 0 || !$(".table_info").text().includes(title)) {
    console.log("Title: " + $(".table_info").text())
    throw new WrongPageError(`We cannot find ${title} title.`)
  }
}

export function shirinkProfileURL(url: string) {
  if (url.startsWith(profilePrefixLong)) {
    return url.substring(profilePrefixLong.length)
  } else {
    return url
  }
}

export function expandProfileURL(url: string | null) {
  if (url == null || url === FALLBACK_PROFILE) {
    return FALLBACK_PROFILE
  }
  if (url.startsWith(profilePrefix)) {
    return url
  } else {
    return profilePrefixLong + url
  }
}