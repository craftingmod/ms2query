import Path from "path"
import { DungeonId } from "./dungeonid"
import fs from "fs-extra"
import fsorg from "fs"
import Enmap from "enmap"
import { CharacterInfo, deserializeCharacterInfo, serializeCharacterInfo, SerializedCInfo, TotalCharacterInfo } from "./charinfo"
import { fetchClearedByDate, fetchMainCharacterByName, fetchTrophyCount, searchLatestClearedPage } from "./ms2fetch"
import { PartyInfo } from "./partyinfo"
import Debug from "debug"
import chalk from "chalk"

const debug = Debug("ms2:debug:analyzer")

export class MS2Analyzer {
  protected readonly respPath: string
  protected readonly settingsPath: string
  protected settings: ASettings
  protected readonly dungeonId: DungeonId

  protected readonly cidStore: Enmap<string, string>
  protected readonly characterStore: Enmap<string, SerializedCInfo>
  protected readonly altStore: Enmap<string, string[]>

  protected partyInfoBuffer: PartyInfo[] = []

  public constructor(dataDir: string = "./data", dungeonId: DungeonId = DungeonId.REVERSE_ZAKUM) {
    // Nickname -> CID
    this.cidStore = new Enmap<string, string>({
      name: "cidstore",
      autoFetch: true,
      fetchAll: true,
      dataDir,
    })
    // CID -> User Info
    this.characterStore = new Enmap<string, SerializedCInfo>({
      name: "characterstore",
      autoFetch: true,
      fetchAll: true,
      dataDir,
    })
    // AID -> CIDs
    this.altStore = new Enmap<string, string[]>({
      name: "altstore",
      autoFetch: true,
      fetchAll: true,
      dataDir,
    })

    this.settingsPath = Path.resolve(dataDir, "settings.json")
    // default settings
    this.settings = {
      afterDate: {
        year: 2019,
        month: 12,
        day: 10,
      },
      lastPage: -1,
    }
    // response path
    this.respPath = Path.resolve(dataDir, "resp")
    this.dungeonId = dungeonId
  }
  public async init() {
    // load settings
    if (await fs.pathExists(this.settingsPath)) {
      this.settings = {
        ...this.settings,
        ...JSON.parse(await fs.readFile(this.settingsPath, "utf8")),
      }
    }
    if (!await fs.pathExists(this.respPath)) {
      await fs.mkdirs(this.respPath)
    }
  }
  public async modifySettings(settings: Partial<ASettings>) {
    this.settings = {
      ...this.settings,
      ...settings,
    }
    await fs.writeFile(this.settingsPath, JSON.stringify(this.settings, null, 4))
  }

  public async analyze() {
    let page: number
    if (this.settings.lastPage > 0) {
      page = this.settings.lastPage
    } else {
      page = await searchLatestClearedPage(this.dungeonId)
      await this.modifySettings({ lastPage: page })
    }

    const lastTime = {
      year: 2200,
      month: 1,
      day: 1,
    }
    const settingTime = new Date(this.settings.afterDate.year, this.settings.afterDate.month - 1, this.settings.afterDate.day)

    while (page >= 1 && settingTime.getTime() <= new Date(lastTime.year, lastTime.month - 1, lastTime.day).getTime()) {
      const parties = await this.analyzePage(page)
      if (parties.length >= 1) {
        lastTime.year = parties[0].partyDate.year
        lastTime.month = parties[0].partyDate.month
        lastTime.day = parties[0].partyDate.day
      }
      if (this.partyInfoBuffer.length >= 100) {
        try {
          await fs.writeFile(Path.resolve(this.respPath, `rzak_page_${page}.json`), JSON.stringify(this.partyInfoBuffer, null, 4))
          this.partyInfoBuffer = []
        } catch (err) {
          console.error(err)
        }
      }
      page -= 1
      await this.modifySettings({ lastPage: page })
    }
  }
  protected async analyzePage(page: number) {
    debug(`Analyzing page ${page}`)

    const pageParties = await fetchClearedByDate(this.dungeonId, page, true)
    pageParties.reverse()
    this.partyInfoBuffer.push(...pageParties)
    for (const party of pageParties) {
      debug(`[${chalk.green(party.leader.nickname)}] Party member: [${party.members.map(m => chalk.green(m.nickname)).join(", ")}], ID: ${chalk.green(party.partyId)}`)
      // add CIDMap for party leader
      this.addCID(party.leader)

      for (const member of party.members) {
        // check member has cid
        if (member.nickname === party.leader.nickname) {
          continue
        }
        let memberCID = ""
        if (this.cidStore.has(member.nickname)) {
          memberCID = this.cidStore.get(member.nickname) ?? ""
          if (memberCID.length <= 0) {
            throw new Error("Unexpected Error")
          }
        } else {
          // fetch cid
          const memberTInfo = await fetchTrophyCount(member.nickname)
          memberCID = memberTInfo.characterId
          // add cid
          this.cidStore.set(member.nickname, memberCID)
        }
        const memberCInfo: CharacterInfo = {
          ...member,
          characterId: memberCID,
        }
        // update character info whatever...
        await this.updateCharacterInfo(memberCInfo)
      }
    }
    return pageParties
  }

