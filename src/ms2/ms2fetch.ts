import got from "got-cjs"
import cheerio from "cheerio"
import { DungeonId } from "./dungeonid"
import { CharacterInfo, CharacterUnknownInfo, Job } from "./charinfo"
import { PartyInfo } from "./partyinfo"


const userAgent = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/80.0.3987.149 Safari/537.36"
const ms2Domain = `maplestory2.nexon.com`
const profilePrefix = `https://ua-maplestory2.nexon.com/`
const jobIconPrefix = `https://ssl.nexon.com/S2/Game/maplestory2/MAVIEW/ranking/`

const bossFirstURL = `https://${ms2Domain}/Rank/Boss1`
const bossMemberURL = `https://${ms2Domain}/Rank/Boss1Party`

export async function fetchClearedByFirst(id: DungeonId, page: number) {
  const { body } = await got(bossFirstURL, {
    searchParams: {
      b: id,
      page,
    },
    headers: {
      "User-Agent": userAgent,
      "Referer": bossFirstURL,
    }
  })
  const $ = cheerio.load(body)
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
    const rankStr = $i.find(".first_child").text()
    let rank = 0
    if (rankStr.length <= 0) {
      rank = Number.parseInt(($i.find(".first_child > img").attr("alt")?.match(/\d+/) ?? ["0"])[0])
      if (Number.isNaN(rank)) {
        rank = 0
      }
    }
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
          "Referer": bossFirstURL,
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