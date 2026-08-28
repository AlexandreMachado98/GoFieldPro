import { formatCurrencyBRL } from '../../utils/commercialVisibility';
import React, { useEffect, useState, useCallback, useMemo } from 'react';
import {
  collection,
  onSnapshot,
  doc,
  updateDoc,
  deleteDoc,
  getDocs,
  setDoc,
  getDoc,
} from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { useAuth } from '../../context/AuthContext';
import { useApp } from '../../context/AppContext';
import {
  UserProfile,
  UserRole,
  UserStatus,
  SubscriptionPlanType,
  SubscriptionStatusType,
  PromoCoupon,
  SystemBillingConfig,
  PlanItemConfig,
  DEFAULT_PLANS,
  AdminAuditLog,
  SystemFeature,
} from '../../types';
import { SYSTEM_FEATURES, ALL_FEATURE_KEYS, FEATURE_CATEGORIES } from '../../config/features';
import { hasSpecialAccessActive, getSpecialAccessComputedStatus, getSpecialAccessDaysRemaining } from '../../utils/featureAccess';
import { SpecialAccessConfig, SpecialAccessStatus } from '../../types';
import { testAsaasConnection } from '../../utils/asaasGateway';
import { recordAdminAuditLog, fetchAdminAuditLogs } from '../../utils/auditLogger';
import { exportUsersToCsv, exportFinancialSummaryToCsv, exportAuditLogsToCsv } from '../../utils/adminExport';
import {
  Users,
  Shield,
  UserCog,
  Mail,
  Calendar,
  CheckCircle2,
  Clock,
  UserCheck,
  UserX,
  Trash2,
  Phone,
  Building2,
  Search,
  Check,
  RefreshCw,
  Sparkles,
  UserPlus,
  Plus,
  KeyRound,
  Key,
  X,
  DollarSign,
  TrendingUp,
  Send,
  Lock,
  Unlock,
  Tag,
  Gift,
  Settings,
  QrCode,
  AlertCircle,
  Edit3,
  Percent,
  Eye,
  EyeOff,
  Zap,
  Download,
  FileSpreadsheet,
  History,
  Activity,
  Copy,
  ArrowUp,
  ArrowDown,
  ToggleLeft,
  ToggleRight,
  AlertTriangle,
  Crown,
  ShieldCheck,
  ChevronDown,
  ChevronRight,
  ChevronUp,
} from 'lucide-react';

const DEFAULT_BILLING_CONFIG: SystemBillingConfig = {
  pixKey: '',
  pixKeyType: 'cnpj',
  beneficiaryName: '',
  bankName: '',
  defaultTrialDays: 14,
  whatsappSupportNumber: '5511999999999',
  customMessageTemplate:
    'Olá {nome} ({empresa}), tudo bem? Sua assinatura do GoField Pro no valor de R$ {valor} vence em {vencimento}. Segue nossa Chave Pix ({chave_tipo}) para renovação: {chave_pix} ({titular}). Qualquer dúvida estamos à disposição!',
  plans: DEFAULT_PLANS,
  maintenanceMode: false,
  maintenanceMessage: 'Estamos realizando uma manutenção preventiva para melhorar sua experiência. Voltamos em breve!',
  allowNewSignups: true,
  enableAiAssistant: true,
  enableGpsSimulation: true,
};

