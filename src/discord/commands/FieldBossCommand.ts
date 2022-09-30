import { ActionRowBuilder, AttachmentBuilder, ButtonBuilder, ButtonStyle, CacheType, Client, CommandInteraction, Embed, EmbedBuilder, Interaction, MessageSelectOption, SelectMenuBuilder } from "discord.js"
import type { BotInit } from "../botinit.js"
import type { Command } from "../command.js"
import { CommandTools } from "../command.js"
import { SlashCommandBuilder } from "discord.js"
import Path from "node:path"
import fs from "node:fs/promises"
import { constants as fscon } from "node:fs"

export class FieldBossCommand implements Command {
  private static readonly SORTED_BY = "정렬"
  public slash = new SlashCommandBuilder()
    .setName("필드보스")
    .setDescription("필드보스를 검색할 수 있습니다.")
    .addStringOption(option => option
      .setName(FieldBossCommand.SORTED_BY)
      .setDescription("정렬 형식을 선택합니다.")
      .setRequired(false)
      .addChoices({
        name: "시간",
        value: "time",
      }, {
        name: "보스 이름",
        value: "name",
      }))

  public images: Array<Buffer | null> = []

  public async beforeInit(client: Client) {
    for (let i = 0; i < FieldBossImage.length; i += 1) {
      const path = Path.resolve("./resources/portraint", `${FieldBossImage[i]}.png`)
      fs.access(path, fscon.R_OK).then(() => true).catch(() => false)
      if (await CommandTools.pathExist(path)) {
        this.images.push(await fs.readFile(path))
      } else {
        this.images.push(null)
      }
    }
  }
  public async execute(interaction: CommandInteraction<CacheType>, bot: BotInit, tool: CommandTools) {
    const date = await CommandTools.getCurrentTime()
    const isTime = (interaction.options.get(FieldBossCommand.SORTED_BY)?.value ?? "name") === "time"

    let embeds: EmbedBuilder[] = []
    let attaches: AttachmentBuilder[] = []

    // find current time boss
    let breaked = false
    let boss: FieldBossId | -1 = -1
    for (let i = 0; i < FieldBossTime.length; i += 1) {
      const time = FieldBossTime[i] ?? 0
      if (date.getMinutes() < time) {
        const messages = this.createFieldBossEmbed(i as FieldBossId, true)
        for (const msg of messages) {
          embeds.push(msg.embed)
          if (msg.attach != null) {
            attaches.push(msg.attach)
          }
        }
        breaked = true
        boss = i
        break
      }
    }
    if (!breaked) {
      boss = FieldBossId.Dundun
      const messages = this.createFieldBossEmbed(FieldBossId.Dundun, true)
      for (const msg of messages) {
        embeds.push(msg.embed)
        if (msg.attach != null) {
          attaches.push(msg.attach)
        }
      }
    }

    await interaction.reply({
      embeds,
      files: attaches,
      components: this.createController(boss, interaction.user.id, isTime),
    })
  }

  public async executeRaw(interaction: Interaction<CacheType>, bot: BotInit) {
    if (interaction.isButton()) {
      const { tag, userid } = CommandTools.parseCustomId(interaction.customId)
      if (!tag.startsWith("fieldboss-btn-")) {
        return true
      }
      const isTime = tag.indexOf("-s-") >= 0

      if (userid !== interaction.user.id) {
        await interaction.reply({
          embeds: [CommandTools.makeErrorMessage("선택권은 메시지 주인에게만 있어요!")],
          ephemeral: true,
        })
        return true
      }
      const bossid = Number.parseInt(tag.substring(tag.lastIndexOf("-") + 1)) as FieldBossId

      let embeds: EmbedBuilder[] = []
      let attaches: AttachmentBuilder[] = []

      const messages = this.createFieldBossEmbed(bossid, true)
      for (const msg of messages) {
        embeds.push(msg.embed)
        if (msg.attach != null) {
          attaches.push(msg.attach)
        }
      }

      const bottom = this.createController(bossid, interaction.user.id, isTime)

      await interaction.update({
        embeds,
        files: attaches,
        components: bottom,
      })
      return false
    }
    return true
  }

