import { doc, getDoc, setDoc, onSnapshot } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { SystemBillingConfig, PlanItemConfig, UserProfile, PromoCoupon } from '../types';
import { DEFAULT_PLANS } from '../types';
import { SYSTEM_FEATURES } from '../config/features';
import { sanitizeFirestorePayload } from '../utils/firestoreSanitizer';

const BILLING_CONFIG_DOC = 'system_config';
const BILLING_CONFIG_ID = 'billing';
const STORAGE_KEY_BILLING = 'gofield_billing_config';
const STORAGE_KEY_PLANS = 'gofield_custom_plans';

export const DEFAULT_BILLING_CONFIG: SystemBillingConfig = {
  pixKey: '',
  pixKeyType: 'cnpj',
  beneficiaryName: 'GoField Pro Solucoes',
  bankName: '',
  defaultTrialDays: 14,
  whatsappSupportNumber: '5511999999999',
  customMessageTemplate: 'Olá {nome}, sua assinatura GoField Pro está disponível.',
  plans: DEFAULT_PLANS,
  proOriginalPrice: 149.0,
  proLaunchPrice: 97.0,
  proDiscountBadge: '35% OFF',
  asaasEnvironment: 'production',
};

/**
 * Normalizes an array of plans to guarantee all essential fields are present
 */
export function normalizePlans(plans?: PlanItemConfig[]): PlanItemConfig[] {
  if (!plans || !Array.isArray(plans) || plans.length === 0) {
    return DEFAULT_PLANS;
  }
  return plans.map((p, idx) => ({
    id: p.id || `plan_${idx}`,
    name: p.name || 'Plano Profissional',
    tag: p.tag || 'Individual',
    originalPrice: Number(p.originalPrice) || Number(p.price) || 0,
    price: Number(p.price) || 0,
    discountBadge: p.discountBadge || '',
    billingPeriod: p.billingPeriod || '/mês',
    features: Array.isArray(p.features) && p.features.length > 0 ? p.features : ['Acesso aos Mapas e GPS'],
    highlight: Boolean(p.highlight),
    activeInShowcase: p.activeInShowcase !== false && (p as any).activeInShowcase !== 'false',
    allowedFeatureKeys: Array.isArray(p.allowedFeatureKeys) ? p.allowedFeatureKeys : [],
    allFeaturesAccess: p.allFeaturesAccess !== false,
  }));
}

/**
 * Returns only plans that are active for client showcase
 */
export function getActiveShowcasePlans(plans?: PlanItemConfig[]): PlanItemConfig[] {
  const normalized = normalizePlans(plans);
  const active = normalized.filter((p) => p.activeInShowcase !== false);
  return active.length > 0 ? active : [normalized[0]];
}

/**
 * Subscribes to real-time updates of the System Billing & Plans Configuration
 */
export function subscribeToBillingConfig(
  callback: (config: SystemBillingConfig) => void,
  onError?: (err: Error) => void
): () => void {
  const docRef = doc(db, BILLING_CONFIG_DOC, BILLING_CONFIG_ID);

  return onSnapshot(
    docRef,
    (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.data() as SystemBillingConfig;
        const normalizedPlans = normalizePlans(data.plans);
        const fullConfig: SystemBillingConfig = {
          ...DEFAULT_BILLING_CONFIG,
          ...data,
          plans: normalizedPlans,
        };
        try {
          localStorage.setItem(STORAGE_KEY_BILLING, JSON.stringify(fullConfig));
          localStorage.setItem(STORAGE_KEY_PLANS, JSON.stringify(normalizedPlans));
        } catch {}
        callback(fullConfig);
      } else {
        const initial = { ...DEFAULT_BILLING_CONFIG, plans: DEFAULT_PLANS };
        setDoc(docRef, initial, { merge: true }).catch(() => {});
        callback(initial);
      }
    },
    (err) => {
      console.warn('SubscriptionService real-time listener notice:', err);
      if (onError) onError(err);
    }
  );
}

/**
 * Retrieves billing config from Firestore or local cache
 */
export async function getBillingConfig(): Promise<SystemBillingConfig> {
  try {
    const docRef = doc(db, BILLING_CONFIG_DOC, BILLING_CONFIG_ID);
    const snap = await getDoc(docRef);
    if (snap.exists()) {
      const data = snap.data() as SystemBillingConfig;
      const normalizedPlans = normalizePlans(data.plans);
      const fullConfig: SystemBillingConfig = {
        ...DEFAULT_BILLING_CONFIG,
        ...data,
        plans: normalizedPlans,
      };
      return fullConfig;
    }
  } catch (e) {
    console.warn('SubscriptionService getBillingConfig error, fallback to cache:', e);
  }

  try {
    const local = localStorage.getItem(STORAGE_KEY_BILLING);
    if (local) return JSON.parse(local);
  } catch {}

  return DEFAULT_BILLING_CONFIG;
}

/**
 * Saves billing config and updates Firestore & local cache
 */
