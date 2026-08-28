import { UserProfile, PlanItemConfig } from '../types';
import { SYSTEM_FEATURES, ALL_FEATURE_KEYS } from '../config/features';

/**
 * Checks if the user has an active Special Access grant (Lifetime, Annual, or Custom within valid date range).
 * Special Access acts as an authoritative override that grants 100% feature access and unlimited limits,
 * completely independent of the user's commercial billing plan.
 */
export function hasSpecialAccessActive(user: UserProfile | null | undefined): boolean {
  if (!user || !user.specialAccess) return false;
  const sa = user.specialAccess;
  if (!sa.enabled || sa.status === 'revoked') return false;

  // Lifetime access has no expiration date
  if (sa.accessType === 'lifetime' || !sa.expiresAt) {
    return true;
  }

  const now = Date.now();
  const start = sa.startsAt ? new Date(sa.startsAt.includes('T') ? sa.startsAt : sa.startsAt + 'T00:00:00').getTime() : 0;
  const end = new Date(sa.expiresAt.includes('T') ? sa.expiresAt : sa.expiresAt + 'T23:59:59').getTime();

  return !isNaN(end) && now >= start && now <= end;
}

/**
 * Universally checks if a user has access to a specific feature key based on their subscription plan,
 * special access grants, permissions configuration, or role.
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

  // 3. Special Exclusive Access: 100% unrestricted access across all current and future features
  if (hasSpecialAccessActive(user)) {
    return true;
  }

  const userPlanId = user.subscriptionPlan;
  const isSubscriptionActive =
    user.subscriptionStatus === 'active' ||
    user.subscriptionStatus === 'trial' ||
    user.status === 'active';

  // If user has a paid plan, verify expiration date
  if (userPlanId && userPlanId !== 'free' && isSubscriptionActive) {
    if (user.subscriptionExpiresAt) {
      const expiry = new Date(user.subscriptionExpiresAt).getTime();
      if (!isNaN(expiry) && expiry <= Date.now()) {
        // Paid plan expired -> fallback smoothly to Free plan privileges!
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
      // If plan has allFeaturesAccess = true
      if (matchedPlan.allFeaturesAccess) {
        return true;
      }

      // If plan explicitly defines allowed features
      if (Array.isArray(matchedPlan.allowedFeatureKeys) && matchedPlan.allowedFeatureKeys.length > 0) {
        return matchedPlan.allowedFeatureKeys.includes(featureKey);
      }
    }

    // Default Pro active subscription (if not specifically restricted) unlocks all features
    return true;
  }

  // 3. Free Plan / Unsubscribed Users: check if feature is defaultFree
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
    hasSpecialAccessActive(user)
  ) {
    return 99999;
  }
  if (checkFeatureAccess(user, 'pdf_maps_unlimited', plansConfig)) {
    return 99999;
  }
  return 2;
}
