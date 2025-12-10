import { MessageFlags, PermissionFlagsBits, SlashCommandBuilder } from 'discord.js';
import { Command } from '../types/Command';
import { getCredits, addCredits, setCredits } from '../lib/creditStore';

const command: Command = {
  data: new SlashCommandBuilder()
    .setName('credits')
    .setDescription('Manage AI credits for users')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .setDMPermission(false)
    .addSubcommand((sub) =>
      sub
        .setName('give')
        .setDescription('Give credits to a user')
        .addUserOption((opt) => opt.setName('user').setDescription('User to give credits to').setRequired(true))
        .addIntegerOption((opt) =>
          opt.setName('amount').setDescription('Amount of credits to give').setRequired(true).setMinValue(1),
        ),
    )
    .addSubcommand((sub) =>
      sub
        .setName('set')
        .setDescription('Set a user\'s credit balance')
        .addUserOption((opt) => opt.setName('user').setDescription('User to set credits for').setRequired(true))
        .addIntegerOption((opt) =>
          opt.setName('amount').setDescription('New credit balance').setRequired(true).setMinValue(0),
        ),
    )
    .addSubcommand((sub) =>
      sub
        .setName('check')
        .setDescription('Check a user\'s credit balance')
        .addUserOption((opt) => opt.setName('user').setDescription('User to check (defaults to yourself)')),
    ),
  requiredRole: 'administrator',
  async execute(interaction) {
    if (!interaction.guild) {
      await interaction.reply({ content: 'This command can only be used in a server.', flags: MessageFlags.Ephemeral });
      return;
    }

    const subcommand = interaction.options.getSubcommand();
    const guildId = interaction.guild.id;

    if (subcommand === 'give') {
      const user = interaction.options.getUser('user', true);
      const amount = interaction.options.getInteger('amount', true);

      const newBalance = await addCredits(guildId, user.id, amount);
      await interaction.reply({
        content: `Gave **${amount}** credits to ${user}. New balance: **${newBalance}** credits.`,
        flags: MessageFlags.Ephemeral,
      });
    } else if (subcommand === 'set') {
      const user = interaction.options.getUser('user', true);
      const amount = interaction.options.getInteger('amount', true);

      const newBalance = await setCredits(guildId, user.id, amount);
      await interaction.reply({
        content: `Set ${user}'s balance to **${newBalance}** credits.`,
        flags: MessageFlags.Ephemeral,
      });
    } else if (subcommand === 'check') {
      const user = interaction.options.getUser('user') ?? interaction.user;
      const balance = await getCredits(guildId, user.id);

      await interaction.reply({
        content: `${user === interaction.user ? 'You have' : `${user} has`} **${balance}** credits.`,
        flags: MessageFlags.Ephemeral,
      });
    }
  },
};

export default command;
