import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  MessageFlags,
  SlashCommandBuilder,
  StringSelectMenuBuilder,
} from 'discord.js';
import { Command } from '../types/Command';
import { getStripe, PRICING_TIERS, PricingTier } from '../lib/stripe';
import { getCredits } from '../lib/creditStore';
import { getSubscription } from '../lib/subscriptionStore';
import config from '../config';

function formatPrice(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

function formatTier(tier: PricingTier, anchorPricePerCredit: number): string {
  const badge =
    tier.badge === 'popular'
      ? ' **[MOST POPULAR]**'
      : tier.badge === 'best-value'
        ? ' **[BEST VALUE]**'
        : '';

  const bonus =
    tier.bonusCredits > 0
      ? ` (+${tier.bonusCredits.toLocaleString()} bonus!)`
      : '';

  const pricePerCredit = tier.priceUsd / tier.totalMonthlyCredits;
  const savings = Math.round((1 - pricePerCredit / anchorPricePerCredit) * 100);
  const savingsText = savings > 0 ? ` | Save ${savings}%` : '';

  return (
    `**${tier.name}**${badge}\n` +
    `${tier.totalMonthlyCredits.toLocaleString()} credits/month${bonus}\n` +
    `${formatPrice(tier.priceUsd)}/mo${savingsText}`
  );
}

async function createCheckoutSession(
  tier: PricingTier,
  guildId: string,
  userId: string,
): Promise<string> {
  const stripe = getStripe();

  const session = await stripe.checkout.sessions.create({
    payment_method_types: ['card'],
    line_items: [
      {
        price_data: {
          currency: 'usd',
          product_data: {
            name: `${tier.name} Subscription`,
            description: `${tier.totalMonthlyCredits.toLocaleString()} AI credits per month`,
          },
          unit_amount: tier.priceUsd,
          recurring: {
            interval: 'month',
          },
        },
        quantity: 1,
      },
    ],
    mode: 'subscription',
    success_url: 'https://discord.com/channels/@me',
    cancel_url: 'https://discord.com/channels/@me',
    metadata: {
      guildId,
      userId,
      tierId: tier.id,
    },
    subscription_data: {
      metadata: {
        guildId,
        userId,
        tierId: tier.id,
      },
    },
    expires_at: Math.floor(Date.now() / 1000) + 30 * 60, // 30 minutes
  });

  return session.url!;
}

const TIER_CHOICES = PRICING_TIERS.map((tier) => ({
  name: `${tier.name} - ${tier.totalMonthlyCredits.toLocaleString()} credits/mo - ${formatPrice(tier.priceUsd)}/mo`,
  value: tier.id,
}));

const command: Command = {
  data: new SlashCommandBuilder()
    .setName('buy')
    .setDescription('Subscribe to get monthly AI credits')
    .setDMPermission(false)
    .addStringOption((option) =>
      option
        .setName('plan')
        .setDescription('Subscription plan')
        .setRequired(false)
        .addChoices(...TIER_CHOICES),
    ),
  async execute(interaction) {
    if (!interaction.guild) {
      await interaction.reply({
        content: 'This command can only be used in a server.',
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    if (!config.stripe.secretKey) {
      await interaction.reply({
        content:
          'Subscriptions are not configured. Contact an administrator.',
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    const selectedTierId = interaction.options.getString('plan');
    const guildId = interaction.guild.id;
    const userId = interaction.user.id;
    const currentBalance = await getCredits(guildId, userId);
    const currentSub = await getSubscription(guildId, userId);

    // Anchor price per credit (from starter tier)
    const anchorPricePerCredit =
      PRICING_TIERS[0].priceUsd / PRICING_TIERS[0].totalMonthlyCredits;

    // If no plan selected, show overview with all tiers
    if (!selectedTierId) {
      const subStatus = currentSub?.status === 'active'
        ? `\nCurrent plan: **${PRICING_TIERS.find(t => t.id === currentSub.tierId)?.name ?? 'Unknown'}**`
        : '';

      const embed = new EmbedBuilder()
        .setTitle('Subscribe for Monthly Credits')
        .setDescription(
          `Current balance: **${currentBalance.toLocaleString()}** credits${subStatus}\n\n` +
            'Select a plan below to subscribe. Credits refresh monthly and can be used for:\n' +
            '- `/ask` - AI chat with premium models\n' +
            '- `/image` - AI image generation\n\n' +
            '**Available Plans:**\n\n' +
            PRICING_TIERS.map((t) => formatTier(t, anchorPricePerCredit)).join(
              '\n\n',
            ),
        )
        .setColor(0x5865f2)
        .setFooter({ text: 'Cancel anytime • Payments via Stripe' });

      const selectMenu = new StringSelectMenuBuilder()
        .setCustomId('buy_select')
        .setPlaceholder('Select a plan...')
        .addOptions(
          PRICING_TIERS.map((tier) => ({
            label: `${tier.name} - ${formatPrice(tier.priceUsd)}/mo`,
            description: `${tier.totalMonthlyCredits.toLocaleString()} credits/month${tier.bonusCredits ? ` (incl. ${tier.bonusCredits.toLocaleString()} bonus)` : ''}`,
            value: tier.id,
            emoji:
              tier.badge === 'popular'
                ? '⭐'
                : tier.badge === 'best-value'
                  ? '💎'
                  : undefined,
          })),
        );

      const row =
        new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
          selectMenu,
        );

      await interaction.reply({
        embeds: [embed],
        components: [row],
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    // Plan was selected directly - create checkout session
    const tier = PRICING_TIERS.find((t) => t.id === selectedTierId);
    if (!tier) {
      await interaction.reply({
        content: 'Invalid plan selected.',
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    try {
      const checkoutUrl = await createCheckoutSession(tier, guildId, userId);

      const embed = new EmbedBuilder()
        .setTitle(`Subscribe to ${tier.name}`)
        .setDescription(
          `**${tier.totalMonthlyCredits.toLocaleString()}** credits/month for **${formatPrice(tier.priceUsd)}/mo**\n\n` +
            'Click the button below to complete your subscription.\n' +
            'The link expires in 30 minutes.',
        )
        .setColor(0x5865f2);

      const button = new ButtonBuilder()
        .setLabel('Subscribe Now')
        .setStyle(ButtonStyle.Link)
        .setURL(checkoutUrl);

      const row = new ActionRowBuilder<ButtonBuilder>().addComponents(button);

      await interaction.editReply({
        embeds: [embed],
        components: [row],
      });
    } catch (error) {
      console.error('Failed to create checkout session', error);
      await interaction.editReply({
        content: 'Failed to create checkout session. Please try again later.',
      });
    }
  },
};

export default command;
