import { SlashCommandBuilder } from 'discord.js';
import { Command } from '../types/Command';

const command: Command = {
  data: new SlashCommandBuilder().setName('ping').setDescription('Check if Jeeves is responsive'),
  requiredRole: 'helper',
  async execute(interaction) {
    const start = Date.now();
    await interaction.reply({ content: 'Pong!', ephemeral: true });
    const end = Date.now();
    const latency = end - start;
    await interaction.followUp({ content: `Latency: ${latency}ms`, ephemeral: true });
  },
};

export default command;
