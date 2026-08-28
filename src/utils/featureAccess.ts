import { UserProfile, PlanItemConfig } from '../types';
import { SYSTEM_FEATURES, ALL_FEATURE_KEYS } from '../config/features';

/**
 * Universally checks if a user has access to a specific feature key based on their subscription plan,
 * permissions configuration, or role.
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

  const userPlanId = user.subscriptionPlan;
  const isSubscriptionActive =
    user.subscriptionStatus === 'active' ||
    user.subscriptionStatus === 'trial' ||
    user.status === 'active';

  // If user has a specific plan
  if (userPlanId && userPlanId !== 'free' && isSubscriptionActive) {
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
  if (user.role === 'super_admin' || user.email?.toLowerCase() === 'alexandre1604981@gmail.com') {
    return 99999;
  }
  if (checkFeatureAccess(user, 'pdf_maps_unlimited', plansConfig)) {
    return 99999;
  }
  return 2;
}
