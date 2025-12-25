import express, { Request, Response } from 'express';
import { Client } from 'discord.js';
import Stripe from 'stripe';
import config from '../config';
import { getStripe, getTierById } from './stripe';
import { addCredits } from './creditStore';
import {
  getSubscriptionByStripeId,
  upsertSubscription,
  updateSubscriptionStatus,
} from './subscriptionStore';

let server: ReturnType<typeof express.application.listen> | null = null;

export function initWebhookServer(client: Client): void {
  if (!config.stripe.secretKey || !config.stripe.webhookSecret) {
    console.log('Stripe not configured, skipping webhook server');
    return;
  }

  const app = express();

  // Stripe requires raw body for signature verification
  app.post(
    '/webhook/stripe',
    express.raw({ type: 'application/json' }),
    async (req: Request, res: Response) => {
      const stripe = getStripe();
      const sig = req.headers['stripe-signature'];

      if (!sig) {
        res.status(400).send('Missing stripe-signature header');
        return;
      }

      let event: Stripe.Event;

      try {
        event = stripe.webhooks.constructEvent(
          req.body,
          sig,
          config.stripe.webhookSecret!,
        );
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        console.error('Webhook signature verification failed:', message);
        res.status(400).send(`Webhook Error: ${message}`);
        return;
      }

      try {
        switch (event.type) {
          case 'checkout.session.completed': {
            const session = event.data.object as Stripe.Checkout.Session;
            if (session.mode === 'subscription') {
              await handleSubscriptionCreated(session, client);
            }
            break;
          }
          case 'invoice.paid': {
            const invoice = event.data.object as Stripe.Invoice;
            await handleInvoicePaid(invoice, client);
            break;
          }
          case 'customer.subscription.updated': {
            const subscription = event.data.object as Stripe.Subscription;
            await handleSubscriptionUpdated(subscription);
            break;
          }
          case 'customer.subscription.deleted': {
            const subscription = event.data.object as Stripe.Subscription;
            await handleSubscriptionDeleted(subscription, client);
            break;
          }
        }
      } catch (error) {
        console.error(`Error handling ${event.type}:`, error);
      }

      res.json({ received: true });
    },
  );

  // Health check endpoint
  app.get('/health', (_req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  server = app.listen(config.stripe.webhookPort, () => {
    console.log(
      `Stripe webhook server listening on port ${config.stripe.webhookPort}`,
    );
  });
}

async function handleSubscriptionCreated(
  session: Stripe.Checkout.Session,
  client: Client,
): Promise<void> {
  const { guildId, userId, tierId } = session.metadata || {};

  if (!guildId || !userId || !tierId) {
    console.error('Missing metadata in checkout session:', session.id);
    return;
  }

  const tier = getTierById(tierId);
  if (!tier) {
    console.error('Unknown tier:', tierId);
    return;
  }

  const subscriptionId =
    typeof session.subscription === 'string'
      ? session.subscription
      : session.subscription?.id;

  if (!subscriptionId) {
    console.error('No subscription ID in session:', session.id);
    return;
  }

  const customerId =
    typeof session.customer === 'string'
      ? session.customer
      : session.customer?.id;

  // Get subscription details from Stripe
  const stripe = getStripe();
  const subscriptionData = await stripe.subscriptions.retrieve(subscriptionId);
  const currentPeriodEnd = (subscriptionData as unknown as { current_period_end: number }).current_period_end;

  await upsertSubscription({
    stripeSubscriptionId: subscriptionId,
    stripeCustomerId: customerId || '',
    guildId,
    userId,
    tierId,
    status: 'active',
    currentPeriodEnd: new Date(currentPeriodEnd * 1000).toISOString(),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });

  console.log(
    `Subscription created: ${subscriptionId} for user ${userId} in guild ${guildId}`,
  );

  // DM user about successful subscription
  try {
    const user = await client.users.fetch(userId);
    await user.send({
      content:
        `Your **${tier.name}** subscription is now active!\n\n` +
        `You'll receive **${tier.totalMonthlyCredits.toLocaleString()}** credits each month.\n` +
        `Your first credits will be added when your first payment processes.\n\n` +
        `Thank you for subscribing!`,
    });
  } catch {
    console.log(`Could not DM user ${userId} about subscription`);
  }
}

async function handleInvoicePaid(
  invoice: Stripe.Invoice,
  client: Client,
): Promise<void> {
  // Get subscription ID from invoice (handle both string and object)
  const invoiceAny = invoice as unknown as { subscription?: string | { id: string } | null };
  const subscriptionId =
    typeof invoiceAny.subscription === 'string'
      ? invoiceAny.subscription
      : invoiceAny.subscription?.id;

  if (!subscriptionId) {
    return; // Not a subscription invoice
  }

  const sub = await getSubscriptionByStripeId(subscriptionId);
  if (!sub) {
    console.error('Subscription not found for invoice:', invoice.id);
    return;
  }

  const tier = getTierById(sub.tierId);
  if (!tier) {
    console.error('Unknown tier for subscription:', sub.tierId);
    return;
  }

  // Add monthly credits
  const newBalance = await addCredits(
    sub.guildId,
    sub.userId,
    tier.totalMonthlyCredits,
  );

  console.log(
    `Monthly credits added: ${tier.totalMonthlyCredits} to user ${sub.userId} in guild ${sub.guildId}. New balance: ${newBalance}`,
  );

  // DM user about credit renewal
  try {
    const user = await client.users.fetch(sub.userId);
    await user.send({
      content:
        `Your monthly **${tier.name}** credits have been added!\n\n` +
        `+**${tier.totalMonthlyCredits.toLocaleString()}** credits\n` +
        `New balance: **${newBalance.toLocaleString()}** credits`,
    });
  } catch {
    console.log(`Could not DM user ${sub.userId} about credit renewal`);
  }
}

async function handleSubscriptionUpdated(
  subscription: Stripe.Subscription,
): Promise<void> {
  const subAny = subscription as unknown as { status: string; current_period_end: number; id: string };
  const status = subAny.status as 'active' | 'canceled' | 'past_due' | 'unpaid';
  const validStatuses = ['active', 'canceled', 'past_due', 'unpaid'];

  if (!validStatuses.includes(status)) {
    return;
  }

  await updateSubscriptionStatus(
    subAny.id,
    status,
    new Date(subAny.current_period_end * 1000).toISOString(),
  );

  console.log(`Subscription ${subAny.id} updated to status: ${status}`);
}

async function handleSubscriptionDeleted(
  subscription: Stripe.Subscription,
  client: Client,
): Promise<void> {
  const sub = await getSubscriptionByStripeId(subscription.id);
  if (!sub) {
    return;
  }

  await updateSubscriptionStatus(subscription.id, 'canceled');

  console.log(`Subscription canceled: ${subscription.id}`);

  // DM user about cancellation
  try {
    const user = await client.users.fetch(sub.userId);
    const tier = getTierById(sub.tierId);
    await user.send({
      content:
        `Your **${tier?.name ?? 'subscription'}** has been canceled.\n\n` +
        `Your remaining credits are still available to use.\n` +
        `You can resubscribe anytime with \`/buy\`.`,
    });
  } catch {
    console.log(`Could not DM user ${sub.userId} about cancellation`);
  }
}

export function stopWebhookServer(): void {
  if (server) {
    server.close();
    server = null;
  }
}
