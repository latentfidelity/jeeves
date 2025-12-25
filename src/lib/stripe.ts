import Stripe from 'stripe';
import config from '../config';

export type PricingTier = {
  id: string;
  name: string;
  priceUsd: number; // in cents per month
  monthlyCredits: number;
  bonusCredits: number;
  totalMonthlyCredits: number;
  badge?: 'popular' | 'best-value';
};

export const PRICING_TIERS: PricingTier[] = [
  {
    id: 'starter',
    name: 'Starter',
    priceUsd: 499,
    monthlyCredits: 5000,
    bonusCredits: 0,
    totalMonthlyCredits: 5000,
  },
  {
    id: 'popular',
    name: 'Popular',
    priceUsd: 999,
    monthlyCredits: 12000,
    bonusCredits: 3000,
    totalMonthlyCredits: 15000,
    badge: 'popular',
  },
  {
    id: 'pro',
    name: 'Pro',
    priceUsd: 2499,
    monthlyCredits: 35000,
    bonusCredits: 10000,
    totalMonthlyCredits: 45000,
    badge: 'best-value',
  },
  {
    id: 'ultimate',
    name: 'Ultimate',
    priceUsd: 4999,
    monthlyCredits: 80000,
    bonusCredits: 20000,
    totalMonthlyCredits: 100000,
  },
];

let stripeClient: Stripe | null = null;

export function getStripe(): Stripe {
  if (!stripeClient) {
    if (!config.stripe.secretKey) {
      throw new Error('STRIPE_SECRET_KEY is not configured');
    }
    stripeClient = new Stripe(config.stripe.secretKey);
  }
  return stripeClient;
}

export function getTierById(tierId: string): PricingTier | undefined {
  return PRICING_TIERS.find((t) => t.id === tierId);
}
