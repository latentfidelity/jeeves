import { PermissionFlagsBits, SlashCommandBuilder } from 'discord.js';
import { Command } from '../types/Command';
import config from '../config';
import { runOpenRouterChat } from '../lib/openrouter';

const MAX_PROMPT_LENGTH = 800;

const command: Command = {
  data: new SlashCommandBuilder()
    .setName('ai')
    .setDescription('Ask Jeeves AI (OpenRouter)')
    .addStringOption((option) =>
      option
        .setName('prompt')
        .setDescription('Question or text to send to the AI')
        .setRequired(true)
        .setMaxLength(MAX_PROMPT_LENGTH),
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
    .setDMPermission(false),
  requiredRole: 'helper',
  async execute(interaction) {
    const prompt = interaction.options.getString('prompt', true).trim();

    if (!config.openRouter.apiKey) {
      await interaction.reply({
        content: 'OpenRouter is not configured. Ask an admin to set OPENROUTER_API_KEY.',
        ephemeral: true,
      });
      return;
    }

    await interaction.deferReply({ ephemeral: true });

    try {
      const response = await runOpenRouterChat(prompt, {
        userId: interaction.user.id,
        systemPrompt:
          'You are Jeeves, a concise moderation copilot for Discord staff. Provide short, actionable answers. If unsure, say so briefly.',
      });

      await interaction.editReply(response);
    } catch (error) {
      console.error('OpenRouter chat failed', error);
      await interaction.editReply('OpenRouter request failed. Please try again later.');
    }
  },
};

export default command;
