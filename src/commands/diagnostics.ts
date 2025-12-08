import { Colors, EmbedBuilder, PermissionFlagsBits, SlashCommandBuilder } from 'discord.js';
import config from '../config';
import { getGuildConfig } from '../lib/configStore';
import { Command } from '../types/Command';

const checks = [
  { name: 'Ban members', perm: PermissionFlagsBits.BanMembers },
  { name: 'Kick members', perm: PermissionFlagsBits.KickMembers },
  { name: 'Moderate members', perm: PermissionFlagsBits.ModerateMembers },
  { name: 'Manage roles', perm: PermissionFlagsBits.ManageRoles },
  { name: 'Manage channels', perm: PermissionFlagsBits.ManageChannels },
  { name: 'Manage messages', perm: PermissionFlagsBits.ManageMessages },
];

const command: Command = {
  data: new SlashCommandBuilder()
    .setName('diagnostics')
    .setDescription('Check Jeeves permissions and configuration')
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
    .setDMPermission(false),
  requiredRole: 'moderator',
  async execute(interaction) {
    if (!interaction.guild) {
      await interaction.reply({ content: 'This command can only be used in a server.', ephemeral: true });
      return;
    }

    const me = interaction.guild.members.me;
    if (!me) {
      await interaction.reply({ content: 'Could not load bot member data.', ephemeral: true });
      return;
    }

    const results = checks.map((check) => ({
      name: check.name,
      ok: me.permissions.has(check.perm),
    }));

    const guildConfig = await getGuildConfig(interaction.guild.id);
    const modLogChannelId = guildConfig.modLogChannelId || config.modLogChannelId;

    let modLogStatus = 'Not configured';
    if (modLogChannelId) {
      try {
        const channel = await interaction.guild.channels.fetch(modLogChannelId);
        if (channel && channel.isTextBased()) {
          const canSend = channel.permissionsFor(me)?.has(PermissionFlagsBits.SendMessages);
          modLogStatus = canSend ? `Configured: <#${modLogChannelId}>` : 'Configured but missing Send Messages permission';
        } else {
          modLogStatus = 'Configured but channel not found or not text-based';
        }
      } catch {
        modLogStatus = 'Configured but fetch failed';
      }
    }

    const embed = new EmbedBuilder()
      .setTitle('Jeeves Diagnostics')
      .setColor(Colors.Blue)
      .addFields(
        ...results.map((result) => ({
          name: result.name,
          value: result.ok ? '✅ OK' : '❌ Missing',
          inline: true,
        })),
        { name: 'Mod log channel', value: modLogStatus, inline: false },
      )
      .setTimestamp();

    await interaction.reply({ embeds: [embed], ephemeral: true });
  },
};

export default command;
