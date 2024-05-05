import { ActionRowBuilder, AttachmentBuilder, ButtonBuilder, ButtonStyle, CommandInteraction, EmbedBuilder, SlashCommandBuilder } from "discord.js"
import Path from "node:path"
import fs from "node:fs/promises"
import { constants as fscon } from "node:fs"

import { CommandPolicy, DaemonCommand, type InteractionExecutors } from "../base/Command.ts"
import * as CommandTools from "../base/CommandTools.ts"
import { MS2QueryBot } from "../MS2QueryBot.ts"

const selectTag = "fieldboss-selection"

export class FieldBossCommand extends DaemonCommand<MS2QueryBot> {
  private static readonly SORTED_BY = "정렬"

  public override runPolicy = CommandPolicy.All

  public override slash = new SlashCommandBuilder()
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

  public override executors = {}
  public override interactions: InteractionExecutors = {
    [selectTag]: async (interaction, params) => {
      const data = params as unknown as ActionData
      // 보스 ID 가져오기
      const bossId = Number(data.fieldBossId ?? FieldBossId.Dundun)
      // 시간 기반인지 체크
      const isTimeBased = data.isTime === "true"

      // Embed 필드 가져오기
      const contents = this.createFieldBossEmbed(bossId, isTimeBased)
      // 컨트롤러 가져오기
      const controller = this.createController(bossId, interaction.user.id, isTimeBased)

      // 인터렉션 업데이트
      await interaction.update({
        embeds: contents.embeds,
        files: contents.attaches,
        components: controller,
      })
    }
  }

  public images: Array<Buffer | null> = []

  public override async onLogin() {
    for (let i = 0; i < FieldBossImage.length; i += 1) {
      const path = Path.resolve("./resources/portraint", `${FieldBossImage[i]}.png`)
      try {
        this.images.push(await fs.readFile(path))
      } catch (err) {
        this.images.push(null)
      }
    }
  }

  public override async execute(interaction: CommandInteraction) {
    // 현재 시각 찾기
    const currentTime = await CommandTools.getCurrentTimeForce()
    // 정렬 방식 가져오기
    const isTimeBased = CommandTools.getInteractionOption<"name" | "time">(interaction, FieldBossCommand.SORTED_BY, "name") === "time"

    // 현재 시각 보스 가져오기

    let embeds: EmbedBuilder[] = []
    let attaches: AttachmentBuilder[] = []

    // find current time boss
    let breaked = false
    let boss: FieldBossId | -1 = -1
    for (let i = 0; i < FieldBossTime.length; i += 1) {
      const time = FieldBossTime[i] ?? 0
      if (currentTime.getMinutes() < time) {
        const messages = this.createFieldBossEmbed(i as FieldBossId, true)
        embeds.push(...messages.embeds)
        attaches.push(...messages.attaches)
        breaked = true
        boss = i
        break
      }
    }
    if (!breaked) {
      boss = FieldBossId.Dundun
      const messages = this.createFieldBossEmbed(FieldBossId.Dundun, true)
      embeds.push(...messages.embeds)
      attaches.push(...messages.attaches)
    }

    await interaction.reply({
      embeds,
      files: attaches,
      components: this.createController(boss, interaction.user.id, isTimeBased),
    })
  }

  /**
 * bossId와 isTimeBased 정보를 통해 reply할 정보 만들기
 * @param boss 필드보스 ID
 * @param isTime 시간 기준인지 여부
 * @returns 첨부할 embeds와 attachments
 */
  protected createFieldBossEmbed(boss: FieldBossId, isTime: boolean) {
    const embeds: EmbedBuilder[] = []
    const attaches: AttachmentBuilder[] = []

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

        embed.setThumbnail(FieldBossImageURL[i]!!)

        embeds.push(embed)
        // attaches.push(attach)
      } else {
        embeds.push(embed)
      }
    }

    return {
      embeds,
      attaches,
    }
  }

  /**
 * 컨트롤러 배치
 * @param boss 필드보스 ID
 * @param sender 인터렉션을 보낸 유저 ID
 * @param isTime 시간 기준인지 여부
 * @returns 컨트롤러
 */
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

      const customId = CommandTools.buildCustomId(selectTag, {
        isTime: isTime.toString(),
        fieldBossId: id.toString(),
        sender: sender,
      })
      const btn = new ButtonBuilder()
        .setCustomId(customId)
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

interface ActionData {
  isTime: string,
  fieldBossId: string,
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
const FieldBossImageURL = [
  "https://cdn.discordapp.com/attachments/1093734958763364442/1093735109686997073/dundun.png",
  "https://cdn.discordapp.com/attachments/1093734958763364442/1093735151311265873/roro.png",
  "https://cdn.discordapp.com/attachments/1093734958763364442/1093735108520972298/angry_vaphomet.png",
  "https://cdn.discordapp.com/attachments/1093734958763364442/1093735150078132264/icedragon.png",
  "https://cdn.discordapp.com/attachments/1093734958763364442/1093735107656945724/acreon.png",

  "https://cdn.discordapp.com/attachments/1093734958763364442/1093735149830676531/griffon.png",
  "https://cdn.discordapp.com/attachments/1093734958763364442/1093735109095587960/cold_vaphomet.png",
  "https://cdn.discordapp.com/attachments/1093734958763364442/1093735151898464256/ureus.png",

  "https://cdn.discordapp.com/attachments/1093734958763364442/1093735149830676531/griffon.png",
  "https://cdn.discordapp.com/attachments/1093734958763364442/1093735151621636197/toto.png",

  "https://cdn.discordapp.com/attachments/1093734958763364442/1093735109921865788/giantturtle.png",
  "https://cdn.discordapp.com/attachments/1093734958763364442/1093735152208846858/vayarguardian.png",

  "https://cdn.discordapp.com/attachments/1093734958763364442/1093735107975721021/alphaturtle.png",

  "https://cdn.discordapp.com/attachments/1093734958763364442/1093735150359154698/mk52alpha.png",
  "https://cdn.discordapp.com/attachments/1093734958763364442/1093735150946357369/rernos.png",

  "https://cdn.discordapp.com/attachments/1093734958763364442/1093735109359833148/devlin.png",
  "https://cdn.discordapp.com/attachments/1093734958763364442/1093735150631788594/pekanos.png",
  "https://cdn.discordapp.com/attachments/1093734958763364442/1093735108244144148/amadon.png",

  "https://cdn.discordapp.com/attachments/1093734958763364442/1093735108818776225/chucky.png"
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