  protected createFieldBossEmbed(boss: FieldBossId, isTime: boolean) {
    const out: Array<{ attach: AttachmentBuilder | null, embed: EmbedBuilder }> = []
    const cTime = FieldBossTime[boss]
    if (isTime) {
      while (boss > 0) {
        boss -= 1
        if (FieldBossTime[boss] !== cTime) {
          boss += 1
          break
        }
      }
    }
    for (let i = boss; i < FieldBoss.length; i += 1) {
      if (i !== boss && !isTime) {
        break
      }
      const time = FieldBossTime[i] ?? 0
      if (FieldBossTime[boss] !== time) {
        break
      }
      const fieldBossName = FieldBoss[i]!!

      const embed = new EmbedBuilder()
      embed.setTitle(fieldBossName)
      embed.addFields({
        name: "출현 시간",
        value: `${(time < 0 ? "짝수 " : "")}${Math.abs(time)}분`,
      }, {
        name: "위치",
        value: FieldBossGen[i] ?? "알 수 없음",
      })
      embed.setColor(CommandTools.COLOR_INFO)

      if (this.images[i] != null) {
        const attach = new AttachmentBuilder(this.images[i]!!)
          .setName(`${FieldBossImage[i]}.png`)
          .setDescription(fieldBossName)
        embed.setThumbnail(`attachment://${FieldBossImage[i]}.png`)
        out.push({ attach, embed })
      } else {
        out.push({ attach: null, embed })
      }
    }
    return out
  }
  protected createController(boss: FieldBossId | -1, sender: string, isTime: boolean) {

    const components: ButtonBuilder[] = []
    let lastTime = -1
    for (let i = 0; i < FieldBoss.length; i += 1) {
      const id = i as FieldBossId
      const time = FieldBossTime[id]!!
      if (time !== lastTime) {
        lastTime = time
      } else {
        if (isTime) {
          continue
        }
      }
      const btn = new ButtonBuilder()
        .setCustomId(CommandTools.createCustomId(`fieldboss-btn-${isTime ? "s-" : ""}${i}`, sender))
        .setLabel(isTime ? `${(time < 0 ? "짝수 " : "")}${Math.abs(time)}분` : FieldBoss[id] ?? "알 수 없음")
      if (id === boss) {
        btn.setStyle(ButtonStyle.Primary)
      } else if (!isTime && FieldBossTime[i] === FieldBossTime[boss]) {
        btn.setStyle(ButtonStyle.Success)
      } else {
        btn.setStyle(ButtonStyle.Secondary)
      }
      components.push(btn)
    }
    const rows: ActionRowBuilder<ButtonBuilder>[] = []
    for (let i = 0; i < components.length; i += 1) {
      if (i % 5 === 0) {
        rows.push(new ActionRowBuilder())
      }
      rows[Math.floor(i / 5)]?.addComponents(components[i]!!)
    }
    return rows
  }
}


/**
 * Don't ask about spelling
 */
const FieldBoss = [
  "둔둔",
  "로로와 무무스",
  "분노의 바포메트",
  "이카드 마르",
  "아크레온",

  "그리폰",
  "냉혈한 바포메트",
  "우레우스",

  "그리피나",
  "토토와 구구스",

  "자이언트 터틀",
  "바야르 수문장",

  "알파 터틀",

  "마크52 알파",
  "레르노스",

  "데블린 워리어",
  "페카노스",
  "아마돈",

  "아머드 체키"
]
const FieldBossImage = [
  "dundun",
  "roro",
  "angry_vaphomet",
  "icedragon",
  "acreon",

  "griffon",
  "cold_vaphomet",
  "ureus",

  "griffina",
  "toto",

  "giantturtle",
  "vayarguardian",

  "alphaturtle",

  "mk52alpha",
  "rernos",

  "devlin",
  "pekanos",
  "amadon",

  "chucky",
]
const FieldBossTime = [
  5,
  5,
  5,
  5,
  5,

  15,
  15,
  15,

  25,
  25,

  35,
  35,

  40,

  45,
  45,

  55,
  55,
  55,

  -5,
]
const FieldBossGen = [
  "커닝 폐기물 처리장",
  "바움나무",
  "캐슬 리버스",
  "아이스 크라운",
  "라벤더 섬",

  "차가운 심장",
  "눈꽃 봉우리",
  "메마른 벌목지",

  "트리니안 가도",
  "붉은 휘파람 절벽",

  "비치웨이 \"111\"",
  "깎은 절벽 요새",

  "엘루아 강가",

  "뉴런 DNA 연구 센터",
  "퍼플 문 캐슬",

  "로얄로드 남부",
  "상처입은 협곡",
  "루델리 아레나",

  "스카이 포트리스 갑판",
]

enum FieldBossId {
  Dundun,
  Moomoose,
  AngryBaphomet,
  Icard_Marr,
  Archreon,

  Grippon,
  ColdBaphomet,
  Ureous,

  Greefina,
  Gugus,

  GiantTurtle,
  VayarGuardian,

  AlphaTurtle,

  Mk52Alpha,
  Rernos,

  DevlinWarrior,
  Pekanos,
  Amadon,

  Chucky,
}