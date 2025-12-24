import { AttachmentBuilder, MessageFlags, SlashCommandBuilder } from 'discord.js';
import { Command } from '../types/Command';
import config from '../config';
import { generateImage, IMAGE_MODELS } from '../lib/fal';
import { getCredits, deductCredits } from '../lib/creditStore';

function getModelCredits(modelId: string): number {
  const modelInfo = IMAGE_MODELS.find((m) => m.id === modelId) ?? IMAGE_MODELS[0];
  return Math.ceil(modelInfo.credits * config.creditMargin);
}

const MAX_PROMPT_LENGTH = 500;

const MODEL_CHOICES = IMAGE_MODELS.map((m) => ({
  name: m.name,
  value: m.id,
}));

const command: Command = {
  data: new SlashCommandBuilder()
    .setName('image')
    .setDescription('Generate an image with AI (FAL)')
    .addStringOption((option) =>
      option
        .setName('prompt')
        .setDescription('Describe the image you want to generate')
        .setRequired(true)
        .setMaxLength(MAX_PROMPT_LENGTH),
    )
    .addStringOption((option) =>
      option
        .setName('model')
        .setDescription('AI model to use (default: FLUX.1 Schnell)')
        .setRequired(false)
        .addChoices(...MODEL_CHOICES),
    )
    .addBooleanOption((option) =>
      option
        .setName('private')
        .setDescription('Only show image to you (default: public)')
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
    const selectedModel = modelOverride ?? IMAGE_MODELS[0].id;

    if (!config.fal.apiKey) {
      await interaction.reply({
        content: 'FAL is not configured. Ask an admin to set FAL_API_KEY.',
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    // Check credits before generating
    const guildId = interaction.guild.id;
    const userId = interaction.user.id;
    const modelInfo = IMAGE_MODELS.find((m) => m.id === selectedModel) ?? IMAGE_MODELS[0];
    const requiredCredits = getModelCredits(selectedModel);

    const balance = await getCredits(guildId, userId);
    if (balance < requiredCredits) {
      await interaction.reply({
        content: `You need **${requiredCredits} credits** to generate an image with ${modelInfo.name}.\nYour balance: **${balance} credits**.\n\nAsk an admin for credits via \`/credits add\`.`,
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    await interaction.deferReply({ flags: isPrivate ? MessageFlags.Ephemeral : undefined });

    try {
      const result = await generateImage(prompt, {
        model: selectedModel,
      });

      const modelDisplay = IMAGE_MODELS.find((m) => m.id === result.model)?.name ?? result.model;

      const imageResponse = await fetch(result.url);
      if (!imageResponse.ok) {
        throw new Error('Failed to fetch generated image');
      }

      const imageBuffer = Buffer.from(await imageResponse.arrayBuffer());
      const attachment = new AttachmentBuilder(imageBuffer, { name: 'image.png' });

      // Deduct credits after successful generation
      const deduction = await deductCredits(guildId, userId, result.credits);

      await interaction.editReply({
        content: `**Prompt:** ${prompt}\n\n-# ${modelDisplay} | ${result.width}x${result.height} | seed: ${result.seed} | \`-${result.credits} credits\` · ${deduction.remaining} remaining`,
        files: [attachment],
      });
    } catch (error) {
      console.error('FAL image generation failed', error);
      const message = error instanceof Error ? error.message : 'Unknown error';
      await interaction.editReply(`Image generation failed: ${message}`);
    }
  },
};

export default command;
