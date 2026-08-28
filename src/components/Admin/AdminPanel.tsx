import React, { useEffect, useState, useCallback } from 'react';
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
} from '../../types';
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
  const { notifySuccess, notifyError, notifyInfo, showConfirm } = useApp();

  // Navigation subtabs inside SuperAdmin
  const [adminTab, setAdminTab] = useState<
    'dashboard' | 'users' | 'subscriptions' | 'plans' | 'coupons' | 'audit_and_settings'
  >('dashboard');

  // Users State
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filterStatus, setFilterStatus] = useState<'all' | 'pending' | 'active' | 'blocked'>('all');
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
  const [planModalName, setPlanModalName] = useState('');
  const [planModalTag, setPlanModalTag] = useState('');
  const [planModalOriginalPrice, setPlanModalOriginalPrice] = useState<number>(0);
  const [planModalPrice, setPlanModalPrice] = useState<number>(0);
  const [planModalBadge, setPlanModalBadge] = useState('');
  const [planModalFeaturesText, setPlanModalFeaturesText] = useState('');
  const [savingPlanChanges, setSavingPlanChanges] = useState(false);
  const [isCreatingPlan, setIsCreatingPlan] = useState<boolean>(false);
  const [planModalActiveInShowcase, setPlanModalActiveInShowcase] = useState<boolean>(true);
  const [planModalHighlight, setPlanModalHighlight] = useState<boolean>(false);
  const [planModalPeriod, setPlanModalPeriod] = useState<string>('/mês');

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
  const [newUserPlan, setNewUserPlan] = useState<SubscriptionPlanType>('pro_mensal');
  const [newUserSubValue, setNewUserSubValue] = useState<number>(44.99);
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

    const loadBillingAndPlansConfig = async () => {
      try {
        const configDoc = await getDoc(doc(db, 'system_config', 'billing'));
        if (configDoc.exists()) {
          const data = configDoc.data() as SystemBillingConfig;
          setBillingConfig((prev) => ({ ...prev, ...data }));
          localStorage.setItem('gofield_billing_config', JSON.stringify(data));
          if (data.plans && Array.isArray(data.plans) && data.plans.length > 0) {
            setPlans(data.plans);
            localStorage.setItem('gofield_custom_plans', JSON.stringify(data.plans));
          }
        }
      } catch (e) {
        console.warn('Could not load billing config from Firestore', e);
      }
    };

    const loadCoupons = async () => {
      try {
        const couponsSnap = await getDocs(collection(db, 'coupons'));
        const couponList = couponsSnap.docs.map((d) => ({ id: d.id, ...d.data() } as PromoCoupon));
        setCoupons(couponList);
      } catch (e) {
        console.warn('Could not load coupons from Firestore', e);
      }
    };

    const loadLogs = async () => {
      setIsLoadingLogs(true);
      const logs = await fetchAdminAuditLogs();
      setAuditLogs(logs);
      setIsLoadingLogs(false);
    };

    loadBillingAndPlansConfig();
    loadCoupons();
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
      const newConfig = { ...billingConfig, plans };
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
              billingPeriod: planModalPeriod || p.billingPeriod || '/mês',
              highlight: planModalHighlight,
              activeInShowcase: planModalActiveInShowcase,
              features: updatedFeatures.length > 0 ? updatedFeatures : p.features,
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
      const updatedConfig = { ...billingConfig, plans: updatedPlans };
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

  // Create Coupon with Temporal Validity
  const handleCreateCoupon = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCouponCode.trim()) return;
    setSavingCoupon(true);
    try {
      const now = new Date();
      const expiry = new Date();
      expiry.setDate(expiry.getDate() + (newCouponDays || 30));
      const cleanCode = newCouponCode.trim().toUpperCase().replace(/\s+/g, '');

      const newCouponData: PromoCoupon = {
        id: `coupon_${cleanCode}`,
        code: cleanCode,
        discountType: newCouponDiscountType,
        discountPercent: newCouponDiscountType === 'percent' ? Number(newCouponDiscount) || 20 : undefined,
        discountFixed: newCouponDiscountType === 'fixed' ? Number(newCouponDiscount) || 15 : undefined,
        validFrom: now.toISOString().split('T')[0],
        validUntil: expiry.toISOString().split('T')[0],
        applicablePlans: newCouponApplicablePlan === 'all' ? undefined : [newCouponApplicablePlan],
        maxUses: Number(newCouponMaxUses) || 50,
        usedCount: 0,
        active: true,
        notes: `Criado em ${new Date().toLocaleDateString('pt-BR')}`,
      };

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
        reason: `Criação do cupom promocional ${cleanCode} com validade até ${newCouponData.validUntil}`,
      });

      notifySuccess('Cupom Criado com Sucesso!', `Código ${cleanCode} ativo.`);
      setIsCouponModalOpen(false);
      setNewCouponCode('');
    } catch (err: any) {
      notifyError('Erro ao Criar Cupom', 'Falha ao salvar cupom no banco.');
    } finally {
      setSavingCoupon(false);
    }
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

  // Filtered Users List
  const filteredUsers = users
    .filter((u) => {
      if (filterStatus === 'pending') return u.status === 'pending';
      if (filterStatus === 'active') return u.status === 'active';
      if (filterStatus === 'blocked') return u.status === 'blocked';
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
        <div className="grid grid-cols-2 sm:grid-cols-6 gap-2 pt-2 border-t border-slate-800/80">
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

      {/* TAB 2: CLIENTS & USERS MANAGEMENT */}
      {adminTab === 'users' && (
        <div className="space-y-4 animate-in fade-in">
          {/* Filters Bar */}
          <div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3">
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
                    return (
                      <tr key={u.uid} className="hover:bg-slate-800/40 transition-colors">
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
                              className="p-1.5 bg-rose-950/60 hover:bg-rose-800 border border-rose-500/40 text-rose-300 rounded-lg transition-all cursor-pointer"
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
                        setPlanModalOriginalPrice(p.originalPrice || p.price);
                        setPlanModalPrice(p.price);
                        setPlanModalBadge(p.discountBadge || '');
                        setPlanModalPeriod(p.billingPeriod || '/mês');
                        setPlanModalActiveInShowcase(p.activeInShowcase !== false);
                        setPlanModalFeaturesText(p.features.join('\n'));
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
      {adminTab === 'coupons' && (
        <div className="space-y-4 animate-in fade-in">
          <div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl flex items-center justify-between">
            <h3 className="text-sm font-extrabold text-white">Cupons de Desconto & Campanhas</h3>
            <button
              onClick={() => setIsCouponModalOpen(true)}
              className="bg-pink-600 hover:bg-pink-500 text-white px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-md"
            >
              <Plus className="w-4 h-4" />
              <span>Novo Cupom</span>
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
            {coupons.map((c) => (
              <div key={c.id} className="bg-slate-900 border border-slate-800 p-4 rounded-2xl shadow-lg space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-mono font-black text-sm text-pink-400 bg-pink-950/60 px-2.5 py-1 rounded-lg border border-pink-500/30">
                    {c.code}
                  </span>
                  <span className="text-xs font-bold text-emerald-400">
                    {c.discountType === 'fixed' ? `R$ ${c.discountFixed} OFF` : `${c.discountPercent}% OFF`}
                  </span>
                </div>
                <div className="text-[11px] text-slate-400 space-y-0.5">
                  <p>Válido até: {c.validUntil}</p>
                  <p>Usos: {c.usedCount || 0} / {c.maxUses}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

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

              <div className="col-span-2">
                <label className="block text-slate-400 font-bold mb-1">Benefícios (1 por linha)</label>
                <textarea
                  value={planModalFeaturesText}
                  onChange={(e) => setPlanModalFeaturesText(e.target.value)}
                  rows={4}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-white font-mono text-xs"
                />
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

      {/* MODAL: CREATE COUPON */}
      {isCouponModalOpen && (
        <div className="fixed inset-0 z-[9999] bg-black/80 backdrop-blur-sm flex items-center justify-center p-3">
          <form onSubmit={handleCreateCoupon} className="bg-slate-900 border border-pink-500/40 w-full max-w-md rounded-2xl shadow-2xl p-5 space-y-4">
            <h3 className="text-sm font-black text-white">Criar Cupom Promocional</h3>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-400 font-bold mb-1">Código do Cupom *</label>
                <input
                  type="text"
                  value={newCouponCode}
                  onChange={(e) => setNewCouponCode(e.target.value.toUpperCase())}
                  placeholder="EX: PROMO30"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white font-mono font-black"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-slate-400 font-bold mb-1">Desconto (%)</label>
                  <input
                    type="number"
                    value={newCouponDiscount}
                    onChange={(e) => setNewCouponDiscount(Number(e.target.value))}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white font-bold"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 font-bold mb-1">Validade (Dias)</label>
                  <input
                    type="number"
                    value={newCouponDays}
                    onChange={(e) => setNewCouponDays(Number(e.target.value))}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white font-bold"
                  />
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setIsCouponModalOpen(false)}
                className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 font-bold text-xs cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={savingCoupon}
                className="px-4 py-2 rounded-xl bg-pink-600 hover:bg-pink-500 text-white font-black text-xs cursor-pointer shadow-lg"
              >
                {savingCoupon ? 'Criando...' : 'Criar Cupom'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
