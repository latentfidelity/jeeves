import { PermissionFlagsBits, SlashCommandBuilder } from 'discord.js';
import { addCase } from '../lib/caseStore';
import { createActionEmbed, sendModLog } from '../lib/modLog';
import { addNote, clearNotes, getNotes } from '../lib/noteStore';
import { Command } from '../types/Command';

const command: Command = {
  data: new SlashCommandBuilder()
    .setName('note')
    .setDescription('Moderator notes for members')
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
    .setDMPermission(false)
    .addSubcommand((sub) =>
      sub
        .setName('add')
        .setDescription('Add a private moderator note for a member')
        .addUserOption((option) =>
          option.setName('user').setDescription('User to add a note to').setRequired(true),
        )
        .addStringOption((option) =>
          option
            .setName('note')
            .setDescription('Note text')
            .setRequired(true)
            .setMaxLength(1000),
        ),
    )
    .addSubcommand((sub) =>
      sub
        .setName('list')
        .setDescription('List moderator notes for a member')
        .addUserOption((option) =>
          option.setName('user').setDescription('User to view notes for').setRequired(true),
        ),
    )
    .addSubcommand((sub) =>
      sub
        .setName('clear')
        .setDescription('Clear all notes for a member')
        .addUserOption((option) =>
          option.setName('user').setDescription('User to clear notes for').setRequired(true),
        ),
    ),
  requiredRole: 'moderator',
  async execute(interaction) {
    if (!interaction.guild) {
      await interaction.reply({ content: 'This command can only be used in a server.', ephemeral: true });
      return;
    }

    const user = interaction.options.getUser('user', true);
    const subcommand = interaction.options.getSubcommand();

    if (subcommand === 'add') {
      const note = interaction.options.getString('note', true);
      const notes = await addNote(interaction.guild.id, user.id, {
        note,
        moderatorId: interaction.user.id,
        createdAt: Date.now(),
      });

      const caseEntry = await addCase({
        action: 'note',
        userId: user.id,
        moderatorId: interaction.user.id,
        reason: 'Moderator note added',
        context: { totalNotes: notes.length.toString() },
      });

      await interaction.reply({
        content: `Added note for ${user.tag}. They now have ${notes.length} note(s). Case #${caseEntry.id}.`,
        ephemeral: true,
      });

      const embed = createActionEmbed({
        action: 'Note Added',
        targetTag: user.tag,
        targetId: user.id,
        moderatorTag: interaction.user.tag,
        moderatorId: interaction.user.id,
        reason: 'Moderator note added',
        caseId: caseEntry.id,
        extraFields: [
          { name: 'Note', value: note.slice(0, 1000) },
          { name: 'Notes for user', value: notes.length.toString(), inline: true },
        ],
      });

      await sendModLog(interaction.guild, embed);
      return;
    }

    if (subcommand === 'list') {
      const notes = await getNotes(interaction.guild.id, user.id);
      if (!notes.length) {
        await interaction.reply({ content: `${user.tag} has no notes.`, ephemeral: true });
        return;
      }

      const description = notes
        .map((entry, index) => {
          const date = new Date(entry.createdAt).toLocaleString();
          return `${index + 1}. ${entry.note} — by <@${entry.moderatorId}> on ${date}`;
        })
        .join('\n');

      await interaction.reply({
        content: `Notes for ${user.tag}:\n${description}`,
        ephemeral: true,
      });
      return;
    }

    if (subcommand === 'clear') {
      const notes = await getNotes(interaction.guild.id, user.id);
      await clearNotes(interaction.guild.id, user.id);

      const caseEntry = await addCase({
        action: 'clearnotes',
        userId: user.id,
        moderatorId: interaction.user.id,
        reason: 'Notes cleared',
        context: { cleared: notes.length.toString() },
      });

      await interaction.reply({
        content: `Cleared ${notes.length} note(s) for ${user.tag}. Case #${caseEntry.id}.`,
        ephemeral: true,
      });

      const embed = createActionEmbed({
        action: 'Notes Cleared',
        targetTag: user.tag,
        targetId: user.id,
        moderatorTag: interaction.user.tag,
        moderatorId: interaction.user.id,
        reason: 'Notes cleared',
        caseId: caseEntry.id,
        extraFields: [{ name: 'Notes cleared', value: notes.length.toString(), inline: true }],
      });

      await sendModLog(interaction.guild, embed);
      return;
    }

    await interaction.reply({ content: 'Unknown subcommand.', ephemeral: true });
  },
};

export default command;
