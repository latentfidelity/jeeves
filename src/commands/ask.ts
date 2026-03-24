import { MessageFlags, SlashCommandBuilder } from 'discord.js';
import { appendFile, mkdir } from 'fs/promises';
import { join } from 'path';
import { Command } from '../types/Command';
import config from '../config';
import { runOpenRouterChat } from '../lib/openrouter';
import { getCredits, deductCredits } from '../lib/creditStore';

const LOG_PATH = join(process.cwd(), 'data', 'ask.log');

// ANSI color codes
const c = {
  reset: '\x1b[0m',
  dim: '\x1b[2m',
  bold: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
  magenta: '\x1b[35m',
};

async function logAsk(entry: {
  timestamp: string;
  guild: string;
  user: string;
  userTag: string;
  model: string;
  prompt: string;
  response: string;
  credits: number;
  tokens: number;
}) {
  await mkdir(join(process.cwd(), 'data'), { recursive: true });
  const creditColor = entry.credits === 0 ? c.green : c.red;
  const line =
    `${c.dim}[${entry.timestamp}]${c.reset} ${c.cyan}[${entry.guild}]${c.reset} ${c.yellow}${entry.userTag}${c.reset} ${c.dim}(${entry.user})${c.reset}\n` +
    `  ${c.magenta}model=${c.reset}${entry.model} ${creditColor}credits=${entry.credits}${c.reset} ${c.dim}tokens=${entry.tokens}${c.reset}\n` +
    `  ${c.bold}Q:${c.reset} ${entry.prompt.replace(/\n/g, ' ')}\n` +
    `  ${c.bold}A:${c.reset} ${entry.response.replace(/\n/g, ' ').slice(0, 500)}${entry.response.length > 500 ? '...' : ''}\n\n`;
  await appendFile(LOG_PATH, line);
}

// Models that are free (no credits required)
const FREE_MODELS = new Set([
  'openrouter/free',
  'meta-llama/llama-3.3-70b-instruct:free',
  'meta-llama/llama-3.2-3b-instruct:free',
  'google/gemma-3-27b-it:free',
  'google/gemma-3-12b-it:free',
  'mistralai/mistral-small-3.1-24b-instruct:free',
  'nousresearch/hermes-3-llama-3.1-405b:free',
  'nvidia/nemotron-3-super-120b-a12b:free',
  'openai/gpt-oss-120b:free',
  'qwen/qwen3-coder:free',
]);

const MAX_PROMPT_LENGTH = 800;

// Popular OpenRouter models - curated list
const MODEL_CHOICES = [
  { name: 'Auto (best free)', value: 'openrouter/free' },
  { name: 'Llama 3.3 70B (free)', value: 'meta-llama/llama-3.3-70b-instruct:free' },
  { name: 'Gemma 3 27B (free)', value: 'google/gemma-3-27b-it:free' },
  { name: 'Hermes 3 405B (free)', value: 'nousresearch/hermes-3-llama-3.1-405b:free' },
  { name: 'Nemotron Super 120B (free)', value: 'nvidia/nemotron-3-super-120b-a12b:free' },
  { name: 'GPT-OSS 120B (free)', value: 'openai/gpt-oss-120b:free' },
  { name: 'Mistral Small 3.1 (free)', value: 'mistralai/mistral-small-3.1-24b-instruct:free' },
  { name: 'Qwen3 Coder 480B (free)', value: 'qwen/qwen3-coder:free' },
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
      await interaction.reply({ content: 'This command can only be used in a server.', flags: MessageFlags.Ephemeral });
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
        flags: MessageFlags.Ephemeral,
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
          flags: MessageFlags.Ephemeral,
        });
        return;
      }
    }

    await interaction.deferReply({ flags: isPrivate ? MessageFlags.Ephemeral : undefined });

    try {
      const result = await runOpenRouterChat(prompt, {
        userId: interaction.user.id,
        model: modelOverride ?? undefined,
        systemPrompt: `You are Jeeves, a helpful AI assistant on Discord. Keep responses concise.

Discord syntax:
- Mentions: <@USER_ID> for users, <#CHANNEL_ID> for channels, <@&ROLE_ID> for roles
- Timestamps: <t:UNIX_TIMESTAMP> or <t:UNIX:F> for full, <t:UNIX:R> for relative ("2 hours ago")
- Text: **bold**, *italic*, __underline__, ~~strike~~, ||spoiler||, \`code\`, \`\`\`codeblock\`\`\`
- Quotes: > single line, >>> multi-line block quote
- Headers: # large, ## medium, ### small (must be on own line)
- Subtext: -# small muted text (for footnotes)
- Lists: - or * for bullets, 1. for numbered
- Links: [text](url) or suppress embed with <url>

Use formatting purposefully, not excessively.`,
      });

      // Free models never cost credits, even if the router resolves to an unknown model
      const actualCredits = isFreeModel ? 0 : result.credits;
      let remainingCredits: number | null = null;
      if (actualCredits > 0) {
        const deduction = await deductCredits(guildId, userId, actualCredits);
        remainingCredits = deduction.remaining;
      }

      // Format model name for display (remove provider prefix)
      const modelDisplay = result.model.split('/').pop()?.replace(/:free$/, '') ?? result.model;

      // Build response with credit info
      const creditInfo =
        actualCredits === 0
          ? '`FREE`'
          : `\`-${actualCredits} credits\``;

      const balanceInfo = remainingCredits !== null ? ` · ${remainingCredits} remaining` : '';

      const reply = `**Q:** ${prompt}\n\n**A:** ${result.content}\n\n-# ${modelDisplay} · ${creditInfo}${balanceInfo} · ${result.tokens.total} tokens`;

      await interaction.editReply(reply);

      // Log the ask
      logAsk({
        timestamp: new Date().toISOString(),
        guild: interaction.guild.name,
        user: userId,
        userTag: interaction.user.tag,
        model: result.model,
        prompt,
        response: result.content,
        credits: actualCredits,
        tokens: result.tokens.total,
      }).catch((err) => console.error('Failed to log ask:', err));
    } catch (error) {
      console.error('OpenRouter chat failed', error);
      await interaction.editReply('OpenRouter request failed. Please try again later.');
    }
  },
};

export default command;
