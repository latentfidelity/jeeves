import { SlashCommandBuilder } from 'discord.js';
import { Command } from '../types/Command';
import config from '../config';
import { runOpenRouterChat } from '../lib/openrouter';
import { getCredits, deductCredits } from '../lib/creditStore';

// Models that are free (no credits required)
const FREE_MODELS = new Set([
  'meta-llama/llama-3.3-70b-instruct:free',
  'meta-llama/llama-3.2-3b-instruct:free',
  'google/gemini-2.0-flash-exp:free',
  'google/gemma-3-27b-it:free',
  'mistralai/mistral-small-3.1-24b-instruct:free',
  'mistralai/mistral-7b-instruct:free',
  'qwen/qwen3-235b-a22b:free',
]);

const MAX_PROMPT_LENGTH = 800;

// Popular OpenRouter models - curated list
const MODEL_CHOICES = [
  { name: 'Llama 3.3 70B (free)', value: 'meta-llama/llama-3.3-70b-instruct:free' },
  { name: 'Llama 3.2 3B (free)', value: 'meta-llama/llama-3.2-3b-instruct:free' },
  { name: 'Gemini 2.0 Flash (free)', value: 'google/gemini-2.0-flash-exp:free' },
  { name: 'Gemma 3 27B (free)', value: 'google/gemma-3-27b-it:free' },
  { name: 'Mistral Small 3.1 (free)', value: 'mistralai/mistral-small-3.1-24b-instruct:free' },
  { name: 'Mistral 7B (free)', value: 'mistralai/mistral-7b-instruct:free' },
  { name: 'Qwen 3 235B (free)', value: 'qwen/qwen3-235b-a22b:free' },
  { name: 'GPT-4o Mini', value: 'openai/gpt-4o-mini' },
  { name: 'GPT-4o', value: 'openai/gpt-4o' },
  { name: 'Claude 3.5 Sonnet', value: 'anthropic/claude-3.5-sonnet' },
  { name: 'Claude 3 Haiku', value: 'anthropic/claude-3-haiku' },
  { name: 'DeepSeek V3', value: 'deepseek/deepseek-chat' },
] as const;

const command: Command = {
  data: new SlashCommandBuilder()
    .setName('ask')
    .setDescription('Ask Jeeves (OpenRouter)')
    .addStringOption((option) =>
      option
        .setName('prompt')
        .setDescription('Question or text to send to the AI')
        .setRequired(true)
        .setMaxLength(MAX_PROMPT_LENGTH),
    )
    .addStringOption((option) =>
      option
        .setName('model')
        .setDescription('AI model to use (default: from config)')
        .setRequired(false)
        .addChoices(...MODEL_CHOICES),
    )
    .addBooleanOption((option) =>
      option
        .setName('private')
        .setDescription('Only show response to you (default: public)')
        .setRequired(false),
    )
    .setDMPermission(false),
  async execute(interaction) {
    if (!interaction.guild) {
      await interaction.reply({ content: 'This command can only be used in a server.', ephemeral: true });
      return;
    }

    const prompt = interaction.options.getString('prompt', true).trim();
    const modelOverride = interaction.options.getString('model');
    const isPrivate = interaction.options.getBoolean('private') ?? false;
    const selectedModel = modelOverride ?? config.openRouter.model;
    const isFreeModel = FREE_MODELS.has(selectedModel);

    if (!config.openRouter.apiKey) {
      await interaction.reply({
        content: 'OpenRouter is not configured. Ask an admin to set OPENROUTER_API_KEY.',
        ephemeral: true,
      });
      return;
    }

    // Check credits for paid models
    const guildId = interaction.guild.id;
    const userId = interaction.user.id;

    if (!isFreeModel) {
      const balance = await getCredits(guildId, userId);
      if (balance <= 0) {
        await interaction.reply({
          content: `You need credits to use paid models. Your balance: **0 credits**.\nUse a free model or ask an admin for credits.`,
          ephemeral: true,
        });
        return;
      }
    }

    await interaction.deferReply({ ephemeral: isPrivate });

    try {
      const result = await runOpenRouterChat(prompt, {
        userId: interaction.user.id,
        model: modelOverride ?? undefined,
        systemPrompt:
          'You are Jeeves, a helpful AI assistant. Provide short, clear answers. If unsure, say so briefly.',
      });

      // Deduct credits for paid models
      let remainingCredits: number | null = null;
      if (result.credits > 0) {
        const deduction = await deductCredits(guildId, userId, result.credits);
        remainingCredits = deduction.remaining;
      }

      // Format model name for display (remove provider prefix)
      const modelDisplay = result.model.split('/').pop()?.replace(/:free$/, '') ?? result.model;

      // Build response with credit info
      const creditInfo =
        result.credits === 0
          ? '`FREE`'
          : `\`-${result.credits} credits\``;

      const balanceInfo = remainingCredits !== null ? ` · ${remainingCredits} remaining` : '';

      const reply = `${result.content}\n\n-# ${modelDisplay} · ${creditInfo}${balanceInfo} · ${result.tokens.total} tokens`;

      await interaction.editReply(reply);
    } catch (error) {
      console.error('OpenRouter chat failed', error);
      await interaction.editReply('OpenRouter request failed. Please try again later.');
    }
  },
};

export default command;
