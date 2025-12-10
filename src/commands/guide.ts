import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ComponentType,
  EmbedBuilder,
  SlashCommandBuilder,
} from 'discord.js';
import { Command } from '../types/Command';

const PAGES: { title: string; description: string; fields?: { name: string; value: string }[] }[] = [
  {
    title: 'Welcome to Jeeves AI',
    description:
      'Jeeves is your AI assistant powered by OpenRouter. Use `/ask` to chat with various AI models.\n\n' +
      'This guide will walk you through how everything works.',
    fields: [
      { name: 'Quick Start', value: '`/ask prompt:Hello!` - Ask Jeeves anything' },
      { name: 'Navigation', value: 'Use the buttons below to browse this guide.' },
    ],
  },
  {
    title: 'Free Models',
    description:
      'These models cost **0 credits** and are available to everyone:\n\n' +
      '• **Llama 3.3 70B** - Meta\'s flagship open model\n' +
      '• **Llama 3.2 3B** - Fast, lightweight\n' +
      '• **Gemini 2.0 Flash** - Google\'s latest\n' +
      '• **Gemma 3 27B** - Google\'s open model\n' +
      '• **Mistral Small 3.1** - Great for coding\n' +
      '• **Mistral 7B** - Fast and capable\n' +
      '• **Qwen 3 235B** - Alibaba\'s largest',
    fields: [
      { name: 'Usage', value: '`/ask prompt:... model:Llama 3.3 70B (free)`' },
    ],
  },
  {
    title: 'Paid Models',
    description:
      'Premium models require **credits**. They offer higher quality responses:\n\n' +
      '• **GPT-4o Mini** (~3 credits/ask) - OpenAI\'s efficient model\n' +
      '• **GPT-4o** (~45 credits/ask) - OpenAI\'s flagship\n' +
      '• **Claude 3 Haiku** (~6 credits/ask) - Fast Anthropic model\n' +
      '• **Claude 3.5 Sonnet** (~130 credits/ask) - Best for complex tasks\n' +
      '• **DeepSeek V3** (~5 credits/ask) - Great value',
    fields: [
      { name: 'Note', value: 'Credit costs vary based on response length.' },
    ],
  },
  {
    title: 'Credit System',
    description:
      'Credits are the currency for paid AI models.\n\n' +
      '**How it works:**\n' +
      '• 1 credit ≈ $0.0001 (10,000 credits = $1)\n' +
      '• Credits are deducted after each response\n' +
      '• Cost depends on tokens used (input + output)\n' +
      '• Free models always cost 0 credits',
    fields: [
      { name: 'Check Balance', value: '`/credits check`' },
      { name: 'Response Format', value: '`model · -3 credits · 47 remaining · 156 tokens`' },
    ],
  },
  {
    title: 'Getting Credits',
    description:
      'Credits are managed by server administrators.\n\n' +
      '**For Users:**\n' +
      'Ask an admin to give you credits using `/credits give`.\n\n' +
      '**For Admins:**\n' +
      '• `/credits give @user 100` - Give credits\n' +
      '• `/credits set @user 500` - Set balance\n' +
      '• `/credits check @user` - View balance',
  },
  {
    title: 'Command Options',
    description: 'The `/ask` command has several options:',
    fields: [
      { name: 'prompt (required)', value: 'Your question or message to the AI' },
      { name: 'model (optional)', value: 'Choose a specific AI model from the list' },
      { name: 'private (optional)', value: 'Set to `True` to make the response only visible to you' },
    ],
  },
  {
    title: 'Tips & Best Practices',
    description:
      '**Get better responses:**\n' +
      '• Be specific in your questions\n' +
      '• Provide context when needed\n' +
      '• Use free models for simple tasks\n' +
      '• Save premium models for complex problems\n\n' +
      '**Save credits:**\n' +
      '• Start with free models\n' +
      '• Keep prompts concise\n' +
      '• Use GPT-4o Mini instead of GPT-4o for most tasks',
  },
];

const command: Command = {
  data: new SlashCommandBuilder()
    .setName('guide')
    .setDescription('Learn how to use Jeeves AI and the credit system')
    .setDMPermission(false),
  async execute(interaction) {
    let currentPage = 0;

    const buildEmbed = (page: number) => {
      const pageData = PAGES[page];
      const embed = new EmbedBuilder()
        .setTitle(pageData.title)
        .setDescription(pageData.description)
        .setColor(0x5865f2)
        .setFooter({ text: `Page ${page + 1} of ${PAGES.length}` });

      if (pageData.fields) {
        embed.addFields(pageData.fields);
      }

      return embed;
    };

    const buildButtons = (page: number) => {
      return new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
          .setCustomId('guide_first')
          .setLabel('⏮')
          .setStyle(ButtonStyle.Secondary)
          .setDisabled(page === 0),
        new ButtonBuilder()
          .setCustomId('guide_prev')
          .setLabel('◀ Previous')
          .setStyle(ButtonStyle.Primary)
          .setDisabled(page === 0),
        new ButtonBuilder()
          .setCustomId('guide_next')
          .setLabel('Next ▶')
          .setStyle(ButtonStyle.Primary)
          .setDisabled(page === PAGES.length - 1),
        new ButtonBuilder()
          .setCustomId('guide_last')
          .setLabel('⏭')
          .setStyle(ButtonStyle.Secondary)
          .setDisabled(page === PAGES.length - 1),
      );
    };

    const response = await interaction.reply({
      embeds: [buildEmbed(currentPage)],
      components: [buildButtons(currentPage)],
      ephemeral: true,
    });

    const collector = response.createMessageComponentCollector({
      componentType: ComponentType.Button,
      time: 300000, // 5 minutes
    });

    collector.on('collect', async (i) => {
      if (i.user.id !== interaction.user.id) {
        await i.reply({ content: 'This guide is not for you.', ephemeral: true });
        return;
      }

      switch (i.customId) {
        case 'guide_first':
          currentPage = 0;
          break;
        case 'guide_prev':
          currentPage = Math.max(0, currentPage - 1);
          break;
        case 'guide_next':
          currentPage = Math.min(PAGES.length - 1, currentPage + 1);
          break;
        case 'guide_last':
          currentPage = PAGES.length - 1;
          break;
      }

      await i.update({
        embeds: [buildEmbed(currentPage)],
        components: [buildButtons(currentPage)],
      });
    });

    collector.on('end', async () => {
      try {
        await interaction.editReply({ components: [] });
      } catch {
        // Message may have been deleted
      }
    });
  },
};

export default command;
