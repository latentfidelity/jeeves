import { AttachmentBuilder, MessageFlags, PermissionFlagsBits, SlashCommandBuilder } from 'discord.js';
import { buildBackupBuffer } from '../lib/backup';
import { Command } from '../types/Command';

const command: Command = {
  data: new SlashCommandBuilder()
    .setName('backup')
    .setDescription('Export Jeeves data (warnings, notes, cases, config) as JSON')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .setDMPermission(false),
  requiredRole: 'administrator',
  async execute(interaction) {
    if (!interaction.guild) {
      await interaction.reply({ content: 'This command can only be used in a server.', flags: MessageFlags.Ephemeral });
      return;
    }

    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    const buffer = await buildBackupBuffer();
    const attachment = new AttachmentBuilder(buffer, { name: `jeeves-backup-${Date.now()}.json` });

    await interaction.editReply({
      content: 'Backup generated. Keep this file safe.',
      files: [attachment],
    });
  },
};

export default command;