  private async updateCharacterInfo(dungeonCharInfo: CharacterInfo) {
    if (!(this.characterStore.has(dungeonCharInfo.characterId))) {
      const tcinfo = await this.spoofMainCharacter(dungeonCharInfo)
      debug(`[${chalk.blueBright(tcinfo.nickname)}] hasMain: ${tcinfo.accountSpoofed ? chalk.green("Y") : chalk.red("N")} main: ${chalk.yellow(tcinfo.mainCharacterName)}`)
      if (tcinfo.accountSpoofed) {
        // print alts
        const alts = this.altStore.get(tcinfo.accountId) ?? []
        debug(`[${chalk.blueBright(tcinfo.nickname)}] characters: [${alts.map((cid) => {
          const charInfo = this.characterStore.get(cid)
          if (charInfo != null) {
            return chalk.blueBright(deserializeCharacterInfo(charInfo).nickname)
          } else {
            return "?"
          }
        }).map(a => chalk.blueBright(a)).join(", ")}]`)
      }
    } else {
      const cid = dungeonCharInfo.characterId
      const cinfo = this.getCharacterInfo(cid)
      if (cinfo == null) {
        return
      }
      if (cinfo.nickname != dungeonCharInfo.nickname) {
        cinfo.nickname = dungeonCharInfo.nickname
      }
      if (cinfo.job != dungeonCharInfo.job) {
        cinfo.job = dungeonCharInfo.job
      }
      this.characterStore.set(cinfo.characterId, serializeCharacterInfo(cinfo))
    }
  }
  private getCharacterInfo(cid: string) {
    const scinfo = this.characterStore.get(cid)
    if (scinfo == null) {
      return null
    }
    const cinfo = deserializeCharacterInfo(scinfo)
    return cinfo
  }

  private async spoofMainCharacter(character: CharacterInfo) {
    debug(`[${chalk.blueBright(character.nickname)}] Spoofing Main Character`)
    const mainChar = await fetchMainCharacterByName(character.nickname)
    const currentChar: TotalCharacterInfo = {
      ...character,
      mainCharId: "",
      accountId: "",
      accountSpoofed: false,
    }
    if (mainChar != null) {
      currentChar.mainCharId = mainChar.characterId
      currentChar.accountId = mainChar.accountId
      currentChar.accountSpoofed = true
      // update main character info
      const mainTotalChar: TotalCharacterInfo = {
        ...mainChar,
        mainCharId: mainChar.characterId,
        accountSpoofed: true,
      }
      if (!(this.altStore.has(mainChar.accountId))) {
        this.altStore.set(mainChar.accountId, [mainChar.characterId])
      }
      const altList = this.altStore.get(mainChar.accountId) ?? []
      altList.push(currentChar.characterId)
      this.altStore.set(mainChar.accountId, [...new Set(altList)])

      this.characterStore.set(mainTotalChar.characterId, serializeCharacterInfo(mainTotalChar))
    }
    // update current character info
    this.characterStore.set(currentChar.characterId, serializeCharacterInfo(currentChar))
    return {
      ...currentChar,
      mainCharacterName: mainChar?.nickname ?? "",
    } as TotalCharacterInfo & { mainCharacterName: string }
  }

  private addCID(user: { nickname: string, characterId: string }) {
    if (!this.cidStore.has(user.nickname)) {
      this.cidStore.set(user.nickname, user.characterId)
    }
  }

}

export interface ASettings {
  afterDate: { year: number, month: number, day: number },
  lastPage: number,
}