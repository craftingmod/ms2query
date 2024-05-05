import { AttachmentBuilder, CacheType, CommandInteraction, EmbedBuilder } from "discord.js"
import type { BotInit } from "../botbase.js"
import { Command, CommandTools } from "../Command.js"
import { SlashCommandBuilder } from "discord.js"
import { fetchGuildRank, fetchTrophyCount, profilePrefixLong } from "../../ms2/ms2fetch.js"
import got from "got"

export class TrophyCommand implements Command {
  private readonly commandColor = "#e0e3b8"
  public slash = new SlashCommandBuilder()
    .setName("트로피")
    .setDescription("캐릭터 혹은 길드의 트로피 수를 조사합니다.")
    .addSubcommand(subcommand =>
      subcommand.setName("캐릭터")
        .setDescription("특정 캐릭터의 트로피 수를 조사합니다.")
        .addStringOption(option =>
          option.setName("이름")
            .setDescription("조사할 캐릭터의 이름")
            .setRequired(true)
        )
    )
    .addSubcommand(subcommand =>
      subcommand.setName("길드")
        .setDescription("특정 길드의 트로피 수를 조사합니다.")
        .addStringOption(option =>
          option.setName("이름")
            .setDescription("조사할 길드의 이름")
            .setRequired(true)
        )
    )
  public async execute(interaction: CommandInteraction<CacheType>, bot: BotInit, tool: CommandTools) {
    for (const subCommand of interaction.options.data) {
      if (subCommand.name === "캐릭터") {
        const name = interaction.options.get("이름")?.value?.toString() ?? ""
        if (name.length <= 0) {
          await tool.replySimple("캐릭터 이름이 올바르지 않습니다.")
          continue
        }
        const trophyInfo = await fetchTrophyCount(name)
        if (trophyInfo == null) {
          await tool.replySimple(`${name} 캐릭터를 찾을 수 없습니다.`)
          continue
        }
        const attaches: AttachmentBuilder[] = []
        const sendEmbed = new EmbedBuilder()
        sendEmbed.setColor(this.commandColor)
        sendEmbed.setTitle("캐릭터 검색 결과")
        sendEmbed.addFields({
          name: "🏷️ 닉네임",
          value: trophyInfo.nickname,
        }, {
          name: "🆔 캐릭터 ID",
          value: trophyInfo.characterId.toString(),
        }, {
          name: "🥇 순위",
          value: `${trophyInfo.trophyRank}등`,
          inline: true,
        }, {
          name: "🏆 트로피",
          value: `${CommandTools.commaNumber(trophyInfo.trophyCount)}개`,
          inline: true,
        })
        if (trophyInfo.profileURL.length > 0 && trophyInfo.profileURL.startsWith(profilePrefixLong)) {
          const profileBuffer = await got(trophyInfo.profileURL).buffer()
          attaches.push(new AttachmentBuilder(profileBuffer).setName("profile.png"))
          sendEmbed.setThumbnail("attachment://profile.png")
        }
        await interaction.reply({
          embeds: [sendEmbed],
          files: attaches,
        })
      } else if (subCommand.name === "길드") {
        const name = interaction.options.get("이름")?.value?.toString() ?? ""
        const fetchGuild = await fetchGuildRank(name, true)
        if (fetchGuild == null) {
          await tool.replySimple(`${name} 길드를 찾을 수 없습니다.`)
          continue
        }
        const attaches: AttachmentBuilder[] = []
        const sendEmbed = new EmbedBuilder()
        sendEmbed.setColor(this.commandColor)
        sendEmbed.setTitle("길드 검색 결과")
        sendEmbed.addFields({
          name: "🏷️ 길드명",
          value: fetchGuild.guildName,
        }, {
          name: "🆔 길드 ID",
          value: fetchGuild.guildId.toString(),
        }, {
          name: "✨ 길드장",
          value: fetchGuild.leaderName,
        }, {
          name: "🥇 순위",
          value: `${fetchGuild.rank}등`,
          inline: true,
        }, {
          name: "🏆 트로피",
          value: `${CommandTools.commaNumber(fetchGuild.trophyCount)}개`,
          inline: true,
        })
        // 길마 정보
        if (fetchGuild.leaderInfo != null) {
          const profileBuffer = await got(fetchGuild.leaderInfo.profileURL, { responseType: "buffer" }).buffer()
          const userAttach = new AttachmentBuilder(profileBuffer)
            .setName("userprofile.png")

          attaches.push(userAttach)
          sendEmbed.setAuthor({
            name: fetchGuild.leaderInfo.nickname,
            iconURL: "attachment://userprofile.png",
          })
        }
        // 길드 로고
        if (fetchGuild.guildProfileURL != null) {
          const guildBuffer = await got(fetchGuild.guildProfileURL, { responseType: "buffer" }).buffer()
          const guildAttach = new AttachmentBuilder(guildBuffer)
            .setName("guild.png")
          attaches.push(guildAttach)
          sendEmbed.setThumbnail("attachment://guild.png")
        }
        await interaction.reply({
          embeds: [sendEmbed],
          files: attaches,
        })
      }
    }
  }
}