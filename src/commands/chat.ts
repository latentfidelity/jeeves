import { MessageFlags, SlashCommandBuilder, ChannelType, PermissionFlagsBits } from 'discord.js';
import { Command } from '../types/Command';
import { getChatConfig, setChatConfig, disableChat } from '../lib/chatStore';
import config from '../config';

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
    .setName('chat')
    .setDescription('Configure Jeeves to occasionally chat in a channel')
    .addSubcommand((sub) =>
      sub
        .setName('enable')
        .setDescription('Enable chat mode in a channel')
        .addChannelOption((opt) =>
          opt
            .setName('channel')
            .setDescription('Channel for Jeeves to chat in')
            .addChannelTypes(ChannelType.GuildText)
            .setRequired(true),
        )
        .addIntegerOption((opt) =>
          opt
            .setName('chance')
            .setDescription('Percentage chance to reply (1-100, default 15)')
            .setMinValue(1)
            .setMaxValue(100)
            .setRequired(false),
        )
        .addStringOption((opt) =>
          opt
            .setName('model')
            .setDescription('AI model to use (default: from config)')
            .setRequired(false)
            .addChoices(...MODEL_CHOICES),
        ),
    )
    .addSubcommand((sub) => sub.setName('disable').setDescription('Disable chat mode'))
    .addSubcommand((sub) => sub.setName('status').setDescription('Show current chat configuration'))
    .addSubcommand((sub) =>
      sub
        .setName('chance')
        .setDescription('Update the reply chance percentage')
        .addIntegerOption((opt) =>
          opt
            .setName('percent')
            .setDescription('Percentage chance to reply (1-100)')
            .setMinValue(1)
            .setMaxValue(100)
            .setRequired(true),
        ),
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .setDMPermission(false),

  requiredRole: 'moderator',

  async execute(interaction) {
    if (!interaction.guild) {
      await interaction.reply({ content: 'This command can only be used in a server.', flags: MessageFlags.Ephemeral });
      return;
    }

    const subcommand = interaction.options.getSubcommand();
    const guildId = interaction.guild.id;

    if (subcommand === 'enable') {
      const channel = interaction.options.getChannel('channel', true);
      const chance = interaction.options.getInteger('chance') ?? 15;
      const model = interaction.options.getString('model') ?? config.openRouter.model;

      await setChatConfig(guildId, {
        enabled: true,
        channelId: channel.id,
        model,
        chance,
      });

      const modelDisplay = model.split('/').pop()?.replace(/:free$/, '') ?? model;
      await interaction.reply({
        content: `Chat mode enabled in <#${channel.id}>\n` +
          `-# Model: ${modelDisplay} · Reply chance: ${chance}%`,
        flags: MessageFlags.Ephemeral,
      });
    } else if (subcommand === 'disable') {
      await disableChat(guildId);
      await interaction.reply({ content: 'Chat mode disabled.', flags: MessageFlags.Ephemeral });
    } else if (subcommand === 'status') {
      const chatConfig = await getChatConfig(guildId);

      if (!chatConfig || !chatConfig.enabled) {
        await interaction.reply({ content: 'Chat mode is **disabled**.', flags: MessageFlags.Ephemeral });
        return;
      }

      const modelDisplay = chatConfig.model.split('/').pop()?.replace(/:free$/, '') ?? chatConfig.model;
      await interaction.reply({
        content: `Chat mode is **enabled**\n` +
          `Channel: <#${chatConfig.channelId}>\n` +
          `Model: ${modelDisplay}\n` +
          `Reply chance: ${chatConfig.chance}%`,
        flags: MessageFlags.Ephemeral,
      });
    } else if (subcommand === 'chance') {
      const chatConfig = await getChatConfig(guildId);

      if (!chatConfig || !chatConfig.enabled) {
        await interaction.reply({ content: 'Chat mode is not enabled. Use `/chat enable` first.', flags: MessageFlags.Ephemeral });
        return;
      }

      const newChance = interaction.options.getInteger('percent', true);
      await setChatConfig(guildId, { ...chatConfig, chance: newChance });

      await interaction.reply({
        content: `Reply chance updated to **${newChance}%**`,
        flags: MessageFlags.Ephemeral,
      });
    }
  },
};

export default command;
