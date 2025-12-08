import { Colors, EmbedBuilder, PermissionFlagsBits, SlashCommandBuilder } from 'discord.js';
import { getInfractions } from '../lib/infractions';
import { Command } from '../types/Command';

const command: Command = {
  data: new SlashCommandBuilder()
    .setName('infractions')
    .setDescription('View infraction counts for a member')
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
    .setDMPermission(false)
    .addUserOption((option) =>
      option.setName('user').setDescription('User to inspect').setRequired(true),
    ),
  requiredRole: 'moderator',
  async execute(interaction) {
    if (!interaction.guild) {
      await interaction.reply({ content: 'This command can only be used in a server.', ephemeral: true });
      return;
    }

    const user = interaction.options.getUser('user', true);
    const infractions = await getInfractions(interaction.guild.id, user.id);

    if (!infractions.length) {
      await interaction.reply({ content: `${user.tag} has no recorded infractions.`, ephemeral: true });
      return;
    }

    const embed = new EmbedBuilder()
      .setTitle(`Infractions for ${user.tag}`)
      .setColor(Colors.Orange)
      .addFields(
        infractions.map((inf) => ({
          name: inf.type,
          value: `${inf.count} (last updated ${new Date(inf.lastUpdated).toLocaleString()})`,
          inline: true,
        })),
      );

    await interaction.reply({ embeds: [embed], ephemeral: true });
  },
};

export default command;