export async function saveBillingConfig(config: SystemBillingConfig): Promise<void> {
  const normalizedPlans = normalizePlans(config.plans);
  const updated: SystemBillingConfig = {
    ...config,
    plans: normalizedPlans,
  };

  const cleanDoc = sanitizeFirestorePayload(updated);
  const docRef = doc(db, BILLING_CONFIG_DOC, BILLING_CONFIG_ID);
  await setDoc(docRef, cleanDoc, { merge: true });

  try {
    localStorage.setItem(STORAGE_KEY_BILLING, JSON.stringify(updated));
    localStorage.setItem(STORAGE_KEY_PLANS, JSON.stringify(normalizedPlans));
  } catch {}
}

/**
 * Adds or updates a plan in Firestore
 */
export async function savePlanToConfig(
  plan: PlanItemConfig,
  currentConfig: SystemBillingConfig
): Promise<SystemBillingConfig> {
  const currentPlans = normalizePlans(currentConfig.plans);
  const existingIdx = currentPlans.findIndex((p) => p.id === plan.id);

  let updatedPlans: PlanItemConfig[];
  if (existingIdx >= 0) {
    updatedPlans = currentPlans.map((p) => (p.id === plan.id ? { ...p, ...plan } : p));
  } else {
    updatedPlans = [...currentPlans, plan];
  }

  const updatedConfig: SystemBillingConfig = {
    ...currentConfig,
    plans: updatedPlans,
  };

  await saveBillingConfig(updatedConfig);
  return updatedConfig;
}

/**
 * Toggles showcase visibility of a plan with immediate Firestore write
 */
export async function togglePlanVisibility(
  planId: string,
  currentConfig: SystemBillingConfig
): Promise<SystemBillingConfig> {
  const currentPlans = normalizePlans(currentConfig.plans);
  const updatedPlans = currentPlans.map((p) => {
    if (p.id === planId) {
      const nextActive = p.activeInShowcase === false ? true : false;
      return { ...p, activeInShowcase: nextActive };
    }
    return p;
  });

  const updatedConfig: SystemBillingConfig = {
    ...currentConfig,
    plans: updatedPlans,
  };

  await saveBillingConfig(updatedConfig);
  return updatedConfig;
}

/**
 * Deletes a plan from Firestore
 */
export async function deletePlanFromConfig(
  planId: string,
  currentConfig: SystemBillingConfig
): Promise<SystemBillingConfig> {
  const currentPlans = normalizePlans(currentConfig.plans);
  const updatedPlans = currentPlans.filter((p) => p.id !== planId);

  const updatedConfig: SystemBillingConfig = {
    ...currentConfig,
    plans: updatedPlans,
  };

  await saveBillingConfig(updatedConfig);
  return updatedConfig;
}

/**
 * Evaluates whether a user has access to a specific feature key based on:
 * 1. Super Admin / Owner privilege (100% unrestricted)
 * 2. Special Exclusive Access grant
 * 3. Commercial Subscription Plan (if active and unexpired)
 * 4. Default Free tier access
 */
export function checkUserFeatureAccess(
  user: UserProfile | null | undefined,
  featureKey: string,
  plans?: PlanItemConfig[]
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

  // 3. Special Access override
  if (user.specialAccess && user.specialAccess.enabled && user.specialAccess.status === 'active') {
    if (user.specialAccess.grantedFeatures && user.specialAccess.grantedFeatures.length > 0) {
      if (
        user.specialAccess.grantedFeatures.includes('ALL_FEATURES') ||
        user.specialAccess.grantedFeatures.includes(featureKey)
      ) {
        return true;
      }
      return false;
    }
    return true;
  }

  // 4. Commercial Subscription Plan
  const planId = user.subscriptionPlan;
  const isSubActive =
    user.subscriptionStatus === 'active' ||
    user.subscriptionStatus === 'trial' ||
    user.status === 'active';

  if (planId && planId !== 'free' && isSubActive) {
    if (user.subscriptionExpiresAt) {
      const exp = new Date(user.subscriptionExpiresAt).getTime();
      if (!isNaN(exp) && exp <= Date.now()) {
        const target = SYSTEM_FEATURES.find((f) => f.key === featureKey);
        return Boolean(target?.defaultFree);
      }
    }

    const availablePlans = normalizePlans(plans);
    const matched = availablePlans.find((p) => p.id === planId || (planId === 'pro_mensal' && p.id === 'pro'));
    if (matched) {
      if (matched.allFeaturesAccess) return true;
      if (Array.isArray(matched.allowedFeatureKeys) && matched.allowedFeatureKeys.length > 0) {
        return matched.allowedFeatureKeys.includes(featureKey);
      }
    }

    return true;
  }

  // 5. Default Free Tier
  const target = SYSTEM_FEATURES.find((f) => f.key === featureKey);
  return Boolean(target?.defaultFree);
}

/**
 * Returns the maximum allowed concurrent PDF maps for the user (Free: 2, Pro: 99999)
 */
export function getUserMaxPdfMapsLimit(
  user: UserProfile | null | undefined,
  plans?: PlanItemConfig[]
): number {
  if (!user) return 2;
  if (
    user.role === 'super_admin' ||
    user.email?.toLowerCase() === 'alexandre1604981@gmail.com'
  ) {
    return 99999;
  }
  if (checkUserFeatureAccess(user, 'pdf_maps_unlimited', plans)) {
    return 99999;
  }
  return 2;
}
