import { UserProfile, PlanItemConfig, SpecialAccessStatus } from '../types';
import { SYSTEM_FEATURES, ALL_FEATURE_KEYS } from '../config/features';

/**
 * Computes the real-time status of a user's Special Access grant:
 * - 'none': User has no special access
 * - 'scheduled': Grant starts in a future date
 * - 'active': Currently within the active validity window (or lifetime)
 * - 'expired': End date has passed
 * - 'revoked': Manually revoked by an administrator
 * - 'cancelled': Cancelled before activation
 */
export function getSpecialAccessComputedStatus(
  user: UserProfile | null | undefined
): SpecialAccessStatus | 'none' {
  if (!user || !user.specialAccess || !user.specialAccess.enabled) {
    return 'none';
  }

  const sa = user.specialAccess;

  if (sa.status === 'revoked' || sa.status === 'cancelled') {
    return sa.status;
  }

  // Lifetime access has no expiration
  if (sa.accessType === 'lifetime' || !sa.expiresAt) {
    return 'active';
  }

  const now = Date.now();

  // Parse start of day (00:00:00) and end of day (23:59:59) in local time
  const startDateStr = sa.startsAt ? (sa.startsAt.includes('T') ? sa.startsAt : `${sa.startsAt}T00:00:00`) : '';
  const endDateStr = sa.expiresAt ? (sa.expiresAt.includes('T') ? sa.expiresAt : `${sa.expiresAt}T23:59:59`) : '';

  const start = startDateStr ? new Date(startDateStr).getTime() : 0;
  const end = endDateStr ? new Date(endDateStr).getTime() : NaN;

  if (isNaN(end)) return 'none';

  if (now < start) {
    return 'scheduled';
  }

  if (now > end) {
    return 'expired';
  }

  return 'active';
}

/**
 * Returns remaining days of Special Access or 'lifetime'
 */
export function getSpecialAccessDaysRemaining(
  user: UserProfile | null | undefined
): number | 'lifetime' | 0 {
  if (!user || !user.specialAccess || !user.specialAccess.enabled) return 0;
  const sa = user.specialAccess;

  if (sa.status === 'revoked' || sa.status === 'cancelled') return 0;
  if (sa.accessType === 'lifetime' || !sa.expiresAt) return 'lifetime';

  const endDateStr = sa.expiresAt.includes('T') ? sa.expiresAt : `${sa.expiresAt}T23:59:59`;
  const end = new Date(endDateStr).getTime();
  if (isNaN(end)) return 0;

  const diffMs = end - Date.now();
  if (diffMs <= 0) return 0;

  return Math.ceil(diffMs / (1000 * 60 * 60 * 24));
}

/**
 * Checks if the user has an active Special Access grant and optionally if a specific feature key is unlocked.
 * Special Access acts as an authoritative override that unlocks Premium capabilities,
 * completely independent of the commercial billing subscription.
 */
export function hasSpecialAccessActive(
  user: UserProfile | null | undefined,
  featureKey?: string
): boolean {
  if (!user) return false;
  const status = getSpecialAccessComputedStatus(user);
  if (status !== 'active') return false;

  // If specific featureKey is requested, verify if grantedFeatures allows it
  if (featureKey && user.specialAccess?.grantedFeatures && user.specialAccess.grantedFeatures.length > 0) {
    const gf = user.specialAccess.grantedFeatures;
    if (gf.includes('ALL_FEATURES') || gf.includes(featureKey)) {
      return true;
    }
    return false;
  }

  return true;
}

/**
 * Universally checks if a user has access to a specific feature key based on:
 * 1. Super Admin / Owner privilege
 * 2. Active Special Access grant
 * 3. Commercial Subscription Plan (if active and unexpired)
 * 4. Default Free Plan access
 */
export function checkFeatureAccess(
  user: UserProfile | null | undefined,
  featureKey: string,
  plansConfig?: PlanItemConfig[]
): boolean {
  if (!user) return false;

  // 1. Super Admin or Owner always has 100% unrestricted access
  if (
    user.role === 'super_admin' ||
    user.email?.toLowerCase() === 'alexandre1604981@gmail.com'
  ) {
    return true;
  }

  // 2. Blocked users have 0 access
  if (user.status === 'blocked' || user.subscriptionStatus === 'suspended') {
    return false;
  }

  // 3. Special Exclusive Access: Unlocks Premium features while active
  if (hasSpecialAccessActive(user, featureKey)) {
    return true;
  }

  const userPlanId = user.subscriptionPlan;
  const isSubscriptionActive =
    user.subscriptionStatus === 'active' ||
    user.subscriptionStatus === 'trial' ||
    user.status === 'active';

  // If user has a paid commercial plan, verify validity date
  if (userPlanId && userPlanId !== 'free' && isSubscriptionActive) {
    if (user.subscriptionExpiresAt) {
      const expiry = new Date(user.subscriptionExpiresAt).getTime();
      if (!isNaN(expiry) && expiry <= Date.now()) {
        // Paid plan expired -> fallback smoothly to Free plan privileges
        const targetFeature = SYSTEM_FEATURES.find((f) => f.key === featureKey);
        return Boolean(targetFeature?.defaultFree);
      }
    }

    // Find plan configuration from billing config or local defaults
    const activePlans = plansConfig || [];
    const matchedPlan = activePlans.find(
      (p) => p.id === userPlanId || (userPlanId === 'pro_mensal' && p.id === 'pro')
    );

    if (matchedPlan) {
      if (matchedPlan.allFeaturesAccess) {
        return true;
      }
      if (Array.isArray(matchedPlan.allowedFeatureKeys) && matchedPlan.allowedFeatureKeys.length > 0) {
        return matchedPlan.allowedFeatureKeys.includes(featureKey);
      }
    }

    // Default active Pro subscription unlocks all features
    return true;
  }

  // 4. Free Plan: check if feature is defaultFree
  const targetFeature = SYSTEM_FEATURES.find((f) => f.key === featureKey);
  return Boolean(targetFeature?.defaultFree);
}

/**
 * Returns the maximum allowed concurrent PDF maps for the user
 */
export function getUserMaxPdfMaps(
  user: UserProfile | null | undefined,
  plansConfig?: PlanItemConfig[]
): number {
  if (!user) return 2;
  if (
    user.role === 'super_admin' ||
    user.email?.toLowerCase() === 'alexandre1604981@gmail.com' ||
    hasSpecialAccessActive(user, 'pdf_maps_unlimited')
  ) {
    return 99999;
  }
  if (checkFeatureAccess(user, 'pdf_maps_unlimited', plansConfig)) {
    return 99999;
  }
  return 2;
}
