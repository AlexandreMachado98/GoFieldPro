import { UserProfile, PlanItemConfig } from '../types';
import { hasSpecialAccessActive } from './featureAccess';

/**
 * Centralized BRL Currency Formatter
 * Formats a numeric value into Brazilian Real (e.g. 44.99 -> "R$ 44,99")
 */
export function formatCurrencyBRL(value: number | undefined | null): string {
  if (value === undefined || value === null || isNaN(value)) {
    return 'R$ 0,00';
  }
  return `R$ ${value.toFixed(2).replace('.', ',')}`;
}

/**
 * Determines whether spontaneous commercial upgrade offers, banners, and prices
 * should be proactively displayed to a user.
 * 
 * Rules:
 * - Super Admin / Owner -> FALSE (Never show ads/offers)
 * - Active Special Access -> FALSE (Has unlocked VIP access, don't spam offers)
 * - Active Paid Subscriber -> FALSE (Already paying customer, keep UI clean)
 * - Free Plan or Expired/Overdue Subscriber -> TRUE (Show upgrade banner and prices)
 */
export function shouldShowCommercialOffers(user: UserProfile | null | undefined): boolean {
  if (!user) return true; // Unauthenticated or visitor

  // 1. Super Admin Owner
  const isSuperAdminOwner =
    user.role === 'super_admin' ||
    (user.email || '').toLowerCase() === 'alexandre1604981@gmail.com';
  if (isSuperAdminOwner) return false;

  // 2. Active Special Access Grant (VIP override)
  if (hasSpecialAccessActive(user)) return false;

  // 3. User with active paid subscription
  const plan = user.subscriptionPlan;
  const isPaidPlan = plan && plan !== 'free' && plan !== 'free_trial';
  const subStatus = user.subscriptionStatus;

  if (isPaidPlan && subStatus === 'active') {
    // Check expiration if present
    if (user.subscriptionExpiresAt) {
      const expiry = new Date(user.subscriptionExpiresAt.includes('T') ? user.subscriptionExpiresAt : `${user.subscriptionExpiresAt}T23:59:59`).getTime();
      if (!isNaN(expiry) && Date.now() <= expiry) {
        return false; // Still active and valid
      }
    } else {
      return false; // Active without explicit expiration
    }
  }

  // 4. Free User or Expired / Overdue Subscriber
  return true;
}

/**
 * Evaluates the effective price of a plan considering standard price and seasonal promotions.
 */
export function getPlanEffectivePrice(
  plan: PlanItemConfig,
  referenceDate: number = Date.now()
): {
  price: number;
  originalPrice: number;
  isPromotional: boolean;
  discountBadge?: string;
} {
  const basePrice = typeof plan.price === 'number' ? plan.price : 0;
  const baseOriginalPrice = typeof plan.originalPrice === 'number' && plan.originalPrice > 0 ? plan.originalPrice : basePrice;

  // Check seasonal promotion
  if (
    typeof plan.promoPrice === 'number' &&
    plan.promoPrice >= 0 &&
    plan.promoStartsAt &&
    plan.promoExpiresAt
  ) {
    const start = new Date(plan.promoStartsAt.includes('T') ? plan.promoStartsAt : `${plan.promoStartsAt}T00:00:00`).getTime();
    const end = new Date(plan.promoExpiresAt.includes('T') ? plan.promoExpiresAt : `${plan.promoExpiresAt}T23:59:59`).getTime();

    if (!isNaN(start) && !isNaN(end) && referenceDate >= start && referenceDate <= end) {
      return {
        price: plan.promoPrice,
        originalPrice: basePrice,
        isPromotional: true,
        discountBadge: plan.discountBadge || 'OFERTA ESPECIAL',
      };
    }
  }

  const hasDiscount = baseOriginalPrice > basePrice;
  return {
    price: basePrice,
    originalPrice: baseOriginalPrice,
    isPromotional: hasDiscount,
    discountBadge: plan.discountBadge,
  };
}