export const AdminPanel: React.FC = () => {
  const { profile } = useAuth();
  const { notifySuccess, notifyError, notifyInfo, notifyWarning, showConfirm } = useApp();

  // Navigation subtabs inside SuperAdmin
  const [adminTab, setAdminTab] = useState<
    'dashboard' | 'users' | 'special_access' | 'subscriptions' | 'plans' | 'coupons' | 'audit_and_settings'
  >('dashboard');

  // Users State
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filterStatus, setFilterStatus] = useState<
    'all' | 'pending' | 'active' | 'blocked' | 'special_access' | 'special_lifetime' | 'special_expiring'
  >('all');
  const [subscriptionFilter, setSubscriptionFilter] = useState<'all' | 'active' | 'trial' | 'overdue' | 'suspended'>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Billing & Plans Config State
  const [billingConfig, setBillingConfig] = useState<SystemBillingConfig>(() => {
    try {
      const saved = localStorage.getItem('gofield_billing_config');
      return saved ? JSON.parse(saved) : DEFAULT_BILLING_CONFIG;
    } catch {
      return DEFAULT_BILLING_CONFIG;
    }
  });

  const [plans, setPlans] = useState<PlanItemConfig[]>(() => {
    try {
      const saved = localStorage.getItem('gofield_custom_plans');
      return saved ? JSON.parse(saved) : DEFAULT_PLANS;
    } catch {
      return DEFAULT_PLANS;
    }
  });

  const [savingBilling, setSavingBilling] = useState(false);

      // Edit Plan Modal State
  const [editingPlan, setEditingPlan] = useState<PlanItemConfig | null>(null);
  const [isCreatingPlan, setIsCreatingPlan] = useState<boolean>(false);
  const [planModalName, setPlanModalName] = useState('');
  const [planModalTag, setPlanModalTag] = useState('');
  const [planModalOriginalPrice, setPlanModalOriginalPrice] = useState<number>(0);
  const [planModalPrice, setPlanModalPrice] = useState<number>(0);
  const [planModalBadge, setPlanModalBadge] = useState('');
  const [planModalPeriod, setPlanModalPeriod] = useState<string>('/mês');
  const [planModalFeaturesText, setPlanModalFeaturesText] = useState('');
  const [planModalActiveInShowcase, setPlanModalActiveInShowcase] = useState<boolean>(true);
  const [planModalHighlight, setPlanModalHighlight] = useState<boolean>(false);
  const [planModalPromoPrice, setPlanModalPromoPrice] = useState<string>('');
  const [planModalPromoStartsAt, setPlanModalPromoStartsAt] = useState<string>('');
  const [planModalPromoExpiresAt, setPlanModalPromoExpiresAt] = useState<string>('');
  const [savingPlanChanges, setSavingPlanChanges] = useState(false);

  // Plan Feature Entitlements State
  const [planModalAllFeatures, setPlanModalAllFeatures] = useState<boolean>(true);
  const [planModalAllowedKeys, setPlanModalAllowedKeys] = useState<string[]>(ALL_FEATURE_KEYS);
  const [planModalSearchFeature, setPlanModalSearchFeature] = useState<string>('');
  const [planModalExpandedCategories, setPlanModalExpandedCategories] = useState<Record<string, boolean>>({
    management: true,
    maps: true,
    safety: true,
    forestry: true,
    reports: true,
  });
  const [viewingPlanFeatures, setViewingPlanFeatures] = useState<PlanItemConfig | null>(null);

  // Feature Selection Helpers
  const handleToggleFeature = (key: string) => {
    setPlanModalAllowedKeys((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]
    );
  };

  const handleSelectAllFeatures = () => {
    setPlanModalAllowedKeys(ALL_FEATURE_KEYS);
  };

  const handleDeselectAllFeatures = () => {
    setPlanModalAllowedKeys([]);
  };

  const handleToggleCategory = (category: string) => {
    const catKeys = SYSTEM_FEATURES.filter((f) => f.category === category).map((f) => f.key);
    const allSelected = catKeys.every((k) => planModalAllowedKeys.includes(k));

    if (allSelected) {
      setPlanModalAllowedKeys((prev) => prev.filter((k) => !catKeys.includes(k)));
    } else {
      setPlanModalAllowedKeys((prev) => Array.from(new Set([...prev, ...catKeys])));
    }
  };

  const handleToggleAccordion = (category: string) => {
    setPlanModalExpandedCategories((prev) => ({
      ...prev,
      [category]: !prev[category],
    }));
  };

  // Promo Coupons State
  const [coupons, setCoupons] = useState<PromoCoupon[]>([]);
  const [isCouponModalOpen, setIsCouponModalOpen] = useState(false);
  const [newCouponCode, setNewCouponCode] = useState('');
  const [newCouponDiscountType, setNewCouponDiscountType] = useState<'percent' | 'fixed'>('percent');
  const [newCouponDiscount, setNewCouponDiscount] = useState<number>(20);
  const [newCouponMaxUses, setNewCouponMaxUses] = useState<number>(50);
  const [newCouponDays, setNewCouponDays] = useState<number>(30);
  const [newCouponApplicablePlan, setNewCouponApplicablePlan] = useState<string>('all');
  const [savingCoupon, setSavingCoupon] = useState(false);
  const [couponSearchQuery, setCouponSearchQuery] = useState('');
  const [couponStatusFilter, setCouponStatusFilter] = useState<'all' | 'active' | 'inactive' | 'expired'>('all');

  // Audit Logs State
  const [auditLogs, setAuditLogs] = useState<AdminAuditLog[]>([]);
  const [auditSearchQuery, setAuditSearchQuery] = useState('');
  const [isLoadingLogs, setIsLoadingLogs] = useState(false);

  // Block User Modal State
  const [blockingUser, setBlockingUser] = useState<UserProfile | null>(null);
  const [blockType, setBlockType] = useState<'overdue' | 'security' | 'requested' | 'deactivated'>('security');
  const [blockReason, setBlockReason] = useState('');
  const [savingBlock, setSavingBlock] = useState(false);

  // Edit Subscription Modal State
    // Special Access Modal State
  const [selectedActiveUserUid, setSelectedActiveUserUid] = useState<string>('');
  // Unified Grant Special Access Modal State
  const [isGrantSpecialModalOpen, setIsGrantSpecialModalOpen] = useState(false);
  const [grantModalClientMode, setGrantModalClientMode] = useState<'existing' | 'new'>('existing');
  const [grantSelectedUserUid, setGrantSelectedUserUid] = useState<string>('');
  const [grantSearchQuery, setGrantSearchQuery] = useState<string>('');
  const [grantFilterStatus, setGrantFilterStatus] = useState<'active' | 'all' | 'without_special'>('active');
  const [grantNewUserName, setGrantNewUserName] = useState('');
  const [grantNewUserEmail, setGrantNewUserEmail] = useState('');
  const [grantNewUserCompany, setGrantNewUserCompany] = useState('');
  const [grantNewUserPhone, setGrantNewUserPhone] = useState('');
  const [grantNewUserRole, setGrantNewUserRole] = useState<UserRole>('surveyor');
  const [grantNewUserPlan, setGrantNewUserPlan] = useState<SubscriptionPlanType>('free');
  const [grantNewUserSubValue, setGrantNewUserSubValue] = useState<number>(0);
  const [grantSaType, setGrantSaType] = useState<'annual' | 'custom' | 'lifetime'>('lifetime');
  const [grantSaStartsAt, setGrantSaStartsAt] = useState<string>(() => new Date().toISOString().split('T')[0]);
  const [grantSaExpiresAt, setGrantSaExpiresAt] = useState<string>(() => {
    const nextYear = new Date();
    nextYear.setFullYear(nextYear.getFullYear() + 1);
    return nextYear.toISOString().split('T')[0];
  });
  const [grantSaReason, setGrantSaReason] = useState<string>('Cliente Parceiro');
  const [savingGrantSpecial, setSavingGrantSpecial] = useState(false);
  const [grantConfirmationPending, setGrantConfirmationPending] = useState(false);
  const [grantAllFeatures, setGrantAllFeatures] = useState(true);

  // Dedicated Special Access Tab States
  const [saTabTargetUid, setSaTabTargetUid] = useState<string>('');
  const [saTabSearchQuery, setSaTabSearchQuery] = useState<string>('');
  const [saTabFilter, setSaTabFilter] = useState<'all' | 'lifetime' | 'annual' | 'custom' | 'revoked' | 'expiring'>('all');
  const [specialAccessUser, setSpecialAccessUser] = useState<UserProfile | null>(null);
  const [saEnabled, setSaEnabled] = useState<boolean>(true);
  const [saType, setSaType] = useState<'annual' | 'custom' | 'lifetime'>('annual');
  const [saStartsAt, setSaStartsAt] = useState<string>(() => new Date().toISOString().split('T')[0]);
  const [saExpiresAt, setSaExpiresAt] = useState<string>(() => {
    const nextYear = new Date();
    nextYear.setFullYear(nextYear.getFullYear() + 1);
    return nextYear.toISOString().split('T')[0];
  });
  const [saReason, setSaReason] = useState<string>('Cliente Parceiro');
  const [savingSpecialAccess, setSavingSpecialAccess] = useState<boolean>(false);

  const [editingUserSubscription, setEditingUserSubscription] = useState<UserProfile | null>(null);
  const [subModalPlan, setSubModalPlan] = useState<SubscriptionPlanType>('pro_mensal');
  const [subModalStatus, setSubModalStatus] = useState<SubscriptionStatusType>('active');
  const [subModalValue, setSubModalValue] = useState<number>(44.99);
  const [subModalExpiresAt, setSubModalExpiresAt] = useState<string>('');
  const [subModalNotes, setSubModalNotes] = useState<string>('');
  const [savingSubChanges, setSavingSubChanges] = useState(false);

  // Modal State for Adding users
  const [isAddUserModalOpen, setIsAddUserModalOpen] = useState(false);
  const [newUserName, setNewUserName] = useState('');
  const [newUserEmail, setNewUserEmail] = useState('');
  const [newUserCompany, setNewUserCompany] = useState('');
  const [newUserPhone, setNewUserPhone] = useState('');
  const [newUserRole, setNewUserRole] = useState<UserRole>('surveyor');
  const [newUserStatus, setNewUserStatus] = useState<UserStatus>('active');
  const [newUserPlan, setNewUserPlan] = useState<SubscriptionPlanType>('free');
  const [newUserSubValue, setNewUserSubValue] = useState<number>(0);
  const [newUserGrantSpecialAccess, setNewUserGrantSpecialAccess] = useState<boolean>(false);
  const [newUserSaType, setNewUserSaType] = useState<'annual' | 'custom' | 'lifetime'>('lifetime');
  const [newUserSaStartsAt, setNewUserSaStartsAt] = useState<string>(() => new Date().toISOString().split('T')[0]);
  const [newUserSaExpiresAt, setNewUserSaExpiresAt] = useState<string>(() => {
    const nextYear = new Date();
    nextYear.setFullYear(nextYear.getFullYear() + 1);
    return nextYear.toISOString().split('T')[0];
  });
  const [newUserSaReason, setNewUserSaReason] = useState<string>('Novo Cliente VIP');
  const [savingUser, setSavingUser] = useState(false);

  // Helper to parse snapshot with subscription defaults
  const parseUsersSnapshot = (snapshotDocs: any[]): UserProfile[] => {
    const usersData = snapshotDocs.map((docSnap) => {
      const data = typeof docSnap.data === 'function' ? docSnap.data() : docSnap;
      const isOwner = (data.email || '').toLowerCase() === 'alexandre1604981@gmail.com';

      let defaultExpires = data.subscriptionExpiresAt;
      if (!defaultExpires) {
        const createdDate = data.createdAt ? new Date(data.createdAt) : new Date();
        const expiry = new Date(createdDate);
        expiry.setDate(expiry.getDate() + 14);
        defaultExpires = expiry.toISOString().split('T')[0];
      }

      const rawStatus = data.subscriptionStatus || (isOwner ? 'active' : 'trial');
      const planVal = typeof data.subscriptionValue === 'number' ? data.subscriptionValue : isOwner ? 0 : 44.99;

      return {
        ...data,
        uid: docSnap.id || data.uid,
        email: data.email || '',
        name: data.name || data.email?.split('@')[0] || 'Usuário',
        role: isOwner ? 'super_admin' : (data.role as UserRole) || 'surveyor',
        status: isOwner ? 'active' : (data.status as UserStatus) || 'pending',
        company: data.company || '',
        companyCnpj: data.companyCnpj || '',
        phone: data.phone || '',
        requestedRole: data.requestedRole || data.role || 'surveyor',
        avatar:
          data.avatar ||
          `https://ui-avatars.com/api/?name=${encodeURIComponent(data.name || 'U')}&background=0284c7&color=fff`,
        createdAt: data.createdAt || new Date().toISOString(),
        approvedAt: data.approvedAt,
        approvedBy: data.approvedBy,
        subscriptionPlan: data.subscriptionPlan || (isOwner ? 'florestal_corporativo' : 'free_trial'),
        subscriptionStatus: isOwner ? 'active' : rawStatus,
        subscriptionExpiresAt: defaultExpires,
        subscriptionValue: planVal,
        paymentMethod: data.paymentMethod || 'pix',
        billingNotes: data.billingNotes || '',
        maxUsersAllowed: data.maxUsersAllowed || 5,
        lastPaymentDate: data.lastPaymentDate,
        blockReason: data.blockReason,
        blockType: data.blockType,
        blockedAt: data.blockedAt,
        blockedBy: data.blockedBy,
        specialAccess: data.specialAccess || undefined,
        hasChosenPlan: data.hasChosenPlan ?? false,
      } as UserProfile;
    });

    usersData.sort((a, b) => {
      if (a.status === 'pending' && b.status !== 'pending') return -1;
      if (a.status !== 'pending' && b.status === 'pending') return 1;
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });

    return usersData;
  };

  // Load Billing Config, Plans, Coupons, and Audit Logs
  useEffect(() => {
    if (profile?.role !== 'super_admin') return;

    const unsubBilling = onSnapshot(
      doc(db, 'system_config', 'billing'),
      (configDoc) => {
        if (configDoc.exists()) {
          const data = configDoc.data() as SystemBillingConfig;
          setBillingConfig((prev) => ({ ...prev, ...data }));
          localStorage.setItem('gofield_billing_config', JSON.stringify(data));
          if (data.plans && Array.isArray(data.plans) && data.plans.length > 0) {
            setPlans(data.plans);
            localStorage.setItem('gofield_custom_plans', JSON.stringify(data.plans));
          }
        }
      },
      (err) => console.warn('Real-time billing config listener notice:', err)
    );

    const unsubCoupons = onSnapshot(
      collection(db, 'coupons'),
      (snapshot) => {
        const list = snapshot.docs.map((d) => ({ id: d.id, ...d.data() } as PromoCoupon));
        setCoupons(list);
      },
      (err) => {
        console.warn('Could not subscribe to coupons collection', err);
      }
    );

    const loadLogs = async () => {
      setIsLoadingLogs(true);
      const logs = await fetchAdminAuditLogs();
      setAuditLogs(logs);
      setIsLoadingLogs(false);
    };

    
    
    loadLogs();
  }, [profile]);

  // Real-time synchronization of all registered users
  useEffect(() => {
    if (profile?.role !== 'super_admin') {
      setLoading(false);
      return;
    }

    const usersRef = collection(db, 'users');
    const unsubscribe = onSnapshot(
      usersRef,
      (snapshot) => {
        const usersData = parseUsersSnapshot(snapshot.docs);
        setUsers(usersData);
        setLoading(false);
      },
      (error) => {
        console.error('Error with real-time users listener:', error);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [profile]);

  // Manual Sync
  const manualSync = useCallback(async () => {
    setRefreshing(true);
    try {
      const usersRef = collection(db, 'users');
      const snapshot = await getDocs(usersRef);
      const list = parseUsersSnapshot(snapshot.docs);
      setUsers(list);
      const logs = await fetchAdminAuditLogs();
      setAuditLogs(logs);
      notifySuccess('Sincronização Concluída', `${list.length} usuário(s) sincronizados com o banco de dados.`);
    } catch (err: any) {
      console.error('Manual sync error:', err);
      notifyError('Erro de Sincronização', 'Não foi possível carregar a lista de usuários.');
    } finally {
      setRefreshing(false);
      setLoading(false);
    }
  }, [notifySuccess, notifyError]);

  // Save Billing Configuration & Feature Flags
  const handleSaveBillingConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingBilling(true);
    try {
      const proPlan = plans.find((p) => p.id === 'pro') || plans.find((p) => p.id !== 'free');
      const newConfig: SystemBillingConfig = {
        ...billingConfig,
        plans,
        proLaunchPrice: proPlan ? proPlan.price : billingConfig.proLaunchPrice,
        proOriginalPrice: proPlan ? proPlan.originalPrice : billingConfig.proOriginalPrice,
        proDiscountBadge: proPlan?.discountBadge || billingConfig.proDiscountBadge,
      };
      localStorage.setItem('gofield_billing_config', JSON.stringify(newConfig));
      localStorage.setItem('gofield_custom_plans', JSON.stringify(plans));

      try {
        await setDoc(doc(db, 'system_config', 'billing'), newConfig, { merge: true });
      } catch (cloudErr) {
        console.warn('Firestore write notice (saved locally):', cloudErr);
      }

      await recordAdminAuditLog({
        adminUid: profile?.uid || 'super_admin',
        adminEmail: profile?.email || 'admin@am-tst.com.br',
        adminName: profile?.name || 'Super Admin',
        action: 'UPDATE_BILLING_CONFIG',
        targetType: 'billing',
        targetId: 'system_config_billing',
        reason: 'Atualização de chave Pix, gateway Asaas e Feature Flags do sistema',
      });

      notifySuccess('Configurações Salvas!', 'Os dados de cobrança Pix, mensagens e Feature Flags foram atualizados.');
    } catch (err: any) {
      console.error('Error saving billing config:', err);
      notifyError('Erro ao Salvar', 'Não foi possível atualizar as configurações.');
    } finally {
      setSavingBilling(false);
    }
  };

  // Plan Showcase Toggle
  const handleTogglePlanShowcase = async (planId: string) => {
    const targetPlan = plans.find((p) => p.id === planId);
    const nextState = targetPlan?.activeInShowcase === false ? true : false;

    const updatedPlans = plans.map((p) => {
      if (p.id === planId) {
        return { ...p, activeInShowcase: nextState };
      }
      return p;
    });

    setPlans(updatedPlans);
    localStorage.setItem('gofield_custom_plans', JSON.stringify(updatedPlans));
    const updatedConfig = { ...billingConfig, plans: updatedPlans };
    setBillingConfig(updatedConfig);
    localStorage.setItem('gofield_billing_config', JSON.stringify(updatedConfig));

    try {
      await setDoc(doc(db, 'system_config', 'billing'), updatedConfig, { merge: true });
    } catch (err) {}

    await recordAdminAuditLog({
      adminUid: profile?.uid || 'super_admin',
      adminEmail: profile?.email || 'admin@am-tst.com.br',
      adminName: profile?.name || 'Super Admin',
      action: 'TOGGLE_PLAN_SHOWCASE',
      targetType: 'plan',
      targetId: planId,
      targetName: targetPlan?.name,
      previousValue: targetPlan?.activeInShowcase ?? true,
      newValue: nextState,
      reason: nextState ? 'Ativação do plano na vitrine pública' : 'Ocultação do plano da vitrine pública',
    });

    if (nextState) {
      notifySuccess('Plano Ativado na Vitrine!', `O plano "${targetPlan?.name}" agora está visível para todos os usuários.`);
    } else {
      notifyInfo('Plano Oculto da Vitrine', `O plano "${targetPlan?.name}" foi ocultado da vitrine pública.`);
    }
  };

  // Reorder Plans (Move Up / Down)
  const handleMovePlan = async (index: number, direction: 'up' | 'down') => {
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= plans.length) return;

    const newPlans = [...plans];
    const temp = newPlans[index];
    newPlans[index] = newPlans[targetIndex];
    newPlans[targetIndex] = temp;

    setPlans(newPlans);
    localStorage.setItem('gofield_custom_plans', JSON.stringify(newPlans));
    const updatedConfig = { ...billingConfig, plans: newPlans };
    setBillingConfig(updatedConfig);
    localStorage.setItem('gofield_billing_config', JSON.stringify(updatedConfig));

    try {
      await setDoc(doc(db, 'system_config', 'billing'), updatedConfig, { merge: true });
    } catch (err) {}

    notifySuccess('Ordem Atualizada', 'A ordem de exibição dos planos na vitrine foi salva.');
  };

  // Duplicate Plan in 1 Click
  const handleDuplicatePlan = async (plan: PlanItemConfig) => {
    const duplicatedPlan: PlanItemConfig = {
      ...plan,
      id: `plan_${Date.now()}`,
      name: `${plan.name} (Cópia)`,
      activeInShowcase: false,
    };

    const newPlans = [...plans, duplicatedPlan];
    setPlans(newPlans);
    localStorage.setItem('gofield_custom_plans', JSON.stringify(newPlans));
    const updatedConfig = { ...billingConfig, plans: newPlans };
    setBillingConfig(updatedConfig);
    localStorage.setItem('gofield_billing_config', JSON.stringify(updatedConfig));

    try {
      await setDoc(doc(db, 'system_config', 'billing'), updatedConfig, { merge: true });
    } catch (err) {}

    await recordAdminAuditLog({
      adminUid: profile?.uid || 'super_admin',
      adminEmail: profile?.email || 'admin@am-tst.com.br',
      adminName: profile?.name || 'Super Admin',
      action: 'DUPLICATE_PLAN',
      targetType: 'plan',
      targetId: duplicatedPlan.id,
      targetName: duplicatedPlan.name,
      reason: `Plano duplicado a partir de ${plan.name}`,
    });

    notifySuccess('Plano Duplicado!', `Criada cópia de "${plan.name}" (oculta por padrão).`);
  };

  // Save Plan Changes & Log Price Alteration
  const handleSavePlanChanges = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingPlan) return;

    setSavingPlanChanges(true);
    try {
      const updatedFeatures = planModalFeaturesText
        .split('\n')
        .map((f) => f.replace(/^[-*•]\s*/, '').trim())
        .filter((f) => f.length > 0);

      const cleanOrigPrice = Number(planModalOriginalPrice) || 0;
      const cleanPrice = Number(planModalPrice) || 0;
      const cleanPromoPrice = planModalPromoPrice.trim() !== '' ? Number(planModalPromoPrice) : undefined;
      const cleanPromoStartsAt = planModalPromoStartsAt.trim() || undefined;
      const cleanPromoExpiresAt = planModalPromoExpiresAt.trim() || undefined;

      const existingPlan = plans.find((p) => p.id === editingPlan.id);
      let updatedPlans: PlanItemConfig[];

      if (existingPlan) {
        updatedPlans = plans.map((p) => {
          if (p.id === editingPlan.id) {
            return {
              ...p,
              name: planModalName.trim() || p.name,
              tag: planModalTag.trim() || p.tag,
              originalPrice: cleanOrigPrice,
              price: cleanPrice,
              discountBadge: planModalBadge.trim(),
              billingPeriod: planModalPeriod || (cleanPrice === 0 ? '/sempre' : p.billingPeriod || '/mês'),
              highlight: planModalHighlight,
              activeInShowcase: planModalActiveInShowcase,
              features: updatedFeatures.length > 0 ? updatedFeatures : p.features,
              promoPrice: cleanPromoPrice,
              promoStartsAt: cleanPromoStartsAt,
              promoExpiresAt: cleanPromoExpiresAt,
              allFeaturesAccess: cleanPrice === 0 ? false : planModalAllFeatures,
              allowedFeatureKeys: planModalAllowedKeys,
            };
          }
          return p;
        });

        // Record Audit Log if price or features changed
        await recordAdminAuditLog({
          adminUid: profile?.uid || 'super_admin',
          adminEmail: profile?.email || 'admin@am-tst.com.br',
          adminName: profile?.name || 'Super Admin',
          action: 'SAVE_PLAN',
          targetType: 'plan',
          targetId: editingPlan.id,
          targetName: planModalName,
          previousValue: { price: existingPlan.price, originalPrice: existingPlan.originalPrice },
          newValue: { price: cleanPrice, originalPrice: cleanOrigPrice },
          reason: `Edição de valores e benefícios do plano ${planModalName}`,
        });
      } else {
        const newPlanItem: PlanItemConfig = {
          id: editingPlan.id,
          name: planModalName.trim() || 'Novo Plano',
          tag: planModalTag.trim() || 'Profissional',
          originalPrice: cleanOrigPrice,
          price: cleanPrice,
          discountBadge: planModalBadge.trim(),
          billingPeriod: planModalPeriod || '/mês',
          highlight: planModalHighlight,
          activeInShowcase: planModalActiveInShowcase,
          features: updatedFeatures.length > 0 ? updatedFeatures : ['Mapas PDF Ilimitados', 'Medição de Madeira (m³)'],
          promoPrice: cleanPromoPrice,
          promoStartsAt: cleanPromoStartsAt,
          promoExpiresAt: cleanPromoExpiresAt,
        };
        updatedPlans = [...plans, newPlanItem];

        await recordAdminAuditLog({
          adminUid: profile?.uid || 'super_admin',
          adminEmail: profile?.email || 'admin@am-tst.com.br',
          adminName: profile?.name || 'Super Admin',
          action: 'CREATE_PLAN',
          targetType: 'plan',
          targetId: newPlanItem.id,
          targetName: newPlanItem.name,
          newValue: newPlanItem,
          reason: `Criação do novo plano ${newPlanItem.name}`,
        });
      }

      setPlans(updatedPlans);
      localStorage.setItem('gofield_custom_plans', JSON.stringify(updatedPlans));
      
      const proPlan = updatedPlans.find((p) => p.id === 'pro') || updatedPlans.find((p) => p.id !== 'free');
      const updatedConfig: SystemBillingConfig = {
        ...billingConfig,
        plans: updatedPlans,
        proLaunchPrice: proPlan ? proPlan.price : billingConfig.proLaunchPrice,
        proOriginalPrice: proPlan ? proPlan.originalPrice : billingConfig.proOriginalPrice,
        proDiscountBadge: proPlan?.discountBadge || billingConfig.proDiscountBadge,
      };
      setBillingConfig(updatedConfig);
      localStorage.setItem('gofield_billing_config', JSON.stringify(updatedConfig));

      try {
        await setDoc(doc(db, 'system_config', 'billing'), updatedConfig, { merge: true });
      } catch (cloudErr) {}

      notifySuccess('Plano Salvo com Sucesso!', `O plano "${planModalName}" foi salvo.`);
      setEditingPlan(null);
    } catch (err: any) {
      notifyError('Erro ao Salvar Plano', err?.message || 'Falha ao salvar plano.');
    } finally {
      setSavingPlanChanges(false);
    }
  };

  // Secure User Block Handler with Reason & Audit Log
  const handleConfirmBlockUser = async () => {
    if (!blockingUser) return;
    if (!blockReason.trim()) {
      notifyError('Motivo Obrigatório', 'Por favor, informe a justificativa do bloqueio para o registro de auditoria.');
      return;
    }

    setSavingBlock(true);
    try {
      const userRef = doc(db, 'users', blockingUser.uid);
      const blockData = {
        status: 'blocked' as UserStatus,
        subscriptionStatus: 'suspended' as SubscriptionStatusType,
        blockReason: blockReason.trim(),
        blockType: blockType,
        blockedAt: new Date().toISOString(),
        blockedBy: profile?.email || 'Super Admin',
      };

      await updateDoc(userRef, blockData);

      setUsers((prev) =>
        prev.map((u) => (u.uid === blockingUser.uid ? { ...u, ...blockData } : u))
      );

      await recordAdminAuditLog({
        adminUid: profile?.uid || 'super_admin',
        adminEmail: profile?.email || 'admin@am-tst.com.br',
        adminName: profile?.name || 'Super Admin',
        action: 'BLOCK_USER',
        targetType: 'user',
        targetId: blockingUser.uid,
        targetName: blockingUser.name,
        newValue: blockData,
        reason: blockReason.trim(),
      });

      notifySuccess('Usuário Bloqueado com Sucesso', `O acesso de ${blockingUser.name} foi suspenso com registro em auditoria.`);
      setBlockingUser(null);
      setBlockReason('');
    } catch (err: any) {
      console.error('Error blocking user:', err);
      notifyError('Erro ao Bloquear', 'Não foi possível bloquear o usuário.');
    } finally {
      setSavingBlock(false);
    }
  };

  // Delete User Permanently
  const handleDeleteUser = async (userToDelete: UserProfile) => {
    if (userToDelete.email?.toLowerCase() === 'alexandre1604981@gmail.com') {
      notifyWarning('Ação Não Permitida', 'Não é possível excluir a conta do Super Administrador.');
      return;
    }

    showConfirm({
      title: 'Excluir Usuário Permanentemente?',
      message: `Tem certeza que deseja remover permanentemente o cadastro de ${userToDelete.name} (${userToDelete.email})? Esta ação não pode ser desfeita e todos os dados serão apagados.`,
      confirmText: 'Excluir Permanentemente',
      cancelText: 'Cancelar',
      type: 'danger',
      onConfirm: async () => {
        try {
          const userRef = doc(db, 'users', userToDelete.uid);
          await deleteDoc(userRef);
          setUsers((prev) => prev.filter((u) => u.uid !== userToDelete.uid));

          await recordAdminAuditLog({
            adminUid: profile?.uid || 'super_admin',
            adminEmail: profile?.email || 'admin@am-tst.com.br',
            adminName: profile?.name || 'Super Admin',
            action: 'DELETE_USER',
            targetType: 'user',
            targetId: userToDelete.uid,
            targetName: userToDelete.name,
            reason: `Exclusão permanente do usuário ${userToDelete.name} (${userToDelete.email})`,
          });

          notifySuccess('Usuário Excluído com Sucesso!', `O registro de ${userToDelete.name} foi removido.`);
        } catch (error) {
          console.error('Error deleting user:', error);
          notifyError('Erro ao Excluir', 'Não foi possível remover o registro do usuário.');
        }
      },
    });
  };

  // Delete All Pending Users in Batch
  const handleDeleteAllPendingUsers = async () => {
    const pendingList = users.filter((u) => u.status === 'pending');
    if (pendingList.length === 0) {
      notifyInfo('Nenhum Pendente', 'Não há usuários com cadastro pendente para excluir.');
      return;
    }

    showConfirm({
      title: 'Excluir Todos os Usuários Pendentes?',
      message: `Tem certeza que deseja remover permanentemente todos os ${pendingList.length} cadastros pendentes de uma só vez?`,
      confirmText: `Excluir ${pendingList.length} Pendentes`,
      cancelText: 'Cancelar',
      type: 'danger',
      onConfirm: async () => {
        try {
          await Promise.all(pendingList.map((u) => deleteDoc(doc(db, 'users', u.uid))));
          setUsers((prev) => prev.filter((u) => u.status !== 'pending'));

          await recordAdminAuditLog({
            adminUid: profile?.uid || 'super_admin',
            adminEmail: profile?.email || 'admin@am-tst.com.br',
            adminName: profile?.name || 'Super Admin',
            action: 'DELETE_PENDING_USERS',
            targetType: 'user',
            targetId: 'batch_pending',
            reason: `Exclusão em lote de ${pendingList.length} cadastros pendentes`,
          });

          notifySuccess('Pendentes Excluídos!', `${pendingList.length} usuário(s) pendente(s) foram excluídos com sucesso.`);
        } catch (error) {
          notifyError('Erro', 'Não foi possível excluir os cadastros pendentes.');
        }
      },
    });
  };

  // Approve Pending User
  const handleApproveUser = async (userToApprove: UserProfile) => {
    try {
      const userRef = doc(db, 'users', userToApprove.uid);
      await updateDoc(userRef, {
        status: 'active',
        approvedAt: new Date().toISOString(),
        approvedBy: profile?.name || 'Super Admin',
      });

      setUsers((prev) =>
        prev.map((u) => (u.uid === userToApprove.uid ? { ...u, status: 'active' } : u))
      );

      await recordAdminAuditLog({
        adminUid: profile?.uid || 'super_admin',
        adminEmail: profile?.email || 'admin@am-tst.com.br',
        adminName: profile?.name || 'Super Admin',
        action: 'APPROVE_USER',
        targetType: 'user',
        targetId: userToApprove.uid,
        targetName: userToApprove.name,
        reason: 'Aprovação manual de acesso ao aplicativo',
      });

      notifySuccess('Acesso Liberado!', `${userToApprove.name} agora está ativo no GoField Pro.`);
    } catch (err) {
      notifyError('Erro', 'Não foi possível aprovar o usuário.');
    }
  };

  // Unblock User Handler
  const handleUnblockUser = async (userToUnblock: UserProfile) => {
    showConfirm({
      title: 'Desbloquear Usuário?',
      message: `Deseja reativar o acesso de ${userToUnblock.name} (${userToUnblock.email})?`,
      confirmText: 'Desbloquear Acesso',
      cancelText: 'Cancelar',
      type: 'info',
      onConfirm: async () => {
        try {
          const userRef = doc(db, 'users', userToUnblock.uid);
          const unblockData = {
            status: 'active' as UserStatus,
            subscriptionStatus: 'active' as SubscriptionStatusType,
            blockReason: '',
            blockType: undefined,
          };

          await updateDoc(userRef, unblockData);

          setUsers((prev) =>
            prev.map((u) => (u.uid === userToUnblock.uid ? { ...u, ...unblockData } : u))
          );

          await recordAdminAuditLog({
            adminUid: profile?.uid || 'super_admin',
            adminEmail: profile?.email || 'admin@am-tst.com.br',
            adminName: profile?.name || 'Super Admin',
            action: 'UNBLOCK_USER',
            targetType: 'user',
            targetId: userToUnblock.uid,
            targetName: userToUnblock.name,
            reason: 'Reativação de conta de usuário',
          });

          notifySuccess('Acesso Reativado!', `${userToUnblock.name} está liberado para acessar o aplicativo.`);
        } catch (error) {
          notifyError('Erro ao Desbloquear', 'Não foi possível reativar o usuário.');
        }
      },
    });
  };

  // Extend 7 Days with Audit Log
  const handleExtend7Days = async (targetUser: UserProfile) => {
    try {
      const currentExpiry = targetUser.subscriptionExpiresAt ? new Date(targetUser.subscriptionExpiresAt) : new Date();
      const baseDate = currentExpiry.getTime() < Date.now() ? new Date() : currentExpiry;
      baseDate.setDate(baseDate.getDate() + 7);
      const newExpiryStr = baseDate.toISOString().split('T')[0];

      const userRef = doc(db, 'users', targetUser.uid);
      await updateDoc(userRef, {
        subscriptionExpiresAt: newExpiryStr,
        subscriptionStatus: 'active',
      });

      setUsers((prev) =>
        prev.map((u) => (u.uid === targetUser.uid ? { ...u, subscriptionExpiresAt: newExpiryStr, subscriptionStatus: 'active' } : u))
      );

      await recordAdminAuditLog({
        adminUid: profile?.uid || 'super_admin',
        adminEmail: profile?.email || 'admin@am-tst.com.br',
        adminName: profile?.name || 'Super Admin',
        action: 'EXTEND_SUBSCRIPTION',
        targetType: 'user',
        targetId: targetUser.uid,
        targetName: targetUser.name,
        previousValue: targetUser.subscriptionExpiresAt,
        newValue: newExpiryStr,
        reason: '+7 dias de cortesia concedidos pelo Super Admin',
      });

      notifySuccess('+7 Dias Concedidos!', `Assinatura de ${targetUser.name} prorrogada até ${baseDate.toLocaleDateString('pt-BR')}.`);
    } catch (err) {
      notifyError('Erro ao Prorrogar', 'Falha ao atualizar data.');
    }
  };

  // WhatsApp 1-Click Billing Message
  const handleSendWhatsAppBilling = (targetUser: UserProfile) => {
    if (!targetUser.phone) {
      notifyError('WhatsApp Indisponível', `O cliente ${targetUser.name} não possui telefone cadastrado.`);
      return;
    }

    const cleanPhone = targetUser.phone.replace(/\D/g, '');
    const phoneWithCountry = cleanPhone.startsWith('55') ? cleanPhone : `55${cleanPhone}`;
    const formattedExpiry = targetUser.subscriptionExpiresAt
      ? new Date(targetUser.subscriptionExpiresAt).toLocaleDateString('pt-BR')
      : 'hoje';

    const message = billingConfig.customMessageTemplate
      .replace('{nome}', targetUser.name || 'Cliente')
      .replace('{empresa}', targetUser.company || 'sua empresa')
      .replace('{valor}', (targetUser.subscriptionValue || 44.99).toFixed(2).replace('.', ','))
      .replace('{vencimento}', formattedExpiry)
      .replace('{chave_pix}', billingConfig.pixKey)
      .replace('{chave_tipo}', billingConfig.pixKeyType.toUpperCase())
      .replace('{titular}', billingConfig.beneficiaryName);

    const whatsappUrl = `https://wa.me/${phoneWithCountry}?text=${encodeURIComponent(message)}`;
    window.open(whatsappUrl, '_blank');
  };

    // Handler: Unified Grant Special Access with Confirmation & Security
  const handleInitiateGrantSpecialAccess = (e: React.FormEvent) => {
    e.preventDefault();

    if (grantModalClientMode === 'new') {
      if (!grantNewUserName.trim()) {
        notifyWarning('Nome Obrigatório', 'Informe o nome do novo cliente.');
        return;
      }
      if (!grantNewUserEmail.trim() || !grantNewUserEmail.includes('@') || !grantNewUserEmail.includes('.')) {
        notifyWarning('E-mail Inválido', 'Informe um e-mail válido para o novo cliente.');
        return;
      }
      const exists = users.some((u) => (u.email || '').toLowerCase() === grantNewUserEmail.trim().toLowerCase());
      if (exists) {
        notifyError('E-mail Já Cadastrado', `O e-mail "${grantNewUserEmail}" já está cadastrado no sistema.`);
        return;
      }
    } else {
      if (!grantSelectedUserUid) {
        notifyWarning('Selecione um Usuário', 'Por favor, escolha um usuário existente na lista.');
        return;
      }
    }

    if (grantSaType === 'custom' && grantSaExpiresAt && grantSaStartsAt && grantSaExpiresAt < grantSaStartsAt) {
      notifyWarning('Data Inválida', 'A data de término não pode ser anterior à data de início.');
      return;
    }

    // Open Confirmation Dialog
    setGrantConfirmationPending(true);
  };

  const handleConfirmAndSaveSpecialAccess = async () => {
    let targetUid = '';
    let targetName = '';
    let targetEmail = '';
    let targetCompany = '';
    let targetPhone = '';
    let targetPlan: SubscriptionPlanType = 'free';
    let targetSubValue = 0;
    let targetRole: UserRole = 'surveyor';
    const isCreatingNew = grantModalClientMode === 'new';

    if (isCreatingNew) {
      targetName = grantNewUserName.trim();
      targetEmail = grantNewUserEmail.trim().toLowerCase();
      targetCompany = grantNewUserCompany.trim() || 'Particular';
      targetPhone = grantNewUserPhone.trim();
      targetPlan = grantNewUserPlan;
      targetSubValue = Number(grantNewUserSubValue) || (grantNewUserPlan === 'free' ? 0 : 44.99);
      targetRole = grantNewUserRole;
      targetUid = `user_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    } else {
      const existingUser = users.find((u) => u.uid === grantSelectedUserUid);
      if (!existingUser) {
        notifyError('Usuário Não Encontrado', 'O usuário selecionado não foi localizado.');
        return;
      }
      targetUid = existingUser.uid;
      targetName = existingUser.name;
      targetEmail = existingUser.email;
      targetCompany = existingUser.company || '';
      targetPhone = existingUser.phone || '';
      targetPlan = existingUser.subscriptionPlan || 'free';
      targetSubValue = existingUser.subscriptionValue || 0;
      targetRole = existingUser.role || 'surveyor';
    }

    setSavingGrantSpecial(true);

    try {
      const nowIso = new Date().toISOString();
      let finalExpiresAt: string | null = null;
      if (grantSaType === 'annual') {
        const d = new Date(grantSaStartsAt + 'T00:00:00');
        d.setFullYear(d.getFullYear() + 1);
        finalExpiresAt = d.toISOString().split('T')[0];
      } else if (grantSaType === 'custom') {
        finalExpiresAt = grantSaExpiresAt;
      } else {
        finalExpiresAt = null; // Lifetime
      }

      // Check if start date is in the future (scheduled) or today (active)
      const startDateVal = grantSaStartsAt ? new Date(grantSaStartsAt + 'T00:00:00').getTime() : 0;
      const initialStatus: SpecialAccessStatus = startDateVal > Date.now() ? 'scheduled' : 'pending_acceptance';

      const saConfig: SpecialAccessConfig = {
        enabled: true,
        accessType: grantSaType,
        status: initialStatus,
        startsAt: grantSaStartsAt,
        expiresAt: finalExpiresAt,
        grantedBy: profile?.email || profile?.name || 'Super Admin',
        grantedAt: nowIso,
        reason: grantSaReason.trim() || 'Concessão Administrativa de Acesso Especial',
        grantedFeatures: grantAllFeatures ? ['ALL_FEATURES'] : ['pdf_maps_unlimited', 'field_rounds', 'fire_incidents', 'woodpile_cubage', 'kml_kmz_gpx', 'offline_tiles', 'technical_reports'],
      };

      if (isCreatingNew) {
        const newUserData: UserProfile = {
          uid: targetUid,
          email: targetEmail,
          name: targetName,
          role: targetRole,
          status: 'active',
          avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(targetName)}`,
          company: targetCompany,
          phone: targetPhone,
          createdAt: nowIso,
          approvedAt: nowIso,
          approvedBy: profile?.email || 'Super Admin',
          subscriptionPlan: targetPlan,
          subscriptionStatus: 'active',
          subscriptionValue: targetSubValue,
          hasChosenPlan: true,
          specialAccess: saConfig,
        };

        await setDoc(doc(db, 'users', targetUid), newUserData);
        setUsers((prev) => [newUserData, ...prev]);
      } else {
        const cleanPayload = {
          specialAccess: {
            enabled: true,
            accessType: saConfig.accessType,
            status: saConfig.status,
            startsAt: saConfig.startsAt,
            expiresAt: saConfig.expiresAt,
            grantedBy: saConfig.grantedBy,
            grantedAt: saConfig.grantedAt,
            reason: saConfig.reason,
            grantedFeatures: saConfig.grantedFeatures,
          },
        };

        await updateDoc(doc(db, 'users', targetUid), cleanPayload);
        setUsers((prev) =>
          prev.map((u) => (u.uid === targetUid ? { ...u, specialAccess: saConfig } : u))
        );
      }

      await recordAdminAuditLog({
        adminUid: profile?.uid || 'super_admin',
        adminEmail: profile?.email || 'admin@am-tst.com.br',
        adminName: profile?.name || 'Super Admin',
        action: isCreatingNew ? 'CREATE_USER_WITH_SPECIAL_ACCESS' : 'GRANT_SPECIAL_ACCESS',
        targetType: 'user',
        targetId: targetUid,
        targetName: targetName,
        newValue: saConfig,
        reason: `Acesso Especial ${grantSaType.toUpperCase()} (${saConfig.status.toUpperCase()}) concedido para ${targetName} (${targetEmail}). Motivo: ${saConfig.reason}`,
      });

      notifySuccess(
        'Acesso Especial Concedido!',
        `Acesso ${grantSaType === 'lifetime' ? 'Vitalício' : grantSaType === 'annual' ? 'Anual' : 'Personalizado'} (${initialStatus === 'scheduled' ? 'Agendado' : 'Ativo'}) configurado para ${targetName}.`
      );

      // Reset form
      setGrantConfirmationPending(false);
      setGrantSelectedUserUid('');
      setGrantNewUserName('');
      setGrantNewUserEmail('');
      setGrantNewUserCompany('');
      setGrantNewUserPhone('');
      setGrantSaType('lifetime');
      setGrantSaReason('Cliente Parceiro');
      setIsGrantSpecialModalOpen(false);
    } catch (err: any) {
      console.error('Error granting special access:', err);
      notifyError('Erro ao Conceder Acesso', 'Não foi possível salvar o acesso especial no banco.');
    } finally {
      setSavingGrantSpecial(false);
    }
  };

  // Atomic Add User Handler (With Commercial Plan + Optional Special Access)
  const handleAddUser = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanName = newUserName.trim();
    const cleanEmail = newUserEmail.trim().toLowerCase();

    if (!cleanName) {
      notifyWarning('Nome Obrigatório', 'Por favor, informe o nome completo do cliente.');
      return;
    }

    if (!cleanEmail || !cleanEmail.includes('@') || !cleanEmail.includes('.')) {
      notifyWarning('E-mail Inválido', 'Por favor, informe um endereço de e-mail válido.');
      return;
    }

    // Check duplicate in memory
    const emailExistsInMemory = users.some(
      (u) => (u.email || '').toLowerCase() === cleanEmail
    );
    if (emailExistsInMemory) {
      notifyError('E-mail Já Cadastrado', `O e-mail "${cleanEmail}" já está cadastrado no sistema. Escolha outro e-mail.`);
      return;
    }

    // Custom date validation
    if (newUserGrantSpecialAccess && newUserSaType === 'custom') {
      if (newUserSaExpiresAt && newUserSaStartsAt && newUserSaExpiresAt < newUserSaStartsAt) {
        notifyWarning('Data Inválida', 'A data de término não pode ser anterior à data de início.');
        return;
      }
    }

    setSavingUser(true);

    try {
      // Check duplicate directly in Firestore
      const usersRef = collection(db, 'users');
      const emailSnap = await getDocs(usersRef);
      const emailExistsInDb = emailSnap.docs.some(
        (docSnap) => (docSnap.data().email || '').toLowerCase() === cleanEmail
      );

      if (emailExistsInDb) {
        notifyError('E-mail Já Cadastrado', `O e-mail "${cleanEmail}" já está cadastrado no banco de dados.`);
        setSavingUser(false);
        return;
      }

      const generatedUid = `user_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
      const nowIso = new Date().toISOString();

      let specialAccessData: SpecialAccessConfig | undefined = undefined;
      if (newUserGrantSpecialAccess) {
        let finalExpiresAt: string | null = null;
        if (newUserSaType === 'annual') {
          const d = new Date(newUserSaStartsAt + 'T00:00:00');
          d.setFullYear(d.getFullYear() + 1);
          finalExpiresAt = d.toISOString().split('T')[0];
        } else if (newUserSaType === 'custom') {
          finalExpiresAt = newUserSaExpiresAt;
        } else {
          finalExpiresAt = null; // Lifetime
        }

        specialAccessData = {
          enabled: true,
          accessType: newUserSaType,
          status: 'active',
          startsAt: newUserSaStartsAt,
          expiresAt: finalExpiresAt,
          grantedBy: profile?.email || profile?.name || 'Super Admin',
          grantedAt: nowIso,
          reason: newUserSaReason.trim() || 'Criado com Acesso Especial',
        };
      }

      // Build clean payload without undefined keys
      const newUserData: UserProfile = {
        uid: generatedUid,
        email: cleanEmail,
        name: cleanName,
        role: newUserRole,
        status: newUserStatus,
        avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(cleanName)}`,
        company: newUserCompany.trim() || 'Empresa Particular',
        phone: newUserPhone.trim() || '',
        createdAt: nowIso,
        approvedAt: nowIso,
        approvedBy: profile?.email || 'Super Admin',
        subscriptionPlan: newUserPlan,
        subscriptionStatus: 'active',
        subscriptionValue: Number(newUserSubValue) || (newUserPlan === 'free' ? 0 : 44.99),
        hasChosenPlan: true,
      };

      if (specialAccessData) {
        newUserData.specialAccess = specialAccessData;
      }

      await setDoc(doc(db, 'users', generatedUid), newUserData);

      setUsers((prev) => [newUserData, ...prev]);

      await recordAdminAuditLog({
        adminUid: profile?.uid || 'super_admin',
        adminEmail: profile?.email || 'admin@am-tst.com.br',
        adminName: profile?.name || 'Super Admin',
        action: 'CREATE_USER',
        targetType: 'user',
        targetId: generatedUid,
        targetName: cleanName,
        newValue: newUserData,
        reason: `Criação de usuário "${cleanName}" (${cleanEmail}) com Plano ${newUserPlan.toUpperCase()}${
          specialAccessData ? ` e Acesso Especial ${specialAccessData.accessType.toUpperCase()}` : ''
        }.`,
      });

      notifySuccess(
        'Cliente Criado com Sucesso!',
        `Usuário ${cleanName} criado no plano ${newUserPlan.toUpperCase()}${
          specialAccessData ? ` com Acesso Especial (${specialAccessData.accessType === 'lifetime' ? 'Vitalício' : 'Anual'})` : ''
        }.`
      );

      // Reset form
      setNewUserName('');
      setNewUserEmail('');
      setNewUserCompany('');
      setNewUserPhone('');
      setNewUserRole('surveyor');
      setNewUserStatus('active');
      setNewUserPlan('free');
      setNewUserSubValue(0);
      setNewUserGrantSpecialAccess(false);
      setNewUserSaType('lifetime');
      setNewUserSaReason('Novo Cliente VIP');
      setIsAddUserModalOpen(false);
    } catch (err: any) {
      console.error('Error creating user:', err);
      notifyError('Erro ao Criar Cliente', 'Não foi possível salvar o usuário no banco de dados.');
    } finally {
      setSavingUser(false);
    }
  };

  // Special Access Management Handlers
  const handleOpenSpecialAccessModal = (u: UserProfile) => {
    setSpecialAccessUser(u);
    if (u.specialAccess && u.specialAccess.enabled && u.specialAccess.status !== 'revoked') {
      setSaEnabled(true);
      setSaType(u.specialAccess.accessType || 'annual');
      setSaStartsAt(u.specialAccess.startsAt ? u.specialAccess.startsAt.split('T')[0] : new Date().toISOString().split('T')[0]);
      if (u.specialAccess.expiresAt) {
        setSaExpiresAt(u.specialAccess.expiresAt.split('T')[0]);
      } else {
        const nextYear = new Date();
        nextYear.setFullYear(nextYear.getFullYear() + 1);
        setSaExpiresAt(nextYear.toISOString().split('T')[0]);
      }
      setSaReason(u.specialAccess.reason || 'Cliente Parceiro');
    } else {
      setSaEnabled(true);
      setSaType('annual');
      setSaStartsAt(new Date().toISOString().split('T')[0]);
      const nextYear = new Date();
      nextYear.setFullYear(nextYear.getFullYear() + 1);
      setSaExpiresAt(nextYear.toISOString().split('T')[0]);
      setSaReason('Cliente Parceiro');
    }
  };

  const handleSaveSpecialAccess = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!specialAccessUser) return;

    if (!saEnabled) {
      handleRevokeSpecialAccess(specialAccessUser);
      return;
    }

    if (saType === 'custom' && saExpiresAt && saStartsAt && saExpiresAt < saStartsAt) {
      notifyWarning('Data Inválida', 'A data de término não pode ser anterior à data de início.');
      return;
    }

    setSavingSpecialAccess(true);
    try {
      let finalExpiresAt: string | null = null;
      if (saType === 'annual') {
        const d = new Date(saStartsAt + 'T00:00:00');
        d.setFullYear(d.getFullYear() + 1);
        finalExpiresAt = d.toISOString().split('T')[0];
      } else if (saType === 'custom') {
        finalExpiresAt = saExpiresAt;
      } else {
        finalExpiresAt = null; // Lifetime
      }

      const saConfig: SpecialAccessConfig = {
        enabled: true,
        accessType: saType,
        status: 'active',
        startsAt: saStartsAt,
        expiresAt: finalExpiresAt,
        grantedBy: profile?.email || profile?.name || 'Super Admin',
        grantedAt: new Date().toISOString(),
        reason: saReason.trim() || 'Concessão Administrativa Especial',
      };

      const cleanPayload: any = {
        specialAccess: {
          enabled: true,
          accessType: saConfig.accessType,
          status: 'active',
          startsAt: saConfig.startsAt,
          expiresAt: saConfig.expiresAt,
          grantedBy: saConfig.grantedBy,
          grantedAt: saConfig.grantedAt,
          reason: saConfig.reason,
        },
      };

      await updateDoc(doc(db, 'users', specialAccessUser.uid), cleanPayload);
      setUsers((prev) =>
        prev.map((u) => (u.uid === specialAccessUser.uid ? { ...u, specialAccess: saConfig } : u))
      );

      await recordAdminAuditLog({
        adminUid: profile?.uid || 'super_admin',
        adminEmail: profile?.email || 'admin@am-tst.com.br',
        adminName: profile?.name || 'Super Admin',
        action: 'GRANT_SPECIAL_ACCESS',
        targetType: 'user',
        targetId: specialAccessUser.uid,
        targetName: specialAccessUser.name || specialAccessUser.email,
        newValue: saConfig,
        reason: `Concessão de Acesso Especial ${saType.toUpperCase()} para ${specialAccessUser.name}. Motivo: ${saConfig.reason}`,
      });

      notifySuccess(
        'Acesso Especial Concedido!',
        `Acesso ${saType === 'lifetime' ? 'Vitalício' : saType === 'annual' ? 'Anual' : 'Personalizado'} liberado com sucesso para ${specialAccessUser.name}.`
      );
      setSpecialAccessUser(null);
    } catch (err: any) {
      console.error('Error saving special access:', err);
      notifyError('Erro ao Salvar', 'Não foi possível salvar o acesso especial.');
    } finally {
      setSavingSpecialAccess(false);
    }
  };

  const handleRevokeSpecialAccess = (user: UserProfile) => {
    showConfirm({
      title: `Revogar Acesso Especial de ${user.name}?`,
      message: `Este usuário perderá imediatamente a autorização total e passará a responder pelas regras e limitações do seu plano normal (${user.subscriptionPlan || 'free'}).`,
      type: 'danger',
      confirmText: 'Sim, Revogar Acesso',
      cancelText: 'Cancelar',
      onConfirm: async () => {
        try {
          const cleanPayload: any = {
            'specialAccess.enabled': false,
            'specialAccess.status': 'revoked',
            'specialAccess.revokedAt': new Date().toISOString(),
            'specialAccess.revokedBy': profile?.email || 'Super Admin',
          };

          await updateDoc(doc(db, 'users', user.uid), cleanPayload);
          setUsers((prev) =>
            prev.map((u) =>
              u.uid === user.uid && u.specialAccess
                ? {
                    ...u,
                    specialAccess: { ...u.specialAccess, enabled: false, status: 'revoked' },
                  }
                : u
            )
          );

          await recordAdminAuditLog({
            adminUid: profile?.uid || 'super_admin',
            adminEmail: profile?.email || 'admin@am-tst.com.br',
            adminName: profile?.name || 'Super Admin',
            action: 'REVOKE_SPECIAL_ACCESS',
            targetType: 'user',
            targetId: user.uid,
            targetName: user.name || user.email,
            reason: `Revogação de Acesso Especial de ${user.name}.`,
          });

          notifySuccess('Acesso Especial Revogado', `O acesso especial de ${user.name} foi revogado com sucesso.`);
          if (specialAccessUser?.uid === user.uid) setSpecialAccessUser(null);
        } catch (err) {
          notifyError('Erro ao Revogar', 'Falha ao revogar acesso especial no banco.');
        }
      },
    });
  };

  // 1. Create Promo Coupon with robust validation and 100% clean object (no undefined)
  const handleCreateCoupon = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanCode = newCouponCode.trim().toUpperCase().replace(/[^A-Z0-9_-]/g, '');

    if (!cleanCode) {
      notifyWarning('Código Obrigatório', 'Informe um código para o cupom (ex: PROMO10).');
      return;
    }

    if (cleanCode.length < 3) {
      notifyWarning('Código Muito Curto', 'O código do cupom deve ter pelo menos 3 caracteres.');
      return;
    }

    // Check duplicate
    const codeExists = coupons.some((c) => c.code.toUpperCase() === cleanCode);
    if (codeExists) {
      notifyWarning('Código Já Cadastrado', `O cupom "${cleanCode}" já existe. Escolha outro código.`);
      return;
    }

    // Validate discount
    const discountVal = Number(newCouponDiscount);
    if (isNaN(discountVal) || discountVal <= 0) {
      notifyWarning('Desconto Inválido', 'Informe um valor de desconto válido e positivo.');
      return;
    }

    if (newCouponDiscountType === 'percent' && (discountVal < 1 || discountVal > 100)) {
      notifyWarning('Percentual Inválido', 'O desconto percentual deve estar entre 1% e 100%.');
      return;
    }

    // Validate validity
    const days = Math.max(1, Number(newCouponDays) || 30);
    const maxUses = Math.max(1, Number(newCouponMaxUses) || 50);

    setSavingCoupon(true);
    try {
      const now = new Date();
      const expiry = new Date();
      expiry.setDate(expiry.getDate() + days);

      // Clean payload with zero undefined properties
      const newCouponData: PromoCoupon = {
        id: `coupon_${cleanCode}`,
        code: cleanCode,
        discountType: newCouponDiscountType,
        validFrom: now.toISOString().split('T')[0],
        validUntil: expiry.toISOString().split('T')[0],
        maxUses: maxUses,
        usedCount: 0,
        active: true,
        notes: `Criado por ${profile?.name || 'Admin'} em ${new Date().toLocaleDateString('pt-BR')}`,
      };

      if (newCouponDiscountType === 'percent') {
        newCouponData.discountPercent = discountVal;
      } else {
        newCouponData.discountFixed = discountVal;
      }

      if (newCouponApplicablePlan && newCouponApplicablePlan !== 'all') {
        newCouponData.applicablePlans = [newCouponApplicablePlan];
      }

      await setDoc(doc(db, 'coupons', newCouponData.id), newCouponData);
      setCoupons((prev) => [newCouponData, ...prev.filter((c) => c.id !== newCouponData.id)]);

      await recordAdminAuditLog({
        adminUid: profile?.uid || 'super_admin',
        adminEmail: profile?.email || 'admin@am-tst.com.br',
        adminName: profile?.name || 'Super Admin',
        action: 'CREATE_COUPON',
        targetType: 'coupon',
        targetId: newCouponData.id,
        targetName: cleanCode,
        newValue: newCouponData,
        reason: `Criação do cupom promocional ${cleanCode} (${newCouponDiscountType === 'percent' ? discountVal + '%' : 'R$ ' + discountVal}) com validade de ${days} dias.`,
      });

      notifySuccess('Cupom Criado com Sucesso!', `Código ${cleanCode} ativo e pronto para uso.`);
      setIsCouponModalOpen(false);
      setNewCouponCode('');
      setNewCouponDiscount(20);
      setNewCouponDays(30);
      setNewCouponMaxUses(50);
      setNewCouponApplicablePlan('all');
    } catch (err: any) {
      console.error('Error creating coupon:', err);
      notifyError('Erro ao Criar Cupom', err?.message || 'Falha ao salvar cupom no banco de dados.');
    } finally {
      setSavingCoupon(false);
    }
  };

  // 2. Toggle Coupon Active / Inactive Status
  const handleToggleCouponStatus = async (coupon: PromoCoupon) => {
    const nextStatus = !coupon.active;
    try {
      await updateDoc(doc(db, 'coupons', coupon.id), { active: nextStatus });
      setCoupons((prev) => prev.map((c) => (c.id === coupon.id ? { ...c, active: nextStatus } : c)));

      await recordAdminAuditLog({
        adminUid: profile?.uid || 'super_admin',
        adminEmail: profile?.email || 'admin@am-tst.com.br',
        adminName: profile?.name || 'Super Admin',
        action: 'UPDATE_COUPON',
        targetType: 'coupon',
        targetId: coupon.id,
        targetName: coupon.code,
        newValue: { active: nextStatus },
        reason: `Status do cupom ${coupon.code} alterado para ${nextStatus ? 'ATIVO' : 'INATIVO'}.`,
      });

      notifySuccess(
        nextStatus ? 'Cupom Ativado' : 'Cupom Desativado',
        `O cupom ${coupon.code} foi ${nextStatus ? 'ativado' : 'pausado'}.`
      );
    } catch (err: any) {
      notifyError('Erro ao Atualizar', 'Não foi possível alterar o status do cupom.');
    }
  };

  // 3. Delete Coupon Permanently
  const handleDeleteCoupon = (coupon: PromoCoupon) => {
    showConfirm({
      title: `Excluir Cupom "${coupon.code}"?`,
      message: `Deseja realmente remover permanentemente este cupom? Os usuários não poderão mais aplicá-lo.`,
      type: 'danger',
      confirmText: 'Sim, Excluir Cupom',
      cancelText: 'Cancelar',
      onConfirm: async () => {
        try {
          await deleteDoc(doc(db, 'coupons', coupon.id));
          setCoupons((prev) => prev.filter((c) => c.id !== coupon.id));

          await recordAdminAuditLog({
            adminUid: profile?.uid || 'super_admin',
            adminEmail: profile?.email || 'admin@am-tst.com.br',
            adminName: profile?.name || 'Super Admin',
            action: 'DELETE_COUPON',
            targetType: 'coupon',
            targetId: coupon.id,
            targetName: coupon.code,
            reason: `Exclusão permanente do cupom promocional ${coupon.code}.`,
          });

          notifySuccess('Cupom Excluído', `O cupom ${coupon.code} foi removido com sucesso.`);
        } catch (err: any) {
          notifyError('Erro ao Excluir', 'Falha ao remover cupom do banco de dados.');
        }
      },
    });
  };

  // 4. Copy Coupon Code
  const handleCopyCouponCode = (code: string) => {
    navigator.clipboard.writeText(code);
    notifySuccess('Código Copiado!', `Cupom "${code}" copiado para a área de transferência.`);
  };

  // Financial KPI Calculations
  const activePayingUsers = users.filter(
    (u) => (u.subscriptionStatus === 'active' || u.status === 'active') && u.email !== 'alexandre1604981@gmail.com'
  );
  const trialUsers = users.filter((u) => u.subscriptionStatus === 'trial' || u.subscriptionPlan === 'free_trial');
  const overdueUsers = users.filter((u) => {
    if (u.email === 'alexandre1604981@gmail.com') return false;
    if (u.subscriptionStatus === 'overdue') return true;
    if (u.subscriptionExpiresAt) {
      return new Date(u.subscriptionExpiresAt).getTime() < Date.now() && u.subscriptionStatus !== 'suspended';
    }
    return false;
  });
  const blockedUsers = users.filter((u) => u.status === 'blocked' || u.subscriptionStatus === 'suspended');

  const totalMrr = activePayingUsers.reduce((sum, u) => sum + (u.subscriptionValue || 44.99), 0);
  const projectedArr = totalMrr * 12;
  const overdueAmount = overdueUsers.reduce((sum, u) => sum + (u.subscriptionValue || 44.99), 0);
  const averageTicket = activePayingUsers.length > 0 ? totalMrr / activePayingUsers.length : 44.99;
  const churnRate = users.length > 0 ? (blockedUsers.length / users.length) * 100 : 0;

    // Selected Active User Object
  const selectedActiveUser = useMemo(() => {
    if (!selectedActiveUserUid) return null;
    return users.find((u) => u.uid === selectedActiveUserUid) || null;
  }, [users, selectedActiveUserUid]);

  const activeClientsList = useMemo(() => {
    // Include all non-blocked users (active, pending, trial, free, pro)
    return users.filter((u) => u.status !== 'blocked');
  }, [users]);

  // Filtered Users List
  const filteredUsers = users
    .filter((u) => {
      if (filterStatus === 'pending') return u.status === 'pending';
      if (filterStatus === 'active') return u.status === 'active';
      if (filterStatus === 'blocked') return u.status === 'blocked';
      if (filterStatus === 'special_access') return hasSpecialAccessActive(u);
      if (filterStatus === 'special_lifetime') return hasSpecialAccessActive(u) && u.specialAccess?.accessType === 'lifetime';
      if (filterStatus === 'special_expiring') {
        if (!hasSpecialAccessActive(u) || !u.specialAccess?.expiresAt) return false;
        const exp = new Date(u.specialAccess.expiresAt).getTime();
        const diffDays = (exp - Date.now()) / (1000 * 60 * 60 * 24);
        return diffDays >= 0 && diffDays <= 30;
      }
      return true;
    })
    .filter((u) => {
      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase();
      return (
        u.name?.toLowerCase().includes(q) ||
        u.email?.toLowerCase().includes(q) ||
        u.company?.toLowerCase().includes(q) ||
        u.phone?.toLowerCase().includes(q)
      );
    });

  // Filtered Subscriptions List
  const filteredSubscriptions = users
    .filter((u) => {
      if (subscriptionFilter === 'active') return u.subscriptionStatus === 'active';
      if (subscriptionFilter === 'trial') return u.subscriptionStatus === 'trial';
      if (subscriptionFilter === 'overdue') {
        const isExp = u.subscriptionExpiresAt ? new Date(u.subscriptionExpiresAt).getTime() < Date.now() : false;
        return u.subscriptionStatus === 'overdue' || isExp;
      }
      if (subscriptionFilter === 'suspended') return u.subscriptionStatus === 'suspended' || u.status === 'blocked';
      return true;
    })
    .filter((u) => {
      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase();
      return (
        u.name?.toLowerCase().includes(q) ||
        u.email?.toLowerCase().includes(q) ||
        u.company?.toLowerCase().includes(q) ||
        u.phone?.toLowerCase().includes(q)
      );
    });

  // Filtered Audit Logs
  const filteredAuditLogs = auditLogs.filter((log) => {
    if (!auditSearchQuery.trim()) return true;
    const q = auditSearchQuery.toLowerCase();
    return (
      log.action.toLowerCase().includes(q) ||
      log.adminEmail.toLowerCase().includes(q) ||
      (log.targetName && log.targetName.toLowerCase().includes(q)) ||
      log.reason.toLowerCase().includes(q)
    );
  });

  if (profile?.role !== 'super_admin') {
    return (
      <div className="h-full flex items-center justify-center p-4">
        <div className="bg-slate-900 border border-slate-800 p-8 rounded-3xl max-w-md text-center shadow-2xl">
          <Shield className="w-12 h-12 text-rose-500 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-white mb-2">Acesso Restrito ao Super Admin</h2>
          <p className="text-slate-400 text-xs">
            Esta área é exclusiva para a autoridade máxima do sistema AM TST.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto overflow-x-hidden p-3 sm:p-6 space-y-5 max-w-7xl mx-auto text-slate-100 pb-32 w-full">
      {/* Header Bar with 6 Subtabs */}
      <div className="bg-slate-900 border border-slate-800 p-4 sm:p-6 rounded-3xl shadow-2xl space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-black uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                👑 Super Administrador Central
              </span>
              <span className="text-xs text-slate-400 font-bold">• AM TST Saúde & Segurança</span>
            </div>
            <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight mt-1 flex items-center gap-2">
              <UserCog className="w-6 h-6 text-sky-400 shrink-0" />
              <span>Painel Executivo & Governança SaaS</span>
            </h1>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={manualSync}
              disabled={refreshing}
              className="bg-slate-950 hover:bg-slate-800 border border-slate-700/80 px-3.5 py-2 rounded-xl flex items-center gap-1.5 text-xs font-bold text-sky-400 transition-all active:scale-95 shadow-md cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
              <span>{refreshing ? 'Sincronizando...' : 'Sincronizar'}</span>
            </button>
          </div>
        </div>

        {/* 6 Subtabs Navigation Buttons */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-7 gap-2 pt-2 border-t border-slate-800/80">
          <button
            onClick={() => setAdminTab('dashboard')}
            className={`py-2.5 px-3 rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer ${
              adminTab === 'dashboard'
                ? 'bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-lg shadow-emerald-950/50'
                : 'bg-slate-950/60 hover:bg-slate-800 text-slate-400 hover:text-white border border-slate-800'
            }`}
          >
            <TrendingUp className="w-4 h-4" />
            <span>Dashboard</span>
          </button>

          <button
            onClick={() => setAdminTab('users')}
            className={`py-2.5 px-3 rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer ${
              adminTab === 'users'
                ? 'bg-gradient-to-r from-sky-600 to-blue-600 text-white shadow-lg shadow-sky-950/50'
                : 'bg-slate-950/60 hover:bg-slate-800 text-slate-400 hover:text-white border border-slate-800'
            }`}
          >
            <Users className="w-4 h-4" />
            <span>Clientes ({users.length})</span>
          </button>

          <button
            onClick={() => setAdminTab('special_access')}
            className={`py-2.5 px-3 rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer ${
              adminTab === 'special_access'
                ? 'bg-gradient-to-r from-amber-500 to-yellow-500 text-slate-950 font-black shadow-lg shadow-amber-950/50'
                : 'bg-slate-950/60 hover:bg-slate-800 text-amber-300/80 hover:text-amber-300 border border-amber-500/30'
            }`}
          >
            <KeyRound className="w-4 h-4" />
            <span>Acesso Especial ({users.filter((u) => hasSpecialAccessActive(u)).length})</span>
          </button>

          <button
            onClick={() => setAdminTab('subscriptions')}
            className={`py-2.5 px-3 rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer ${
              adminTab === 'subscriptions'
                ? 'bg-gradient-to-r from-amber-600 to-orange-600 text-white shadow-lg shadow-amber-950/50'
                : 'bg-slate-950/60 hover:bg-slate-800 text-slate-400 hover:text-white border border-slate-800'
            }`}
          >
            <DollarSign className="w-4 h-4" />
            <span>Assinaturas</span>
          </button>

          <button
            onClick={() => setAdminTab('plans')}
            className={`py-2.5 px-3 rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer ${
              adminTab === 'plans'
                ? 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow-lg shadow-purple-950/50'
                : 'bg-slate-950/60 hover:bg-slate-800 text-slate-400 hover:text-white border border-slate-800'
            }`}
          >
            <Zap className="w-4 h-4" />
            <span>Planos ({plans.length})</span>
          </button>

          <button
            onClick={() => setAdminTab('coupons')}
            className={`py-2.5 px-3 rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer ${
              adminTab === 'coupons'
                ? 'bg-gradient-to-r from-pink-600 to-rose-600 text-white shadow-lg shadow-pink-950/50'
                : 'bg-slate-950/60 hover:bg-slate-800 text-slate-400 hover:text-white border border-slate-800'
            }`}
          >
            <Gift className="w-4 h-4" />
            <span>Cupons ({coupons.length})</span>
          </button>

          <button
            onClick={() => setAdminTab('audit_and_settings')}
            className={`py-2.5 px-3 rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer ${
              adminTab === 'audit_and_settings'
                ? 'bg-gradient-to-r from-slate-700 to-slate-800 text-white shadow-lg border border-slate-600'
                : 'bg-slate-950/60 hover:bg-slate-800 text-slate-400 hover:text-white border border-slate-800'
            }`}
          >
            <History className="w-4 h-4" />
            <span>Auditoria & Config</span>
          </button>
        </div>
      </div>

      {/* TAB 1: EXECUTIVE FINANCIAL DASHBOARD */}
      {adminTab === 'dashboard' && (
        <div className="space-y-5 animate-in fade-in">
          {/* Executive Summary Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl shadow-xl space-y-2">
              <div className="flex items-center justify-between text-xs text-slate-400 font-bold">
                <span>MRR (Recorrente Mensal)</span>
                <DollarSign className="w-4 h-4 text-emerald-400" />
              </div>
              <div className="text-2xl font-black text-white">
                R$ {totalMrr.toFixed(2).replace('.', ',')}
              </div>
              <p className="text-[11px] text-emerald-400 font-semibold flex items-center gap-1">
                <TrendingUp className="w-3 h-3" /> Base de assinantes ativos
              </p>
            </div>

            <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl shadow-xl space-y-2">
              <div className="flex items-center justify-between text-xs text-slate-400 font-bold">
                <span>ARR (Projeção Anual)</span>
                <Sparkles className="w-4 h-4 text-sky-400" />
              </div>
              <div className="text-2xl font-black text-white">
                R$ {projectedArr.toFixed(2).replace('.', ',')}
              </div>
              <p className="text-[11px] text-sky-400 font-semibold">
                Projeção anual 12 meses
              </p>
            </div>

            <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl shadow-xl space-y-2">
              <div className="flex items-center justify-between text-xs text-slate-400 font-bold">
                <span>Assinantes Ativos</span>
                <Users className="w-4 h-4 text-teal-400" />
              </div>
              <div className="text-2xl font-black text-white">
                {activePayingUsers.length} <span className="text-xs text-slate-400 font-normal">clientes</span>
              </div>
              <p className="text-[11px] text-slate-400">
                Ticket Médio: R$ {averageTicket.toFixed(2).replace('.', ',')}
              </p>
            </div>

            <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl shadow-xl space-y-2">
              <div className="flex items-center justify-between text-xs text-slate-400 font-bold">
                <span>Inadimplência</span>
                <AlertCircle className="w-4 h-4 text-rose-400" />
              </div>
              <div className="text-2xl font-black text-rose-400">
                R$ {overdueAmount.toFixed(2).replace('.', ',')}
              </div>
              <p className="text-[11px] text-rose-300 font-semibold">
                {overdueUsers.length} cliente(s) em atraso
              </p>
            </div>
          </div>

          {/* Quick Actions & Export Banner */}
          <div className="bg-gradient-to-r from-emerald-950/40 via-slate-900 to-slate-950 border border-emerald-500/30 p-5 rounded-3xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h3 className="text-sm font-extrabold text-white">Exportação Executiva em Formato CSV</h3>
              <p className="text-xs text-slate-400">
                Gere relatórios completos de faturamento, inadimplência e base de clientes em 1 clique.
              </p>
            </div>
            <button
              onClick={() => exportFinancialSummaryToCsv(users, { totalMrr, projectedArr, activeCount: activePayingUsers.length, overdueCount: overdueUsers.length, churnRate })}
              className="bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2.5 rounded-xl font-black text-xs flex items-center justify-center gap-2 shadow-lg transition-all active:scale-95 cursor-pointer"
            >
              <FileSpreadsheet className="w-4 h-4" />
              <span>Exportar Relatório Financeiro (CSV)</span>
            </button>
          </div>
        </div>
      )}

                  {/* TAB: SPECIAL EXCLUSIVE & LIFETIME ACCESS */}
      {adminTab === 'special_access' && (
        <div className="space-y-6 animate-in fade-in">
          {/* Header & KPI Summary */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-gradient-to-br from-amber-950/40 via-slate-900 to-slate-950 border border-amber-500/40 p-5 rounded-2xl shadow-xl space-y-1">
              <div className="flex items-center justify-between text-xs text-amber-400 font-bold">
                <span>Acessos Especiais Ativos</span>
                <KeyRound className="w-4 h-4" />
              </div>
              <div className="text-2xl font-black text-white">
                {users.filter((u) => getSpecialAccessComputedStatus(u) === 'active').length} <span className="text-xs text-slate-400 font-normal">VIPs ativos</span>
              </div>
              <p className="text-[11px] text-amber-300">100% dos recursos Premium liberados</p>
            </div>

            <div className="bg-gradient-to-br from-yellow-950/30 via-slate-900 to-slate-950 border border-yellow-500/30 p-5 rounded-2xl shadow-xl space-y-1">
              <div className="flex items-center justify-between text-xs text-yellow-400 font-bold">
                <span>Acessos Vitalícios</span>
                <Sparkles className="w-4 h-4" />
              </div>
              <div className="text-2xl font-black text-amber-300">
                {users.filter((u) => getSpecialAccessComputedStatus(u) === 'active' && u.specialAccess?.accessType === 'lifetime').length} <span className="text-xs text-slate-400 font-normal">permanentes</span>
              </div>
              <p className="text-[11px] text-slate-400">Sem data de expiração</p>
            </div>

            <div className="bg-gradient-to-br from-sky-950/30 via-slate-900 to-slate-950 border border-sky-500/30 p-5 rounded-2xl shadow-xl space-y-1">
              <div className="flex items-center justify-between text-xs text-sky-400 font-bold">
                <span>Acessos Anuais / Temporários</span>
                <Calendar className="w-4 h-4" />
              </div>
              <div className="text-2xl font-black text-sky-300">
                {users.filter((u) => getSpecialAccessComputedStatus(u) === 'active' && u.specialAccess?.accessType !== 'lifetime').length} <span className="text-xs text-slate-400 font-normal">com vigência</span>
              </div>
              <p className="text-[11px] text-slate-400">1 Ano ou período personalizado</p>
            </div>

            <div className="bg-gradient-to-br from-purple-950/30 via-slate-900 to-slate-950 border border-purple-500/30 p-5 rounded-2xl shadow-xl space-y-1">
              <div className="flex items-center justify-between text-xs text-purple-400 font-bold">
                <span>Agendados / Expirados</span>
                <Clock className="w-4 h-4" />
              </div>
              <div className="text-2xl font-black text-purple-300">
                {users.filter((u) => {
                  const st = getSpecialAccessComputedStatus(u);
                  return st === 'scheduled' || st === 'expired' || st === 'revoked';
                }).length} <span className="text-xs text-slate-400 font-normal">no histórico</span>
              </div>
              <p className="text-[11px] text-slate-400">Controle total de vigência</p>
            </div>
          </div>

          {/* MAIN TOOLBAR: ACTION BUTTON, SEARCH & STATUS FILTERS */}
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 sm:p-6 shadow-xl space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h3 className="text-base sm:text-lg font-black text-white flex items-center gap-2">
                  <KeyRound className="w-5 h-5 text-amber-400" />
                  <span>Painel de Membros com Acesso Especial</span>
                </h3>
                <p className="text-xs text-slate-400">
                  Conceda acesso temporário aos recursos Premium durante um período de vigência definido
                </p>
              </div>

              {/* PRIMARY ACTION BUTTON: + ADICIONAR MEMBRO */}
              <button
                type="button"
                onClick={() => {
                  setGrantModalClientMode('existing');
                  setGrantSelectedUserUid('');
                  setGrantConfirmationPending(false);
                  setIsGrantSpecialModalOpen(true);
                }}
                className="px-6 py-3.5 rounded-2xl bg-gradient-to-r from-amber-500 via-yellow-500 to-amber-600 hover:from-amber-400 hover:to-yellow-400 text-slate-950 font-black text-xs sm:text-sm cursor-pointer shadow-xl shadow-amber-950/60 flex items-center justify-center gap-2 transition-all active:scale-95 shrink-0"
              >
                <UserPlus className="w-4 h-4 text-slate-950 stroke-[3]" />
                <span>+ ADICIONAR MEMBRO</span>
              </button>
            </div>

            {/* DIRECT ACTIVE CLIENT SELECTOR INLINE BOX */}
            <div className="p-4 sm:p-5 rounded-2xl bg-slate-950 border border-amber-500/40 space-y-3 shadow-inner">
              <div className="flex items-center justify-between">
                <label className="text-amber-300 font-extrabold uppercase tracking-wider text-xs flex items-center gap-2">
                  <UserCheck className="w-4 h-4 text-amber-400" />
                  <span>🎯 Selecionar Usuário para Ação Rápida ({users.length} usuários cadastrados):</span>
                </label>
                {saTabTargetUid && (
                  <button
                    type="button"
                    onClick={() => setSaTabTargetUid('')}
                    className="text-xs text-slate-400 hover:text-rose-400 font-bold underline cursor-pointer"
                  >
                    Limpar Seleção ✕
                  </button>
                )}
              </div>

              <div className="relative">
                <select
                  value={saTabTargetUid}
                  onChange={(e) => setSaTabTargetUid(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 hover:border-amber-400 rounded-xl px-4 py-3 text-white text-xs sm:text-sm font-bold focus:outline-none focus:border-amber-500 transition-colors cursor-pointer appearance-none shadow-md"
                >
                  <option value="">-- Clique aqui e selecione um usuário da lista ({users.length} disponíveis) --</option>
                  {users.map((client) => {
                    const compStatus = getSpecialAccessComputedStatus(client);
                    const statusText =
                      compStatus === 'active'
                        ? ` ★ [ACESSO ATIVO: ${client.specialAccess?.accessType === 'lifetime' ? 'VITALÍCIO' : 'TEMPORÁRIO'}]`
                        : compStatus === 'scheduled'
                        ? ' [AGENDADO]'
                        : compStatus === 'expired'
                        ? ' [EXPIRADO]'
                        : compStatus === 'revoked'
                        ? ' [REVOGADO]'
                        : ' [Sem Acesso Especial]';

                    return (
                      <option key={client.uid} value={client.uid}>
                        👤 {client.name} ({client.email}) | Empresa: {client.company || 'Particular'} | Plano: {(client.subscriptionPlan || 'Free').toUpperCase()}{statusText}
                      </option>
                    );
                  })}
                </select>
                <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-amber-400">
                  <ChevronDown className="w-5 h-5" />
                </div>
              </div>

              {/* Selected Target Client Action Box */}
              {(() => {
                const targetUser = users.find((u) => u.uid === saTabTargetUid);
                if (!targetUser) return null;
                const compStatus = getSpecialAccessComputedStatus(targetUser);
                const daysRemaining = getSpecialAccessDaysRemaining(targetUser);

                return (
                  <div className="p-4 rounded-xl bg-slate-900 border border-amber-500/50 space-y-3 animate-in fade-in mt-3">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-3">
                      <div className="flex items-center gap-3">
                        <img
                          src={targetUser.avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(targetUser.name)}`}
                          alt={targetUser.name}
                          className="w-11 h-11 rounded-xl bg-slate-800 border border-amber-500/40 object-cover"
                        />
                        <div>
                          <div className="flex items-center gap-2">
                            <h4 className="text-sm font-black text-white">{targetUser.name}</h4>
                            {compStatus === 'active' && (
                              <span className="px-2 py-0.5 rounded-full text-[9px] font-black uppercase bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 flex items-center gap-1">
                                <KeyRound className="w-2.5 h-2.5" />
                                <span>Ativo • {daysRemaining === 'lifetime' ? 'Vitalício' : `${daysRemaining}d restantes`}</span>
                              </span>
                            )}
                            {compStatus === 'scheduled' && (
                              <span className="px-2 py-0.5 rounded-full text-[9px] font-black uppercase bg-yellow-500/20 text-yellow-300 border border-yellow-500/40 flex items-center gap-1">
                                <Clock className="w-2.5 h-2.5" />
                                <span>Agendado para ${targetUser.specialAccess?.startsAt}</span>
                              </span>
                            )}
                            {compStatus === 'expired' && (
                              <span className="px-2 py-0.5 rounded-full text-[9px] font-black uppercase bg-rose-500/20 text-rose-300 border border-rose-500/40">
                                Expirado
                              </span>
                            )}
                            {compStatus === 'revoked' && (
                              <span className="px-2 py-0.5 rounded-full text-[9px] font-black uppercase bg-slate-800 text-slate-400 border border-slate-700">
                                Revogado
                              </span>
                            )}
                            {compStatus === 'none' && (
                              <span className="px-2 py-0.5 rounded-full text-[9px] font-bold uppercase bg-slate-800 text-slate-400 border border-slate-700">
                                Sem Acesso Especial
                              </span>
                            )}
                          </div>
                          <div className="text-xs text-slate-400 mt-0.5 flex items-center gap-3">
                            <span>✉️ {targetUser.email}</span>
                            <span>🏢 {targetUser.company || 'Particular'}</span>
                            <span className="text-emerald-400 font-bold">Plano Original: {(targetUser.subscriptionPlan || 'Free').toUpperCase()}</span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => handleOpenSpecialAccessModal(targetUser)}
                          className="px-4 py-2 rounded-xl bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-400 hover:to-yellow-400 text-slate-950 font-black text-xs cursor-pointer shadow flex items-center gap-1.5 transition-all active:scale-95"
                        >
                          <KeyRound className="w-3.5 h-3.5" />
                          <span>
                            {compStatus === 'active' || compStatus === 'scheduled' ? 'Editar Vigência / Recursos' : 'Conceder Acesso Especial'}
                          </span>
                        </button>

                        {(compStatus === 'active' || compStatus === 'scheduled') && (
                          <button
                            type="button"
                            onClick={() => handleRevokeSpecialAccess(targetUser)}
                            className="px-3.5 py-2 rounded-xl bg-rose-950/60 hover:bg-rose-900/60 border border-rose-800 text-rose-300 font-bold text-xs cursor-pointer transition-all flex items-center gap-1.5"
                          >
                            <X className="w-3.5 h-3.5 text-rose-400" />
                            <span>Revogar Acesso</span>
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })()}
            </div>

            {/* Search and Filters Bar for VIP Table */}
            <div className="flex flex-col sm:flex-row items-center gap-3 pt-3 border-t border-slate-800">
              <div className="relative flex-1 w-full">
                <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={saTabSearchQuery}
                  onChange={(e) => setSaTabSearchQuery(e.target.value)}
                  placeholder="Pesquisar membro por nome, e-mail, empresa ou motivo..."
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-10 pr-4 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500 transition-colors"
                />
              </div>

                            {/* Status Filter Pills */}
              <div className="flex items-center gap-1.5 overflow-x-auto w-full sm:w-auto pb-1">
                <button
                  type="button"
                  onClick={() => setSaTabFilter('all')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                    saTabFilter === 'all' ? 'bg-amber-600 text-white shadow' : 'bg-slate-950 text-slate-400 hover:text-white'
                  }`}
                >
                  Todos ({users.filter((u) => u.specialAccess).length})
                </button>
                <button
                  type="button"
                  onClick={() => setSaTabFilter('pending')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                    saTabFilter === 'pending' ? 'bg-yellow-500 text-slate-950 font-black shadow' : 'bg-slate-950 text-yellow-400/80 hover:text-yellow-300'
                  }`}
                >
                  🟡 Aguardando Aceite ({users.filter((u) => u.specialAccess && !u.specialAccess.acceptedAt && u.specialAccess.status !== 'declined' && u.specialAccess.status !== 'revoked').length})
                </button>
                <button
                  type="button"
                  onClick={() => setSaTabFilter('active')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                    saTabFilter === 'active' ? 'bg-emerald-600 text-white shadow' : 'bg-slate-950 text-emerald-400/80 hover:text-emerald-300'
                  }`}
                >
                  🟢 Ativos ({users.filter((u) => getSpecialAccessComputedStatus(u) === 'active').length})
                </button>
                <button
                  type="button"
                  onClick={() => setSaTabFilter('lifetime')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                    saTabFilter === 'lifetime' ? 'bg-yellow-600 text-slate-950 font-black shadow' : 'bg-slate-950 text-slate-400 hover:text-white'
                  }`}
                >
                  👑 Vitalícios ({users.filter((u) => u.specialAccess && u.specialAccess.accessType === 'lifetime' && u.specialAccess.enabled).length})
                </button>
                <button
                  type="button"
                  onClick={() => setSaTabFilter('annual')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                    saTabFilter === 'annual' ? 'bg-sky-600 text-white shadow' : 'bg-slate-950 text-slate-400 hover:text-white'
                  }`}
                >
                  📅 Anuais ({users.filter((u) => u.specialAccess && u.specialAccess.accessType === 'annual' && u.specialAccess.enabled).length})
                </button>
                <button
                  type="button"
                  onClick={() => setSaTabFilter('expired')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                    saTabFilter === 'expired' ? 'bg-rose-600 text-white shadow' : 'bg-slate-950 text-rose-400/80 hover:text-rose-300'
                  }`}
                >
                  🔴 Expirados ({users.filter((u) => getSpecialAccessComputedStatus(u) === 'expired').length})
                </button>
                <button
                  type="button"
                  onClick={() => setSaTabFilter('revoked')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                    saTabFilter === 'revoked' ? 'bg-slate-700 text-white shadow' : 'bg-slate-950 text-slate-500 hover:text-slate-300'
                  }`}
                >
                  ⚫ Revogados ({users.filter((u) => u.specialAccess && (u.specialAccess.status === 'revoked' || u.specialAccess.status === 'declined')).length})
                </button>
              </div>
            </div>

            {/* TABLE OF MEMBERS WITH SPECIAL ACCESS */}
            <div className="overflow-x-auto rounded-2xl border border-slate-800">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-950 text-slate-400 border-b border-slate-800 font-extrabold uppercase tracking-wider text-[10px]">
                  <tr>
                    <th className="p-3.5">Membro</th>
                    <th className="p-3.5">Plano Original</th>
                    <th className="p-3.5">Tipo de Acesso</th>
                    <th className="p-3.5">Vigência (Início → Fim)</th>
                    <th className="p-3.5">Status</th>
                    <th className="p-3.5">Aceite do Membro</th>
                    <th className="p-3.5">Responsável / Motivo</th>
                    <th className="p-3.5 text-right">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 bg-slate-950/40">
                  {users
                    .filter((u) => {
                      if (!u.specialAccess) return false;
                      const compStatus = getSpecialAccessComputedStatus(u);
                      if (saTabFilter === 'pending') return !u.specialAccess.acceptedAt && u.specialAccess.status !== 'declined' && u.specialAccess.status !== 'revoked';
                      if (saTabFilter === 'active') return compStatus === 'active';
                      if (saTabFilter === 'lifetime') return u.specialAccess.accessType === 'lifetime' && u.specialAccess.enabled;
                      if (saTabFilter === 'annual') return u.specialAccess.accessType === 'annual' && u.specialAccess.enabled;
                      if (saTabFilter === 'expired') return compStatus === 'expired';
                      if (saTabFilter === 'revoked') return u.specialAccess.status === 'revoked' || u.specialAccess.status === 'declined';
                      return true;
                    })
                    .filter((u) => {
                      if (!saTabSearchQuery.trim()) return true;
                      const q = saTabSearchQuery.toLowerCase();
                      return (
                        u.name?.toLowerCase().includes(q) ||
                        u.email?.toLowerCase().includes(q) ||
                        u.company?.toLowerCase().includes(q) ||
                        u.specialAccess?.reason?.toLowerCase().includes(q)
                      );
                    })
                    .map((u) => {
                      const compStatus = getSpecialAccessComputedStatus(u);
                      const isLifetime = u.specialAccess?.accessType === 'lifetime';
                      const isAnnual = u.specialAccess?.accessType === 'annual';
                      const isAccepted = !!u.specialAccess?.acceptedAt;
                      const isDeclined = u.specialAccess?.status === 'declined';
                      const daysRemaining = getSpecialAccessDaysRemaining(u);

                      return (
                        <tr key={u.uid} className="hover:bg-slate-850/60 transition-colors">
                          <td className="p-3.5">
                            <div className="font-bold text-white text-xs">{u.name}</div>
                            <div className="text-[11px] text-slate-400">{u.email}</div>
                            {u.company && <div className="text-[10px] text-slate-500">🏢 {u.company}</div>}
                          </td>
                          <td className="p-3.5">
                            <span className="font-bold text-slate-300 uppercase text-[11px]">
                              {u.subscriptionPlan || 'Gratuito'}
                            </span>
                          </td>
                          <td className="p-3.5">
                            <span className={`inline-flex items-center gap-1 text-[10px] font-black uppercase px-2.5 py-1 rounded-full ${
                              isLifetime
                                ? 'bg-gradient-to-r from-amber-500/20 to-yellow-500/20 text-amber-300 border border-amber-500/40 shadow-sm'
                                : isAnnual
                                ? 'bg-sky-500/20 text-sky-300 border border-sky-500/40'
                                : 'bg-purple-500/20 text-purple-300 border border-purple-500/40'
                            }`}>
                              <KeyRound className="w-3 h-3" />
                              <span>{isLifetime ? '👑 Vitalício' : isAnnual ? '📅 1 Ano' : '⏱️ Custom'}</span>
                            </span>
                          </td>
                          <td className="p-3.5 text-slate-300 font-mono text-[11px]">
                            {isLifetime ? (
                              <span className="text-amber-300 font-bold">Permanente (desde {u.specialAccess?.startsAt})</span>
                            ) : (
                              <div>
                                <div>{u.specialAccess?.startsAt} → {u.specialAccess?.expiresAt || '—'}</div>
                                {compStatus === 'active' && (
                                  <div className="text-[10px] text-emerald-400 font-sans font-bold">
                                    {daysRemaining} dias restantes
                                  </div>
                                )}
                              </div>
                            )}
                          </td>
                          <td className="p-3.5">
                            <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase inline-flex items-center gap-1 ${
                              compStatus === 'active'
                                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                                : compStatus === 'pending_acceptance'
                                ? 'bg-yellow-500/20 text-yellow-300 border border-yellow-500/40'
                                : compStatus === 'scheduled'
                                ? 'bg-sky-500/20 text-sky-300 border border-sky-500/40'
                                : isDeclined
                                ? 'bg-orange-500/20 text-orange-300 border border-orange-500/40'
                                : 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                            }`}>
                              <span>●</span>
                              <span>
                                {compStatus === 'active'
                                  ? 'Ativo'
                                  : compStatus === 'pending_acceptance'
                                  ? 'Aguardando Aceite'
                                  : compStatus === 'scheduled'
                                  ? 'Agendado'
                                  : isDeclined
                                  ? 'Recusado'
                                  : compStatus === 'expired'
                                  ? 'Expirado'
                                  : 'Revogado'}
                              </span>
                            </span>
                          </td>
                          <td className="p-3.5 text-[11px]">
                            {isAccepted ? (
                              <div className="space-y-0.5">
                                <span className="inline-flex items-center gap-1 font-bold text-emerald-400">
                                  <Check className="w-3 h-3 text-emerald-400 stroke-[3]" />
                                  <span>Sim, Aceitou</span>
                                </span>
                                <div className="text-[10px] text-slate-400 font-mono">
                                  {new Date(u.specialAccess?.acceptedAt!).toLocaleDateString('pt-BR')} {new Date(u.specialAccess?.acceptedAt!).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                                </div>
                              </div>
                            ) : isDeclined ? (
                              <span className="font-bold text-orange-400">Recusado pelo membro</span>
                            ) : (
                              <span className="inline-flex items-center gap-1 font-semibold text-yellow-400/90">
                                <Clock className="w-3 h-3" />
                                <span>Aguardando Aceite</span>
                              </span>
                            )}
                          </td>
                          <td className="p-3.5 text-slate-400 text-[11px] max-w-[200px] truncate">
                            <div className="font-semibold text-slate-300 truncate">{u.specialAccess?.reason || 'Parceria Comercial'}</div>
                            <div className="text-[10px] text-slate-500 truncate">Por: {u.specialAccess?.grantedBy}</div>
                          </td>
                          <td className="p-3.5 text-right space-x-2 whitespace-nowrap">
                            <button
                              type="button"
                              onClick={() => handleOpenSpecialAccessModal(u)}
                              className="px-3 py-1.5 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/40 text-amber-300 font-bold text-xs transition-colors cursor-pointer"
                            >
                              Editar
                            </button>
                            {(compStatus === 'active' || compStatus === 'pending_acceptance' || compStatus === 'scheduled') && (
                              <button
                                type="button"
                                onClick={() => handleRevokeSpecialAccess(u)}
                                className="px-3 py-1.5 rounded-lg bg-rose-950/60 hover:bg-rose-900/60 border border-rose-800 text-rose-300 font-bold text-xs transition-colors cursor-pointer"
                              >
                                Revogar
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>

              {users.filter((u) => u.specialAccess).length === 0 && (
                <div className="text-center py-12 text-slate-500 space-y-2">
                  <KeyRound className="w-8 h-8 text-slate-600 mx-auto" />
                  <p className="text-sm font-bold text-slate-400">Nenhum membro com Acesso Especial cadastrado</p>
                  <p className="text-xs text-slate-500">
                    Clique no botão acima <span className="text-amber-400 font-bold">+ ADICIONAR MEMBRO</span> para conceder acesso aos recursos Premium.
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: CLIENTS & USERS MANAGEMENT */}
      {adminTab === 'users' && (
        <div className="space-y-4 animate-in fade-in">
          {/* Filters & Status Bar */}
          <div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Buscar por nome, e-mail, empresa ou telefone..."
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-4 py-2 text-xs text-white focus:outline-none focus:border-sky-500"
                />
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                {users.some((u) => u.status === 'pending') && (
                  <button
                    onClick={handleDeleteAllPendingUsers}
                    className="bg-rose-950/80 hover:bg-rose-900 text-rose-300 border border-rose-800/80 px-3 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-md transition-all active:scale-95"
                  >
                    <Trash2 className="w-3.5 h-3.5 text-rose-400" />
                    <span>Excluir Todos os Pendentes ({users.filter((u) => u.status === 'pending').length})</span>
                  </button>
                )}
                <button
                  onClick={() => exportUsersToCsv(users)}
                  className="bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 px-3 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Exportar CSV</span>
                </button>
                <button
                  onClick={() => setIsAddUserModalOpen(true)}
                  className="bg-sky-600 hover:bg-sky-500 text-white px-3 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                >
                  <UserPlus className="w-3.5 h-3.5" />
                  <span>Adicionar Usuário</span>
                </button>
              </div>
            </div>

            {/* Status Pills */}
            <div className="flex items-center gap-2 pt-2 border-t border-slate-800/60 overflow-x-auto">
              <button
                onClick={() => setFilterStatus('all')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold cursor-pointer transition-all ${
                  filterStatus === 'all' ? 'bg-sky-600 text-white shadow-md' : 'bg-slate-950 text-slate-400 hover:text-white'
                }`}
              >
                Todos ({users.length})
              </button>
              <button
                onClick={() => setFilterStatus('active')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold cursor-pointer transition-all ${
                  filterStatus === 'active' ? 'bg-emerald-600 text-white shadow-md' : 'bg-slate-950 text-slate-400 hover:text-white'
                }`}
              >
                Ativos ({users.filter((u) => u.status === 'active').length})
              </button>
              <button
                onClick={() => setFilterStatus('special_access')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold cursor-pointer transition-all flex items-center gap-1 ${
                  filterStatus === 'special_access'
                    ? 'bg-amber-600 text-white shadow-md'
                    : 'bg-slate-950 text-amber-400/80 hover:text-amber-300'
                }`}
              >
                <KeyRound className="w-3.5 h-3.5" />
                <span>🔑 Acesso Especial ({users.filter((u) => hasSpecialAccessActive(u)).length})</span>
              </button>
              <button
                onClick={() => setFilterStatus('special_lifetime')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold cursor-pointer transition-all ${
                  filterStatus === 'special_lifetime'
                    ? 'bg-gradient-to-r from-amber-600 to-yellow-600 text-white shadow-md'
                    : 'bg-slate-950 text-slate-400 hover:text-white'
                }`}
              >
                👑 Vitalício ({users.filter((u) => hasSpecialAccessActive(u) && u.specialAccess?.accessType === 'lifetime').length})
              </button>
              <button
                onClick={() => setFilterStatus('special_expiring')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold cursor-pointer transition-all ${
                  filterStatus === 'special_expiring'
                    ? 'bg-orange-600 text-white shadow-md'
                    : 'bg-slate-950 text-slate-400 hover:text-white'
                }`}
              >
                ⏳ Expira em 30d (
                {
                  users.filter((u) => {
                    if (!hasSpecialAccessActive(u) || !u.specialAccess?.expiresAt) return false;
                    const exp = new Date(u.specialAccess.expiresAt).getTime();
                    const diff = (exp - Date.now()) / (1000 * 60 * 60 * 24);
                    return diff >= 0 && diff <= 30;
                  }).length
                }
                )
              </button>
              <button
                onClick={() => setFilterStatus('pending')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold cursor-pointer transition-all ${
                  filterStatus === 'pending' ? 'bg-slate-800 text-slate-300 shadow-md' : 'bg-slate-950 text-slate-400 hover:text-white'
                }`}
              >
                Pendentes ({users.filter((u) => u.status === 'pending').length})
              </button>
              <button
                onClick={() => setFilterStatus('blocked')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold cursor-pointer transition-all ${
                  filterStatus === 'blocked' ? 'bg-rose-600 text-white shadow-md' : 'bg-slate-950 text-slate-400 hover:text-white'
                }`}
              >
                Bloqueados ({users.filter((u) => u.status === 'blocked' || u.subscriptionStatus === 'suspended').length})
              </button>
            </div>
          </div>

          {/* Users Table */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-950/80 text-slate-400 border-b border-slate-800 font-extrabold uppercase tracking-wider text-[10px]">
                  <tr>
                    <th className="p-3.5">Cliente</th>
                    <th className="p-3.5">Empresa</th>
                    <th className="p-3.5">Plano / Valor</th>
                    <th className="p-3.5">Status</th>
                    <th className="p-3.5 text-right">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {filteredUsers.map((u) => {
                    const isBlocked = u.status === 'blocked' || u.subscriptionStatus === 'suspended';
                    const isSelected = selectedActiveUserUid === u.uid;
                    return (
                      <tr
                        key={u.uid}
                        onClick={() => setSelectedActiveUserUid(isSelected ? '' : u.uid)}
                        className={`transition-colors cursor-pointer ${
                          isSelected
                            ? 'bg-sky-950/40 ring-1 ring-inset ring-sky-500/50'
                            : 'hover:bg-slate-800/40'
                        }`}
                      >
                        <td className="p-3.5">
                          <div className="font-bold text-white">{u.name}</div>
                          <div className="text-[11px] text-slate-400">{u.email}</div>
                          {u.phone && <div className="text-[10px] text-sky-400">{u.phone}</div>}
                        </td>
                        <td className="p-3.5 text-slate-300">{u.company || '—'}</td>
                        <td className="p-3.5">
                          <span className="font-bold text-emerald-400">
                            R$ {(u.subscriptionValue || 44.99).toFixed(2).replace('.', ',')}
                          </span>
                          <span className="text-[10px] text-slate-400 block">{u.subscriptionPlan || 'pro_mensal'}</span>
                        </td>
                        <td className="p-3.5">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase ${
                              isBlocked
                                ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                                : u.status === 'active'
                                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                                : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                            }`}
                          >
                            {isBlocked ? 'Bloqueado' : u.status === 'active' ? 'Ativo' : 'Pendente'}
                          </span>
                          {u.blockReason && (
                            <div className="text-[9px] text-rose-400 mt-1 font-medium italic">
                              Motivo: {u.blockReason}
                            </div>
                          )}
                        </td>
                        <td className="p-3.5 text-right space-x-1.5">
                          {u.status === 'pending' && (
                            <button
                              onClick={() => handleApproveUser(u)}
                              title="Aprovar Acesso"
                              className="p-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg transition-all cursor-pointer shadow-md"
                            >
                              <UserCheck className="w-4 h-4" />
                            </button>
                          )}
                          {isBlocked ? (
                            <button
                              onClick={() => handleUnblockUser(u)}
                              title="Desbloquear Usuário"
                              className="p-1.5 bg-emerald-950/60 hover:bg-emerald-800 border border-emerald-500/40 text-emerald-300 rounded-lg transition-all cursor-pointer"
                            >
                              <Unlock className="w-4 h-4" />
                            </button>
                          ) : (
                            <button
                              onClick={() => {
                                setBlockingUser(u);
                                setBlockReason('');
                              }}
                              title="Bloquear Usuário"
                              className="p-1.5 bg-amber-950/60 hover:bg-amber-800 border border-amber-500/40 text-amber-300 rounded-lg transition-all cursor-pointer"
                            >
                              <Lock className="w-4 h-4" />
                            </button>
                          )}
                          <button
                            onClick={() => handleSendWhatsAppBilling(u)}
                            title="Cobrar via WhatsApp"
                            className="p-1.5 bg-emerald-900/40 hover:bg-emerald-700 border border-emerald-600/40 text-emerald-400 rounded-lg transition-all cursor-pointer"
                          >
                            <Send className="w-4 h-4" />
                          </button>
                          {u.email !== 'alexandre1604981@gmail.com' && (
                            <button
                              onClick={() => handleDeleteUser(u)}
                              title="Excluir Permanentemente"
                              className="p-1.5 bg-rose-950/60 hover:bg-rose-800 border border-rose-600/40 text-rose-300 rounded-lg transition-all cursor-pointer"
                            >
                              <Trash2 className="w-4 h-4 text-rose-400" />
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: SUBSCRIPTIONS */}
      {adminTab === 'subscriptions' && (
        <div className="space-y-4 animate-in fade-in">
          <div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <h3 className="text-sm font-extrabold text-white">Controle de Vigência & Cobrança Pix</h3>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setSubscriptionFilter('all')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold cursor-pointer ${
                  subscriptionFilter === 'all' ? 'bg-amber-600 text-white' : 'bg-slate-950 text-slate-400'
                }`}
              >
                Todos
              </button>
              <button
                onClick={() => setSubscriptionFilter('active')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold cursor-pointer ${
                  subscriptionFilter === 'active' ? 'bg-emerald-600 text-white' : 'bg-slate-950 text-slate-400'
                }`}
              >
                Ativos
              </button>
              <button
                onClick={() => setSubscriptionFilter('overdue')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold cursor-pointer ${
                  subscriptionFilter === 'overdue' ? 'bg-rose-600 text-white' : 'bg-slate-950 text-slate-400'
                }`}
              >
                Inadimplentes
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredSubscriptions.map((u) => {
              const isOverdue = u.subscriptionExpiresAt ? new Date(u.subscriptionExpiresAt).getTime() < Date.now() : false;
              return (
                <div key={u.uid} className="bg-slate-900 border border-slate-800 p-4 rounded-2xl shadow-lg space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="font-extrabold text-white text-xs truncate">{u.name}</h4>
                      <p className="text-[10px] text-slate-400 truncate">{u.company || u.email}</p>
                    </div>
                    <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${
                      isOverdue ? 'bg-rose-500/20 text-rose-300' : 'bg-emerald-500/20 text-emerald-300'
                    }`}>
                      {isOverdue ? 'Vencido' : 'Em Dia'}
                    </span>
                  </div>

                  <div className="bg-slate-950 p-2.5 rounded-xl text-xs flex justify-between items-center">
                    <span className="text-slate-400">Vencimento:</span>
                    <span className="font-bold text-white">
                      {u.subscriptionExpiresAt ? new Date(u.subscriptionExpiresAt).toLocaleDateString('pt-BR') : '—'}
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleExtend7Days(u)}
                      className="flex-1 bg-sky-950/80 hover:bg-sky-800 border border-sky-500/40 text-sky-300 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer"
                    >
                      +7 Dias Cortesia
                    </button>
                    <button
                      onClick={() => handleSendWhatsAppBilling(u)}
                      className="bg-emerald-600 hover:bg-emerald-500 text-white p-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer"
                    >
                      <Send className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* TAB 4: PLANS & SHOWCASE */}
      {adminTab === 'plans' && (
        <div className="space-y-4 animate-in fade-in">
          <div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl flex items-center justify-between">
            <div>
              <h3 className="text-sm font-extrabold text-white">Gerenciamento Central de Planos & Vitrine</h3>
              <p className="text-xs text-slate-400">
                Ative ou oculte planos para definir exatamente quantos aparecem na vitrine do app.
              </p>
            </div>
            <button
              onClick={() => {
                setIsCreatingPlan(true);
                setEditingPlan({
                  id: `plan_${Date.now()}`,
                  name: '',
                  tag: 'Novo Plano',
                  originalPrice: 97.99,
                  price: 44.99,
                  discountBadge: '54% OFF',
                  billingPeriod: '/mês',
                  features: ['Mapas PDF Ilimitados', 'Medição de Madeira (m³)'],
                  activeInShowcase: true,
                });
                setPlanModalName('');
                setPlanModalTag('Novo');
                setPlanModalOriginalPrice(97.99);
                setPlanModalPrice(44.99);
                setPlanModalBadge('54% OFF');
                setPlanModalPeriod('/mês');
                setPlanModalActiveInShowcase(true);
                setPlanModalFeaturesText('Mapas PDF Ilimitados\nMedição de Madeira (m³)\nRelatórios com Fotos');
              }}
              className="bg-purple-600 hover:bg-purple-500 text-white px-3.5 py-2 rounded-xl text-xs font-black flex items-center gap-1.5 cursor-pointer shadow-md"
            >
              <Plus className="w-4 h-4" />
              <span>Novo Plano</span>
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {plans.map((p, idx) => (
              <div key={p.id} className="bg-slate-900 border border-slate-800 p-5 rounded-2xl shadow-xl flex flex-col justify-between space-y-4">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[10px] font-black uppercase px-2 py-0.5 bg-slate-800 text-slate-300 rounded-md">
                      {p.tag}
                    </span>
                    <button
                      onClick={() => handleTogglePlanShowcase(p.id)}
                      className={`px-2.5 py-1 rounded-full text-[10px] font-black flex items-center gap-1 cursor-pointer ${
                        p.activeInShowcase !== false
                          ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                          : 'bg-slate-800 text-slate-500 border border-slate-700'
                      }`}
                    >
                      {p.activeInShowcase !== false ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
                      <span>{p.activeInShowcase !== false ? 'Visível na Vitrine' : 'Oculto'}</span>
                    </button>
                  </div>

                  <h4 className="text-base font-black text-white">{p.name}</h4>
                  <div className="mt-2 flex items-baseline gap-2">
                    <span className="text-xs text-slate-500 line-through">R$ {p.originalPrice?.toFixed(2)}</span>
                    <span className="text-xl font-black text-emerald-400">R$ {p.price?.toFixed(2)}</span>
                    <span className="text-xs text-slate-400">{p.billingPeriod || '/mês'}</span>
                  </div>

                  <ul className="mt-4 space-y-1.5 text-xs text-slate-300">
                    {p.features?.map((f, i) => (
                      <li key={i} className="flex items-center gap-2">
                        <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                        <span className="truncate">{f}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="pt-3 border-t border-slate-800 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => handleMovePlan(idx, 'up')}
                      disabled={idx === 0}
                      title="Mover para Cima"
                      className="p-1.5 bg-slate-950 hover:bg-slate-800 rounded text-slate-400 disabled:opacity-30 cursor-pointer"
                    >
                      <ArrowUp className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => handleMovePlan(idx, 'down')}
                      disabled={idx === plans.length - 1}
                      title="Mover para Baixo"
                      className="p-1.5 bg-slate-950 hover:bg-slate-800 rounded text-slate-400 disabled:opacity-30 cursor-pointer"
                    >
                      <ArrowDown className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => handleDuplicatePlan(p)}
                      title="Duplicar Plano"
                      className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg cursor-pointer"
                    >
                      <Copy className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => {
                        setEditingPlan(p);
                        setIsCreatingPlan(false);
                        setPlanModalName(p.name);
                        setPlanModalTag(p.tag);
                        setPlanModalOriginalPrice(p.originalPrice !== undefined ? p.originalPrice : p.price);
                        setPlanModalPrice(p.price);
                        setPlanModalBadge(p.discountBadge || '');
                        setPlanModalPeriod(p.billingPeriod || (p.price === 0 ? '/sempre' : '/mês'));
                        setPlanModalActiveInShowcase(p.activeInShowcase !== false);
                        setPlanModalHighlight(Boolean(p.highlight));
                        setPlanModalPromoPrice(p.promoPrice !== undefined ? String(p.promoPrice) : '');
                        setPlanModalPromoStartsAt(p.promoStartsAt || '');
                        setPlanModalPromoExpiresAt(p.promoExpiresAt || '');
                        setPlanModalFeaturesText(Array.isArray(p.features) ? p.features.join('\n') : '');
                        setPlanModalAllFeatures(p.allFeaturesAccess !== false);
                        setPlanModalAllowedKeys(p.allowedFeatureKeys || ALL_FEATURE_KEYS);
                      }}
                      className="p-1.5 bg-purple-600 hover:bg-purple-500 text-white rounded-lg cursor-pointer"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 5: COUPONS */}
      {adminTab === 'coupons' && (() => {
        const filteredCoupons = coupons.filter((c) => {
          const matchesSearch = c.code.toLowerCase().includes(couponSearchQuery.toLowerCase()) ||
            (c.notes && c.notes.toLowerCase().includes(couponSearchQuery.toLowerCase()));

          const isExpired = new Date(c.validUntil) < new Date();
          const isExhausted = (c.usedCount || 0) >= (c.maxUses || 50);

          if (couponStatusFilter === 'active') return matchesSearch && c.active && !isExpired && !isExhausted;
          if (couponStatusFilter === 'inactive') return matchesSearch && !c.active;
          if (couponStatusFilter === 'expired') return matchesSearch && (isExpired || isExhausted);
          return matchesSearch;
        });

        return (
          <div className="space-y-4 animate-in fade-in">
            {/* Header / Stats */}
            <div className="bg-slate-900 border border-slate-800 p-4 sm:p-5 rounded-3xl flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-xl">
              <div>
                <h3 className="text-base font-black text-white flex items-center gap-2">
                  <Tag className="w-5 h-5 text-pink-400" />
                  <span>Cupons de Desconto & Campanhas Promocionais</span>
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Crie cupons de desconto para campanhas no checkout via Pix ou novos cadastros.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setIsCouponModalOpen(true)}
                  className="bg-gradient-to-r from-pink-600 to-rose-600 hover:from-pink-500 hover:to-rose-500 text-white px-4 py-2.5 rounded-xl text-xs font-black flex items-center justify-center gap-2 shadow-lg shadow-pink-950/50 cursor-pointer active:scale-95 transition-all"
                >
                  <Plus className="w-4 h-4" />
                  <span>Novo Cupom</span>
                </button>
              </div>
            </div>

            {/* Filter Bar */}
            <div className="bg-slate-900/90 border border-slate-800 p-3 rounded-2xl flex flex-col sm:flex-row items-center justify-between gap-3">
              <div className="relative w-full sm:w-72">
                <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={couponSearchQuery}
                  onChange={(e) => setCouponSearchQuery(e.target.value)}
                  placeholder="Buscar por código ou observação..."
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-pink-500 transition-colors"
                />
              </div>

              <div className="flex items-center gap-1.5 w-full sm:w-auto overflow-x-auto">
                <button
                  type="button"
                  onClick={() => setCouponStatusFilter('all')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-colors cursor-pointer ${
                    couponStatusFilter === 'all'
                      ? 'bg-pink-600 text-white shadow'
                      : 'bg-slate-950 text-slate-400 hover:text-white border border-slate-800'
                  }`}
                >
                  Todos ({coupons.length})
                </button>
                <button
                  type="button"
                  onClick={() => setCouponStatusFilter('active')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-colors cursor-pointer ${
                    couponStatusFilter === 'active'
                      ? 'bg-emerald-600 text-white shadow'
                      : 'bg-slate-950 text-slate-400 hover:text-white border border-slate-800'
                  }`}
                >
                  Ativos
                </button>
                <button
                  type="button"
                  onClick={() => setCouponStatusFilter('inactive')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-colors cursor-pointer ${
                    couponStatusFilter === 'inactive'
                      ? 'bg-amber-600 text-white shadow'
                      : 'bg-slate-950 text-slate-400 hover:text-white border border-slate-800'
                  }`}
                >
                  Pausados
                </button>
                <button
                  type="button"
                  onClick={() => setCouponStatusFilter('expired')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-colors cursor-pointer ${
                    couponStatusFilter === 'expired'
                      ? 'bg-rose-600 text-white shadow'
                      : 'bg-slate-950 text-slate-400 hover:text-white border border-slate-800'
                  }`}
                >
                  Expirados/Esgotados
                </button>
              </div>
            </div>

            {/* Coupons Grid */}
            {filteredCoupons.length === 0 ? (
              <div className="bg-slate-900/60 border border-slate-800 rounded-3xl p-8 text-center space-y-3">
                <div className="w-12 h-12 rounded-2xl bg-pink-500/10 text-pink-400 flex items-center justify-center mx-auto">
                  <Tag className="w-6 h-6" />
                </div>
                <h4 className="text-sm font-bold text-white">Nenhum cupom encontrado</h4>
                <p className="text-xs text-slate-400 max-w-sm mx-auto">
                  Clique em "Novo Cupom" para criar uma campanha de desconto promocional.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
                {filteredCoupons.map((c) => {
                  const isExpired = new Date(c.validUntil) < new Date();
                  const isExhausted = (c.usedCount || 0) >= (c.maxUses || 50);

                  return (
                    <div
                      key={c.id}
                      className={`bg-slate-900 border rounded-2xl p-4 shadow-lg flex flex-col justify-between gap-3 transition-all ${
                        !c.active
                          ? 'border-slate-800 opacity-60'
                          : isExpired || isExhausted
                          ? 'border-rose-900/60 bg-rose-950/10'
                          : 'border-slate-800 hover:border-pink-500/40'
                      }`}
                    >
                      <div className="space-y-2.5">
                        <div className="flex items-center justify-between gap-2">
                          <button
                            type="button"
                            onClick={() => handleCopyCouponCode(c.code)}
                            title="Clique para copiar código"
                            className="font-mono font-black text-sm text-pink-300 bg-pink-950/80 hover:bg-pink-900/80 px-2.5 py-1 rounded-lg border border-pink-500/40 flex items-center gap-1.5 cursor-pointer transition-colors active:scale-95"
                          >
                            <span>{c.code}</span>
                            <span className="text-[10px] text-pink-400">📋</span>
                          </button>

                          <span className="text-xs font-extrabold text-emerald-400 bg-emerald-950/60 border border-emerald-500/30 px-2 py-0.5 rounded-lg">
                            {c.discountType === 'fixed'
                              ? `R$ ${Number(c.discountFixed || 0).toFixed(2)} OFF`
                              : `${c.discountPercent || 0}% OFF`}
                          </span>
                        </div>

                        <div className="text-[11px] text-slate-400 space-y-1 bg-slate-950/60 p-2.5 rounded-xl border border-slate-800/80">
                          <div className="flex items-center justify-between">
                            <span className="text-slate-500">Status:</span>
                            <span className={`font-bold ${
                              !c.active
                                ? 'text-slate-400'
                                : isExpired
                                ? 'text-rose-400'
                                : isExhausted
                                ? 'text-amber-400'
                                : 'text-emerald-400'
                            }`}>
                              {!c.active
                                ? '⚪ Pausado'
                                : isExpired
                                ? '🔴 Expirado'
                                : isExhausted
                                ? '🟡 Esgotado'
                                : '🟢 Ativo'}
                            </span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-slate-500">Validade:</span>
                            <span className="text-slate-200 font-medium">
                              {new Date(c.validUntil + 'T00:00:00').toLocaleDateString('pt-BR')}
                            </span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-slate-500">Utilizações:</span>
                            <span className="text-slate-200 font-bold">
                              {c.usedCount || 0} / {c.maxUses || 'Ilimitado'}
                            </span>
                          </div>
                          {c.applicablePlans && c.applicablePlans.length > 0 && (
                            <div className="flex items-center justify-between">
                              <span className="text-slate-500">Plano:</span>
                              <span className="text-sky-300 font-bold uppercase text-[10px]">
                                {c.applicablePlans.join(', ')}
                              </span>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Card Actions */}
                      <div className="flex items-center justify-end gap-1.5 pt-1 border-t border-slate-800/80">
                        <button
                          type="button"
                          onClick={() => handleToggleCouponStatus(c)}
                          className={`px-2.5 py-1.5 rounded-lg text-[11px] font-bold transition-colors cursor-pointer ${
                            c.active
                              ? 'bg-slate-800 hover:bg-slate-750 text-slate-300'
                              : 'bg-emerald-950/80 hover:bg-emerald-900/80 text-emerald-300 border border-emerald-500/30'
                          }`}
                        >
                          {c.active ? 'Pausar' : 'Ativar'}
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteCoupon(c)}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-950/40 transition-colors cursor-pointer"
                          title="Excluir Cupom"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })()}

      {/* TAB 6: AUDIT TRAIL & SYSTEM CONFIG */}
      {adminTab === 'audit_and_settings' && (
        <div className="space-y-5 animate-in fade-in">
          {/* Audit Logs Table */}
          <div className="bg-slate-900 border border-slate-800 p-5 rounded-3xl space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h3 className="text-base font-black text-white flex items-center gap-2">
                  <History className="w-5 h-5 text-sky-400" />
                  <span>Trilha de Auditoria (Audit Logs)</span>
                </h3>
                <p className="text-xs text-slate-400">
                  Registro imutável de todas as ações críticas executadas pelos administradores.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => exportAuditLogsToCsv(auditLogs)}
                  className="bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Exportar Logs (CSV)</span>
                </button>
              </div>
            </div>

            <div className="overflow-x-auto rounded-xl border border-slate-800">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-950 text-slate-400 uppercase text-[10px] tracking-wider font-extrabold">
                  <tr>
                    <th className="p-3">Data / Hora</th>
                    <th className="p-3">Administrador</th>
                    <th className="p-3">Ação</th>
                    <th className="p-3">Alvo</th>
                    <th className="p-3">Justificativa</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {filteredAuditLogs.slice(0, 50).map((l) => (
                    <tr key={l.id} className="hover:bg-slate-800/30">
                      <td className="p-3 text-[11px] text-slate-400">
                        {new Date(l.createdAt).toLocaleString('pt-BR')}
                      </td>
                      <td className="p-3 font-bold text-white">{l.adminEmail || l.adminName}</td>
                      <td className="p-3">
                        <span className="font-mono text-[10px] bg-slate-800 px-2 py-0.5 rounded text-sky-300">
                          {l.action}
                        </span>
                      </td>
                      <td className="p-3 text-slate-300">{l.targetName || l.targetId}</td>
                      <td className="p-3 text-slate-400">{l.reason}</td>
                    </tr>
                  ))}
                  {filteredAuditLogs.length === 0 && (
                    <tr>
                      <td colSpan={5} className="p-6 text-center text-slate-500">
                        Nenhum registro de auditoria encontrado.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Global Settings & Feature Flags */}
          <form onSubmit={handleSaveBillingConfig} className="bg-slate-900 border border-slate-800 p-5 rounded-3xl space-y-4">
            <h3 className="text-base font-black text-white flex items-center gap-2">
              <Settings className="w-5 h-5 text-emerald-400" />
              <span>Configurações Comerciais & Feature Flags</span>
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">Chave Pix Oficial</label>
                <input
                  type="text"
                  value={billingConfig.pixKey}
                  onChange={(e) => setBillingConfig({ ...billingConfig, pixKey: e.target.value })}
                  placeholder="CNPJ ou chave Pix"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">Nome do Titular / Razão Social</label>
                <input
                  type="text"
                  value={billingConfig.beneficiaryName}
                  onChange={(e) => setBillingConfig({ ...billingConfig, beneficiaryName: e.target.value })}
                  placeholder="AM TST SAÚDE E SEGURANÇA"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white"
                />
              </div>
            </div>

            <div className="pt-2 flex justify-end">
              <button
                type="submit"
                disabled={savingBilling}
                className="bg-emerald-600 hover:bg-emerald-500 text-white px-5 py-2 rounded-xl text-xs font-black shadow-lg cursor-pointer"
              >
                {savingBilling ? 'Salvando...' : 'Salvar Configurações Globais'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* MODAL: BLOCK USER WITH MANDATORY REASON */}
      {blockingUser && (
        <div className="fixed inset-0 z-[9999] bg-black/80 backdrop-blur-sm flex items-center justify-center p-3">
          <div className="bg-slate-900 border border-rose-500/40 w-full max-w-md rounded-2xl shadow-2xl p-5 space-y-4">
            <div className="flex items-center gap-2 text-rose-400">
              <AlertTriangle className="w-5 h-5 shrink-0" />
              <h3 className="text-sm font-black text-white">Bloqueio Seguro de Usuário</h3>
            </div>
            <p className="text-xs text-slate-300">
              Você está prestes a suspender o acesso de <strong className="text-white">{blockingUser.name}</strong> ({blockingUser.email}).
            </p>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-400 font-bold mb-1">Tipo de Bloqueio</label>
                <select
                  value={blockType}
                  onChange={(e) => setBlockType(e.target.value as any)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white font-bold"
                >
                  <option value="security">Violação de Termos / Segurança</option>
                  <option value="overdue">Suspensão por Inadimplência</option>
                  <option value="requested">Solicitado pelo Cliente</option>
                  <option value="deactivated">Desativação de Conta</option>
                </select>
              </div>

              <div>
                <label className="block text-slate-400 font-bold mb-1">Justificativa do Bloqueio (Obrigatório) *</label>
                <textarea
                  value={blockReason}
                  onChange={(e) => setBlockReason(e.target.value)}
                  placeholder="Informe o motivo detalhado para registro na trilha de auditoria..."
                  rows={3}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-white focus:outline-none focus:border-rose-500"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                onClick={() => setBlockingUser(null)}
                className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 font-bold text-xs cursor-pointer"
              >
                Cancelar
              </button>
              <button
                onClick={handleConfirmBlockUser}
                disabled={savingBlock || !blockReason.trim()}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-black text-xs disabled:opacity-50 cursor-pointer shadow-lg"
              >
                {savingBlock ? 'Bloqueando...' : 'Confirmar Bloqueio Seguro'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: VIEW PLAN FEATURES DETAILS */}
      {viewingPlanFeatures && (
        <div className="fixed inset-0 z-[9999] bg-black/80 backdrop-blur-sm flex items-center justify-center p-3">
          <div className="bg-slate-900 border border-slate-800 w-full max-w-lg rounded-2xl shadow-2xl p-5 space-y-4 max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-base font-black text-white">{viewingPlanFeatures.name}</span>
                  <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-slate-800 text-slate-300">
                    {viewingPlanFeatures.tag}
                  </span>
                </div>
                <p className="text-xs text-slate-400 mt-0.5">
                  R$ {viewingPlanFeatures.price.toFixed(2).replace('.', ',')} {viewingPlanFeatures.billingPeriod || '/mês'}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setViewingPlanFeatures(null)}
                className="p-1.5 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto space-y-3 pr-1 text-xs">
              <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 flex items-center justify-between">
                <span className="font-bold text-slate-300">Status de Permissão Geral:</span>
                <span className="font-black text-emerald-400">
                  {viewingPlanFeatures.allFeaturesAccess
                    ? 'Acesso Completo (Todas as Funcionalidades)'
                    : `${(viewingPlanFeatures.allowedFeatureKeys || []).length} de ${SYSTEM_FEATURES.length} Recursos Liberados`}
                </span>
              </div>

              <div className="space-y-2">
                {SYSTEM_FEATURES.map((feat) => {
                  const isLiberado =
                    viewingPlanFeatures.allFeaturesAccess ||
                    (Array.isArray(viewingPlanFeatures.allowedFeatureKeys) &&
                      viewingPlanFeatures.allowedFeatureKeys.includes(feat.key));

                  return (
                    <div
                      key={feat.key}
                      className={`p-2.5 rounded-xl border flex items-center justify-between gap-2 ${
                        isLiberado
                          ? 'bg-emerald-950/20 border-emerald-500/40 text-white'
                          : 'bg-slate-950 border-slate-800/80 text-slate-500 opacity-60'
                      }`}
                    >
                      <div>
                        <div className="font-bold text-xs flex items-center gap-1.5">
                          {isLiberado ? (
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                          ) : (
                            <Lock className="w-3.5 h-3.5 text-slate-600" />
                          )}
                          <span>{feat.name}</span>
                        </div>
                        <p className="text-[10px] text-slate-400 mt-0.5">{feat.description}</p>
                      </div>
                      <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-full border ${
                        isLiberado
                          ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                          : 'bg-slate-900 text-slate-600 border-slate-800'
                      }`}>
                        {isLiberado ? 'Liberado' : 'Bloqueado'}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="pt-2 border-t border-slate-800 flex justify-end">
              <button
                type="button"
                onClick={() => setViewingPlanFeatures(null)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs rounded-xl cursor-pointer"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: EDIT/CREATE PLAN */}
      {editingPlan && (
        <div className="fixed inset-0 z-[9999] bg-black/80 backdrop-blur-sm flex items-center justify-center p-3">
          <form onSubmit={handleSavePlanChanges} className="bg-slate-900 border border-purple-500/40 w-full max-w-lg rounded-2xl shadow-2xl p-5 space-y-4 max-h-[90dvh] overflow-y-auto">
            <h3 className="text-sm font-black text-white">{isCreatingPlan ? 'Novo Plano' : 'Editar Plano'}</h3>

            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="col-span-2">
                <label className="block text-slate-400 font-bold mb-1">Nome do Plano *</label>
                <input
                  type="text"
                  value={planModalName}
                  onChange={(e) => setPlanModalName(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white font-bold"
                  required
                />
              </div>

              <div>
                <label className="block text-slate-400 font-bold mb-1">Preço Original R$</label>
                <input
                  type="number"
                  step="0.01"
                  value={planModalOriginalPrice}
                  onChange={(e) => setPlanModalOriginalPrice(Number(e.target.value))}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white font-bold"
                />
              </div>

              <div>
                <label className="block text-slate-400 font-bold mb-1">Preço Final R$ *</label>
                <input
                  type="number"
                  step="0.01"
                  value={planModalPrice}
                  onChange={(e) => setPlanModalPrice(Number(e.target.value))}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-emerald-400 font-black"
                  required
                />
              </div>

              {/* Período de Cobrança: Mensal ou Anual */}
              <div className="col-span-2">
                <label className="block text-slate-400 font-bold mb-1">Período de Cobrança *</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setPlanModalPeriod('/mês')}
                    className={`py-2 px-3 rounded-xl border text-xs font-black flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                      planModalPeriod === '/mês'
                        ? 'bg-purple-600 border-purple-400 text-white shadow-md'
                        : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-white'
                    }`}
                  >
                    <Calendar className="w-3.5 h-3.5" />
                    <span>Mensal (/mês)</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setPlanModalPeriod('/ano')}
                    className={`py-2 px-3 rounded-xl border text-xs font-black flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                      planModalPeriod === '/ano'
                        ? 'bg-purple-600 border-purple-400 text-white shadow-md'
                        : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-white'
                    }`}
                  >
                    <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                    <span>Anual (/ano)</span>
                  </button>
                </div>
              </div>

              <div className="col-span-2">
                <label className="block text-slate-400 font-bold mb-1">Selo / Etiqueta de Desconto</label>
                <input
                  type="text"
                  value={planModalBadge}
                  onChange={(e) => setPlanModalBadge(e.target.value)}
                  placeholder="Ex: 54% OFF • LANÇAMENTO ou ECONOMIZE 20% NO ANUAL"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white font-bold"
                />
              </div>

              <div className="col-span-2">
                <label className="block text-slate-400 font-bold mb-1">Texto de Benefícios na Vitrine (1 por linha)</label>
                <textarea
                  value={planModalFeaturesText}
                  onChange={(e) => setPlanModalFeaturesText(e.target.value)}
                  rows={3}
                  placeholder="Mapas PDF e GPS Ilimitados&#10;Medição de Pilha de Madeira (m³)&#10;Relatórios Técnicos em PDF com Fotos"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-white font-mono text-xs"
                />
              </div>

              {/* SEÇÃO: FUNCIONALIDADES DISPONÍVEIS NESTE PLANO (RBAC / ENTITLEMENTS) */}
              <div className="col-span-2 pt-3 border-t border-slate-800 space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div>
                    <h4 className="text-xs font-black uppercase tracking-wider text-emerald-400 flex items-center gap-1.5">
                      <ShieldCheck className="w-4 h-4" />
                      <span>Funcionalidades Disponíveis Neste Plano</span>
                    </h4>
                    <p className="text-[11px] text-slate-400">
                      Defina exatamente quais módulos e recursos do sistema estarão liberados para os usuários deste plano.
                    </p>
                  </div>

                  <div className="flex items-center gap-1.5 text-xs">
                    <span className="px-2.5 py-1 rounded-full bg-slate-950 border border-slate-800 font-black text-white text-[11px]">
                      {planModalAllFeatures
                        ? `${SYSTEM_FEATURES.length} de ${SYSTEM_FEATURES.length} Liberadas`
                        : `${planModalAllowedKeys.length} de ${SYSTEM_FEATURES.length} Liberadas`}
                    </span>
                  </div>
                </div>

                {/* Master Switch: Acesso Completo ao Sistema */}
                <div className="p-3.5 rounded-2xl bg-gradient-to-r from-purple-950/50 via-slate-950 to-slate-950 border border-purple-500/40 flex items-center justify-between gap-3 shadow-md">
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2">
                      <Crown className="w-4 h-4 text-amber-400" />
                      <span className="text-xs font-black text-white">Acesso Completo ao Sistema</span>
                    </div>
                    <p className="text-[10px] text-slate-400">
                      Libera 100% de todas as funcionalidades atuais e futuras para os assinantes deste plano (Ideal para Planos Pro / Enterprise).
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setPlanModalAllFeatures(!planModalAllFeatures)}
                    className={`px-3.5 py-1.5 rounded-xl font-black text-xs transition-all flex items-center gap-1.5 cursor-pointer ${
                      planModalAllFeatures
                        ? 'bg-purple-600 text-white shadow-lg shadow-purple-900/50'
                        : 'bg-slate-800 text-slate-400 hover:text-white'
                    }`}
                  >
                    {planModalAllFeatures ? 'LIBERADO (TOTAL)' : 'PERSONALIZAR'}
                  </button>
                </div>

                {/* Granular Feature Checkboxes (When not in allFeaturesAccess mode) */}
                {!planModalAllFeatures && (
                  <div className="space-y-3 p-3 bg-slate-950/70 border border-slate-800/80 rounded-2xl animate-in fade-in">
                    {/* Search and Quick Batch Selectors */}
                    <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2">
                      <div className="relative flex-1">
                        <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                        <input
                          type="text"
                          value={planModalSearchFeature}
                          onChange={(e) => setPlanModalSearchFeature(e.target.value)}
                          placeholder="Pesquisar funcionalidade ou módulo..."
                          className="w-full bg-slate-900 border border-slate-800 rounded-xl pl-8 pr-3 py-1.5 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-sky-500"
                        />
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <button
                          type="button"
                          onClick={handleSelectAllFeatures}
                          className="px-2.5 py-1 rounded-lg bg-emerald-950/60 hover:bg-emerald-900/80 border border-emerald-500/40 text-emerald-300 font-bold text-[10px] cursor-pointer"
                        >
                          Selecionar Todas
                        </button>
                        <button
                          type="button"
                          onClick={handleDeselectAllFeatures}
                          className="px-2.5 py-1 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-400 hover:text-white font-bold text-[10px] cursor-pointer"
                        >
                          Desmarcar Todas
                        </button>
                      </div>
                    </div>

                    {/* Categorized Accordion Groups */}
                    <div className="space-y-2.5 max-h-[350px] overflow-y-auto pr-1">
                      {FEATURE_CATEGORIES.map((cat) => {
                        const catFeatures = SYSTEM_FEATURES.filter(
                          (f) =>
                            f.category === cat.id &&
                            (!planModalSearchFeature.trim() ||
                              f.name.toLowerCase().includes(planModalSearchFeature.toLowerCase()) ||
                              f.description.toLowerCase().includes(planModalSearchFeature.toLowerCase()))
                        );

                        if (catFeatures.length === 0) return null;

                        const isExpanded = planModalExpandedCategories[cat.id] ?? true;
                        const catKeys = catFeatures.map((f) => f.key);
                        const selectedInCatCount = catKeys.filter((k) => planModalAllowedKeys.includes(k)).length;
                        const isCatAllSelected = selectedInCatCount === catKeys.length;

                        return (
                          <div key={cat.id} className="border border-slate-800/90 rounded-xl overflow-hidden bg-slate-900/80">
                            <div className="p-2.5 bg-slate-950/90 flex items-center justify-between gap-2 border-b border-slate-800/80">
                              <button
                                type="button"
                                onClick={() => handleToggleAccordion(cat.id)}
                                className="flex items-center gap-2 font-black text-xs text-white hover:text-sky-400 transition-colors flex-1 text-left cursor-pointer"
                              >
                                {isExpanded ? <ChevronDown className="w-3.5 h-3.5 text-slate-400" /> : <ChevronRight className="w-3.5 h-3.5 text-slate-400" />}
                                <span>{cat.label}</span>
                                <span className="text-[10px] font-normal text-slate-400">
                                  ({selectedInCatCount}/{catFeatures.length})
                                </span>
                              </button>

                              <button
                                type="button"
                                onClick={() => handleToggleCategory(cat.id)}
                                className={`text-[10px] font-bold px-2 py-0.5 rounded-md border transition-all cursor-pointer ${
                                  isCatAllSelected
                                    ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30 hover:bg-rose-500/20 hover:text-rose-300 hover:border-rose-500/30'
                                    : 'bg-slate-800 text-slate-300 border-slate-700 hover:text-white'
                                }`}
                              >
                                {isCatAllSelected ? 'Desmarcar Categoria' : 'Selecionar Categoria'}
                              </button>
                            </div>

                            {isExpanded && (
                              <div className="p-2.5 space-y-2">
                                {catFeatures.map((feat) => {
                                  const isAllowed = planModalAllowedKeys.includes(feat.key);
                                  return (
                                    <div
                                      key={feat.key}
                                      onClick={() => handleToggleFeature(feat.key)}
                                      className={`p-2 rounded-xl border flex items-center justify-between gap-2.5 cursor-pointer transition-all ${
                                        isAllowed
                                          ? 'bg-emerald-950/30 border-emerald-500/50 hover:border-emerald-400'
                                          : 'bg-slate-950/60 border-slate-800/80 hover:border-slate-700 opacity-70'
                                      }`}
                                    >
                                      <div className="flex items-start gap-2">
                                        <div className={`w-4 h-4 rounded mt-0.5 flex items-center justify-center shrink-0 border transition-all ${
                                          isAllowed
                                            ? 'bg-emerald-500 border-emerald-400 text-slate-950'
                                            : 'border-slate-700 bg-slate-900'
                                        }`}>
                                          {isAllowed && <Check className="w-3 h-3 stroke-[3]" />}
                                        </div>
                                        <div>
                                          <div className="text-xs font-bold text-white leading-tight flex items-center gap-1.5">
                                            <span>{feat.name}</span>
                                            {feat.defaultFree && (
                                              <span className="text-[8px] font-black px-1.5 py-0.2 rounded bg-sky-500/20 text-sky-300 border border-sky-500/30">
                                                FREE INCLUSO
                                              </span>
                                            )}
                                          </div>
                                          <p className="text-[10px] text-slate-400 mt-0.5 leading-snug">{feat.description}</p>
                                        </div>
                                      </div>

                                      <div className="shrink-0">
                                        <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-full border ${
                                          isAllowed
                                            ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                                            : 'bg-slate-900 text-slate-500 border-slate-800'
                                        }`}>
                                          {isAllowed ? 'Liberado' : 'Bloqueado'}
                                        </span>
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setEditingPlan(null)}
                className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 font-bold text-xs cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={savingPlanChanges}
                className="px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-black text-xs cursor-pointer shadow-lg"
              >
                {savingPlanChanges ? 'Salvando...' : 'Salvar Plano'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* MODAL: ADD NEW USER / CLIENT */}
      {isAddUserModalOpen && (
        <div className="fixed inset-0 z-[99999] bg-black/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
          <form
            onSubmit={handleAddUser}
            className="bg-slate-900 border border-sky-500/40 w-full max-w-xl rounded-3xl shadow-2xl p-5 sm:p-6 space-y-4 animate-in fade-in my-8"
          >
            {/* Header */}
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-sky-500/20 text-sky-400 border border-sky-500/30 flex items-center justify-center">
                  <UserPlus className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm sm:text-base font-black text-white leading-tight">
                    Adicionar Novo Cliente
                  </h3>
                  <p className="text-[11px] text-slate-400">
                    Cadastre o usuário, vincule o plano comercial e configure o Acesso Especial
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsAddUserModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3.5 text-xs">
              {/* Name & Email */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 font-bold mb-1 uppercase tracking-wider text-[11px]">
                    Nome Completo *
                  </label>
                  <input
                    type="text"
                    value={newUserName}
                    onChange={(e) => setNewUserName(e.target.value)}
                    placeholder="Ex: João da Silva"
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2.5 text-white font-medium focus:outline-none focus:border-sky-500 transition-colors"
                    required
                    autoFocus
                  />
                </div>

                <div>
                  <label className="block text-slate-300 font-bold mb-1 uppercase tracking-wider text-[11px]">
                    E-mail de Acesso *
                  </label>
                  <input
                    type="email"
                    value={newUserEmail}
                    onChange={(e) => setNewUserEmail(e.target.value.toLowerCase().trim())}
                    placeholder="cliente@empresa.com"
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2.5 text-white font-medium focus:outline-none focus:border-sky-500 transition-colors"
                    required
                  />
                </div>
              </div>

              {/* Company & Phone */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 font-bold mb-1 uppercase tracking-wider text-[11px]">
                    Empresa / Órgão
                  </label>
                  <input
                    type="text"
                    value={newUserCompany}
                    onChange={(e) => setNewUserCompany(e.target.value)}
                    placeholder="Ex: Agroflorestal São Paulo"
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white font-medium focus:outline-none focus:border-sky-500 transition-colors"
                  />
                </div>

                <div>
                  <label className="block text-slate-300 font-bold mb-1 uppercase tracking-wider text-[11px]">
                    WhatsApp / Telefone
                  </label>
                  <input
                    type="tel"
                    value={newUserPhone}
                    onChange={(e) => setNewUserPhone(e.target.value)}
                    placeholder="(11) 99999-9999"
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white font-medium focus:outline-none focus:border-sky-500 transition-colors"
                  />
                </div>
              </div>

              {/* Role & Commercial Plan */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 font-bold mb-1 uppercase tracking-wider text-[11px]">
                    Função no Sistema
                  </label>
                  <select
                    value={newUserRole}
                    onChange={(e) => setNewUserRole(e.target.value as UserRole)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-slate-200 font-medium focus:outline-none focus:border-sky-500 transition-colors"
                  >
                    <option value="surveyor">Topógrafo / Pesquisador de Campo</option>
                    <option value="field_lead">Líder de Equipe / Operação</option>
                    <option value="auditor">Auditor / Engenheiro SST</option>
                    <option value="super_admin">Super Administrador</option>
                  </select>
                </div>

                <div>
                  <label className="block text-slate-300 font-bold mb-1 uppercase tracking-wider text-[11px]">
                    Plano Comercial
                  </label>
                  <select
                    value={newUserPlan}
                    onChange={(e) => {
                      const p = e.target.value as SubscriptionPlanType;
                      setNewUserPlan(p);
                      const found = plans.find((pl) => pl.id === p);
                      if (found) {
                        setNewUserSubValue(found.price);
                      } else if (p === 'free') {
                        setNewUserSubValue(0);
                      }
                    }}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-slate-200 font-medium focus:outline-none focus:border-sky-500 transition-colors"
                  >
                    <option value="free">Plano Gratuito ({formatCurrencyBRL(0)})</option>
                    {plans
                      .filter((pl) => pl.id !== 'free')
                      .map((pl) => (
                        <option key={pl.id} value={pl.id}>
                          {pl.name} ({formatCurrencyBRL(pl.price)}{pl.billingPeriod || '/mês'})
                        </option>
                      ))}
                    <option value="personalizado">Plano Personalizado (Valor Livre)</option>
                  </select>
                </div>
              </div>

              {/* SPECIAL ACCESS SECTION (HIGHLIGHTED IN GOLD) */}
              <div className="p-3.5 bg-gradient-to-b from-amber-950/40 via-slate-950 to-slate-950 rounded-2xl border border-amber-500/40 space-y-3 shadow-inner">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 text-amber-300 font-black text-xs uppercase tracking-wider">
                    <KeyRound className="w-4 h-4 text-amber-400" />
                    <span>🔑 Conceder Acesso Especial Exclusivo?</span>
                  </div>
                  <div className="flex items-center gap-1 bg-slate-900 p-0.5 rounded-lg border border-slate-700">
                    <button
                      type="button"
                      onClick={() => setNewUserGrantSpecialAccess(false)}
                      className={`px-2.5 py-1 rounded-md text-[11px] font-bold transition-all cursor-pointer ${
                        !newUserGrantSpecialAccess ? 'bg-slate-800 text-white shadow' : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      Não
                    </button>
                    <button
                      type="button"
                      onClick={() => setNewUserGrantSpecialAccess(true)}
                      className={`px-2.5 py-1 rounded-md text-[11px] font-black transition-all cursor-pointer ${
                        newUserGrantSpecialAccess ? 'bg-amber-600 text-white shadow' : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      Sim (VIP)
                    </button>
                  </div>
                </div>

                {newUserGrantSpecialAccess && (
                  <div className="space-y-3 pt-2 border-t border-slate-800/80 animate-in fade-in">
                    {/* Access Type */}
                    <div>
                      <label className="block text-slate-300 font-bold mb-1.5 uppercase tracking-wider text-[10px]">
                        Tipo de Acesso Especial
                      </label>
                      <div className="grid grid-cols-3 gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            setNewUserSaType('annual');
                            const d = new Date();
                            d.setFullYear(d.getFullYear() + 1);
                            setNewUserSaExpiresAt(d.toISOString().split('T')[0]);
                          }}
                          className={`p-2 rounded-xl border font-bold text-xs text-center transition-all cursor-pointer ${
                            newUserSaType === 'annual'
                              ? 'bg-amber-500/20 border-amber-500 text-amber-300 ring-1 ring-amber-500/30'
                              : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200'
                          }`}
                        >
                          <div className="font-extrabold text-white text-xs">1 Ano</div>
                          <div className="text-[10px] text-slate-400">365 dias</div>
                        </button>

                        <button
                          type="button"
                          onClick={() => setNewUserSaType('custom')}
                          className={`p-2 rounded-xl border font-bold text-xs text-center transition-all cursor-pointer ${
                            newUserSaType === 'custom'
                              ? 'bg-amber-500/20 border-amber-500 text-amber-300 ring-1 ring-amber-500/30'
                              : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200'
                          }`}
                        >
                          <div className="font-extrabold text-white text-xs">Personalizado</div>
                          <div className="text-[10px] text-slate-400">Datas livres</div>
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            setNewUserSaType('lifetime');
                            setNewUserSaExpiresAt('');
                          }}
                          className={`p-2 rounded-xl border font-bold text-xs text-center transition-all cursor-pointer ${
                            newUserSaType === 'lifetime'
                              ? 'bg-gradient-to-r from-amber-500/30 to-emerald-500/30 border-amber-400 text-amber-200 ring-1 ring-amber-500/40'
                              : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200'
                          }`}
                        >
                          <div className="font-extrabold text-amber-300 text-xs">👑 Vitalício</div>
                          <div className="text-[10px] text-slate-400">Permanente</div>
                        </button>
                      </div>
                    </div>

                    {/* Dates */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      <div>
                        <label className="block text-slate-300 font-bold mb-1 uppercase tracking-wider text-[10px]">
                          Data de Início
                        </label>
                        <input
                          type="date"
                          value={newUserSaStartsAt}
                          onChange={(e) => setNewUserSaStartsAt(e.target.value)}
                          className="w-full bg-slate-900 border border-slate-700 rounded-xl px-2.5 py-1.5 text-white font-medium focus:outline-none focus:border-amber-500 text-xs"
                          required
                        />
                      </div>

                      <div>
                        <label className="block text-slate-300 font-bold mb-1 uppercase tracking-wider text-[10px]">
                          Data de Término {newUserSaType === 'lifetime' && '(Sem Expiração)'}
                        </label>
                        <input
                          type="date"
                          value={newUserSaExpiresAt}
                          onChange={(e) => setNewUserSaExpiresAt(e.target.value)}
                          disabled={newUserSaType === 'lifetime'}
                          className="w-full bg-slate-900 border border-slate-700 rounded-xl px-2.5 py-1.5 text-white font-medium focus:outline-none focus:border-amber-500 text-xs disabled:opacity-40"
                          required={newUserSaType !== 'lifetime'}
                        />
                      </div>
                    </div>

                    {/* Reason */}
                    <div>
                      <label className="block text-slate-300 font-bold mb-1 uppercase tracking-wider text-[10px]">
                        Motivo / Justificativa
                      </label>
                      <input
                        type="text"
                        value={newUserSaReason}
                        onChange={(e) => setNewUserSaReason(e.target.value)}
                        placeholder="Ex: Cliente Parceiro, Cortesia, Demonstração"
                        className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-1.5 text-white text-xs focus:outline-none focus:border-amber-500"
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setIsAddUserModalOpen(false)}
                className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-750 text-slate-300 font-bold text-xs cursor-pointer transition-colors"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={savingUser}
                className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-sky-500 to-emerald-500 hover:from-sky-400 hover:to-emerald-400 text-slate-950 font-black text-xs cursor-pointer shadow-lg shadow-sky-950/50 flex items-center gap-1.5 transition-all active:scale-95 disabled:opacity-50"
              >
                {savingUser ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Criando Cliente...</span>
                  </>
                ) : (
                  <>
                    <Check className="w-3.5 h-3.5" />
                    <span>Criar Cliente</span>
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* MODAL: CONCEDER NOVO ACESSO ESPECIAL / ADICIONAR MEMBRO */}
      {isGrantSpecialModalOpen && (
        <div className="fixed inset-0 z-[99999] bg-black/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
          <div className="bg-slate-900 border border-amber-500/50 w-full max-w-xl rounded-3xl shadow-2xl p-5 sm:p-6 space-y-4 animate-in fade-in my-8">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-2xl bg-amber-500/20 text-amber-400 border border-amber-500/30 flex items-center justify-center">
                  <KeyRound className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-black text-white leading-tight">
                    {grantConfirmationPending ? 'Confirmar Concessão de Acesso Especial' : 'Adicionar Membro — Acesso Especial'}
                  </h3>
                  <p className="text-[11px] text-slate-400">
                    {grantConfirmationPending ? 'Revise os dados antes de aplicar as permissões Premium' : 'Conceda acesso temporário ou vitalício aos recursos Premium'}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setIsGrantSpecialModalOpen(false);
                  setGrantConfirmationPending(false);
                }}
                className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* CONFIRMATION SCREEN */}
            {grantConfirmationPending ? (
              <div className="space-y-4 py-2 animate-in fade-in">
                <div className="p-4 rounded-2xl bg-amber-950/30 border border-amber-500/40 space-y-3">
                  <div className="flex items-center gap-2 text-amber-300 font-extrabold text-xs">
                    <ShieldCheck className="w-4 h-4 text-amber-400" />
                    <span>Resumo da Operação:</span>
                  </div>

                  <div className="text-xs space-y-2 text-slate-300">
                    <div>
                      <span className="text-slate-500 font-bold block text-[10px] uppercase">Usuário Beneficiado:</span>
                      <span className="font-extrabold text-white text-sm">
                        {grantModalClientMode === 'new' ? grantNewUserName : users.find((u) => u.uid === grantSelectedUserUid)?.name} (
                        {grantModalClientMode === 'new' ? grantNewUserEmail : users.find((u) => u.uid === grantSelectedUserUid)?.email})
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-2 pt-1">
                      <div>
                        <span className="text-slate-500 font-bold block text-[10px] uppercase">Tipo de Acesso:</span>
                        <span className="font-bold text-amber-300 uppercase">
                          {grantSaType === 'lifetime' ? '👑 Vitalício (Permanente)' : grantSaType === 'annual' ? '📅 Anual (365 Dias)' : '⏱️ Personalizado'}
                        </span>
                      </div>
                      <div>
                        <span className="text-slate-500 font-bold block text-[10px] uppercase">Período de Vigência:</span>
                        <span className="font-mono text-slate-200">
                          {grantSaType === 'lifetime' ? 'Sem expiração' : `De ${grantSaStartsAt} até ${grantSaExpiresAt || '—'}`}
                        </span>
                      </div>
                    </div>

                    <div>
                      <span className="text-slate-500 font-bold block text-[10px] uppercase">Recursos Liberados:</span>
                      <span className="font-bold text-emerald-400">
                        {grantAllFeatures ? '✓ Todos os Recursos Premium (Mapas Ilimitados, SST, Focos, Cubagem, KML/KMZ, Satélite Offline)' : 'Recursos Selecionados'}
                      </span>
                    </div>

                    <div>
                      <span className="text-slate-500 font-bold block text-[10px] uppercase">Motivo:</span>
                      <span className="font-medium text-slate-300">{grantSaReason}</span>
                    </div>
                  </div>
                </div>

                <p className="text-[11px] text-slate-400 italic">
                  * O usuário continuará pertencendo ao plano original no cadastro comercial e receberá notificação no próximo acesso.
                </p>

                <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-800">
                  <button
                    type="button"
                    onClick={() => setGrantConfirmationPending(false)}
                    disabled={savingGrantSpecial}
                    className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-750 text-slate-300 font-bold text-xs cursor-pointer"
                  >
                    Voltar / Editar
                  </button>
                  <button
                    type="button"
                    onClick={handleConfirmAndSaveSpecialAccess}
                    disabled={savingGrantSpecial}
                    className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-black text-xs cursor-pointer shadow-lg shadow-emerald-950/50 flex items-center gap-1.5 transition-all active:scale-95 disabled:opacity-50"
                  >
                    {savingGrantSpecial ? (
                      <>
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        <span>Gravando Acesso...</span>
                      </>
                    ) : (
                      <>
                        <Check className="w-3.5 h-3.5" />
                        <span>CONFIRMAR E CONCEDER ACESSO</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            ) : (
              <form onSubmit={handleInitiateGrantSpecialAccess} className="space-y-4 text-xs">
                {/* STEP 1: CLIENT SOURCE SELECTION (EXISTING OR NEW) */}
                <div>
                  <label className="block text-slate-300 font-bold mb-2 uppercase tracking-wider text-[11px]">
                    1. Seleção do Membro
                  </label>
                  <div className="grid grid-cols-2 gap-2 bg-slate-950 p-1 rounded-2xl border border-slate-800">
                    <button
                      type="button"
                      onClick={() => setGrantModalClientMode('existing')}
                      className={`py-2.5 rounded-xl font-black text-xs transition-all cursor-pointer flex items-center justify-center gap-2 ${
                        grantModalClientMode === 'existing'
                          ? 'bg-amber-500 text-slate-950 shadow-md'
                          : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      <span>● Membro Existente</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setGrantModalClientMode('new')}
                      className={`py-2.5 rounded-xl font-black text-xs transition-all cursor-pointer flex items-center justify-center gap-2 ${
                        grantModalClientMode === 'new'
                          ? 'bg-amber-500 text-slate-950 shadow-md'
                          : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      <span>+ Cadastrar Novo Membro</span>
                    </button>
                  </div>
                </div>

                {/* MODE A: SELECT EXISTING CLIENT */}
                {grantModalClientMode === 'existing' && (
                  <div className="space-y-3 p-3.5 bg-slate-950/80 rounded-2xl border border-slate-800 animate-in fade-in">
                    <div className="relative">
                      <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                      <input
                        type="text"
                        value={grantSearchQuery}
                        onChange={(e) => setGrantSearchQuery(e.target.value)}
                        placeholder="Pesquisar membro por nome ou e-mail..."
                        className="w-full bg-slate-900 border border-slate-700 rounded-xl pl-9 pr-3 py-2 text-white text-xs placeholder-slate-500 focus:outline-none focus:border-amber-500"
                      />
                    </div>

                    {/* Client Select Dropdown List */}
                    <div className="space-y-1">
                      <label className="block text-slate-400 font-bold uppercase tracking-wider text-[10px]">
                        Selecione um membro cadastrado ({users.length}):
                      </label>
                      <select
                        value={grantSelectedUserUid}
                        onChange={(e) => setGrantSelectedUserUid(e.target.value)}
                        className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2.5 text-white font-semibold text-xs focus:outline-none focus:border-amber-500 cursor-pointer"
                        required
                      >
                        <option value="">-- Escolha o usuário na lista abaixo --</option>
                        {users
                          .filter((u) => u.status !== 'blocked')
                          .filter((u) => {
                            if (!grantSearchQuery.trim()) return true;
                            const q = grantSearchQuery.toLowerCase();
                            return u.name?.toLowerCase().includes(q) || u.email?.toLowerCase().includes(q);
                          })
                          .map((u) => {
                            const isVip = hasSpecialAccessActive(u);
                            return (
                              <option key={u.uid} value={u.uid}>
                                {u.name} ({u.email}) — Plano: {(u.subscriptionPlan || 'Free').toUpperCase()} {isVip ? '★ [VIP ATIVO]' : ''}
                              </option>
                            );
                          })}
                      </select>
                    </div>
                  </div>
                )}

                {/* MODE B: CREATE NEW CLIENT DIRECTLY */}
                {grantModalClientMode === 'new' && (
                  <div className="space-y-3 p-3.5 bg-slate-950/80 rounded-2xl border border-slate-800 animate-in fade-in">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      <div>
                        <label className="block text-slate-300 font-bold mb-1 uppercase tracking-wider text-[10px]">
                          Nome Completo *
                        </label>
                        <input
                          type="text"
                          value={grantNewUserName}
                          onChange={(e) => setGrantNewUserName(e.target.value)}
                          placeholder="Ex: João Silva"
                          className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-white text-xs focus:outline-none focus:border-amber-500"
                          required={grantModalClientMode === 'new'}
                        />
                      </div>

                      <div>
                        <label className="block text-slate-300 font-bold mb-1 uppercase tracking-wider text-[10px]">
                          E-mail de Acesso *
                        </label>
                        <input
                          type="email"
                          value={grantNewUserEmail}
                          onChange={(e) => setGrantNewUserEmail(e.target.value.toLowerCase().trim())}
                          placeholder="joao@empresa.com"
                          className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-white text-xs focus:outline-none focus:border-amber-500"
                          required={grantModalClientMode === 'new'}
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      <div>
                        <label className="block text-slate-300 font-bold mb-1 uppercase tracking-wider text-[10px]">
                          Empresa / Órgão
                        </label>
                        <input
                          type="text"
                          value={grantNewUserCompany}
                          onChange={(e) => setGrantNewUserCompany(e.target.value)}
                          placeholder="Ex: Construtora / Fazenda"
                          className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-white text-xs focus:outline-none focus:border-amber-500"
                        />
                      </div>

                      <div>
                        <label className="block text-slate-300 font-bold mb-1 uppercase tracking-wider text-[10px]">
                          Plano Comercial Inicial
                        </label>
                        <select
                          value={grantNewUserPlan}
                          onChange={(e) => setGrantNewUserPlan(e.target.value as SubscriptionPlanType)}
                          className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-slate-200 text-xs focus:outline-none focus:border-amber-500"
                        >
                          <option value="free">Plano Gratuito ({formatCurrencyBRL(0)})</option>
                          {plans
                            .filter((pl) => pl.id !== 'free')
                            .map((pl) => (
                              <option key={pl.id} value={pl.id}>
                                {pl.name} ({formatCurrencyBRL(pl.price)}{pl.billingPeriod || '/mês'})
                              </option>
                            ))}
                        </select>
                      </div>
                    </div>
                  </div>
                )}

                {/* STEP 2: SPECIAL ACCESS CONFIGURATION */}
                <div className="p-3.5 bg-gradient-to-b from-amber-950/40 via-slate-950 to-slate-950 rounded-2xl border border-amber-500/40 space-y-3">
                  <div className="flex items-center gap-2 text-amber-300 font-black text-xs uppercase tracking-wider">
                    <KeyRound className="w-4 h-4 text-amber-400" />
                    <span>2. Configuração do Período & Recursos</span>
                  </div>

                  {/* Type Selection */}
                  <div className="grid grid-cols-3 gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setGrantSaType('lifetime');
                        setGrantSaExpiresAt('');
                      }}
                      className={`p-2.5 rounded-xl border font-bold text-xs text-center transition-all cursor-pointer ${
                        grantSaType === 'lifetime'
                          ? 'bg-gradient-to-r from-amber-500/30 to-yellow-500/30 border-amber-400 text-amber-200 ring-2 ring-amber-500/40 shadow-lg'
                          : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      <div className="font-black text-amber-300 text-xs">👑 Vitalício</div>
                      <div className="text-[10px] text-slate-400">Permanente</div>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setGrantSaType('annual');
                        const d = new Date();
                        d.setFullYear(d.getFullYear() + 1);
                        setGrantSaExpiresAt(d.toISOString().split('T')[0]);
                      }}
                      className={`p-2.5 rounded-xl border font-bold text-xs text-center transition-all cursor-pointer ${
                        grantSaType === 'annual'
                          ? 'bg-amber-500/20 border-amber-500 text-amber-300 ring-2 ring-amber-500/30 shadow'
                          : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      <div className="font-extrabold text-white text-xs">📅 1 Ano</div>
                      <div className="text-[10px] text-slate-400">365 dias</div>
                    </button>

                    <button
                      type="button"
                      onClick={() => setGrantSaType('custom')}
                      className={`p-2.5 rounded-xl border font-bold text-xs text-center transition-all cursor-pointer ${
                        grantSaType === 'custom'
                          ? 'bg-amber-500/20 border-amber-500 text-amber-300 ring-2 ring-amber-500/30 shadow'
                          : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      <div className="font-extrabold text-white text-xs">⏱️ Personalizado</div>
                      <div className="text-[10px] text-slate-400">Datas livres</div>
                    </button>
                  </div>

                  {/* Dates */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    <div>
                      <label className="block text-slate-300 font-bold mb-1 uppercase tracking-wider text-[10px]">
                        Data de Início
                      </label>
                      <input
                        type="date"
                        value={grantSaStartsAt}
                        onChange={(e) => setGrantSaStartsAt(e.target.value)}
                        className="w-full bg-slate-900 border border-slate-700 rounded-xl px-2.5 py-1.5 text-white font-medium focus:outline-none focus:border-amber-500 text-xs"
                        required
                      />
                    </div>

                    <div>
                      <label className="block text-slate-300 font-bold mb-1 uppercase tracking-wider text-[10px]">
                        Data de Término {grantSaType === 'lifetime' && '(Sem Expiração)'}
                      </label>
                      <input
                        type="date"
                        value={grantSaExpiresAt}
                        onChange={(e) => setGrantSaExpiresAt(e.target.value)}
                        disabled={grantSaType === 'lifetime'}
                        className="w-full bg-slate-900 border border-slate-700 rounded-xl px-2.5 py-1.5 text-white font-medium focus:outline-none focus:border-amber-500 text-xs disabled:opacity-40"
                        required={grantSaType !== 'lifetime'}
                      />
                    </div>
                  </div>

                  {/* Resources selection */}
                  <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 space-y-1.5">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={grantAllFeatures}
                        onChange={(e) => setGrantAllFeatures(e.target.checked)}
                        className="w-4 h-4 rounded text-amber-500 focus:ring-amber-500 bg-slate-900 border-slate-700"
                      />
                      <span className="font-bold text-white text-xs">☑ TODOS OS RECURSOS PREMIUM (Recomendado)</span>
                    </label>
                    <p className="text-[10px] text-slate-400 pl-6">
                      Libera mapas PDF ilimitados, vistorias SST, focos de incêndio, cubagem de madeira, KML/KMZ e satélite offline.
                    </p>
                  </div>

                  {/* Reason */}
                  <div>
                    <label className="block text-slate-300 font-bold mb-1 uppercase tracking-wider text-[10px]">
                      Motivo / Justificativa *
                    </label>
                    <input
                      type="text"
                      value={grantSaReason}
                      onChange={(e) => setGrantSaReason(e.target.value)}
                      placeholder="Ex: Demonstração VIP, Parceria Comercial, Cortesia"
                      className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-1.5 text-white text-xs focus:outline-none focus:border-amber-500"
                      required
                    />
                  </div>
                </div>

                {/* Modal Actions */}
                <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-800">
                  <button
                    type="button"
                    onClick={() => setIsGrantSpecialModalOpen(false)}
                    className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-750 text-slate-300 font-bold text-xs cursor-pointer transition-colors"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-400 hover:to-yellow-400 text-slate-950 font-black text-xs cursor-pointer shadow-lg shadow-amber-950/50 flex items-center gap-1.5 transition-all active:scale-95"
                  >
                    <Check className="w-3.5 h-3.5" />
                    <span>AVANÇAR PARA CONFIRMAÇÃO</span>
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* MODAL: SPECIAL EXCLUSIVE ACCESS */}
      {specialAccessUser && (
        <div className="fixed inset-0 z-[99999] bg-black/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4">
          <form
            onSubmit={handleSaveSpecialAccess}
            className="bg-slate-900 border border-amber-500/40 w-full max-w-lg rounded-3xl shadow-2xl p-5 sm:p-6 space-y-4 animate-in fade-in"
          >
            {/* Header */}
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-amber-500/20 text-amber-400 border border-amber-500/30 flex items-center justify-center">
                  <KeyRound className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm sm:text-base font-black text-white leading-tight flex items-center gap-1.5">
                    <span>Acesso Especial Exclusivo</span>
                    <span className="text-[10px] bg-amber-500/20 text-amber-300 px-2 py-0.2 rounded-full border border-amber-500/30">
                      VIP
                    </span>
                  </h3>
                  <p className="text-[11px] text-slate-400">
                    Conceda acesso a 100% dos recursos sem alterar a cobrança do plano comercial.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSpecialAccessUser(null)}
                className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Target User Info */}
            <div className="bg-slate-950/80 p-3 rounded-2xl border border-slate-800 flex items-center justify-between text-xs">
              <div>
                <div className="font-bold text-white text-sm">{specialAccessUser.name}</div>
                <div className="text-slate-400 text-[11px]">{specialAccessUser.email}</div>
              </div>
              <div className="text-right">
                <span className="text-[10px] uppercase font-bold text-slate-400 block">Plano Atual:</span>
                <span className="text-emerald-400 font-extrabold uppercase text-[11px]">
                  {specialAccessUser.subscriptionPlan || 'Gratuito'}
                </span>
              </div>
            </div>

            <div className="space-y-3.5 text-xs">
              {/* Question: Grant Special Access? */}
              <div>
                <label className="block text-slate-300 font-bold mb-1.5 uppercase tracking-wider text-[11px]">
                  Conceder Acesso Especial?
                </label>
                <div className="grid grid-cols-2 gap-2 bg-slate-950 p-1 rounded-xl border border-slate-700">
                  <button
                    type="button"
                    onClick={() => setSaEnabled(true)}
                    className={`py-2 rounded-lg font-black text-xs transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                      saEnabled
                        ? 'bg-amber-600 text-white shadow-md'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    <Check className="w-3.5 h-3.5" />
                    <span>Sim, Ativar Acesso</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setSaEnabled(false)}
                    className={`py-2 rounded-lg font-black text-xs transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                      !saEnabled
                        ? 'bg-slate-800 text-rose-300 shadow-md border border-rose-500/30'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    <X className="w-3.5 h-3.5" />
                    <span>Não / Revogar</span>
                  </button>
                </div>
              </div>

              {saEnabled && (
                <div className="space-y-3.5 animate-in fade-in">
                  {/* Access Type */}
                  <div>
                    <label className="block text-slate-300 font-bold mb-1.5 uppercase tracking-wider text-[11px]">
                      Tipo de Acesso Especial *
                    </label>
                    <div className="grid grid-cols-3 gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setSaType('annual');
                          const d = new Date();
                          d.setFullYear(d.getFullYear() + 1);
                          setSaExpiresAt(d.toISOString().split('T')[0]);
                        }}
                        className={`p-2.5 rounded-xl border font-bold text-xs text-center transition-all cursor-pointer ${
                          saType === 'annual'
                            ? 'bg-amber-500/20 border-amber-500 text-amber-300 ring-2 ring-amber-500/30 shadow'
                            : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200'
                        }`}
                      >
                        <div className="font-extrabold text-white text-xs">1 Ano</div>
                        <div className="text-[10px] text-slate-400 mt-0.5">365 dias</div>
                      </button>

                      <button
                        type="button"
                        onClick={() => setSaType('custom')}
                        className={`p-2.5 rounded-xl border font-bold text-xs text-center transition-all cursor-pointer ${
                          saType === 'custom'
                            ? 'bg-amber-500/20 border-amber-500 text-amber-300 ring-2 ring-amber-500/30 shadow'
                            : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200'
                        }`}
                      >
                        <div className="font-extrabold text-white text-xs">Personalizado</div>
                        <div className="text-[10px] text-slate-400 mt-0.5">Datas livres</div>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setSaType('lifetime');
                          setSaExpiresAt('');
                        }}
                        className={`p-2.5 rounded-xl border font-bold text-xs text-center transition-all cursor-pointer ${
                          saType === 'lifetime'
                            ? 'bg-gradient-to-r from-amber-500/30 to-emerald-500/30 border-amber-400 text-amber-200 ring-2 ring-amber-500/40 shadow-lg'
                            : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200'
                        }`}
                      >
                        <div className="font-extrabold text-amber-300 text-xs">👑 Vitalício</div>
                        <div className="text-[10px] text-slate-400 mt-0.5">Permanente</div>
                      </button>
                    </div>
                  </div>

                  {/* Dates */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-slate-300 font-bold mb-1 uppercase tracking-wider text-[11px]">
                        Data de Início
                      </label>
                      <input
                        type="date"
                        value={saStartsAt}
                        onChange={(e) => setSaStartsAt(e.target.value)}
                        className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white font-medium focus:outline-none focus:border-amber-500 transition-colors"
                        required
                      />
                    </div>

                    <div>
                      <label className="block text-slate-300 font-bold mb-1 uppercase tracking-wider text-[11px]">
                        Data de Término {saType === 'lifetime' && '(Sem Expiração)'}
                      </label>
                      <input
                        type="date"
                        value={saExpiresAt}
                        onChange={(e) => setSaExpiresAt(e.target.value)}
                        disabled={saType === 'lifetime'}
                        className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white font-medium focus:outline-none focus:border-amber-500 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                        required={saType !== 'lifetime'}
                      />
                    </div>
                  </div>

                  {/* Reason / Notes */}
                  <div>
                    <label className="block text-slate-300 font-bold mb-1 uppercase tracking-wider text-[11px]">
                      Motivo / Justificativa
                    </label>
                    <input
                      type="text"
                      value={saReason}
                      onChange={(e) => setSaReason(e.target.value)}
                      placeholder="EX: Cliente Parceiro, Teste Interno, Cortesia, Equipe SST"
                      className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white text-xs focus:outline-none focus:border-amber-500 transition-colors"
                    />
                  </div>

                  {/* Feature Unlocks Notice */}
                  <div className="p-3 bg-slate-950/90 rounded-2xl border border-amber-500/20 space-y-1.5">
                    <div className="text-[11px] font-bold text-amber-300 flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>Benefícios Automáticos do Acesso Especial:</span>
                    </div>
                    <ul className="grid grid-cols-2 gap-1 text-[10px] text-slate-300 font-medium">
                      <li className="flex items-center gap-1">✓ Mapas PDF Ilimitados</li>
                      <li className="flex items-center gap-1">✓ Cubagem de Madeira (m³)</li>
                      <li className="flex items-center gap-1">✓ Rondas SST & Odômetro</li>
                      <li className="flex items-center gap-1">✓ Laudos Técnicos em PDF</li>
                      <li className="flex items-center gap-1">✓ Focos de Incêndio</li>
                      <li className="flex items-center gap-1">✓ Todas as Funções Futuras</li>
                    </ul>
                  </div>
                </div>
              )}
            </div>

            {/* Actions */}
            <div className="flex items-center justify-between gap-2 pt-3 border-t border-slate-800">
              {specialAccessUser.specialAccess && specialAccessUser.specialAccess.enabled ? (
                <button
                  type="button"
                  onClick={() => handleRevokeSpecialAccess(specialAccessUser)}
                  className="px-3.5 py-2 rounded-xl bg-rose-950/60 hover:bg-rose-900/60 border border-rose-800 text-rose-300 font-bold text-xs cursor-pointer transition-colors"
                >
                  Revogar Acesso
                </button>
              ) : (
                <div />
              )}

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setSpecialAccessUser(null)}
                  className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-750 text-slate-300 font-bold text-xs cursor-pointer transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={savingSpecialAccess}
                  className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-400 hover:to-yellow-400 text-slate-950 font-black text-xs cursor-pointer shadow-lg shadow-amber-950/50 flex items-center gap-1.5 transition-all active:scale-95 disabled:opacity-50"
                >
                  {savingSpecialAccess ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>Salvando...</span>
                    </>
                  ) : (
                    <>
                      <Check className="w-3.5 h-3.5" />
                      <span>Salvar Acesso Especial</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </form>
        </div>
      )}

      {/* MODAL: CREATE COUPON */}
      {isCouponModalOpen && (
        <div className="fixed inset-0 z-[99999] bg-black/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4">
          <form
            onSubmit={handleCreateCoupon}
            className="bg-slate-900 border border-pink-500/40 w-full max-w-lg rounded-3xl shadow-2xl p-5 sm:p-6 space-y-4 animate-in fade-in"
          >
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-pink-500/20 text-pink-400 flex items-center justify-center">
                  <Tag className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm sm:text-base font-black text-white leading-tight">
                    Criar Cupom Promocional
                  </h3>
                  <p className="text-[11px] text-slate-400">Gere códigos de desconto para o checkout</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsCouponModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3.5 text-xs">
              {/* Code */}
              <div>
                <label className="block text-slate-300 font-bold mb-1 uppercase tracking-wider text-[11px]">
                  Código do Cupom *
                </label>
                <input
                  type="text"
                  value={newCouponCode}
                  onChange={(e) => setNewCouponCode(e.target.value.toUpperCase().replace(/[^A-Z0-9_-]/g, ''))}
                  placeholder="EX: PROMO20, BLACKFRIDAY, CAMPO10"
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2.5 text-white font-mono font-black tracking-wider text-sm focus:outline-none focus:border-pink-500 transition-colors"
                  required
                  autoFocus
                />
              </div>

              {/* Discount Type & Value */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 font-bold mb-1 uppercase tracking-wider text-[11px]">
                    Tipo de Desconto *
                  </label>
                  <div className="grid grid-cols-2 gap-1.5 bg-slate-950 p-1 rounded-xl border border-slate-700">
                    <button
                      type="button"
                      onClick={() => setNewCouponDiscountType('percent')}
                      className={`py-1.5 rounded-lg font-bold text-xs transition-all cursor-pointer ${
                        newCouponDiscountType === 'percent'
                          ? 'bg-pink-600 text-white shadow'
                          : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      % Porcentagem
                    </button>
                    <button
                      type="button"
                      onClick={() => setNewCouponDiscountType('fixed')}
                      className={`py-1.5 rounded-lg font-bold text-xs transition-all cursor-pointer ${
                        newCouponDiscountType === 'fixed'
                          ? 'bg-pink-600 text-white shadow'
                          : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      R$ Valor Fixo
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-slate-300 font-bold mb-1 uppercase tracking-wider text-[11px]">
                    Valor do Desconto ({newCouponDiscountType === 'percent' ? '%' : 'R$'}) *
                  </label>
                  <input
                    type="number"
                    min="1"
                    max={newCouponDiscountType === 'percent' ? 100 : 9999}
                    step={newCouponDiscountType === 'percent' ? '1' : '0.50'}
                    value={newCouponDiscount}
                    onChange={(e) => setNewCouponDiscount(Number(e.target.value))}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white font-bold text-sm focus:outline-none focus:border-pink-500 transition-colors"
                    required
                  />
                </div>
              </div>

              {/* Validity (Days) & Max Uses */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 font-bold mb-1 uppercase tracking-wider text-[11px]">
                    Validade em Dias *
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={newCouponDays}
                    onChange={(e) => setNewCouponDays(Number(e.target.value))}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white font-bold text-sm focus:outline-none focus:border-pink-500 transition-colors"
                    required
                  />
                </div>

                <div>
                  <label className="block text-slate-300 font-bold mb-1 uppercase tracking-wider text-[11px]">
                    Limite Máximo de Usos *
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={newCouponMaxUses}
                    onChange={(e) => setNewCouponMaxUses(Number(e.target.value))}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white font-bold text-sm focus:outline-none focus:border-pink-500 transition-colors"
                    required
                  />
                </div>
              </div>

              {/* Applicable Plan */}
              <div>
                <label className="block text-slate-300 font-bold mb-1 uppercase tracking-wider text-[11px]">
                  Plano Aplicável
                </label>
                <select
                  value={newCouponApplicablePlan}
                  onChange={(e) => setNewCouponApplicablePlan(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-slate-200 font-medium focus:outline-none focus:border-pink-500 transition-colors"
                >
                  <option value="all">Todos os Planos Pagos</option>
                  <option value="pro_mensal">Apenas Plano Profissional Mensal</option>
                  <option value="pro_anual">Apenas Plano Profissional Anual</option>
                </select>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setIsCouponModalOpen(false)}
                className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-750 text-slate-300 font-bold text-xs cursor-pointer transition-colors"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={savingCoupon}
                className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-pink-600 to-rose-600 hover:from-pink-500 hover:to-rose-500 text-white font-black text-xs cursor-pointer shadow-lg shadow-pink-950/50 flex items-center gap-1.5 transition-all active:scale-95 disabled:opacity-50"
              >
                {savingCoupon ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Criando Cupom...</span>
                  </>
                ) : (
                  <>
                    <Check className="w-3.5 h-3.5" />
                    <span>Criar Cupom</span>
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
